# ArtCurve — Bonding Curve Art Trading Platform
## Hướng dẫn chạy local

---

## CẤU TRÚC DỰ ÁN

```
E:\Project\
├── blockchain\          ← Smart Contracts (Hardhat + Solidity)
│   ├── contracts\
│   │   ├── ArtBondingCurve.sol   ← Contract chính của từng artwork
│   │   └── ArtFactory.sol        ← Factory deploy & registry
│   ├── test\                     ← 53 unit tests
│   └── scripts\deploy.js         ← Script deploy
└── frontend\            ← Next.js dApp
    ├── app\
    │   ├── page.tsx              ← Trang chủ (trending)
    │   ├── explore\              ← Browse artworks
    │   ├── artwork\[address]\    ← Chi tiết + Buy/Sell
    │   ├── create\               ← Upload & launch artwork
    │   └── profile\[address]\    ← Artist/collector profile
    ├── components\
    │   ├── Navbar.tsx
    │   ├── ArtworkCard.tsx
    │   ├── TradePanel.tsx        ← Buy/Sell UI
    │   └── PriceChart.tsx        ← Recharts price history
    └── lib\
        ├── contracts.ts          ← ABIs, addresses, math helpers
        ├── wagmi.ts              ← Wagmi config (RainbowKit)
        ├── hooks.ts              ← React hooks cho contracts
        └── ipfs.ts               ← Pinata IPFS upload
```

---

## BƯỚC 1: CHẠY LOCAL BLOCKCHAIN

```bash
# Terminal 1 — khởi động Hardhat node
cd E:\Project\blockchain
npm install
npx hardhat node
```

Node sẽ chạy tại http://127.0.0.1:8545 và in ra 20 account test (mỗi cái 10000 ETH)

```bash
# Terminal 2 — deploy contracts
cd E:\Project\blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Copy địa chỉ ArtFactory in ra, paste vào frontend/.env.local

---

## BƯỚC 2: CHẠY FRONTEND

```bash
cd E:\Project\frontend
npm install
npm run dev
```

Mở http://localhost:3000

---

## BƯỚC 3: KẾT NỐI METAMASK

1. Mở MetaMask → Add Network:
   - Network Name: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency: ETH

2. Import private key từ Hardhat node output:
   - Account #0: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

---

## BƯỚC 4: DEPLOY LÊN SEPOLIA (testnet thật)

1. Lấy Sepolia ETH từ faucet: https://sepoliafaucet.com

2. Tạo file `blockchain/.env`:
```
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_key
```

3. Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

4. Verify contract:
```bash
npx hardhat verify --network sepolia <FACTORY_ADDRESS>
```

---

## CHẠY TESTS

```bash
cd E:\Project\blockchain
npx hardhat test
# Output: 53 passing
```

---

## PINATA IPFS (upload tranh)

1. Đăng ký tại https://pinata.cloud (free tier: 1GB)
2. Tạo API key
3. Paste vào `frontend/.env.local`:
```
NEXT_PUBLIC_PINATA_JWT=your_jwt_token
```

---

## TÍNH NĂNG

- ✅ Bonding curve tự động định giá theo cung cầu
- ✅ Artist nhận 5% royalty trên MỌI giao dịch (cả buy lẫn sell)
- ✅ Platform fee 1%
- ✅ Fractional ownership — mua 1 share thay vì cả bức tranh
- ✅ Slippage protection
- ✅ Graduation mechanic (24 ETH reserve)
- ✅ IPFS lưu tranh (bất biến, phi tập trung)
- ✅ Price chart realtime từ on-chain events
- ✅ Artist profile + royalty tracking
- ✅ Collector portfolio
- ✅ 53 unit tests pass 100%
