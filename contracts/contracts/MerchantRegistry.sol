// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MerchantRegistry
 * @notice Tracks verified merchants whose transaction attestations count toward
 *         SafiScore credit profiles.
 *
 * Only merchants that have been KYC-verified by SafiScore admin are eligible
 * to contribute attestations. Lenders can query this contract to confirm a
 * merchant's verification status before accepting an attestation.
 */
contract MerchantRegistry is Ownable {
    // ────────────────────────────────────────────────────────────────────────
    // Types
    // ────────────────────────────────────────────────────────────────────────

    struct MerchantInfo {
        bool    verified;
        uint8   trustScore;    // 0–100; reflects quality of attestations over time
        string  name;
        string  category;      // food_beverage | grocery | pharmacy | fuel | retail
        uint256 verifiedAt;
        uint256 revokedAt;     // 0 if not revoked
    }

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    mapping(address => MerchantInfo) private _merchants;
    address[] private _merchantList;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event MerchantVerified(address indexed merchant, string name, string category, uint256 timestamp);
    event MerchantRevoked(address indexed merchant, string reason, uint256 timestamp);
    event TrustScoreUpdated(address indexed merchant, uint8 newScore);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ────────────────────────────────────────────────────────────────────────
    // Admin functions
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify a merchant after off-chain KYC.
     * @param merchant   XRPL-derived EVM address of the merchant's issuer wallet.
     * @param name       Human-readable merchant name.
     * @param category   Business category string.
     * @param trustScore Initial trust score (0–100).
     */
    function verifyMerchant(
        address merchant,
        string calldata name,
        string calldata category,
        uint8 trustScore
    ) external onlyOwner {
        require(merchant != address(0), "Invalid merchant address");
        require(bytes(name).length > 0,     "Name required");
        require(bytes(category).length > 0, "Category required");
        require(trustScore <= 100,          "Trust score must be 0-100");

        if (!_merchants[merchant].verified) {
            _merchantList.push(merchant);
        }

        _merchants[merchant] = MerchantInfo({
            verified:   true,
            trustScore: trustScore,
            name:       name,
            category:   category,
            verifiedAt: block.timestamp,
            revokedAt:  0
        });

        emit MerchantVerified(merchant, name, category, block.timestamp);
    }

    /**
     * @notice Revoke a merchant's verified status (e.g. fraudulent attestations detected).
     */
    function revokeMerchant(address merchant, string calldata reason) external onlyOwner {
        require(_merchants[merchant].verified, "Merchant not verified");
        _merchants[merchant].verified   = false;
        _merchants[merchant].revokedAt  = block.timestamp;
        emit MerchantRevoked(merchant, reason, block.timestamp);
    }

    /**
     * @notice Update a merchant's trust score based on attestation quality monitoring.
     */
    function updateTrustScore(address merchant, uint8 newScore) external onlyOwner {
        require(newScore <= 100, "Trust score must be 0-100");
        _merchants[merchant].trustScore = newScore;
        emit TrustScoreUpdated(merchant, newScore);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Read functions
    // ────────────────────────────────────────────────────────────────────────

    function isVerified(address merchant) external view returns (bool) {
        return _merchants[merchant].verified;
    }

    function getMerchantInfo(address merchant) external view returns (MerchantInfo memory) {
        return _merchants[merchant];
    }

    function getMerchantCount() external view returns (uint256) {
        return _merchantList.length;
    }
}
