const xrpl = require('xrpl');

let client = null;

const getXRPLClient = () => {
  if (!client) {
    const network = process.env.XRPL_NETWORK || 'wss://s.altnet.rippletest.net:51233';
    client = new xrpl.Client(network);
  }
  return client;
};

const connectXRPL = async () => {
  const c = getXRPLClient();
  if (!c.isConnected()) {
    await c.connect();
    console.log(`[XRPL] Connected to ${c.url}`);
  }
  return c;
};

const disconnectXRPL = async () => {
  if (client && client.isConnected()) {
    await client.disconnect();
    console.log('[XRPL] Disconnected');
  }
};

module.exports = { getXRPLClient, connectXRPL, disconnectXRPL };
