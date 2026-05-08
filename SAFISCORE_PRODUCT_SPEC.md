# SafiScore — Retail Credit Verification on Blockchain
### Product Specification v2.0 | UAE | May 2026

---

## 1. Problem

Many residents and SME owners in the UAE — particularly expats and blue-collar workers — lack a formal credit history despite consistent spending behaviour. When they apply for a loan, banks have no verifiable signal. SafiScore turns everyday retail spending into a cryptographically verifiable credit profile.

---

## 2. Solution

**SafiScore is an on-chain credit layer built on top of SafiPoints.**

Every purchase at a SafiPoints-enabled merchant creates a signed attestation anchored on XRPL. When a customer applies for credit, they share a **zero-knowledge proof** — a mathematical statement like *"12+ months of retail transactions averaging AED 3,500/month"* — without revealing individual transactions.

Lenders verify in under 60 seconds via a smart contract query.

---

## 3. How It Works

```
Customer pays at SafiPoints merchant
        │
        ▼
Merchant XRPL wallet signs an attestation memo
XRPL anchors the transaction hash (4s finality, sub-cent fee)
Full details stored encrypted in MongoDB
        │
        ▼
Customer authorises SafiScore share (one-tap consent)
        │
        ▼
ZK Proof Generator (Node.js worker)
  Reads encrypted history → computes proof
  Outputs: "months ≥ 12, avg AED 3,500/month, 5 unique merchants"
        │
        ▼
SafiScoreRegistry.sol (XRPL EVM Sidechain)
  Verifies proof on-chain
  Issues time-limited attestation (30-day TTL)
        │
        ▼
Lender Portal
  Sees: score band, proof timestamp, merchant diversity, spend consistency
  Does NOT see: individual transactions, exact amounts, merchant names
```

---

## 4. Blockchain Architecture

SafiScore uses two chains — each doing what it does best.

| Layer | Chain | Purpose |
|---|---|---|
| **Transaction anchoring** | XRPL Mainnet | Sub-cent fees, 4s finality, native wallet model already in SafiPoints |
| **Smart contract logic** | XRPL EVM Sidechain | Solidity for proof verification, attestation issuance, lender access control |

**Why not Ethereum?** Gas fees (~$2–15/tx) make per-transaction anchoring uneconomical at scale.

**Why XRPL EVM Sidechain?** Stays in the XRPL ecosystem (shared validators, bridged XRP for gas) while enabling Solidity.

---

## 5. XRPL Integration

Every SafiPoints SAFI token mint appends an attestation payload to the XRPL transaction memo:

```json
{
  "type": "safiscore_attestation",
  "version": "1.0",
  "merchant_id": "rXRPL_wallet_address",
  "customer_id": "rXRPL_wallet_address",
  "tx_hash_offchain": "sha256_of_encrypted_record",
  "category": "food_beverage",
  "timestamp": "2026-05-03T10:30:00Z",
  "merchant_sig": "ECDSA_signature"
}
```

- The memo is **immutable** — written to the XRPL ledger and cannot be altered.
- Raw transaction details (AED amount, items) stay in **MongoDB, encrypted at rest**.
- The XRPL wallet address is the customer's pseudonymous identity — no name required.

This plugs into the existing `TokenService.issueTokens()` with no change to the token flow — the memo field is simply extended.

---

## 6. Solidity Smart Contracts

Two contracts live on the **XRPL EVM Sidechain**.

### 6.1 MerchantRegistry.sol

Tracks verified merchants. Only attestations from registered merchants count toward a credit score. Prevents fabricated wallets from gaming the system.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MerchantRegistry {
    address public admin;
    mapping(address => bool)  public verifiedMerchants;
    mapping(address => uint8) public merchantTrustScore; // 0-100

    event MerchantVerified(address indexed merchant, uint256 timestamp);
    event MerchantRevoked(address indexed merchant, string reason);

    modifier onlyAdmin() { require(msg.sender == admin, "Not admin"); _; }
    constructor() { admin = msg.sender; }

    function registerMerchant(address merchant, uint8 trustScore) external onlyAdmin {
        verifiedMerchants[merchant]   = true;
        merchantTrustScore[merchant]  = trustScore;
        emit MerchantVerified(merchant, block.timestamp);
    }

    function revokeMerchant(address merchant, string calldata reason) external onlyAdmin {
        verifiedMerchants[merchant] = false;
        emit MerchantRevoked(merchant, reason);
    }

    function isVerified(address merchant) external view returns (bool) {
        return verifiedMerchants[merchant];
    }
}
```

### 6.2 SafiScoreRegistry.sol

Accepts a ZK proof, verifies it on-chain, and issues a soulbound attestation with a 30-day TTL. Lenders call `verifyAttestation()` to check any applicant.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c,
        uint[4] calldata pubSignals
    ) external view returns (bool);
}

contract SafiScoreRegistry {
    IVerifier public verifier;
    address   public admin;

    struct Attestation {
        address customer;
        uint8   scoreBand;          // 1-5
        uint32  monthsOfHistory;
        uint32  merchantDiversity;  // unique merchants / total * 100
        uint256 issuedAt;
        uint256 expiresAt;          // 30-day TTL
        bool    revoked;
    }

    mapping(bytes32 => Attestation) public attestations;

    event AttestationIssued(bytes32 indexed id, address customer, uint8 scoreBand, uint256 expiresAt);
    event AttestationRevoked(bytes32 indexed id, string reason);

    modifier onlyAdmin() { require(msg.sender == admin, "Not admin"); _; }
    constructor(address _verifier) { verifier = IVerifier(_verifier); admin = msg.sender; }

    /// Called by SafiScore backend after generating a ZK proof.
    function issueAttestation(
        address customer, uint8 scoreBand, uint32 monthsOfHistory, uint32 merchantDiversity,
        uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[4] calldata pubSignals
    ) external onlyAdmin returns (bytes32 id) {
        require(verifier.verifyProof(a, b, c, pubSignals), "Invalid ZK proof");
        id = keccak256(abi.encodePacked(customer, block.timestamp));
        attestations[id] = Attestation({
            customer:          customer,
            scoreBand:         scoreBand,
            monthsOfHistory:   monthsOfHistory,
            merchantDiversity: merchantDiversity,
            issuedAt:          block.timestamp,
            expiresAt:         block.timestamp + 30 days,
            revoked:           false
        });
        emit AttestationIssued(id, customer, scoreBand, block.timestamp + 30 days);
    }

    /// Lenders call this to verify an applicant.
    function verifyAttestation(bytes32 id)
        external view returns (bool valid, Attestation memory data)
    {
        data  = attestations[id];
        valid = !data.revoked && data.expiresAt > block.timestamp && data.customer != address(0);
    }

    function revokeAttestation(bytes32 id, string calldata reason) external onlyAdmin {
        attestations[id].revoked = true;
        emit AttestationRevoked(id, reason);
    }
}
```

