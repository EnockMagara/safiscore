const mongoose = require('mongoose');

const lenderAttestationSchema = new mongoose.Schema({
  // 64-char hex — SHA256 of (customerXrpl + lenderIdentifier + issuedAt)
  attestationId: { type: String, required: true, unique: true },

  customer:           { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerXrplWallet: { type: String, required: true },

  lenderName:       { type: String },
  lenderIdentifier: { type: String, required: true }, // lender's ID / domain / wallet addr

  // ── Public statement — no raw transaction data ───────────────────────────
  scoreBand:          { type: Number, required: true },
  monthsOfHistory:    { type: Number },
  merchantDiversity:  { type: Number },   // unique merchant count
  freshnessScore:     { type: Number },   // days since last tx
  averageMonthlySpend:{ type: String },   // spend band: low | medium | high | very_high

  // ── Cryptographic proof ───────────────────────────────────────────────────
  commitmentHash: { type: String, required: true }, // SHA256 of sorted XRPL tx hashes
  proofSignature: { type: String, required: true }, // HMAC-SHA256 of signed statement
  proofHash:      { type: String, required: true }, // SHA256(proofSignature + statement)

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  issuedAt:     { type: Date, default: Date.now },
  expiresAt:    { type: Date, required: true },
  revoked:      { type: Boolean, default: false },
  revokedAt:    { type: Date },
  revokeReason: { type: String },
}, {
  timestamps: true,
});

lenderAttestationSchema.index({ attestationId: 1 });
lenderAttestationSchema.index({ customer: 1 });
lenderAttestationSchema.index({ lenderIdentifier: 1 });
lenderAttestationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('LenderAttestation', lenderAttestationSchema);
