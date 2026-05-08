const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  name:     { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price:    { type: Number, required: true, min: 0 },
  category: { type: String, default: 'Main', trim: true },
  image:    { type: String },
  emoji:    { type: String, default: '🍽️' },
  isAvailable: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

menuItemSchema.index({ merchant: 1, category: 1, sortOrder: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
