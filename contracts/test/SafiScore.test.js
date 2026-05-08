const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafiScore Contracts", function () {
  let merchantRegistry, safiScoreRegistry;
  let owner, anchorWallet, merchant, customer, lender;

  // Helpers
  const toBytes32 = (str) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const futureTs  = () => Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

  beforeEach(async () => {
    [owner, anchorWallet, merchant, customer, lender] = await ethers.getSigners();

    const MR = await ethers.getContractFactory("MerchantRegistry");
    merchantRegistry = await MR.deploy();

    const SR = await ethers.getContractFactory("SafiScoreRegistry");
    safiScoreRegistry = await SR.deploy();

    // Authorize the anchor wallet
    await safiScoreRegistry.connect(owner).authorizeAnchor(anchorWallet.address);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MerchantRegistry
  // ─────────────────────────────────────────────────────────────────────────

  describe("MerchantRegistry", () => {
    it("allows owner to verify a merchant", async () => {
      await merchantRegistry.connect(owner).verifyMerchant(
        merchant.address, "Tandoor Palace", "food_beverage", 80
      );
      expect(await merchantRegistry.isVerified(merchant.address)).to.be.true;
    });

    it("returns correct merchant info", async () => {
      await merchantRegistry.connect(owner).verifyMerchant(
        merchant.address, "Tandoor Palace", "food_beverage", 80
      );
      const info = await merchantRegistry.getMerchantInfo(merchant.address);
      expect(info.name).to.equal("Tandoor Palace");
      expect(info.category).to.equal("food_beverage");
      expect(info.trustScore).to.equal(80);
    });

    it("allows owner to revoke a merchant", async () => {
      await merchantRegistry.connect(owner).verifyMerchant(
        merchant.address, "Tandoor Palace", "food_beverage", 80
      );
      await merchantRegistry.connect(owner).revokeMerchant(merchant.address, "Fraud detected");
      expect(await merchantRegistry.isVerified(merchant.address)).to.be.false;
    });

    it("prevents non-owner from verifying merchants", async () => {
      await expect(
        merchantRegistry.connect(lender).verifyMerchant(
          merchant.address, "Fake", "other", 50
        )
      ).to.be.revertedWithCustomError(merchantRegistry, "OwnableUnauthorizedAccount");
    });

    it("allows owner to update trust score", async () => {
      await merchantRegistry.connect(owner).verifyMerchant(
        merchant.address, "Tandoor Palace", "food_beverage", 80
      );
      await merchantRegistry.connect(owner).updateTrustScore(merchant.address, 95);
      const info = await merchantRegistry.getMerchantInfo(merchant.address);
      expect(info.trustScore).to.equal(95);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SafiScoreRegistry
  // ─────────────────────────────────────────────────────────────────────────

  describe("SafiScoreRegistry", () => {
    const attestationId  = toBytes32("test-attestation-001");
    const proofHash      = toBytes32("test-proof-hash-001");
    const commitmentHash = toBytes32("test-commitment-001");

    async function doAnchor(exp = futureTs()) {
      return safiScoreRegistry.connect(anchorWallet).anchorAttestation(
        attestationId,
        customer.address,
        proofHash,
        commitmentHash,
        4,    // scoreBand
        12,   // monthsOfHistory
        5,    // merchantDiversity
        exp,
      );
    }

    it("allows authorized anchor to anchor an attestation", async () => {
      const exp = futureTs();
      await expect(
        safiScoreRegistry.connect(anchorWallet).anchorAttestation(
          attestationId, customer.address, proofHash, commitmentHash,
          4, 12, 5, exp
        )
      ).to.emit(safiScoreRegistry, "AttestationAnchored")
        .withArgs(attestationId, customer.address, 4, BigInt(exp));
    });

    it("verifyAttestation returns true for valid attestation", async () => {
      await doAnchor();
      const [valid] = await safiScoreRegistry.verifyAttestation(attestationId, proofHash);
      expect(valid).to.be.true;
    });

    it("verifyAttestation returns false with wrong proofHash", async () => {
      await doAnchor();
      const [valid] = await safiScoreRegistry.verifyAttestation(
        attestationId, toBytes32("wrong-hash")
      );
      expect(valid).to.be.false;
    });

    it("isValidAttestation returns true for live attestation", async () => {
      await doAnchor();
      expect(await safiScoreRegistry.isValidAttestation(attestationId)).to.be.true;
    });

    it("allows authorized anchor to revoke an attestation", async () => {
      await doAnchor();
      await expect(
        safiScoreRegistry.connect(anchorWallet).revokeAttestation(attestationId, "customer_request")
      ).to.emit(safiScoreRegistry, "AttestationRevoked");

      expect(await safiScoreRegistry.isValidAttestation(attestationId)).to.be.false;
    });

    it("prevents unauthorized accounts from anchoring", async () => {
      await expect(
        safiScoreRegistry.connect(lender).anchorAttestation(
          attestationId, customer.address, proofHash, commitmentHash, 3, 6, 2, futureTs()
        )
      ).to.be.revertedWith("Not an authorized anchor");
    });

    it("prevents anchoring a duplicate attestation ID", async () => {
      await doAnchor();
      await expect(doAnchor()).to.be.revertedWith("Attestation already anchored");
    });

    it("rejects score band outside 1-5", async () => {
      await expect(
        safiScoreRegistry.connect(anchorWallet).anchorAttestation(
          toBytes32("new-id"), customer.address, proofHash, commitmentHash,
          6, 12, 5, futureTs()
        )
      ).to.be.revertedWith("Score band must be 1-5");
    });

    it("rejects expired expiresAt", async () => {
      const pastTs = Math.floor(Date.now() / 1000) - 1;
      await expect(
        safiScoreRegistry.connect(anchorWallet).anchorAttestation(
          toBytes32("new-id"), customer.address, proofHash, commitmentHash,
          4, 12, 5, pastTs
        )
      ).to.be.revertedWith("Expiry must be in the future");
    });
  });
});
