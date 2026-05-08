const mongoose = require('mongoose');

const redemptionRequestSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },

  safiAmount: { type: Number, required: true },
  discountAmount: { type: Number, required: true },

  code: { type: String, unique: true },
  xrplTxHash: { type: String },

  status: {
    type: String,
    enum: ['pending', 'applied', 'expired', 'cancelled'],
    default: 'pending',
  },

  expiresAt: { type: Date, required: true },
  appliedToOrderId: { type: String },
}, {
  timestamps: true,
});

redemptionRequestSchema.index({ code: 1 });
redemptionRequestSchema.index({ customer: 1, status: 1 });

module.exports = mongoose.model('RedemptionRequest', redemptionRequestSchema);
