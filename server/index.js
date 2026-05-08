// Load .env from project root (local dev) — silently skipped in Docker where
// env vars are injected via docker-compose env_file.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5002;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/xrpl', require('./routes/xrpl'));

app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/merchants', require('./routes/merchants'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/integration', require('./routes/integration'));
app.use('/api/public', require('./routes/public'));

// ── SafiScore credit layer ───────────────────────────────────
app.use('/api/safiscore', require('./routes/safiscore'));
app.use('/api/lender',    require('./routes/lender'));

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'SafiPoints API',
    version: '0.1.0',
    description: 'Blockchain-powered loyalty rewards on XRPL',
    endpoints: {
      health: 'GET /api/xrpl/health',
      auth: 'POST /api/auth/merchant/register | /api/auth/customer/register',
      loyalty: 'POST /api/loyalty/earn | /api/loyalty/redeem/initiate',
      webhook: 'POST /api/webhook/safisend',
    },
  });
});

// ─── Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n  SafiPoints API running on http://localhost:${PORT}`);
    console.log(`  XRPL Network: ${process.env.XRPL_NETWORK || 'testnet (default)'}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

start().catch(err => {
  console.error('Failed to start SafiPoints:', err);
  process.exit(1);
});

module.exports = app;
