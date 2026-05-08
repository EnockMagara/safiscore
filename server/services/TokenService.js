const XRPLService = require('./XRPLService');
const WalletService = require('./WalletService');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const crypto = require('crypto');

class TokenService {
  /**
   * Issue SAFI tokens from a merchant's issuer wallet to a customer.
   * Records the transaction in MongoDB with the XRPL tx hash.
   * Attaches a SafiScore attestation memo to the on-chain transaction.
   */
  static async issueTokens({ merchant, customer, amount, fiatAmount, metadata }) {
    const issuerWallet = WalletService.restoreWallet(merchant.xrplSeedEnc);

    // ── Build SafiScore attestation memo (compact — stays under XRPL 1KB memo limit) ──
    const attestationPayload = {
      v:   '1',
      mid: merchant.xrplAddress,
      cid: customer.xrplAddress,
      cat: metadata?.category || 'food_beverage',
      ts:  Math.floor(Date.now() / 1000),
    };
    // Hash of the full payload — anchors the on-chain memo to the off-chain record
    const attestationHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(attestationPayload) + (fiatAmount || '') + amount)
      .digest('hex');
    attestationPayload.hash = attestationHash.slice(0, 16); // compact: first 16 hex chars in memo

    const txRecord = await LoyaltyTransaction.create({
      customer: customer._id,
      merchant: merchant._id,
      type: 'earn',
      safiAmount: amount,
      fiatAmount,
      status: 'pending',
      safiscoreEnrolled: true,
      safiscoreCategory: metadata?.category || 'food_beverage',
      safiscoreAttestationHash: attestationHash,
      metadata,
    });

    try {
      const result = await XRPLService.sendTokens(
        issuerWallet,
        customer.xrplAddress,
        amount,
        merchant.xrplAddress,
        attestationPayload,  // SafiScore memo attached to XRPL transaction
      );

      txRecord.xrplTxHash = result.hash;
      txRecord.xrplLedgerIndex = result.ledgerIndex;
      txRecord.status = result.success ? 'confirmed' : 'failed';
      await txRecord.save();

      if (result.success) {
        customer.cachedBalance = (customer.cachedBalance || 0) + amount;
        customer.totalEarned = (customer.totalEarned || 0) + amount;
        await customer.save();
      }

      return {
        success: result.success,
        transactionId: txRecord._id,
        xrplTxHash: result.hash,
        safiAmount: amount,
        newBalance: customer.cachedBalance,
      };
    } catch (err) {
      txRecord.status = 'failed';
      txRecord.metadata = { ...txRecord.metadata, error: err.message };
      await txRecord.save();
      throw err;
    }
  }

  /**
   * Burn SAFI tokens — customer sends tokens back to merchant issuer (redemption).
   */
  static async burnTokens({ merchant, customer, amount, metadata }) {
    const customerWallet = WalletService.restoreWallet(customer.xrplSeedEnc);

    const txRecord = await LoyaltyTransaction.create({
      customer: customer._id,
      merchant: merchant._id,
      type: 'redeem',
      safiAmount: amount,
      fiatAmount: amount * merchant.redemptionRate,
      status: 'pending',
      metadata,
    });

    try {
      const result = await XRPLService.sendTokens(
        customerWallet,
        merchant.xrplAddress,
        amount,
        merchant.xrplAddress,
      );

      txRecord.xrplTxHash = result.hash;
      txRecord.xrplLedgerIndex = result.ledgerIndex;
      txRecord.status = result.success ? 'confirmed' : 'failed';
      await txRecord.save();

      if (result.success) {
        customer.cachedBalance = Math.max(0, (customer.cachedBalance || 0) - amount);
        customer.totalRedeemed = (customer.totalRedeemed || 0) + amount;
        await customer.save();
      }

      return {
        success: result.success,
        transactionId: txRecord._id,
        xrplTxHash: result.hash,
        safiAmount: amount,
        discountAmount: amount * merchant.redemptionRate,
        newBalance: customer.cachedBalance,
      };
    } catch (err) {
      txRecord.status = 'failed';
      txRecord.metadata = { ...txRecord.metadata, error: err.message };
      await txRecord.save();
      throw err;
    }
  }

  /**
   * Query live SAFI balance from XRPL for a customer against a merchant issuer.
   */
  static async getLiveBalance(customerAddress, issuerAddress) {
    return XRPLService.getTokenBalance(customerAddress, issuerAddress);
  }
}

module.exports = TokenService;
