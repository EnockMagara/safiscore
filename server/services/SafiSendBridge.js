const crypto = require('crypto');
const { normalizePhone } = require('../utils/phone');
const Customer = require('../models/Customer');
const Merchant = require('../models/Merchant');
const PendingPoints = require('../models/PendingPoints');
const LoyaltyService = require('./LoyaltyService');
const TokenService = require('./TokenService');
const WalletService = require('./WalletService');
const XRPLService = require('./XRPLService');

/**
 * SafiSendBridge — V2
 *
 * V2 introduces the Soft Account model:
 *
 *   Phase 1 (onPaymentCompleted):
 *     Points are NOT immediately minted on XRPL.
 *     A PendingPoints record is created. Customer gets an SMS.
 *     No wallet, no keys, no on-chain transaction.
 *
 *   Phase 2 (claimPendingPoints):
 *     Customer taps SMS link, verifies OTP.
 *     SafiPoints creates XRPL wallet + mints SAFI.
 *     Rate is locked at the earn-time rate stored in PendingPoints.
 *
 *   Phase 3 (applyCheckoutDiscount):
 *     Customer redeems claimed SAFI at checkout.
 *     Tokens burned on-chain at the locked rate.
 */
class SafiSendBridge {
  static normalizePhone(p) {
    return normalizePhone(p);
  }

