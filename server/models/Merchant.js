const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, trim: true },

  // XRPL issuer wallet for this merchant
  xrplAddress: { type: String, unique: true, sparse: true },
  xrplSeedEnc: { type: String, select: false },

  // Loyalty config
  earnRate: { type: Number, default: 0.10 },       // 10% of fiat spend → SAFI
  minRedemption: { type: Number, default: 50 },     // minimum SAFI to redeem
  redemptionRate: { type: Number, default: 0.10 },  // 1 SAFI = 0.10 KES discount

  isActive: { type: Boolean, default: true },

  // SafiSend reference (optional)
  safisendRestaurantId: { type: String, sparse: true },
}, {
  timestamps: true,
});

merchantSchema.index({ slug: 1 });

module.exports = mongoose.model('Merchant', merchantSchema);
