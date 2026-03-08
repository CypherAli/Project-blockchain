/**
 * ArtCurve — Etherscan Verification Script
 *
 * Reads the deployment JSON for the given network and verifies
 * ArtFactory on the appropriate block explorer.
 *
 * Usage:
 *   npx hardhat run scripts/verify.js --network sepolia
 *   npx hardhat run scripts/verify.js --network polygon-amoy
 *   npx hardhat run scripts/verify.js --network base-sepolia
 */

const { run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentPath = path.join(
    __dirname, "..", "deployments", `${network.name}.json`
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `No deployment found for network "${network.name}". ` +
      `Run: npm run deploy:${network.name} first.`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { factoryAddress, chainId } = deployment;

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║      ArtCurve — Contract Verification    ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`  Network    : ${network.name} (${chainId})`);
  console.log(`  ArtFactory : ${factoryAddress}`);
  console.log(`  Deployed   : ${deployment.deployedAt}`);
  console.log("╚══════════════════════════════════════════╝\n");

  // ArtFactory has no constructor arguments
  console.log("🔍 Verifying ArtFactory...");
  try {
    await run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [],
      contract: "contracts/ArtFactory.sol:ArtFactory",
    });
    console.log("✅ ArtFactory verified!\n");
  } catch (err) {
    if (err.message.includes("Already Verified")) {
      console.log("✅ ArtFactory already verified.\n");
    } else {
      console.error("❌ Verification failed:", err.message);
      process.exit(1);
    }
  }

  // Get explorer URL for result
  const explorerUrls = {
    11155111: `https://sepolia.etherscan.io/address/${factoryAddress}#code`,
    80002:    `https://amoy.polygonscan.com/address/${factoryAddress}#code`,
    84532:    `https://sepolia.basescan.org/address/${factoryAddress}#code`,
  };

  const explorerUrl = explorerUrls[chainId];
  if (explorerUrl) {
    console.log(`🌐 View on explorer:\n   ${explorerUrl}\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ Verify failed:", err.message);
  process.exit(1);
});
