const express = require('express');
const WebhookService = require('../services/WebhookService');

const router = express.Router();

// ─── SafiSend Payment Webhook ─────────────────────────────────
router.post('/safisend', async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const secret = process.env.SAFISEND_WEBHOOK_SECRET;

    // Verify signature if secret is configured and signature is provided
    if (secret && signature) {
      const valid = WebhookService.verifySignature(req.body, signature, secret);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const result = await WebhookService.handleSafisendPayment(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Generic POS Webhook ──────────────────────────────────────
router.post('/generic', async (req, res, next) => {
  try {
    // Same shape as safisend — this is a generic entry point
    const result = await WebhookService.handleSafisendPayment(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
