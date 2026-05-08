const xrpl = require('xrpl');
const { connectXRPL } = require('../config/xrpl');

/**
 * XRPL currency codes: 3 ASCII chars used as-is, anything else must be
 * hex-encoded to exactly 40 hex characters (20 bytes, zero-padded right).
 */
function encodeCurrency(code) {
  if (code.length === 3) return code;
  const hex = Buffer.from(code, 'ascii').toString('hex').toUpperCase();
  return hex.padEnd(40, '0');
}

const CURRENCY_CODE = encodeCurrency(process.env.SAFI_CURRENCY_CODE || 'SAFI');

class XRPLService {
  /**
   * Generate a new XRPL wallet (testnet-funded).
   * Returns { address, seed, classicAddress }
   */
  static async createWallet() {
    const client = await connectXRPL();
    const fund = await client.fundWallet();
    return {
      address: fund.wallet.classicAddress,
      seed: fund.wallet.seed,
      wallet: fund.wallet,
    };
  }

  /**
   * Restore a wallet from a stored seed.
   */
  static walletFromSeed(seed) {
    return xrpl.Wallet.fromSeed(seed);
  }

  /**
   * Set a trust line from `wallet` to `issuerAddress` for SAFI tokens.
   * The trust line allows the wallet to hold the issued currency.
   */
  static async setTrustLine(wallet, issuerAddress, limit = '1000000') {
    const client = await connectXRPL();
    const tx = {
      TransactionType: 'TrustSet',
      Account: wallet.classicAddress,
      LimitAmount: {
        currency: CURRENCY_CODE,
        issuer: issuerAddress,
        value: limit,
      },
    };
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      hash: result.result.hash,
      ledgerIndex: result.result.ledger_index,
    };
  }

  /**
   * Send SAFI tokens from issuer to customer (earn) or customer to issuer (redeem/burn).
   *
   * @param {object}      senderWallet       - xrpl.Wallet instance
   * @param {string}      destinationAddress - recipient XRPL address
   * @param {number}      amount             - token amount
   * @param {string}      issuerAddress      - XRPL issuer address
   * @param {object|null} memoData           - optional SafiScore attestation memo payload
   */
  static async sendTokens(senderWallet, destinationAddress, amount, issuerAddress, memoData = null) {
    const client = await connectXRPL();
    const tx = {
      TransactionType: 'Payment',
      Account: senderWallet.classicAddress,
      Destination: destinationAddress,
      Amount: {
        currency: CURRENCY_CODE,
        issuer: issuerAddress,
        value: String(amount),
      },
    };

    // Attach SafiScore attestation memo if provided.
    // XRPL Memos must be hex-encoded; keep payload compact to stay under ~1KB limit.
    if (memoData) {
      const toHex = (str) => Buffer.from(str, 'utf8').toString('hex').toUpperCase();
      tx.Memos = [{
        Memo: {
          MemoType:   toHex('safiscore/v1'),
          MemoFormat: toHex('application/json'),
          MemoData:   toHex(JSON.stringify(memoData)),
        },
      }];
    }

    const prepared = await client.autofill(tx);
    const signed = senderWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      hash: result.result.hash,
      ledgerIndex: result.result.ledger_index,
      resultCode: result.result.meta.TransactionResult,
    };
  }

  /**
   * Get the SAFI token balance for an address.
   */
  static async getTokenBalance(address, issuerAddress) {
    const client = await connectXRPL();
    try {
      const response = await client.request({
        command: 'account_lines',
        account: address,
        peer: issuerAddress,
      });
      const line = response.result.lines.find(l => l.currency === CURRENCY_CODE);
      return line ? parseFloat(line.balance) : 0;
    } catch (err) {
      if (err.data?.error === 'actNotFound') return 0;
      throw err;
    }
  }

  /**
   * Get basic account info (for health checks / debug).
   */
  static async getAccountInfo(address) {
    const client = await connectXRPL();
    try {
      const response = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated',
      });
      return response.result.account_data;
    } catch (err) {
      if (err.data?.error === 'actNotFound') return null;
      throw err;
    }
  }

  /**
   * Look up a transaction by hash.
   */
  static async getTransaction(hash) {
    const client = await connectXRPL();
    const response = await client.request({
      command: 'tx',
      transaction: hash,
    });
    return response.result;
  }

  /**
   * Check whether the XRPL client is connected.
   */
  static async healthCheck() {
    try {
      const client = await connectXRPL();
      const response = await client.request({ command: 'server_info' });
      return {
        connected: true,
        serverState: response.result.info.server_state,
        network: client.url,
        ledgerIndex: response.result.info.validated_ledger?.seq,
      };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }
}

module.exports = XRPLService;
