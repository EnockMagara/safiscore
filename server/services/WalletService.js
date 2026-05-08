const XRPLService = require('./XRPLService');
const { encrypt, decrypt } = require('../config/encryption');

class WalletService {
  /**
   * Create a new XRPL wallet, encrypt the seed, and return public info + encrypted seed.
   */
  static async createWallet() {
    const { address, seed } = await XRPLService.createWallet();
    const seedEnc = encrypt(seed);
    return { address, seedEnc, seed };
  }

  /**
   * Restore a wallet object from an encrypted seed stored in the DB.
   */
  static restoreWallet(encryptedSeed) {
    const seed = decrypt(encryptedSeed);
    return XRPLService.walletFromSeed(seed);
  }

  /**
   * Create a customer wallet and set up the SAFI trust line to the issuer.
   */
  static async createCustomerWallet(issuerAddress) {
    const { address, seedEnc, seed } = await this.createWallet();
    const wallet = XRPLService.walletFromSeed(seed);
    const trustResult = await XRPLService.setTrustLine(wallet, issuerAddress);
    return {
      address,
      seedEnc,
      trustLineSet: trustResult.success,
      trustTxHash: trustResult.hash,
    };
  }
}

module.exports = WalletService;
