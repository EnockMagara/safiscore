const crypto = require('crypto');
const Merchant = require('../models/Merchant');
const Customer = require('../models/Customer');
const RedemptionRequest = require('../models/RedemptionRequest');
const TokenService = require('./TokenService');

const REDEMPTION_WINDOW_MINUTES = 15;

class RedemptionService {
  /**
   * Initiate a redemption: validate balance, create a short-lived redemption code.
   * Does NOT burn tokens yet — that happens on confirm.
   */
  static async initiate({ customerId, merchantId, safiAmount }) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw Object.assign(new Error('Merchant not found'), { statusCode: 404 });

    const customer = await Customer.findById(customerId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

    if (safiAmount < merchant.minRedemption) {
      throw Object.assign(
        new Error(`Minimum redemption is ${merchant.minRedemption} SAFI`),
        { statusCode: 400 },
      );
    }

    const liveBalance = await TokenService.getLiveBalance(
      customer.xrplAddress,
      merchant.xrplAddress,
    );
    if (liveBalance < safiAmount) {
      throw Object.assign(
        new Error(`Insufficient balance. Have ${liveBalance} SAFI, need ${safiAmount}`),
        { statusCode: 400 },
      );
    }

    const discountAmount = Math.round(safiAmount * merchant.redemptionRate * 100) / 100;
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + REDEMPTION_WINDOW_MINUTES * 60 * 1000);

    const request = await RedemptionRequest.create({
      customer: customer._id,
      merchant: merchant._id,
      safiAmount,
      discountAmount,
      code,
      expiresAt,
      status: 'pending',
    });

    return {
      redemptionId: request._id,
      code,
      safiAmount,
      discountAmount,
      currency: 'KES',
      expiresAt,
      expiresInMinutes: REDEMPTION_WINDOW_MINUTES,
    };
  }

  /**
   * Confirm a redemption by code: burns tokens on XRPL and marks as applied.
   */
  static async confirm({ code, orderId }) {
    const request = await RedemptionRequest.findOne({ code, status: 'pending' });
    if (!request) {
      throw Object.assign(new Error('Redemption code not found or already used'), { statusCode: 404 });
    }

    if (new Date() > request.expiresAt) {
      request.status = 'expired';
      await request.save();
      throw Object.assign(new Error('Redemption code expired'), { statusCode: 410 });
    }

    const merchant = await Merchant.findById(request.merchant).select('+xrplSeedEnc');
    const customer = await Customer.findById(request.customer).select('+xrplSeedEnc');

    const burnResult = await TokenService.burnTokens({
      merchant,
      customer,
      amount: request.safiAmount,
      metadata: { redemptionCode: code, orderId },
    });

    request.status = 'applied';
    request.xrplTxHash = burnResult.xrplTxHash;
    request.appliedToOrderId = orderId || null;
    await request.save();

    return {
      redemptionId: request._id,
      code,
      status: 'applied',
      safiBurned: request.safiAmount,
      discountAmount: request.discountAmount,
      xrplTxHash: burnResult.xrplTxHash,
      newBalance: burnResult.newBalance,
    };
  }

  /**
   * List redemptions for a customer.
   */
  static async listForCustomer(customerId, limit = 20) {
    return RedemptionRequest.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('merchant', 'name slug')
      .lean();
  }
}

module.exports = RedemptionService;