---

## 7. Zero-Knowledge Proof Layer

ZK proofs let customers prove facts about their spending without revealing the underlying data.

**Technology:** `snarkjs` with Groth16 (~200 byte proof, fast on-chain verification).

### What the Circuit Proves

```
Private inputs (never leave the server):
  - Transaction amounts (AED)
  - Timestamps
  - Merchant wallet addresses
  - Customer encryption key (proves data ownership)

Public outputs (submitted to smart contract):
  - months_of_history  >= threshold
  - avg_monthly_spend  in band [low | medium | high]
  - merchant_diversity >= threshold
  - last_tx_within_N_days
  - customer_xrpl_wallet (pseudonym)
```

### Proof Generation Flow

```
POST /api/safiscore/generate-proof
  1. Decrypt customer transactions from MongoDB
  2. Run snarkjs prover in a Node.js worker thread (5–15s)
  3. Submit proof + public signals to SafiScoreRegistry.sol
  4. Store attestation_id
  5. Return { attestation_id, share_url, expires_at }
```

---

## 8. Scoring Model

### 1–5 Star Score

| Component | Weight | What It Measures |
|---|---|---|
| Recency | 25% | Days since last attested purchase |
| Consistency | 30% | Month-to-month transaction count variance |
| Depth | 20% | Total months of verified history |
| Diversity | 15% | Unique merchants / total merchants |
| Volume Trend | 10% | 3-month spend vs. 6-month baseline |

| Stars | Lender Signal |
|---|---|
| 1 | < 3 months — insufficient data |
| 2 | 3–6 months, low consistency |
| 3 | 6–12 months, moderate |
| 4 | 12+ months, high consistency |
| 5 | 18+ months, high diversity and growth trend |

### Spend Bands (UAE, AED)

| Band | Monthly AED | Loan tier |
|---|---|---|
| Low | < 1,000 | Entry-level credit |
| Medium | 1,000 – 5,000 | Micro-loan eligible |
| High | > 5,000 | SME credit eligible |

---

## 9. Privacy & Security

| Principle | Implementation |
|---|---|
| Data minimisation | Only tx hashes on XRPL; full records encrypted in MongoDB |
| Encryption at rest | AES-256-GCM per record; key derived from customer XRPL wallet |
| Consent-first | Customer explicitly authorises each proof generation |
| Selective disclosure | Customer chooses which attributes to share per lender |
| Time-limited access | Attestations expire after 30 days |
| Right to deletion | Off-chain data deletable; XRPL hashes are pseudonymous |
| No raw data to lenders | Lenders see score band + proof hash only |

---

## 10. API Reference

### Customer

```
POST /api/safiscore/consent
  Body:    { wallet_address, consent: true }

GET  /api/safiscore/profile/:wallet_address
  Returns: { score_band, months_of_history, merchant_count, last_activity }

POST /api/safiscore/generate-proof
  Body:    { wallet_address, lender_address }
  Returns: { attestation_id, share_url, expires_at }
```

### Lender

```
GET  /api/safiscore/verify/:attestation_id
  Returns: { valid, score_band, months_of_history, merchant_diversity,
             freshness_days, proof_hash, on_chain_url }

POST /api/safiscore/lender/register
  Body:    { lender_name, xrpl_address }
  Returns: { api_key }
```

---

## 11. Relationship to SafiPoints

SafiScore is **not a separate product**. It is a credit layer on top of SafiPoints.

| SafiPoints already has | How SafiScore reuses it |
|---|---|
| XRPL wallet per customer | Same wallet = credit identity |
| Merchant XRPL wallet | Same wallet signs attestations |
| `TokenService.issueTokens()` | Attestation memo appended at mint time |
| MongoDB transaction records | Extended and encrypted for credit scoring |
| Express API | New `/safiscore` routes added |
| Merchant onboarding | Zero change — attestation auto-enabled |

All existing SafiPoints transactions can be retroactively enrolled on customer consent.

---

*SafiPoints earns trust. SafiScore makes it legible.*
