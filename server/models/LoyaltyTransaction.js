const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },

  type: {
    type: String,
    enum: ['earn', 'redeem', 'expire', 'adjustment'],
    required: true,
  },

  safiAmount: { type: Number, required: true },
  fiatAmount: { type: Number },                    // KES that triggered earn, or discount from redeem

  // XRPL on-chain proof
  xrplTxHash: { type: String },
  xrplLedgerIndex: { type: Number },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
  },

  // ── SafiScore attestation fields ─────────────────────────────────────────
  // Written at earn-time; used by SafiScoreService for credit profile building
  safiscoreEnrolled: { type: Boolean, default: true },
  safiscoreCategory: {
    type: String,
    enum: ['food_beverage', 'grocery', 'pharmacy', 'fuel', 'retail', 'other'],
    default: 'food_beverage',
  },
  // SHA256 of the XRPL memo attestation payload — anchors off-chain record to on-chain tx
  safiscoreAttestationHash: { type: String },

  metadata: { type: mongoose.Schema.Types.Mixed },  // orderId, source, etc.
}, {
  timestamps: true,
});

loyaltyTransactionSchema.index({ customer: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ merchant: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ xrplTxHash: 1 });

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
