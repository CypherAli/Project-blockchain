# ArtCurve — Developer Setup Guide

> Art trading platform powered by linear bonding curves.
> Inspired by pump.fun, built for artists.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                           │
│                   Next.js Frontend (port 3000)                 │
└───────────────┬─────────────────────────┬───────────────────────┘
                │ wagmi / viem (RPC)       │ axios (REST API)
                ▼                          ▼
┌──────────────────────┐       ┌──────────────────────────────────┐
│  Blockchain (EVM)    │       │   Indexer (port 3001)            │
│  • ArtFactory.sol    │──────▶│   • Express REST API             │
│  • ArtBondingCurve   │events │   • PostgreSQL (Prisma ORM)      │
│  Hardhat / Sepolia   │       │   • Trending score engine        │
└──────────────────────┘       └──────────────────────────────────┘
```

- **Blockchain** is the source of truth — all state lives on-chain.
- **Indexer** is a performance cache — trades/artworks indexed from events.
- **Frontend** reads from blockchain via wagmi + falls back gracefully when indexer is offline.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | comes with Node |
| Docker Desktop | latest | https://docker.com/products/docker-desktop |
| Git | any | https://git-scm.com |

---

## Quick Start — Local Development

### Step 1: Clone and install

```bash
git clone https://github.com/CypherAli/Project-blockchain.git artcurve
cd artcurve

# Install all workspaces
npm install --prefix blockchain
npm install --prefix indexer
npm install --prefix frontend
```

### Step 2: Start PostgreSQL

```bash
docker-compose up postgres -d
```

Postgres is now running at `localhost:5432` with:
- Database: `artcurve`
- User: `postgres`
- Password: `localpass`

### Step 3: Start local blockchain

```bash
cd blockchain
npx hardhat node
# Keep this terminal open — this is your local RPC at http://localhost:8545
```

### Step 4: Deploy contracts

Open a new terminal:

```bash
cd blockchain
npm run deploy:local
```

This will:
1. Deploy `ArtFactory` to your local Hardhat node
2. Copy contract ABIs to `frontend/lib/abis/`
3. Update `frontend/.env.local` with the factory address

### Step 5: (Optional) Seed test data

```bash
cd blockchain
npm run seed
# Creates 5 artworks with sample trades on local node
```

### Step 6: Run the indexer

```bash
cd indexer

# Copy and fill in the env file
cp .env.example .env
# Edit .env — at minimum set FACTORY_ADDRESS to the address from Step 4

# Run database migrations
npm run db:migrate

# Start the indexer
npm run dev
# Indexer runs at http://localhost:3001
```

### Step 7: Start the frontend

```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

**Done!** Open http://localhost:3000 and connect MetaMask to the local Hardhat network:
- RPC URL: `http://localhost:8545`
- Chain ID: `31337`
- Currency: `ETH`

---

## Environment Variables Reference

### `frontend/.env.local`

```env
# ── Required ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_FACTORY_ADDRESS=0x...       # Set automatically by npm run deploy:local
NEXT_PUBLIC_CHAIN_ID=31337              # 31337=local, 11155111=sepolia

# ── Wallet Connect ───────────────────────────────────────────────────────────
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # Get from https://cloud.walletconnect.com

# ── Indexer (optional — frontend works without it via direct RPC) ────────────
NEXT_PUBLIC_INDEXER_URL=http://localhost:3001

# ── IPFS / Pinata (for artwork uploads) ─────────────────────────────────────
NEXT_PUBLIC_PINATA_JWT=                 # JWT from https://pinata.cloud (recommended)
# OR legacy API key approach:
# PINATA_API_KEY=
# PINATA_API_SECRET=
```

### `indexer/.env`

```env
# ── Required ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:localpass@localhost:5432/artcurve
RPC_URL=http://localhost:8545
FACTORY_ADDRESS=0x...                   # From deploy output

# ── Optional ──────────────────────────────────────────────────────────────────
CHAIN_ID=31337
START_BLOCK=0                           # Block to start indexing from (use deploy block for speed)
API_PORT=3001
POLL_INTERVAL_MS=3000
FRONTEND_URL=http://localhost:3000      # For CORS
```

---

## Sepolia Testnet Deployment

### 1. Get Sepolia ETH

Visit https://sepoliafaucet.com or https://faucet.alchemy.com/faucets/ethereum-sepolia

### 2. Get an Alchemy RPC URL

1. Go to https://alchemy.com → Create account → New App → Ethereum Sepolia
2. Copy the HTTPS URL

### 3. Configure blockchain env

```bash
cd blockchain
cp .env.example .env
```

