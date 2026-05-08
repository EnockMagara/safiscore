require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    // Local Hardhat node for development
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // XRPL EVM Sidechain mainnet (chainId 1440000)
    xrpl_evm: {
      url: process.env.XRPL_EVM_RPC_URL || "https://rpc.xrplevm.org",
      chainId: 1440000,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    // XRPL EVM Testnet (chainId 1449000) — faucet: https://faucet.xrplevm.org
    xrpl_evm_testnet: {
      url: "https://rpc.testnet.xrplevm.org",
      chainId: 1449000,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
