const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const SafiScoreService  = require('../services/SafiScoreService');
const ProofService      = require('../services/ProofService');
const LenderAttestation = require('../models/LenderAttestation');

const router = express.Router();

// ─── GET /api/safiscore/profile ───────────────────────────────────────────────
// Returns the authenticated customer's current credit profile.
router.get('/profile', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const profile = await SafiScoreService.getProfile(req.user.id);
    res.json({
      scoreBand:           profile.scoreBand,
      scoreBandLabel:      SafiScoreService.bandLabel(profile.scoreBand),
      scoreBreakdown:      profile.scoreBreakdown,
      monthsOfHistory:     profile.monthsOfHistory,
      totalTransactions:   profile.totalTransactions,
      uniqueMerchants:     profile.uniqueMerchants,
      averageMonthlySpend: profile.averageMonthlySpend,
      lastTransactionAt:   profile.lastTransactionAt,
      lastComputedAt:      profile.lastComputedAt,
      consentGiven:        !!profile.consentGivenAt,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/safiscore/profile/refresh ──────────────────────────────────────
// Forces a score recomputation (triggered by customer).
router.post('/profile/refresh', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const profile = await SafiScoreService.refreshProfile(req.user.id);
    res.json({
      message:        'Score refreshed',
      scoreBand:      profile.scoreBand,
      scoreBandLabel: SafiScoreService.bandLabel(profile.scoreBand),
      lastComputedAt: profile.lastComputedAt,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/safiscore/consent ──────────────────────────────────────────────
// Records explicit customer consent to use transaction data for credit scoring.
router.post('/consent', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const profile = await SafiScoreService.giveConsent(req.user.id);
    res.json({
      message:        'Consent recorded. Your credit profile is now active.',
      consentGivenAt: profile.consentGivenAt,
      scoreBand:      profile.scoreBand,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/safiscore/generate-proof ───────────────────────────────────────
// Customer authorises a time-limited attestation for a specific lender.
router.post('/generate-proof', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const { lenderIdentifier, lenderName, attributes } = req.body;
    if (!lenderIdentifier || typeof lenderIdentifier !== 'string') {
      return res.status(400).json({ error: 'lenderIdentifier is required' });
    }
    // Sanitise
    const safeLenderId = lenderIdentifier.trim().slice(0, 200);
    const safeLenderName = lenderName ? String(lenderName).trim().slice(0, 100) : undefined;

    const result = await ProofService.generateProof({
      customerId:       req.user.id,
      lenderIdentifier: safeLenderId,
      lenderName:       safeLenderName,
      attributes:       Array.isArray(attributes) ? attributes : undefined,
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.json({
      message:       'Attestation generated. Share the link with your lender.',
      attestationId: result.attestationId,
      proofHash:     result.proofHash,
      shareUrl:      `${clientUrl}/verify/${result.attestationId}`,
      expiresAt:     result.expiresAt,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/safiscore/attestations ─────────────────────────────────────────
// Lists all attestations the customer has generated.
router.get('/attestations', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const attestations = await LenderAttestation.find({ customer: req.user.id })
      .select('-proofSignature -commitmentHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ attestations });
  } catch (err) { next(err); }
});

// ─── DELETE /api/safiscore/attestations/:id ───────────────────────────────────
// Customer revokes a previously shared attestation.
router.delete('/attestations/:attestationId', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const result = await ProofService.revokeProof(req.params.attestationId, req.user.id);
    res.json({ message: 'Attestation revoked. The lender can no longer use this proof.', ...result });
  } catch (err) { next(err); }
});

// ─── GET /api/safiscore/verify/:attestationId ─────────────────────────────────
// Public endpoint — lenders call this to verify a shared attestation.
// No auth required: the attestationId is a 64-char secret derived from the customer's wallet.
router.get('/verify/:attestationId', async (req, res, next) => {
  try {
    const { attestationId } = req.params;
    if (!attestationId || !/^[a-f0-9]{64}$/.test(attestationId)) {
      return res.status(400).json({ error: 'Invalid attestation ID format' });
    }
    const result = await ProofService.verifyProof(attestationId);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