  /** True when claim accepts any 6-digit OTP (local / demo). Set CLAIM_PROTOTYPE_ANY_OTP=false to force real SMS OTP even in development. */
  static isPrototypeClaimOtp() {
    if (process.env.CLAIM_PROTOTYPE_ANY_OTP === 'false') return false;
    if (process.env.CLAIM_PROTOTYPE_ANY_OTP === 'true') return true;
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Handle a completed payment from SafiSend.
   * Creates a PendingPoints record (Phase 1 — no XRPL tx yet).
   */
  static async onPaymentCompleted({
    customerPhone,
    customerName,
    customerEmail,
    amount,
    restaurantId,
    orderId,
    currency = 'KES',
  }) {
    const merchant = await this.resolveMerchant(restaurantId);
    if (!merchant) {
      return { enrolled: false, reason: `No SafiPoints merchant linked to restaurant ${restaurantId}` };
    }

    // Idempotency: one PendingPoints per order per merchant
    const existing = await PendingPoints.findOne({ orderId, merchant: merchant._id });
    if (existing) {
      return {
        enrolled: true,
        alreadyProcessed: true,
        safiEarned: existing.safiAmount,
        status: existing.status,
      };
    }

    // Calculate SAFI — use customer's current tier if they already have an account
    const existingCustomer = await Customer.findOne({ phone: customerPhone });
    const tier = existingCustomer?.tier || 'bronze';
    const safiAmount = LoyaltyService.calculateEarn(amount, merchant.earnRate, tier);

    if (safiAmount <= 0) {
      return { enrolled: false, reason: 'Earn amount below minimum' };
    }

    // Create PendingPoints record (off-chain, Phase 1)
    const pending = await PendingPoints.create({
      phone: customerPhone,
      email: customerEmail,
      merchant: merchant._id,
      safiAmount,
      fiatAmount: amount,
      earnRate: merchant.earnRate,
      rateMultiplier: LoyaltyService.getMultiplier(tier),
      orderId,
    });

    // Send claim SMS (Africa's Talking / Twilio — stubbed, hook up real provider)
    await this.sendClaimSMS({ phone: customerPhone, safiAmount, merchantName: merchant.name, pendingId: pending._id });

    return {
      enrolled: true,
      processed: true,
      customerPhone,
      safiPending: safiAmount,
      kshCashback: pending.kshCashback,
      claimWindowExpiresAt: pending.claimWindowExpiresAt,
      message: `${safiAmount} SAFI pending — claim SMS sent to ${customerPhone}`,
    };
  }

  /**
   * Phase 2: Customer taps SMS link with their OTP.
   * Verifies OTP, creates XRPL wallet if needed, mints SAFI on-chain.
   * Rate used is the rate locked in the PendingPoints record.
   */
  static async claimPendingPoints({ pendingId, phone, otp }) {
    const pending = await PendingPoints.findById(pendingId);
    if (!pending) throw Object.assign(new Error('Claim link not found'), { statusCode: 404 });
    const normalizedPhone = this.normalizePhone(phone);
    const pendingNorm = this.normalizePhone(pending.phone);
    if (!normalizedPhone || normalizedPhone !== pendingNorm) {
      throw Object.assign(
        new Error('Use the same phone number you entered when you placed the order.'),
        { statusCode: 403 },
      );
    }
    if (pending.status !== 'pending') throw Object.assign(new Error(`Points already ${pending.status}`), { statusCode: 409 });
    if (!pending.isClaimable) throw Object.assign(new Error('Claim window has expired'), { statusCode: 410 });

    const otpDigits = String(otp || '').replace(/\D/g, '').slice(0, 6);
    const prototypeOtp = this.isPrototypeClaimOtp();
    if (prototypeOtp) {
      if (!/^\d{6}$/.test(otpDigits)) {
        throw Object.assign(new Error('Enter any 6-digit code'), { statusCode: 400 });
      }
    } else {
      if (!pending.claimToken || pending.claimToken !== String(otp).trim()) {
        throw Object.assign(new Error('Invalid or expired OTP'), { statusCode: 401 });
      }
      if (pending.claimTokenExpiry && new Date() > pending.claimTokenExpiry) {
        throw Object.assign(new Error('OTP expired — request a new claim link'), { statusCode: 401 });
      }
    }

    const merchant = await Merchant.findById(pending.merchant).select('+xrplSeedEnc');
    if (!merchant) throw Object.assign(new Error('Merchant not found'), { statusCode: 404 });

    // Resolve or create customer account (store normalized phone for new signups)
    let customer = await Customer.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: phone.trim() },
        { phone: pending.phone },
      ],
    }).select('+xrplSeedEnc');
    if (!customer) {
      // Create a full account and XRPL wallet now (customer has consented)
      const walletData = await WalletService.createCustomerWallet(merchant.xrplAddress);
      customer = await Customer.create({
        phone: normalizedPhone,
        email: pending.email,
        name: 'SafiPoints Customer',
        xrplAddress: walletData.address,
        xrplSeedEnc: walletData.seedEnc,
        trustLineSet: walletData.trustLineSet,
        enrolledMerchants: [merchant._id],
      });
    } else if (!customer.enrolledMerchants.map(String).includes(String(merchant._id))) {
      // Existing customer, new merchant — must establish a trust line before minting
      const wallet = WalletService.restoreWallet(customer.xrplSeedEnc);
      const trustResult = await XRPLService.setTrustLine(wallet, merchant.xrplAddress);
      if (!trustResult.success) {
        throw Object.assign(
          new Error(`Failed to set XRPL trust line to merchant issuer: ${trustResult.resultCode}`),
          { statusCode: 500 },
        );
      }
      customer.enrolledMerchants.push(merchant._id);
      await customer.save();
    }

    // Mint SAFI using the LOCKED earn rate from PendingPoints
    const result = await TokenService.issueTokens({
      merchant,
      customer,
      amount: pending.safiAmount,
      fiatAmount: pending.fiatAmount,
      metadata: {
        source: 'claim',
        orderId: pending.orderId,
        earnRate: pending.earnRate,
        rateMultiplier: pending.rateMultiplier,
      },
    });

    // Mark claimed
    pending.status = 'claimed';
    pending.claimedAt = new Date();
    pending.claimedToAddress = customer.xrplAddress;
    pending.xrplTxHash = result.xrplTxHash;
    await pending.save();

    return {
      claimed: true,
      safiMinted: pending.safiAmount,
      kshCashback: pending.kshCashback,
      xrplAddress: customer.xrplAddress,
      xrplTxHash: result.xrplTxHash,
      explorerUrl: `https://testnet.xrpl.org/transactions/${result.xrplTxHash}`,
      earnRate: pending.earnRate,
      expiresAt: pending.expiresAt,
    };
  }

  /**
   * Calculate available discount for checkout.
   * Also shows pending (unclaimed) points as a nudge to claim.
   */
  static async calculateDiscount({ customerPhone, merchantId, pointsToRedeem, orderAmount }) {
    const merchant = await this.resolveMerchant(merchantId);
    if (!merchant) return { available: false, reason: 'Merchant not on SafiPoints' };

    // Show pending points as a nudge even if not yet claimed
    const pendingTotal = await PendingPoints.aggregate([
      { $match: { phone: customerPhone, merchant: merchant._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$safiAmount' } } },
    ]);
    const pendingCount = pendingTotal[0]?.total || 0;

    const customer = await Customer.findOne({ phone: customerPhone });
    if (!customer) {
      return {
        available: false,
        pendingSafi: pendingCount,
        pendingKsh: (pendingCount * merchant.earnRate).toFixed(2),
        reason: 'Points not yet claimed to wallet',
        claimUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/claim`,
      };
    }

    const liveBalance = await TokenService.getLiveBalance(customer.xrplAddress, merchant.xrplAddress);

    if (liveBalance < merchant.minRedemption) {
      return {
        available: false,
        balance: liveBalance,
        pendingSafi: pendingCount,
        minRequired: merchant.minRedemption,
        reason: `Need at least ${merchant.minRedemption} SAFI to redeem`,
      };
    }

    const redeemable = pointsToRedeem ? Math.min(pointsToRedeem, liveBalance) : liveBalance;
    const discountAmount = Math.round(redeemable * merchant.redemptionRate * 100) / 100;
    const maxDiscount = orderAmount * 0.5;
    const actualDiscount = Math.min(discountAmount, maxDiscount);
    const actualPoints = Math.ceil(actualDiscount / merchant.redemptionRate);

    return {
      available: true,
      balance: liveBalance,
      pendingSafi: pendingCount,
      pointsToUse: actualPoints,
      discountAmount: actualDiscount,
      currency: 'KES',
      maxDiscountPercent: 50,
      tier: customer.tier,
    };
  }

  /**
   * Apply SAFI discount at SafiSend checkout (burns on-chain).
   */
  static async applyCheckoutDiscount({ customerPhone, merchantId, pointsToUse, orderId }) {
    const merchant = await this.resolveMerchant(merchantId, { selectSeed: true });
    if (!merchant) throw Object.assign(new Error('Merchant not found'), { statusCode: 404 });

    const customer = await Customer.findOne({ phone: customerPhone }).select('+xrplSeedEnc');
    if (!customer) throw Object.assign(new Error('Customer not found — please claim points first'), { statusCode: 404 });

    const discountAmount = Math.round(pointsToUse * merchant.redemptionRate * 100) / 100;

    const burnResult = await TokenService.burnTokens({
      merchant,
      customer,
      amount: pointsToUse,
      metadata: { source: 'safisend_checkout', orderId },
    });

    return {
      applied: true,
      pointsBurned: pointsToUse,
      discountAmount,
      currency: 'KES',
      xrplTxHash: burnResult.xrplTxHash,
      newBalance: burnResult.newBalance,
      explorerUrl: `https://testnet.xrpl.org/transactions/${burnResult.xrplTxHash}`,
    };
  }

  /**
   * Get a customer's SafiPoints status (claimed + pending) for SafiSend UI.
   */
  static async getCustomerStatus(customerPhone, merchantId) {
    const merchant = await this.resolveMerchant(merchantId);
    if (!merchant) return { enrolled: false };

    const pendingAgg = await PendingPoints.aggregate([
      { $match: { phone: customerPhone, merchant: merchant._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$safiAmount' } } },
    ]);
    const pendingSafi = pendingAgg[0]?.total || 0;

    const customer = await Customer.findOne({ phone: customerPhone });
    if (!customer) {
      return {
        enrolled: false,
        pendingSafi,
        pendingKsh: (pendingSafi * merchant.earnRate).toFixed(2),
        message: pendingSafi > 0 ? `You have ${pendingSafi} SAFI pending — claim them!` : null,
      };
    }

    const balance = await TokenService.getLiveBalance(customer.xrplAddress, merchant.xrplAddress);

    return {
      enrolled: true,
      customerId: customer._id,
      name: customer.name,
      xrplAddress: customer.xrplAddress,
      balance,
      pendingSafi,
      tier: customer.tier,
      totalEarned: customer.totalEarned,
      minRedemption: merchant.minRedemption,
      canRedeem: balance >= merchant.minRedemption,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Resolve merchant by SafiSend restaurant ID or internal ObjectId.
   * Bug fix: previous implementation chained on un-awaited Mongoose Query objects.
   */
  static async resolveMerchant(id, { selectSeed = false } = {}) {
    const projection = selectSeed ? '+xrplSeedEnc' : '';
    let merchant = null;
    try {
      merchant = await Merchant.findById(id).select(projection);
    } catch (_) {
      // id may not be a valid ObjectId — fall through to safisendRestaurantId lookup
    }
    if (!merchant) {
      merchant = await Merchant.findOne({ safisendRestaurantId: id }).select(projection);
    }
    return merchant;
  }

  /**
   * Send claim SMS to customer.
   * Generates a 6-digit OTP with a 15-minute window and stores it on the PendingPoints record.
   * Swap the console.log for Africa's Talking / Twilio in production.
   */
  static async sendClaimSMS({ phone, safiAmount, merchantName, pendingId }) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await PendingPoints.findByIdAndUpdate(pendingId, {
      claimToken: otp,
      claimTokenExpiry: expiry,
      smsSentAt: new Date(),
    });

    const claimUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/claim/${pendingId}`;
    const message = `You earned ${safiAmount} SAFI (KES ${(safiAmount * 0.1).toFixed(0)} cashback) at ${merchantName}! Claim within 6 months: ${claimUrl}  OTP: ${otp}`;

    // Production: await africasTalking.SMS.send({ to: phone, message })
    console.log(`[SMS → ${phone}] ${message}`);

    return { otp, expiry };
  }
}

module.exports = SafiSendBridge;
