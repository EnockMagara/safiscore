const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const LoyaltyService = require('../services/LoyaltyService');
const RedemptionService = require('../services/RedemptionService');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');

const router = express.Router();

// ─── Earn Points ──────────────────────────────────────────────
router.post('/earn', authenticateToken, async (req, res, next) => {
  try {
    const { merchantId, customerId, fiatAmount, metadata } = req.body;

    // Merchants can trigger earn for their customers; customers can self-report (for testing)
    const targetCustomerId = customerId || (req.user.role === 'customer' ? req.user.id : null);
    const targetMerchantId = merchantId || (req.user.role === 'merchant' ? req.user.id : null);

    if (!targetMerchantId || !targetCustomerId || !fiatAmount) {
      return res.status(400).json({ error: 'merchantId, customerId, and fiatAmount are required' });
    }

    const result = await LoyaltyService.earnPoints({
      merchantId: targetMerchantId,
      customerId: targetCustomerId,
      fiatAmount: parseFloat(fiatAmount),
      metadata,
    });

    res.json({
      message: `Earned ${result.safiAmount} SAFI`,
      ...result,
      explorerUrl: result.xrplTxHash
        ? `https://testnet.xrpl.org/transactions/${result.xrplTxHash}`
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Get Balance ──────────────────────────────────────────────
router.get('/balance', authenticateToken, async (req, res, next) => {
  try {
    const { merchantId } = req.query;
    if (!merchantId) return res.status(400).json({ error: 'merchantId query param required' });

    const customerId = req.user.role === 'customer' ? req.user.id : req.query.customerId;
    if (!customerId) return res.status(400).json({ error: 'customerId required' });

    const balance = await LoyaltyService.getBalance(customerId, merchantId);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

// ─── Initiate Redemption ──────────────────────────────────────
router.post('/redeem/initiate', authenticateToken, async (req, res, next) => {
  try {
    const { merchantId, safiAmount } = req.body;
    const customerId = req.user.role === 'customer' ? req.user.id : req.body.customerId;

    if (!merchantId || !safiAmount || !customerId) {
      return res.status(400).json({ error: 'merchantId, customerId, and safiAmount required' });
    }

    const result = await RedemptionService.initiate({
      customerId,
      merchantId,
      safiAmount: parseFloat(safiAmount),
    });

    res.json({
      message: `Redemption initiated: ${result.safiAmount} SAFI → ${result.discountAmount} KES discount`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Confirm Redemption ───────────────────────────────────────
router.post('/redeem/confirm', authenticateToken, async (req, res, next) => {
  try {
    const { code, orderId } = req.body;
    if (!code) return res.status(400).json({ error: 'Redemption code required' });

    const result = await RedemptionService.confirm({ code, orderId });

    res.json({
      message: `Redeemed ${result.safiBurned} SAFI for ${result.discountAmount} KES discount`,
      ...result,
      explorerUrl: result.xrplTxHash
        ? `https://testnet.xrpl.org/transactions/${result.xrplTxHash}`
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Transaction History ──────────────────────────────────────
router.get('/transactions', authenticateToken, async (req, res, next) => {
  try {
    const customerId = req.user.role === 'customer' ? req.user.id : req.query.customerId;
    const { merchantId, type, limit = 20 } = req.query;

    const filter = {};
    if (customerId) filter.customer = customerId;
    if (merchantId) filter.merchant = merchantId;
    if (type) filter.type = type;

    const transactions = await LoyaltyTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('merchant', 'name slug')
      .lean();

    const withExplorer = transactions.map(tx => ({
      ...tx,
      explorerUrl: tx.xrplTxHash
        ? `https://testnet.xrpl.org/transactions/${tx.xrplTxHash}`
        : null,
    }));

    res.json({ count: withExplorer.length, transactions: withExplorer });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
