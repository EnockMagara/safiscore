const express = require('express');
const SafiSendBridge = require('../services/SafiSendBridge');

const router = express.Router();

/**
 * SafiSend Integration API
 *
 * These endpoints are designed to be called FROM SafiSend's backend or
 * embedded in SafiSend's checkout modal via client-side calls.
 */

// ─── Earn: called after SafiSend payment succeeds ─────────────
router.post('/earn', async (req, res, next) => {
  try {
    const result = await SafiSendBridge.onPaymentCompleted(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Status: check if customer is enrolled + balance ──────────
router.get('/status', async (req, res, next) => {
  try {
    const { phone, merchantId } = req.query;
    if (!phone || !merchantId) {
      return res.status(400).json({ error: 'phone and merchantId are required' });
    }
    const status = await SafiSendBridge.getCustomerStatus(phone, merchantId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// ─── Calculate: preview discount before checkout ──────────────
router.post('/calculate-discount', async (req, res, next) => {
  try {
    const { customerPhone, merchantId, pointsToRedeem, orderAmount } = req.body;
    const result = await SafiSendBridge.calculateDiscount({
      customerPhone, merchantId, pointsToRedeem, orderAmount,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Apply: burn tokens at checkout ───────────────────────────
router.post('/apply-discount', async (req, res, next) => {
  try {
    const { customerPhone, merchantId, pointsToUse, orderId } = req.body;
    const result = await SafiSendBridge.applyCheckoutDiscount({
      customerPhone, merchantId, pointsToUse, orderId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Claim: customer taps SMS link, verifies OTP, mints SAFI ─
// GET  /api/integration/claim/:pendingId      — get claim info (balance preview)
// POST /api/integration/claim/:pendingId      — submit OTP and mint
router.get('/claim/:pendingId', async (req, res, next) => {
  try {
    const PendingPoints = require('../models/PendingPoints');
    const pending = await PendingPoints.findById(req.params.pendingId)
      .populate('merchant', 'name earnRate');
    if (!pending) return res.status(404).json({ error: 'Claim link not found or expired' });

    const digits = (pending.phone || '').replace(/\D/g, '');

    res.json({
      pendingId: pending._id,
      safiAmount: pending.safiAmount,
      kshCashback: pending.kshCashback,
      merchantName: pending.merchant?.name,
      earnRate: pending.earnRate,
      status: pending.status,
      isClaimable: pending.isClaimable,
      claimWindowExpiresAt: pending.claimWindowExpiresAt,
      expiresAt: pending.expiresAt,
      prototypeClaimMode: SafiSendBridge.isPrototypeClaimOtp(),
      orderPhoneLast4: digits.length >= 4 ? digits.slice(-4) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/claim/:pendingId', async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'phone and otp are required' });
    }
    const result = await SafiSendBridge.claimPendingPoints({
      pendingId: req.params.pendingId,
      phone,
      otp,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Pending: list all unclaimed points for a phone number ───
router.get('/pending', async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const PendingPoints = require('../models/PendingPoints');
    const points = await PendingPoints.find({ phone, status: 'pending' })
      .populate('merchant', 'name')
      .sort({ earnedAt: -1 });

    const totalSafi = points.reduce((sum, p) => sum + p.safiAmount, 0);
    const totalKsh  = points.reduce((sum, p) => sum + parseFloat(p.kshCashback), 0);

    res.json({
      phone,
      pendingCount: points.length,
      totalSafi,
      totalKsh: totalKsh.toFixed(2),
      points: points.map(p => ({
        id: p._id,
        safiAmount: p.safiAmount,
        kshCashback: p.kshCashback,
        merchantName: p.merchant?.name,
        earnedAt: p.earnedAt,
        claimWindowExpiresAt: p.claimWindowExpiresAt,
        isClaimable: p.isClaimable,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
