const mongoose = require('mongoose');

const creditProfileSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    unique: true,
  },
  customerXrplWallet: { type: String, required: true },

  // ── Cached score (recomputed via SafiScoreService.refreshProfile) ─────────
  scoreBand: { type: Number, min: 1, max: 5, default: 1 },
  scoreBreakdown: {
    recency:     { type: Number, default: 0 }, // 0–100 component scores
    consistency: { type: Number, default: 0 },
    depth:       { type: Number, default: 0 },
    diversity:   { type: Number, default: 0 },
    volumeTrend: { type: Number, default: 0 },
    overall:     { type: Number, default: 0 }, // weighted 0–100
  },

  // ── Aggregates (refreshed alongside score) ────────────────────────────────
  monthsOfHistory:     { type: Number, default: 0 },
  totalTransactions:   { type: Number, default: 0 },
  uniqueMerchants:     { type: Number, default: 0 },
  averageMonthlySpend: { type: Number, default: 0 }, // KES
  lastTransactionAt:   { type: Date },
  lastComputedAt:      { type: Date },

  // ── Consent & compliance ──────────────────────────────────────────────────
  consentGivenAt:        { type: Date },
  dataDeletionRequested: { type: Boolean, default: false },
}, {
  timestamps: true,
});

creditProfileSchema.index({ customerXrplWallet: 1 });

module.exports = mongoose.model('CreditProfile', creditProfileSchema);
