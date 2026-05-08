const PendingPoints = require('../models/PendingPoints');
const Customer = require('../models/Customer');
const TokenService = require('./TokenService');
const Merchant = require('../models/Merchant');

/**
 * ExpiryService — handles the full lifecycle of point expiry.
 *
 * Run this on a schedule (e.g. daily via cron or node-cron):
 *   - Mark claim windows expired (6 months, pending → expired)
 *   - Mark on-chain SAFI as expired (12 months, burn if MPT expiry not auto)
 *   - Send reminder SMS at 5-month and 11-month marks
 *
 * With MPT, token expiry can be set at issuance time and enforced by the ledger.
 * Until MPT migration, this service handles it in the application layer.
 */
class ExpiryService {
  /**
   * Expire pending (unclaimed) points past their claim window.
   * Called daily — safe to run multiple times (idempotent).
   */
  static async expireClaimWindows() {
    const now = new Date();
    const result = await PendingPoints.updateMany(
      {
        status: 'pending',
        claimWindowExpiresAt: { $lt: now },
      },
      { $set: { status: 'expired' } },
    );
    return { expiredPending: result.modifiedCount };
  }

  /**
   * Send 5-month reminder SMS for points approaching claim window expiry.
   */
  static async sendClaimReminders() {
    const fiveMonthsFromNow  = new Date(Date.now() + 30  * 86400 * 1000); // 1 month left
    const sixMonthsMark      = new Date(Date.now() + 60  * 86400 * 1000); // 2 months left

    const due = await PendingPoints.find({
      status: 'pending',
      reminderSentAt: { $exists: false },
      claimWindowExpiresAt: { $gt: new Date(), $lt: fiveMonthsFromNow },
    }).populate('merchant', 'name');

    for (const p of due) {
      const msg = `Reminder: You have ${p.safiAmount} SAFI (KES ${p.kshCashback}) cashback at ${p.merchant?.name}. Claim before ${p.claimWindowExpiresAt.toDateString()}: ${process.env.CLIENT_URL}/claim/${p._id}`;
      console.log(`[REMINDER SMS → ${p.phone}] ${msg}`);
      // await africasTalking.SMS.send({ to: p.phone, message: msg });
      p.reminderSentAt = new Date();
      await p.save();
    }

    return { remindersSent: due.length };
  }

  /**
   * Expire on-chain SAFI (claimed tokens older than 12 months).
   * Burn them back to the issuer.
   * With MPT, the ledger enforces this automatically — this method becomes a no-op.
   */
  static async expireOnChainTokens() {
    const oneYearAgo = new Date(Date.now() - 365 * 86400 * 1000);
    const expired = await PendingPoints.find({
      status: 'claimed',
      expiresAt: { $lt: new Date() },
      claimedAt: { $lt: oneYearAgo },
    }).populate('merchant');

    let burned = 0;
    for (const p of expired) {
      try {
        const customer = await Customer.findOne({ xrplAddress: p.claimedToAddress }).select('+xrplSeedEnc');
        const merchant  = await Merchant.findById(p.merchant._id).select('+xrplSeedEnc');
        if (!customer || !merchant) continue;

        await TokenService.burnTokens({
          merchant,
          customer,
          amount: p.safiAmount,
          metadata: { source: 'expiry', pendingId: p._id },
        });
        p.status = 'expired';
        await p.save();
        burned++;
      } catch (err) {
        console.error(`[ExpiryService] Failed to burn expired tokens for ${p._id}:`, err.message);
      }
    }

    return { onChainBurned: burned };
  }

  /**
   * Run all expiry jobs together.
   */
  static async runAll() {
    const [pending, reminders, onChain] = await Promise.allSettled([
      this.expireClaimWindows(),
      this.sendClaimReminders(),
      this.expireOnChainTokens(),
    ]);

    return {
      expireClaimWindows: pending.status === 'fulfilled' ? pending.value : { error: pending.reason?.message },
      sendClaimReminders: reminders.status === 'fulfilled' ? reminders.value : { error: reminders.reason?.message },
      expireOnChainTokens: onChain.status === 'fulfilled' ? onChain.value : { error: onChain.reason?.message },
    };
  }
}

module.exports = ExpiryService;
