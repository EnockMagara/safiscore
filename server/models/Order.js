const mongoose = require('mongoose');
const crypto = require('crypto');

const orderSchema = new mongoose.Schema({
  merchant:    { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  orderNumber: { type: String, unique: true },

  customerPhone: { type: String, required: true, trim: true },
  customerName:  { type: String, trim: true },

  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name:     String,
    price:    Number,
    quantity: { type: Number, default: 1 },
  }],

  subtotal:  { type: Number, required: true },
  total:     { type: Number, required: true },
  currency:  { type: String, default: 'AED' },

  status: {
    type: String,
    enum: ['pending', 'paid', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  },

  // Payment simulation
  paymentMethod: { type: String, enum: ['cash', 'mpesa', 'card', 'simulated'], default: 'simulated' },
  paidAt: { type: Date },

  // SafiPoints earn tracking
  safiEarned: { type: Number, default: 0 },
  pendingPointsId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingPoints' },
}, { timestamps: true });

orderSchema.pre('save', function (next) {
  if (this.isNew && !this.orderNumber) {
    this.orderNumber = `SP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
