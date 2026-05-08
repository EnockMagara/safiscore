const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const CreditProfile = require('../models/CreditProfile');
const Customer = require('../models/Customer');

// Scoring weights — must sum to 1.0
const WEIGHTS = {
  recency:     0.25,
  consistency: 0.30,
  depth:       0.20,
  diversity:   0.15,
  volumeTrend: 0.10,
};

const MS_PER_DAY   = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

class SafiScoreService {
  // ─────────────────────────────────────────────────────────────────────────
  // Core scoring — pure function, no DB calls
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute score components from an array of confirmed, enrolled LoyaltyTransactions.
   * Returns component scores (0–100) and the final weighted scoreBand (1–5).
   */
  static computeComponents(transactions) {
    if (!transactions || transactions.length === 0) {
      return { recency: 0, consistency: 0, depth: 0, diversity: 0, volumeTrend: 0, overall: 0, scoreBand: 1 };
    }

    const now = Date.now();

    // ── Recency (25%) ────────────────────────────────────────────────────────
    // 100 = transacted today; 0 = 180+ days ago
    const lastTxDate = transactions.reduce((latest, t) =>
      t.createdAt > latest ? t.createdAt : latest, new Date(0));
    const daysSinceLast = (now - lastTxDate.getTime()) / MS_PER_DAY;
    const recency = Math.max(0, Math.min(100, 100 - (daysSinceLast * (100 / 180))));

    // ── Depth (20%) ──────────────────────────────────────────────────────────
    // Months of history — 18+ months = 100
    const oldestTxDate = transactions.reduce((oldest, t) =>
      t.createdAt < oldest ? t.createdAt : oldest, new Date());
    const monthsOfHistory = (now - oldestTxDate.getTime()) / MS_PER_MONTH;
    const depth = Math.min(100, (monthsOfHistory / 18) * 100);

    // ── Consistency (30%) ────────────────────────────────────────────────────
    // Low coefficient-of-variation in monthly transaction counts = high score
    const monthBuckets = {};
    transactions.forEach(t => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthBuckets[key] = (monthBuckets[key] || 0) + 1;
    });
    const monthlyCounts = Object.values(monthBuckets);
    let consistency;
    if (monthlyCounts.length < 2) {
      consistency = monthlyCounts.length === 1 ? 40 : 0;
    } else {
      const mean = monthlyCounts.reduce((a, b) => a + b, 0) / monthlyCounts.length;
      const variance = monthlyCounts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / monthlyCounts.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // 0 = consistent, 1+ = chaotic
      consistency = Math.max(0, Math.min(100, (1 - Math.min(cv, 1)) * 100));
    }

    // ── Diversity (15%) ──────────────────────────────────────────────────────
    // Ratio of unique merchants to total transactions, scaled.
    // Shopping at 5+ different merchants with regular cadence = full score.
    const merchantIds = new Set(transactions.map(t => String(t.merchant)));
    const diversityRatio = merchantIds.size / Math.max(transactions.length, 1);
    const diversity = Math.min(100, diversityRatio * 200); // cap at 50% ratio → 100

    // ── Volume Trend (10%) ───────────────────────────────────────────────────
    // Compare spend in last 3 months vs. previous 3 months (3–6 months ago).
    const threeMonthsAgo = now - 3 * MS_PER_MONTH;
    const sixMonthsAgo   = now - 6 * MS_PER_MONTH;
    const recentSpend = transactions
      .filter(t => t.createdAt.getTime() >= threeMonthsAgo)
      .reduce((s, t) => s + (t.fiatAmount || 0), 0);
    const priorSpend = transactions
      .filter(t => t.createdAt.getTime() >= sixMonthsAgo && t.createdAt.getTime() < threeMonthsAgo)
      .reduce((s, t) => s + (t.fiatAmount || 0), 0);
    let volumeTrend;
    if (priorSpend === 0 && recentSpend > 0) volumeTrend = 75; // just starting
    else if (priorSpend === 0)               volumeTrend = 30;
    else volumeTrend = Math.min(100, (recentSpend / priorSpend) * 50);

