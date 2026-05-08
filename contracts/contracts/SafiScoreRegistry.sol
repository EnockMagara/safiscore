// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafiScoreRegistry
 * @notice On-chain registry of verified credit-score attestations.
 *
 * Flow:
 *   1. Off-chain ProofService generates a proof and derives an attestationId + proofHash.
 *   2. SafiScore backend calls anchorAttestation() to write the proof hash on-chain.
 *   3. Lenders call verifyAttestation() to confirm a proof hash is valid and unexpired.
 *   4. The full score details live off-chain (MongoDB); the chain stores only the
 *      commitment hash — enough for independent verification without exposing data.
 *
 * Privacy: No raw transaction data, amounts, or merchant names are stored on-chain.
 *
 * Upgrade path (v2):
 *   - Replace anchorAttestation() with verifyAndAnchor() that accepts a snarkjs
 *     Groth16 proof blob and calls an on-chain Groth16 verifier before anchoring.
 */
contract SafiScoreRegistry is Ownable {
    // ────────────────────────────────────────────────────────────────────────
    // Types
    // ────────────────────────────────────────────────────────────────────────

    struct Attestation {
        bytes32  proofHash;         // SHA256 of (proofSignature + statement)
        bytes32  commitmentHash;    // SHA256 of sorted XRPL tx hash set
        uint8    scoreBand;         // 1–5
        uint32   monthsOfHistory;
        uint32   merchantDiversity; // unique merchant count
        uint256  issuedAt;
        uint256  expiresAt;
        bool     revoked;
        address  customer;          // EVM representation of customer XRPL wallet
    }

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    // attestationId (bytes32) → Attestation
    mapping(bytes32 => Attestation) private _attestations;

    // Authorised anchoring services (SafiScore backend wallet addresses)
    mapping(address => bool) public authorizedAnchors;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event AttestationAnchored(
        bytes32 indexed attestationId,
        address indexed customer,
        uint8   scoreBand,
        uint256 expiresAt
    );
    event AttestationRevoked(
        bytes32 indexed attestationId,
        address indexed customer,
        string  reason
    );
    event AnchorAuthorized(address indexed anchor);
    event AnchorRevoked(address indexed anchor);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ────────────────────────────────────────────────────────────────────────
    // Admin
    // ────────────────────────────────────────────────────────────────────────

    function authorizeAnchor(address anchor) external onlyOwner {
        require(anchor != address(0), "Invalid address");
        authorizedAnchors[anchor] = true;
        emit AnchorAuthorized(anchor);
    }

    function revokeAnchorAuth(address anchor) external onlyOwner {
        authorizedAnchors[anchor] = false;
        emit AnchorRevoked(anchor);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Anchoring (called by SafiScore backend after generating a proof)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Anchor a proof hash on-chain so lenders can verify it independently.
     *
     * @param attestationId   bytes32 derived from SHA256(customerXrpl:lender:issuedAt)
     * @param customer        EVM address derived from customer's XRPL wallet
     * @param proofHash       SHA256(proofSignature + statement) from ProofService
     * @param commitmentHash  SHA256(sorted XRPL tx hashes)
     * @param scoreBand       1–5
     * @param monthsOfHistory months of attested history
     * @param merchantDiv     unique merchant count
     * @param expiresAt       Unix timestamp — must be > block.timestamp
     */
    function anchorAttestation(
        bytes32 attestationId,
        address customer,
        bytes32 proofHash,
        bytes32 commitmentHash,
        uint8   scoreBand,
        uint32  monthsOfHistory,
        uint32  merchantDiv,
        uint256 expiresAt
    ) external {
        require(authorizedAnchors[msg.sender], "Not an authorized anchor");
        require(customer != address(0),        "Invalid customer address");
        require(scoreBand >= 1 && scoreBand <= 5, "Score band must be 1-5");
        require(expiresAt > block.timestamp,   "Expiry must be in the future");
        require(
            _attestations[attestationId].issuedAt == 0,
            "Attestation already anchored"
        );

        _attestations[attestationId] = Attestation({
            proofHash:        proofHash,
            commitmentHash:   commitmentHash,
            scoreBand:        scoreBand,
            monthsOfHistory:  monthsOfHistory,
            merchantDiversity: merchantDiv,
            issuedAt:         block.timestamp,
            expiresAt:        expiresAt,
            revoked:          false,
            customer:         customer
        });

        emit AttestationAnchored(attestationId, customer, scoreBand, expiresAt);
    }

    /**
     * @notice Revoke an on-chain attestation.
     *         Can be called by the authorized anchor (backend) or the contract owner.
     */
    function revokeAttestation(bytes32 attestationId, string calldata reason) external {
        Attestation storage a = _attestations[attestationId];
        require(a.issuedAt != 0, "Attestation does not exist");
        require(
            authorizedAnchors[msg.sender] || owner() == msg.sender,
            "Not authorized to revoke"
        );
        a.revoked = true;
        emit AttestationRevoked(attestationId, a.customer, reason);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Verification (called by lenders)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify an attestation is valid, unexpired, and unrevoked.
     *         Also confirms the proofHash matches what was anchored (tamper check).
     *
     * @param attestationId  The attestation ID from the customer's share link.
     * @param proofHash      The proofHash from the customer's share link.
     * @return valid         True if attestation passes all checks.
     * @return data          The anchored Attestation struct.
     */
    function verifyAttestation(
        bytes32 attestationId,
        bytes32 proofHash
    ) external view returns (bool valid, Attestation memory data) {
        Attestation memory a = _attestations[attestationId];
        if (a.issuedAt == 0)          return (false, a); // not found
        if (a.revoked)                return (false, a); // revoked
        if (a.expiresAt < block.timestamp) return (false, a); // expired
        if (a.proofHash != proofHash) return (false, a); // tampered
        return (true, a);
    }

    /**
     * @notice Simple existence + validity check (no proofHash required).
     *         Useful for a quick lender dashboard lookup.
     */
    function isValidAttestation(bytes32 attestationId) external view returns (bool) {
        Attestation memory a = _attestations[attestationId];
        return a.issuedAt != 0 && !a.revoked && a.expiresAt >= block.timestamp;
    }

    function getAttestation(bytes32 attestationId) external view returns (Attestation memory) {
        return _attestations[attestationId];
    }
}
