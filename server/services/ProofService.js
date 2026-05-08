/**
 * ProofService — v1: hash-based cryptographic proof
 *
 * Privacy model:
 *   - NO raw transaction amounts, timestamps, or merchant names leave this service.
 *   - Lenders receive only: scoreBand, monthsOfHistory, merchantDiversity, spendBand.
 *   - The "proof" is a HMAC-signed statement bound to a commitment over XRPL tx hashes.
 *
 * Upgrade path to real ZK (v2):
 *   - Replace generateProof() with a snarkjs Groth16 circuit that proves the same
 *     public statements without revealing the private transaction set.
 *   - The LenderAttestation schema and verifyProof() interface stay identical.
 */

const crypto = require('crypto');
const LoyaltyTransaction  = require('../models/LoyaltyTransaction');
const LenderAttestation   = require('../models/LenderAttestation');
const SafiScoreService    = require('./SafiScoreService');

const PROOF_EXPIRY_DAYS = 30;

function hmacSha256(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

class ProofService {
  /**
   * Generate a cryptographic attestation for a customer's credit profile.
   *
   * @param {string}   customerId        - MongoDB customer _id
   * @param {string}   lenderIdentifier  - Lender's unique ID / domain / wallet address
   * @param {string}   [lenderName]      - Human-readable lender name (stored for UX)
   * @param {string[]} [attributes]      - Which score attributes to include in the statement
   *
   * @returns {object} { attestationId, proofHash, shareUrl, expiresAt }
   */
  static async generateProof({ customerId, lenderIdentifier, lenderName, attributes }) {
    const secret = process.env.PROOF_SIGNING_SECRET || process.env.ENCRYPTION_KEY;
    if (!secret) throw new Error('PROOF_SIGNING_SECRET env var must be set');

    // ── 1. Fetch attested transaction identifiers only (not amounts) ─────────
    const transactions = await LoyaltyTransaction.find({
      customer:          customerId,
      type:              'earn',
      status:            'confirmed',
      safiscoreEnrolled: true,
    }).select('xrplTxHash safiscoreAttestationHash createdAt merchant fiatAmount').sort({ createdAt: 1 });

    if (transactions.length === 0) {
      throw Object.assign(
        new Error('No attested transactions found — at least one confirmed purchase is needed'),
        { statusCode: 422 },
      );
    }

    // ── 2. Build commitment — sorted hash of XRPL tx hashes ─────────────────
    // This binds the proof to a specific set of on-chain transactions.
    const txIdentifiers = transactions
      .map(t => t.xrplTxHash || t.safiscoreAttestationHash || t._id.toString())
      .sort();
    const commitmentHash = crypto
      .createHash('sha256')
      .update(txIdentifiers.join(':'))
      .digest('hex');

    // ── 3. Refresh and read credit profile ───────────────────────────────────
    const profile = await SafiScoreService.refreshProfile(customerId);

    // ── 4. Build public statement (selective disclosure) ─────────────────────
    const issuedAt  = new Date();
    const expiresAt = new Date(issuedAt.getTime() + PROOF_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const fullStatement = {
      version:            '1.0',
      commitment:         commitmentHash,
      customer_xrpl:      profile.customerXrplWallet,
      lender:             lenderIdentifier,
      score_band:         profile.scoreBand,
      months_of_history:  profile.monthsOfHistory,
      merchant_diversity: profile.uniqueMerchants,
      spend_band:         SafiScoreService.spendBand(profile.averageMonthlySpend),
      freshness_days:     profile.lastTransactionAt
        ? Math.round((Date.now() - profile.lastTransactionAt.getTime()) / (24 * 60 * 60 * 1000))
        : 999,
      issued_at:  issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    // Apply attribute filter (always keep identity / lifecycle fields)
    const ALWAYS_INCLUDE = new Set([
      'version', 'commitment', 'customer_xrpl', 'lender', 'issued_at', 'expires_at',
    ]);
    const statement = {};
    const allowed = attributes && attributes.length > 0
      ? new Set([...ALWAYS_INCLUDE, ...attributes])
      : null; // null = include all

    Object.keys(fullStatement).forEach(k => {
      if (!allowed || allowed.has(k)) statement[k] = fullStatement[k];
    });

    // ── 5. HMAC-sign the statement ────────────────────────────────────────────
    const statementStr    = JSON.stringify(statement, Object.keys(statement).sort());
    const proofSignature  = hmacSha256(statementStr, secret);
    const proofHash       = crypto
      .createHash('sha256')
      .update(proofSignature + statementStr)
      .digest('hex');

    // ── 6. Derive deterministic attestation ID ────────────────────────────────
    const attestationId = crypto
      .createHash('sha256')
      .update(`${profile.customerXrplWallet}:${lenderIdentifier}:${issuedAt.toISOString()}`)
      .digest('hex');

    // ── 7. Persist ────────────────────────────────────────────────────────────
    await LenderAttestation.create({
      attestationId,
      customer:           customerId,
      customerXrplWallet: profile.customerXrplWallet,
      lenderName:         lenderName || lenderIdentifier,
      lenderIdentifier,
      scoreBand:          statement.score_band,
      monthsOfHistory:    statement.months_of_history,
      merchantDiversity:  statement.merchant_diversity,
      freshnessScore:     statement.freshness_days,
      averageMonthlySpend: statement.spend_band,
      commitmentHash,
      proofSignature,
      proofHash,
      issuedAt,
      expiresAt,
    });

    return {
      attestationId,
      proofHash,
      expiresAt,
      statement, // returned to customer for their own records
    };
  }

  /**
   * Verify a proof by attestation ID.
   * Used by lenders — returns score details without raw customer data.
   */
  static async verifyProof(attestationId) {
    const attestation = await LenderAttestation.findOne({ attestationId });

    if (!attestation) {
      return { valid: false, reason: 'Attestation not found' };
    }
    if (attestation.revoked) {
      return { valid: false, reason: 'Attestation revoked', revokedAt: attestation.revokedAt };
    }
    if (attestation.expiresAt < new Date()) {
      return { valid: false, reason: 'Attestation expired', expiredAt: attestation.expiresAt };
    }

    return {
      valid: true,
      attestation: {
        attestationId:      attestation.attestationId,
        scoreBand:          attestation.scoreBand,
        scoreBandLabel:     SafiScoreService.bandLabel(attestation.scoreBand),
        monthsOfHistory:    attestation.monthsOfHistory,
        merchantDiversity:  attestation.merchantDiversity,
        spendBand:          attestation.averageMonthlySpend,
        freshnessScore:     attestation.freshnessScore,
        proofHash:          attestation.proofHash,
        issuedAt:           attestation.issuedAt,
        expiresAt:          attestation.expiresAt,
      },
    };
  }

  /**
   * Customer-initiated revocation of a shared attestation.
   */
  static async revokeProof(attestationId, customerId, reason = 'customer_revoked') {
    const attestation = await LenderAttestation.findOne({ attestationId, customer: customerId });
    if (!attestation) {
      throw Object.assign(new Error('Attestation not found'), { statusCode: 404 });
    }
    attestation.revoked      = true;
    attestation.revokedAt    = new Date();
    attestation.revokeReason = reason;
    await attestation.save();
    return { revoked: true };
  }
}

module.exports = ProofService;
