# SafiScore — Verifiable Credit Profiles on XRPL

**SafiScore** is an alternative credit scoring system for the UAE built on the XRP Ledger. It turns verified retail spending history into a shareable credit profile — designed for customers with no AECB bureau history, such as expats and first-time borrowers.

Built on top of **SafiPoints**, a blockchain loyalty system for UAE restaurants where customers earn SAFI tokens automatically when they pay and redeem them for discounts. Every transaction is attested on XRPL, forming the raw data layer for SafiScore.

> **Status:** Development / Demo. Intended for ADGM/DIFC regulatory sandbox evaluation. Not a licensed credit bureau product.

---

## How It Works

### Loyalty layer (SafiPoints)
```
Customer scans QR → browses menu → places order → pays →
  SAFI tokens minted on XRPL → customer claims via SMS OTP →
  redeems at next visit for a discount
```

1. **Scan** — Customer scans the merchant QR code
2. **Order** — Browse menu, add items, enter UAE mobile number (+971...)
3. **Earn** — SAFI tokens minted on XRPL as cashback (10% of spend)
4. **Claim** — First-time customers claim via SMS OTP link; returning customers get auto-minted
5. **Redeem** — Toggle "Pay with SAFI Points" at checkout to apply a discount

### Credit layer (SafiScore)
```
Customer activates SafiScore → spending history analysed →
  1–5 band score computed → customer generates signed attestation →
  shares link with lender → lender verifies cryptographic signature
```

Scores are computed from five components weighted as follows:

| Component | Weight | What it measures |
|---|---|---|
| Consistency | 30% | Regular spending month-over-month |
| Recency | 25% | How recently the customer was active |
| Depth | 20% | Average spend per transaction |
| Diversity | 15% | Number of distinct merchants |
| Volume Trend | 10% | Whether spend is growing over time |

The output is a **signed attestation** — not a raw data export. Lenders receive a cryptographically signed statement (score band, months of history, merchant diversity, spend band) with no access to underlying transaction amounts or personal data.

---

## Architecture

```
React SPA ──→ Nginx (SSL) ──→ Express API ──→ MongoDB
                                    │
                                    ├──→ XRPL Testnet (SAFI token mint/burn, tx attestations)
                                    │
                                    └──→ XRPL EVM Sidechain (SafiScore Solidity contracts)
```

| Layer | Stack |
|---|---|
| Frontend | React, Framer Motion, custom CSS |
| API | Node.js, Express, Mongoose |
| Database | MongoDB 7 |
| Blockchain (tokens) | XRPL Testnet — SAFI (IOU token) |
| Blockchain (contracts) | Solidity / Hardhat — XRPL EVM Sidechain |
| Infrastructure | Docker Compose, Nginx, Let's Encrypt SSL |

**Smart contract addresses (XRPL EVM Testnet):**
- `MerchantRegistry`: `0xD0B9d0a21728c3BC317630873e8b2AA1A5B29219`
- `SafiScoreRegistry`: `0x15145d9AD3B597729B8222d98Fa49499646A9d44`

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
git clone https://github.com/EnockMagara/safiscore.git
cd safiscore

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
git clone https://github.com/EnockMagara/safiscore.git
cd safiscore

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
safiscore/
├── client/          # React frontend
│   └── src/
│       ├── pages/   # Landing, Login, MenuPage, CustomerWallet, CreditDashboard, LenderPortal ...
│       ├── components/
│       └── api/
├── server/          # Express API
│   ├── routes/      # auth, loyalty, merchants, customers, safiscore, lender ...
│   ├── services/    # XRPLService, TokenService, SafiScoreService, ProofService ...
│   ├── models/      # Mongoose schemas
│   └── scripts/     # seed.js, seed-menu.js
├── contracts/       # Solidity — SafiScoreRegistry, MerchantRegistry
│   └── contracts/
└── deploy/          # Nginx config, Docker helpers, SSL init
```

---

## SafiScore API Reference

All SafiScore endpoints are prefixed `/api/safiscore`. Customer routes require a JWT (`Authorization: Bearer <token>`). The lender verify endpoint is public.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/safiscore/profile` | Customer JWT | Get current score, components, and history |
| `POST` | `/api/safiscore/profile/refresh` | Customer JWT | Recompute score from latest transactions |
| `POST` | `/api/safiscore/consent` | Customer JWT | Activate SafiScore (required once) |
| `POST` | `/api/safiscore/generate-proof` | Customer JWT | Generate a signed attestation for a lender |
| `GET` | `/api/safiscore/attestations` | Customer JWT | List all active attestations |
| `DELETE` | `/api/safiscore/attestations/:id` | Customer JWT | Revoke an attestation |
| `GET` | `/api/safiscore/verify/:attestationId` | Public | Verify an attestation (lender-facing) |

**Generate attestation — request body:**
```json
{
  "lenderIdentifier": "emirates-nbd.com",
  "lenderName": "Emirates NBD",
  "attributes": ["scoreBand", "monthsOfHistory", "merchantDiversity", "averageMonthlySpend"]
}
```

**Verify attestation — response:**
```json
{
  "valid": true,
  "attestation": {
    "scoreBand": 4,
    "monthsOfHistory": 8,
    "merchantDiversity": 5,
    "averageMonthlySpend": "medium",
    "issuedAt": "2026-05-08T10:00:00Z",
    "expiresAt": "2026-06-07T10:00:00Z",
    "commitmentHash": "a3f9...",
    "proofHash": "7c2d..."
  }
}
```
