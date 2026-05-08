const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true, sparse: true },

  // XRPL wallet
  xrplAddress: { type: String, unique: true, sparse: true },
  xrplSeedEnc: { type: String, select: false },
  trustLineSet: { type: Boolean, default: false },

  // Cached balances (source of truth is XRPL, these are for fast reads)
  cachedBalance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalRedeemed: { type: Number, default: 0 },

  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze',
  },

  enrolledMerchants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' }],

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

customerSchema.index({ phone: 1 });
customerSchema.index({ xrplAddress: 1 });

module.exports = mongoose.model('Customer', customerSchema);