Edit `blockchain/.env`:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...your_wallet_private_key...
ETHERSCAN_API_KEY=...  # Optional — for contract verification
```

### 4. Deploy to Sepolia

```bash
cd blockchain
npm run deploy:sepolia
```

This updates `frontend/.env.local` automatically.

### 5. Verify on Etherscan (optional)

```bash
npm run verify:sepolia
```

### 6. Configure production indexer

Edit `indexer/.env`:
```env
DATABASE_URL=postgresql://...   # Your production PostgreSQL URL
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
FACTORY_ADDRESS=0x...           # From Sepolia deploy output
CHAIN_ID=11155111
START_BLOCK=...                 # Block number from deploy output (saves time)
```

### 7. Run indexer with Docker Compose

```bash
docker-compose up -d
# Both postgres + indexer run in containers
```

---

## Vercel Deployment (Frontend)

### Manual

```bash
cd frontend
npx vercel --prod
```

### Automatic (GitHub Actions)

1. Connect repo to Vercel at https://vercel.com
2. Add these GitHub Secrets (Settings → Secrets → Actions):

| Secret | Where to get |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel account → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after first `vercel` run |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after first `vercel` run |
| `WALLETCONNECT_PROJECT_ID` | cloud.walletconnect.com |

3. Push to `main` → auto-deploys

### Vercel Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_FACTORY_ADDRESS      = 0x... (Sepolia address)
NEXT_PUBLIC_CHAIN_ID             = 11155111
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = ...
NEXT_PUBLIC_INDEXER_URL          = https://your-indexer-url.com
NEXT_PUBLIC_PINATA_JWT           = ...
```

---

## Common Commands

### Blockchain

```bash
# Compile contracts
cd blockchain && npm run compile

# Run all 53 tests
cd blockchain && npm test

# Start local node
cd blockchain && npx hardhat node

# Deploy to local
cd blockchain && npm run deploy:local

# Deploy to Sepolia
cd blockchain && npm run deploy:sepolia

# Verify on Etherscan
cd blockchain && npm run verify:sepolia

# Seed local test data (5 artworks + trades)
cd blockchain && npm run seed
```

### Indexer

```bash
# Run migrations (always use migrate, never db push)
cd indexer && npm run db:migrate

# Open Prisma Studio (visual DB browser)
cd indexer && npm run db:studio

# Development (watch mode)
cd indexer && npm run dev

# Production build + start
cd indexer && npm run build && npm start
```

### Frontend

```bash
# Development server
cd frontend && npm run dev

# Production build (catches TS errors)
cd frontend && npm run build

# Type check only
cd frontend && npx tsc --noEmit
```

### Docker

```bash
# Start database only
docker-compose up postgres -d

# Start database + indexer
docker-compose up -d

# View indexer logs
docker-compose logs -f indexer

# Stop everything
docker-compose down

# Wipe database and restart fresh
docker-compose down -v && docker-compose up -d
```

---

## Project Structure

```
artcurve/
├── blockchain/                  Hardhat + Solidity
│   ├── contracts/
│   │   ├── ArtFactory.sol       Factory + registry (Ownable)
│   │   └── ArtBondingCurve.sol  ERC-20 shares + linear bonding curve
│   ├── test/                    53 unit tests (Hardhat + Chai)
│   ├── scripts/
│   │   ├── deploy.js            Deploy + copy ABIs + update .env
│   │   ├── verify.js            Etherscan verification
│   │   └── seed.js              Local test data (5 artworks)
│   ├── hardhat.config.js
│   └── package.json
│
├── shared/                      Shared TypeScript (frontend + indexer)
│   ├── bondingCurve.ts          Math utilities (getBuyCost, quoteBuy, etc.)
│   └── types.ts                 Shared interfaces (ArtworkInfo, TradeEvent, etc.)
│
├── indexer/                     Event indexer + REST API
│   ├── src/
│   │   ├── index.ts             Entry point (catch-up + polling loop)
│   │   ├── config.ts            Env validation
│   │   ├── db/client.ts         Prisma singleton
│   │   ├── listeners/
│   │   │   ├── artworkCreated.ts  Index ArtworkCreated events
│   │   │   └── trades.ts          Index SharesBought/SharesSold/Graduated
│   │   └── api/
│   │       ├── server.ts          Express + CORS setup
│   │       ├── artworks.ts        GET /api/artworks, /api/artworks/:address
│   │       ├── trades.ts          GET /api/artworks/:address/trades
│   │       └── stats.ts           GET /api/stats
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/          Always use `prisma migrate dev`
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── frontend/                    Next.js 15 app
│   ├── app/
│   │   ├── layout.tsx           Root layout + metadata (server component)
│   │   ├── providers.tsx        Client providers (wagmi, rainbowkit, toast)
│   │   ├── page.tsx             Home + live feed
│   │   ├── explore/page.tsx     Artwork list + search + sort
│   │   ├── artwork/[address]/   Artwork detail + trading
│   │   ├── create/page.tsx      Create artwork form
│   │   ├── profile/[address]/   Artist profile + portfolio
│   │   └── admin/page.tsx       Platform admin (owner only)
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Skeleton.tsx     Loading skeletons
│   │   │   ├── Toast.tsx        Notification system
│   │   │   └── ErrorBoundary.tsx Error handling
│   │   ├── ArtworkCard.tsx      Horizontal artwork card (IPFS fallback)
│   │   ├── Navbar.tsx           Top navigation
│   │   ├── TradePanel.tsx       Buy/sell panel with Toast
│   │   └── PriceChart.tsx       Recharts price chart
│   ├── lib/
│   │   ├── abis/                ABI JSON (auto-copied by deploy script)
│   │   ├── config.ts            Env validation + IPFS gateways + explorer URLs
│   │   ├── api.ts               Indexer API client (typed, with timeout)
│   │   ├── contracts.ts         Contract ABIs + factory address + math re-exports
│   │   ├── hooks.ts             All React Query + wagmi hooks
│   │   ├── ipfs.ts              IPFS upload (Pinata) + multi-gateway fetch
│   │   └── wagmi.ts             wagmi config (chains, connectors)
│   └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml               Tests on push/PR
│       └── deploy-frontend.yml  Auto-deploy to Vercel on main merge
│
├── docker-compose.yml           PostgreSQL + Indexer containers
├── .gitignore
└── SETUP.md                     This file
```

