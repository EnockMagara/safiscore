const Merchant = require('../models/Merchant');
const Customer = require('../models/Customer');
const TokenService = require('./TokenService');

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 10000,
};

const TIER_MULTIPLIERS = {
  bronze: 1.0,
  silver: 1.15,
  gold: 1.30,
  platinum: 1.50,
};

class LoyaltyService {
  /**
   * Calculate SAFI earned for a fiat payment amount.
   * Applies merchant earn rate + customer tier multiplier.
   */
  static calculateEarn(fiatAmount, earnRate, customerTier = 'bronze') {
    const base = fiatAmount * earnRate;
    const multiplier = TIER_MULTIPLIERS[customerTier] || 1.0;
    return Math.round(base * multiplier * 100) / 100;
  }

  /**
   * Process an earn event: calculate tokens, issue on XRPL, update records.
   */
  static async earnPoints({ merchantId, customerId, fiatAmount, metadata = {} }) {
    const merchant = await Merchant.findById(merchantId).select('+xrplSeedEnc');
    if (!merchant) throw Object.assign(new Error('Merchant not found'), { statusCode: 404 });

    const customer = await Customer.findById(customerId).select('+xrplSeedEnc');
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

    if (!customer.trustLineSet) {
      throw Object.assign(new Error('Customer trust line not established'), { statusCode: 400 });
    }

    const safiAmount = this.calculateEarn(fiatAmount, merchant.earnRate, customer.tier);
    if (safiAmount <= 0) {
      throw Object.assign(new Error('Earn amount too small'), { statusCode: 400 });
    }

    const result = await TokenService.issueTokens({
      merchant,
      customer,
      amount: safiAmount,
      fiatAmount,
      metadata: { ...metadata, source: 'earn' },
    });

    // Enroll customer with this merchant if not already
    if (!customer.enrolledMerchants.includes(merchant._id)) {
      customer.enrolledMerchants.push(merchant._id);
      await customer.save();
    }

    // Check for tier upgrade — capture previous tier BEFORE assignment
    const newTier = this.computeTier(customer.totalEarned);
    if (newTier !== customer.tier) {
      const previousTier = customer.tier;
      customer.tier = newTier;
      await customer.save();
      result.tierUpgrade = { from: previousTier, to: newTier };
    }

    return {
      ...result,
      earnRate: merchant.earnRate,
      tier: customer.tier,
      tierMultiplier: TIER_MULTIPLIERS[customer.tier],
    };
  }

  /**
   * Return multiplier for a given tier (used externally to lock rate at earn time).
   */
  static getMultiplier(tier) {
    return TIER_MULTIPLIERS[tier] || 1.0;
  }

  /**
   * Determine tier based on lifetime earned SAFI.
   */
  static computeTier(totalEarned) {
    if (totalEarned >= TIER_THRESHOLDS.platinum) return 'platinum';
    if (totalEarned >= TIER_THRESHOLDS.gold) return 'gold';
    if (totalEarned >= TIER_THRESHOLDS.silver) return 'silver';
    return 'bronze';
  }

  /**
   * Get customer balance — live from XRPL against a specific merchant issuer.
   */
  static async getBalance(customerId, merchantId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw Object.assign(new Error('Merchant not found'), { statusCode: 404 });

    const liveBalance = await TokenService.getLiveBalance(
      customer.xrplAddress,
      merchant.xrplAddress,
    );

    // Sync cached balance
    customer.cachedBalance = liveBalance;
    await customer.save();

    return {
      customerId: customer._id,
      xrplAddress: customer.xrplAddress,
      issuer: merchant.xrplAddress,
      merchantName: merchant.name,
      balance: liveBalance,
      tier: customer.tier,
      totalEarned: customer.totalEarned,
      totalRedeemed: customer.totalRedeemed,
    };
  }
}

module.exports = LoyaltyService;
