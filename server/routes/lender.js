/**
 * Lender verification portal API.
 *
 * Auth: API-key header  →  X-SafiScore-Key: <key>
 *
 * For v1, a single LENDER_API_KEY env var gates all lender routes.
 * Phase 2: replace with per-lender key table in MongoDB.
 */

const express = require('express');
const ProofService      = require('../services/ProofService');
const LenderAttestation = require('../models/LenderAttestation');

const router = express.Router();

// ── Lender API-key middleware ─────────────────────────────────────────────────
function requireLenderKey(req, res, next) {
  const key = req.headers['x-safiscore-key'];
  const expected = process.env.LENDER_API_KEY;
  if (!expected) {
    // If LENDER_API_KEY is not configured, lender routes are open (dev mode only)
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Lender API not configured' });
    }
    return next();
  }
  if (!key || key !== expected) {
    return res.status(401).json({ error: 'Invalid or missing X-SafiScore-Key header' });
  }
  next();
}

// ─── GET /api/lender/verify/:attestationId ────────────────────────────────────
// Core verification endpoint — returns score details for a shared attestation.
router.get('/verify/:attestationId', requireLenderKey, async (req, res, next) => {
  try {
    const { attestationId } = req.params;
    if (!attestationId || !/^[a-f0-9]{64}$/.test(attestationId)) {
      return res.status(400).json({ error: 'Invalid attestation ID format' });
    }
    const result = await ProofService.verifyProof(attestationId);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET /api/lender/attestations ─────────────────────────────────────────────
// Lists active (non-expired, non-revoked) attestations issued to this lender.
// Lender is identified by their domain / identifier passed as query param.
router.get('/attestations', requireLenderKey, async (req, res, next) => {
  try {
    const { lender, page = 1, limit = 20 } = req.query;
    if (!lender) return res.status(400).json({ error: 'lender query param is required' });

    const safePage  = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = {
      lenderIdentifier: lender,
      revoked:          false,
      expiresAt:        { $gt: new Date() },
    };

    const [attestations, total] = await Promise.all([
      LenderAttestation.find(query)
        .select('attestationId scoreBand monthsOfHistory merchantDiversity spendBand freshnessScore issuedAt expiresAt customerXrplWallet')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      LenderAttestation.countDocuments(query),
    ]);

    res.json({
      total,
      page:  safePage,
      pages: Math.ceil(total / safeLimit),
      attestations: attestations.map(a => ({
        ...a,
        scoreBandLabel: (['', 'Insufficient', 'Thin', 'Moderate', 'Good', 'Excellent'])[a.scoreBand] || 'Unknown',
      })),
    });
  } catch (err) { next(err); }
});

// ─── GET /api/lender/health ───────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ service: 'SafiScore Lender API', status: 'ok', version: '1.0' });
});

module.exports = router;
