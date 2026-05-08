# SafiPoints — Blockchain Loyalty Rewards on XRPL

Blockchain-powered loyalty and cashback system for restaurants and retail, built on the XRP Ledger. Customers earn **SAFI tokens** automatically when they pay, store them on-chain, and redeem them for discounts at checkout. Extended with **SafiScore** — a verifiable on-chain credit profile built from retail spending history.

---

## How It Works

```
Customer scans QR → browses menu → places order → pays →
  SAFI tokens minted on XRPL → customer claims via SMS OTP →
  redeems at next visit for a discount
```

1. **Scan** — Customer scans the merchant QR code
2. **Order** — Browse menu, add items, enter UAE mobile number (+971...)
3. **Earn** — SAFI tokens minted on XRPL as cashback (10% of spend)
4. **Claim** — First-time customers claim via SMS OTP link; returning customers get auto-minted
5. **Redeem** — Toggle "Pay with SAFI Points" at checkout to apply discount

---

## Architecture

```
React SPA ──→ Nginx (SSL) ──→ Express API ──→ MongoDB
                                    │
                                    └──→ XRPL Testnet (token mint/burn/balance)
                                    │
                                    └──→ XRPL EVM Sidechain (SafiScore contracts)
```

| Layer | Stack |
|---|---|
| Frontend | React, Framer Motion, custom CSS |
| API | Node.js, Express, Mongoose |
| Database | MongoDB 7 |
| Blockchain | XRPL Testnet — SAFI (3-char IOU) |
| Smart Contracts | Solidity / Hardhat — XRPL EVM Sidechain |
| Infrastructure | Docker Compose, Nginx, Let's Encrypt SSL |

---

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for the recommended path)
- MongoDB 7 (if running natively)
- Git

---

## Running Locally

### Option A — Docker Compose (recommended)

```bash
# 1. Clone
git clone https://github.com/EnockMagara/SAFIPOINTS.git
cd SAFIPOINTS

# 2. Configure environment
cp .env.example .env
```

Open `.env` and set at minimum:

```
MONGODB_URI=mongodb://mongo:27017/safipoints
JWT_SECRET=your_long_random_secret_here
ENCRYPTION_KEY=exactly_32_characters_here_!!!!!
XRPL_NETWORK=wss://s.altnet.rippletest.net:51233
```

```bash
# 3. Start all services (MongoDB, API, React, Nginx)
docker compose up -d

# 4. Seed demo data (creates XRPL wallets — takes ~30s)
docker compose exec api node scripts/seed.js

# 5. Seed demo menu items
docker compose exec api node scripts/seed-menu.js al-fanar-restaurant
```

App is available at **http://localhost**.

---

### Option B — Native (no Docker)

```bash
# 1. Clone and install dependencies
git clone https://github.com/EnockMagara/SAFIPOINTS.git
cd SAFIPOINTS

npm install                        # root dev tools
npm install --prefix server        # API dependencies
npm install --prefix client        # React dependencies

# 2. Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI=mongodb://localhost:27017/safipoints
# and set JWT_SECRET, ENCRYPTION_KEY (exactly 32 chars)

# 3. Start MongoDB (must be running before the API)
mongod

# 4. Start API and React in parallel
npm run dev
# API runs on http://localhost:5002
# React runs on http://localhost:3000

# 5. Seed demo data (in a new terminal)
npm run seed
# or: cd server && node scripts/seed.js

# 6. Seed menu items
cd server && node scripts/seed-menu.js al-fanar-restaurant
```

---

## Smart Contracts (SafiScore)

Contracts live in `contracts/` and are deployed to the XRPL EVM Sidechain.

```bash
cd contracts
npm install

# Compile
npm run compile

# Run tests
npm test

# Deploy to local Hardhat node
npm run node                    # terminal 1 — start local chain
npm run deploy:local            # terminal 2 — deploy contracts

# Deploy to XRPL EVM testnet
npm run deploy:testnet
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `ENCRYPTION_KEY` | Yes | AES-256 key — **must be exactly 32 characters** |
| `XRPL_NETWORK` | Yes | XRPL WebSocket endpoint |
| `XRPL_ISSUER_ADDRESS` | No | Pre-funded issuer wallet address (auto-created if blank) |
| `XRPL_ISSUER_SEED` | No | Issuer wallet seed |
| `CLIENT_URL` | No | Frontend URL for claim SMS links (default: http://localhost:3000) |
| `PORT` | No | API port (default: 5002) |

---

## Demo Credentials

After running `seed.js`:

| Role | Login | Password |
|---|---|---|
| Merchant | alfanar@demo.com | demo1234 |
| Customer | +971551111111 | — (phone only) |

**Try the order flow:**
1. Go to `http://localhost:3000/m/al-fanar-restaurant`
2. Add items to cart
3. Enter phone `+971551111111` and place order
4. On the payment page the SAFI toggle appears — use it to apply a discount

---

## Production Deployment

```bash
# Build and push images
docker compose build
docker compose push

# On the server
docker compose up -d

# Services started:
# mongo:7       — database
# api           — Express on :5002 (internal)
# client        — Nginx serving React build
# nginx         — reverse proxy, SSL termination (ports 80 / 443)
# certbot       — Let's Encrypt auto-renewal
```

---

## Project Structure

```
SAFIPOINTS/
├── client/          # React frontend
│   └── src/
│       ├── pages/   # Landing, Login, MenuPage, CustomerWallet, MerchantDashboard ...
│       ├── components/
│       └── api/
├── server/          # Express API
│   ├── routes/      # auth, loyalty, merchants, customers, safiscore ...
│   ├── services/    # XRPLService, TokenService, SafiScoreService ...
│   ├── models/      # Mongoose schemas
│   └── scripts/     # seed.js, seed-menu.js
├── contracts/       # Solidity — SafiScoreRegistry, MerchantRegistry
│   └── contracts/
└── deploy/          # Nginx config, Docker helpers, SSL init
```