    // ── Weighted overall & band ───────────────────────────────────────────────
    const overall = Math.round(
      recency     * WEIGHTS.recency     +
      consistency * WEIGHTS.consistency +
      depth       * WEIGHTS.depth       +
      diversity   * WEIGHTS.diversity   +
      volumeTrend * WEIGHTS.volumeTrend,
    );

    let scoreBand;
    if (overall >= 80)      scoreBand = 5;
    else if (overall >= 60) scoreBand = 4;
    else if (overall >= 40) scoreBand = 3;
    else if (overall >= 20) scoreBand = 2;
    else                    scoreBand = 1;

    return {
      recency:     Math.round(recency),
      consistency: Math.round(consistency),
      depth:       Math.round(depth),
      diversity:   Math.round(diversity),
      volumeTrend: Math.round(volumeTrend),
      overall,
      scoreBand,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Profile management — DB operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Recompute and persist a customer's credit profile.
   * Called after each earn event and on explicit refresh requests.
   */
  static async refreshProfile(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

    // Only confirmed earn transactions that are enrolled in SafiScore
    const transactions = await LoyaltyTransaction.find({
      customer: customerId,
      type: 'earn',
      status: 'confirmed',
      safiscoreEnrolled: true,
    }).select('createdAt fiatAmount merchant safiscoreAttestationHash xrplTxHash').sort({ createdAt: 1 });

    const components = this.computeComponents(transactions);

    // Aggregate stats
    const merchantIds = new Set(transactions.map(t => String(t.merchant)));
    const firstTx = transactions[0];
    const lastTx  = transactions[transactions.length - 1];
    const monthsOfHistory = firstTx
      ? Math.round((Date.now() - firstTx.createdAt.getTime()) / MS_PER_MONTH)
      : 0;
    const totalFiat = transactions.reduce((s, t) => s + (t.fiatAmount || 0), 0);
    const avgMonthlySpend = monthsOfHistory > 0 ? Math.round(totalFiat / monthsOfHistory) : totalFiat;

    const profile = await CreditProfile.findOneAndUpdate(
      { customer: customerId },
      {
        customer:            customerId,
        customerXrplWallet:  customer.xrplAddress,
        scoreBand:           components.scoreBand,
        scoreBreakdown: {
          recency:     components.recency,
          consistency: components.consistency,
          depth:       components.depth,
          diversity:   components.diversity,
          volumeTrend: components.volumeTrend,
          overall:     components.overall,
        },
        monthsOfHistory,
        totalTransactions:   transactions.length,
        uniqueMerchants:     merchantIds.size,
        averageMonthlySpend: avgMonthlySpend,
        lastTransactionAt:   lastTx?.createdAt,
        lastComputedAt:      new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return profile;
  }

  /**
   * Return a customer's credit profile.
   * Uses cached version if computed within last 24 h; otherwise refreshes.
   */
  static async getProfile(customerId) {
    const profile = await CreditProfile.findOne({ customer: customerId });
    const staleCutoff = Date.now() - 24 * 60 * 60 * 1000;
    if (!profile || !profile.lastComputedAt || profile.lastComputedAt.getTime() < staleCutoff) {
      return this.refreshProfile(customerId);
    }
    return profile;
  }

  /**
   * Record explicit customer consent and trigger an initial score computation.
   */
  static async giveConsent(customerId) {
    await CreditProfile.findOneAndUpdate(
      { customer: customerId },
      { $set: { consentGivenAt: new Date() } },
      { upsert: true },
    );
    return this.refreshProfile(customerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Human-readable band label. */
  static bandLabel(band) {
    const labels = ['', 'Insufficient', 'Thin', 'Moderate', 'Good', 'Excellent'];
    return labels[band] || 'Unknown';
  }

  /**
   * Selective-disclosure spend band.
   * Lenders receive a range category, not the exact KES amount.
   */
  static spendBand(avgMonthlyKes) {
    if (avgMonthlyKes < 2000)  return 'low';       // < KES 2,000 / month
    if (avgMonthlyKes < 10000) return 'medium';    // KES 2,000 – 10,000
    if (avgMonthlyKes < 50000) return 'high';      // KES 10,000 – 50,000
    return 'very_high';
  }
}

module.exports = SafiScoreService;
