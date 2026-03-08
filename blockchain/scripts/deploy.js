/**
 * ArtCurve — Deploy Script
 *
 * Deploys ArtFactory and:
 *  - Saves deployment JSON  → blockchain/deployments/{network}.json
 *  - Copies ABI artifacts   → frontend/lib/abis/*.json
 *  - Updates               → frontend/.env.local with factory address
 *
 * Usage:
 *   npm run deploy:local     (hardhat node)
 *   npm run deploy:sepolia   (Sepolia testnet)
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Resolve paths relative to project root
const ROOT = path.join(__dirname, "..", "..");
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts", "contracts");
const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");
const FRONTEND_ABIS_DIR = path.join(ROOT, "frontend", "lib", "abis");
const FRONTEND_ENV = path.join(ROOT, "frontend", ".env.local");

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║        ArtCurve — Deployment             ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`  Network  : ${network.name} (${chainId})`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(balance)} ETH`);
  console.log("╚══════════════════════════════════════════╝\n");

  if (balance === 0n && network.name !== "hardhat") {
    throw new Error("Deployer has 0 ETH. Get Sepolia ETH from https://sepoliafaucet.com");
  }

  // ── 1. Deploy ArtFactory ─────────────────────────────────────────────────
  console.log("📦 Deploying ArtFactory...");
  const ArtFactory = await ethers.getContractFactory("ArtFactory");
  const factory = await ArtFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const deployBlock = await ethers.provider.getBlockNumber();
  console.log(`✅ ArtFactory → ${factoryAddress}`);

  // ── 2. Copy ABIs to frontend ──────────────────────────────────────────────
  ensureDir(FRONTEND_ABIS_DIR);

  const abiPairs = [
    ["ArtFactory.sol/ArtFactory.json", "ArtFactory.json"],
    ["ArtBondingCurve.sol/ArtBondingCurve.json", "ArtBondingCurve.json"],
  ];

  let abisCopied = 0;
  for (const [src, dest] of abiPairs) {
    const srcPath = path.join(ARTIFACTS_DIR, src);
    const destPath = path.join(FRONTEND_ABIS_DIR, dest);
    if (fs.existsSync(srcPath)) {
      // Only copy the ABI array, not the full artifact (smaller file)
      const artifact = JSON.parse(fs.readFileSync(srcPath, "utf8"));
      fs.writeFileSync(destPath, JSON.stringify({ abi: artifact.abi }, null, 2));
      abisCopied++;
    }
  }
  console.log(`✅ ABIs copied to frontend/lib/abis/ (${abisCopied} files)`);

  // ── 3. Save deployment JSON ───────────────────────────────────────────────
  ensureDir(DEPLOYMENTS_DIR);

  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    factoryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: deployBlock,
  };

  const deploymentPath = path.join(DEPLOYMENTS_DIR, `${network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`✅ Deployment info → deployments/${network.name}.json`);

  // ── 4. Update frontend/.env.local ─────────────────────────────────────────
  updateEnvFile(FRONTEND_ENV, {
    NEXT_PUBLIC_FACTORY_ADDRESS: factoryAddress,
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
  });
  console.log("✅ frontend/.env.local updated");

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                 DEPLOYMENT COMPLETE                  ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`  ArtFactory : ${factoryAddress}`);
  console.log(`  Network    : ${network.name} (chainId: ${chainId})`);
  console.log(`  Block      : #${deployBlock}`);
  console.log("╠══════════════════════════════════════════════════════╣");

  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("  NEXT STEPS:");
    console.log(`  1. Verify: npm run verify:${network.name}`);
    console.log("  2. Start indexer: cd ../indexer && npm start");
    console.log("  3. Start frontend: cd ../frontend && npm run dev");

    const explorerBase = getExplorerBase(Number(chainId));
    if (explorerBase) {
      console.log(`\n  Explorer: ${explorerBase}/address/${factoryAddress}`);
    }
  } else {
    console.log("  NEXT STEPS:");
    console.log("  1. Seed test data: npm run seed");
    console.log("  2. Start frontend: cd ../frontend && npm run dev");
    console.log("  3. Connect MetaMask to http://localhost:8545 (chainId: 31337)");
  }
  console.log("╚══════════════════════════════════════════════════════╝\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Update or create key=value pairs in a .env file */
function updateEnvFile(filePath, updates) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    if (content.includes(key + "=")) {
      content = content.replace(new RegExp(`${key}=.*`), line);
    } else {
      content = content.trimEnd() + "\n" + line;
    }
  }
  fs.writeFileSync(filePath, content.trimEnd() + "\n");
}

function getExplorerBase(chainId) {
  const explorers = {
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    80002: "https://amoy.polygonscan.com",
    84532: "https://sepolia.basescan.org",
  };
  return explorers[chainId] ?? null;
}

main().catch((err) => {
  console.error("\n❌ Deploy failed:", err.message);
  process.exit(1);
});
