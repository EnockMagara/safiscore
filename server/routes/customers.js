const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Customer = require('../models/Customer');
const LoyaltyService = require('../services/LoyaltyService');
const RedemptionService = require('../services/RedemptionService');

const router = express.Router();

// ─── Get Own Customer Profile ─────────────────────────────────
router.get('/me', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.user.id)
      .populate('enrolledMerchants', 'name slug xrplAddress')
      .lean();

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json({
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      xrplAddress: customer.xrplAddress,
      trustLineSet: customer.trustLineSet,
      cachedBalance: customer.cachedBalance,
      totalEarned: customer.totalEarned,
      totalRedeemed: customer.totalRedeemed,
      tier: customer.tier,
      enrolledMerchants: customer.enrolledMerchants,
      createdAt: customer.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Live Balance (queries XRPL) ─────────────────────────────
router.get('/me/balance', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const { merchantId } = req.query;
    if (!merchantId) return res.status(400).json({ error: 'merchantId query param required' });

    const balance = await LoyaltyService.getBalance(req.user.id, merchantId);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

// ─── Customer Redemption History ──────────────────────────────
router.get('/me/redemptions', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
    const redemptions = await RedemptionService.listForCustomer(req.user.id);
    res.json({ count: redemptions.length, redemptions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