---

## Bonding Curve Math

The price of share `n` when supply is `S`:

```
price(S, n) = k·n·(2S+n)/2 + p0·n
```

Where:
- `k = 0.0001 ETH` (curve steepness) — controls how fast price rises
- `p0 = 0.001 ETH` (floor price) — minimum price per share
- Fees: **5% royalty** to artist + **1% platform fee** on every buy and sell

Graduation threshold: **24 ETH** reserve → artwork "graduates".

The math is implemented once in `shared/bondingCurve.ts` and shared between frontend and indexer to guarantee identical calculations.

---

## Indexer API Reference

Base URL: `http://localhost:3001` (dev) or your deployed indexer URL.

### `GET /api/artworks`

Query artworks with sorting and filtering.

**Query params:**
- `sort`: `trending` | `newest` | `graduating` | `graduated` (default: `trending`)
- `page`: number (default: `1`)
- `limit`: number (default: `20`, max: `100`)
- `search`: string (name filter)
- `artist`: address (filter by artist)

### `GET /api/artworks/:address`

Get a single artwork with all fields.

### `GET /api/artworks/:address/trades`

Get trade history for an artwork.

**Query params:**
- `page`: number (default: `1`)
- `limit`: number (default: `50`)

### `GET /api/stats`

Get platform-wide statistics (total artworks, volume, graduated count, etc.)

### `GET /health`

Returns `200 OK` with `{ status: "ok" }` when indexer is running.

---

## Troubleshooting

### "NEXT_PUBLIC_FACTORY_ADDRESS is not set"

Run `cd blockchain && npm run deploy:local` first. This updates `frontend/.env.local` automatically.

### "Cannot connect to database"

Make sure Docker is running: `docker-compose up postgres -d`
Then check: `docker-compose exec postgres pg_isready -U postgres`

### MetaMask shows wrong network

Add Hardhat network to MetaMask:
- Network name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency: `ETH`

### Indexer not catching events

Check that `FACTORY_ADDRESS` in `indexer/.env` matches the deployed address.
Check `START_BLOCK` — set it to the deploy block number to avoid scanning from genesis.

### IPFS images not loading

Images fall back through 4 gateways automatically. If all fail, a placeholder image is shown.
For production, configure `NEXT_PUBLIC_PINATA_JWT` to pin images on upload.

### CI/CD GitHub Actions failing

- **Contracts job**: Check `blockchain/package.json` scripts match `npm test` and `npm run compile`
- **Frontend job**: Add `WALLETCONNECT_PROJECT_ID` to GitHub Secrets
- **Vercel deploy**: Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` to GitHub Secrets

---

## What the User Must Do (Keys / Accounts)

Claude wrote all the code. These require you to create accounts or provide secrets:

| Task | Link | Time |
|------|------|------|
| Get WalletConnect Project ID | https://cloud.walletconnect.com | 5 min |
| Get Pinata API key (IPFS uploads) | https://pinata.cloud → API Keys | 5 min |
| Get Alchemy RPC URL (Sepolia) | https://alchemy.com | 5 min |
| Install Docker Desktop | https://docker.com/products/docker-desktop | 10 min |
| Create Vercel account + connect repo | https://vercel.com | 10 min |
| Fund a wallet with Sepolia ETH | https://sepoliafaucet.com | 2 min |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes + ensure tests pass: `cd blockchain && npm test`
4. Ensure frontend builds: `cd frontend && npm run build`
5. Open a Pull Request → CI runs automatically

---

*ArtCurve — where art meets DeFi.*
