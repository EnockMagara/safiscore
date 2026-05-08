const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SafiScore contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "XRP/ETH");

  // ── 1. Deploy MerchantRegistry ─────────────────────────────────────────
  const MerchantRegistry = await ethers.getContractFactory("MerchantRegistry");
  const merchantRegistry = await MerchantRegistry.deploy();
  await merchantRegistry.waitForDeployment();
  console.log("MerchantRegistry deployed to:", await merchantRegistry.getAddress());

  // ── 2. Deploy SafiScoreRegistry ────────────────────────────────────────
  const SafiScoreRegistry = await ethers.getContractFactory("SafiScoreRegistry");
  const safiScoreRegistry = await SafiScoreRegistry.deploy();
  await safiScoreRegistry.waitForDeployment();
  console.log("SafiScoreRegistry deployed to:", await safiScoreRegistry.getAddress());

  // ── 3. Authorize deployer as anchor (backend wallet) ──────────────────
  const tx = await safiScoreRegistry.authorizeAnchor(deployer.address);
  await tx.wait();
  console.log("Deployer authorized as anchor in SafiScoreRegistry");

  // ── 4. Print summary ──────────────────────────────────────────────────
  console.log("\n=== Deployment Summary ===");
  console.log("Network:              ", (await ethers.provider.getNetwork()).name);
  console.log("MerchantRegistry:     ", await merchantRegistry.getAddress());
  console.log("SafiScoreRegistry:    ", await safiScoreRegistry.getAddress());
  console.log("\nAdd these to your .env:");
  console.log(`MERCHANT_REGISTRY_ADDRESS=${await merchantRegistry.getAddress()}`);
  console.log(`SAFISCORE_REGISTRY_ADDRESS=${await safiScoreRegistry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
