const mongoose = require('mongoose');

/**
 * PendingPoints — Phase 1 of the V2 earn flow.
 *
 * When a customer pays at a SafiSend restaurant, SAFI is NOT immediately minted.
 * Instead, a PendingPoints record is created. The customer receives an SMS and
 * has up to CLAIM_WINDOW_DAYS to claim them to a real XRPL wallet.
 * After EXPIRY_DAYS, unclaimed points expire entirely.
 *
 * The earnRate is LOCKED at earn time so that early adopters are rewarded —
 * even if the global rate changes, the customer redeems at the rate they earned.
 */

const CLAIM_WINDOW_DAYS = 180;  // 6 months to claim to wallet
const EXPIRY_DAYS       = 365;  // 1 year until points expire

const pendingPointsSchema = new mongoose.Schema({
  // Customer identity at Phase 1 — only phone is required (no wallet yet)
  phone: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  email: { type: String, trim: true },

  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true,
  },

  // The earn event
  safiAmount: { type: Number, required: true, min: 0 },
  fiatAmount: { type: Number, required: true },

  // Rate locked at earn time — 1 SAFI = earnRate AED
  // This is what the customer redeems at regardless of future global rate changes.
  earnRate: { type: Number, required: true },

  // Multiplier applied (e.g. 1.2 for early adopters, 1.5 for double-points day)
  rateMultiplier: { type: Number, default: 1.0 },

  // SafiSend reference for idempotency — prevents double-awarding for same order
  orderId: { type: String, required: true, index: true },

  // Claim tracking
  status: {
    type: String,
    enum: ['pending', 'claimed', 'expired'],
    default: 'pending',
    index: true,
  },

  claimToken: { type: String, index: true },         // short-lived token sent in SMS
  claimTokenExpiry: { type: Date },                  // OTP window (15 min)

  claimedAt: { type: Date },
  claimedToAddress: { type: String },                // XRPL address after claim
  xrplTxHash: { type: String },                      // on-chain mint tx

  // SMS reminders
  smsSentAt: { type: Date },
  reminderSentAt: { type: Date },                    // 5-month reminder
  finalReminderSentAt: { type: Date },               // 11-month reminder

  // Expiry windows — defaults computed from earnedAt
  claimWindowExpiresAt: {
    type: Date,
    default: function () {
      const base = this.earnedAt || new Date();
      return new Date(base.getTime() + CLAIM_WINDOW_DAYS * 86400 * 1000);
    },
  },
  expiresAt: {
    type: Date,
    default: function () {
      const base = this.earnedAt || new Date();
      return new Date(base.getTime() + EXPIRY_DAYS * 86400 * 1000);
    },
  },

  earnedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Compound index: one record per order+merchant (idempotency)
pendingPointsSchema.index({ orderId: 1, merchant: 1 }, { unique: true });

pendingPointsSchema.virtual('aedCashback').get(function () {
  return (this.safiAmount * this.earnRate).toFixed(2);
});

pendingPointsSchema.virtual('isClaimable').get(function () {
  return this.status === 'pending' && new Date() < this.claimWindowExpiresAt;
});

pendingPointsSchema.virtual('isExpired').get(function () {
  return this.status !== 'claimed' && new Date() >= this.expiresAt;
});

pendingPointsSchema.set('toJSON', { virtuals: true });

// Auto-mark as expired on load if past expiresAt and not yet claimed.
// This keeps DB status accurate without a separate cron job.
pendingPointsSchema.post('find', function (docs) {
  const now = new Date();
  const toExpire = docs.filter(d => d.status === 'pending' && d.expiresAt && now >= d.expiresAt);
  if (toExpire.length) {
    const ids = toExpire.map(d => d._id);
    mongoose.model('PendingPoints').updateMany({ _id: { $in: ids } }, { status: 'expired' }).exec();
    toExpire.forEach(d => { d.status = 'expired'; });
  }
});

pendingPointsSchema.post('findOne', function (doc) {
  if (doc && doc.status === 'pending' && doc.expiresAt && new Date() >= doc.expiresAt) {
    doc.status = 'expired';
    mongoose.model('PendingPoints').updateOne({ _id: doc._id }, { status: 'expired' }).exec();
  }
});

module.exports = mongoose.model('PendingPoints', pendingPointsSchema);
module.exports.CLAIM_WINDOW_DAYS = CLAIM_WINDOW_DAYS;
module.exports.EXPIRY_DAYS       = EXPIRY_DAYS;
