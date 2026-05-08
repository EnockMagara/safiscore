const crypto = require('crypto');
const SafiSendBridge = require('./SafiSendBridge');

class WebhookService {
  /**
   * Verify HMAC signature from SafiSend webhook.
   */
  static verifySignature(payload, signature, secret) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Handle a payment_completed webhook from SafiSend.
   * Routes through SafiSendBridge (V2 PendingPoints model) so all payment
   * sources — demo UI, SafiSend integration, and webhooks — follow the same
   * off-chain-first → OTP-claim → on-chain-mint path.
   */
  static async handleSafisendPayment(payload) {
    const {
      event,
      customerPhone,
      customerName,
      customerEmail,
      amount,
      restaurantId,
      orderId,
      currency = 'KES',
    } = payload;

    if (event !== 'payment_completed') {
      return { skipped: true, reason: `Unhandled event: ${event}` };
    }

    if (!customerPhone || !amount || !restaurantId) {
      throw Object.assign(
        new Error('Missing required fields: customerPhone, amount, restaurantId'),
        { statusCode: 400 },
      );
    }

    return SafiSendBridge.onPaymentCompleted({
      customerPhone,
      customerName,
      customerEmail,
      amount,
      restaurantId,
      orderId,
      currency,
    });
  }
}

module.exports = WebhookService;
