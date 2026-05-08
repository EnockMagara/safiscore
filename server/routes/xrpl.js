const express = require('express');
const XRPLService = require('../services/XRPLService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public: XRPL connection health check
router.get('/health', async (_req, res, next) => {
  try {
    const status = await XRPLService.healthCheck();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// Authenticated: look up account info
router.get('/account/:address', authenticateToken, async (req, res, next) => {
  try {
    const info = await XRPLService.getAccountInfo(req.params.address);
    if (!info) return res.status(404).json({ error: 'Account not found on XRPL' });
    res.json(info);
  } catch (err) {
    next(err);
  }
});

// Authenticated: look up transaction by hash
router.get('/tx/:hash', authenticateToken, async (req, res, next) => {
  try {
    const tx = await XRPLService.getTransaction(req.params.hash);
    res.json(tx);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
