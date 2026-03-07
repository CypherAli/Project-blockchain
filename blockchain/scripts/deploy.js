const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = network.config.chainId;

  console.log("\n========================================");
  console.log("  Art Bonding Curve Platform - Deploy");
  console.log("========================================");
  console.log(`Network:  ${network.name} (chainId: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance:  ${ethers.formatEther(
      await ethers.provider.getBalance(deployer.address)
    )} ETH\n`
  );

  // ── Deploy ArtFactory ───────────────────────────────────────────────────────
  console.log("Deploying ArtFactory...");
  const ArtFactory = await ethers.getContractFactory("ArtFactory");
  const factory = await ArtFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`ArtFactory deployed at: ${factoryAddress}`);

  // ── Deploy a sample artwork for testing ────────────────────────────────────
  console.log("\nDeploying sample artwork...");
  const listingFee = await factory.listingFee();
  const tx = await factory.createArtworkDefault(
    "Starry Night Redux",
    "QmSampleCIDForDemo123",
    { value: listingFee }
  );
  const receipt = await tx.wait();

  // Parse the ArtworkCreated event to get the address
  const event = receipt.logs.find(
    (log) => log.fragment?.name === "ArtworkCreated"
  );
  const sampleArtwork = event?.args?.[0] ?? "check logs";
  console.log(`Sample artwork deployed at: ${sampleArtwork}`);

  // ── Save deployment info ────────────────────────────────────────────────────
  const deploymentInfo = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      ArtFactory: factoryAddress,
      sampleArtwork,
    },
  };

  // Save to blockchain/deployments/
  const deployDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir);
  const outPath = path.join(deployDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));

  // Also save to frontend/src/lib/ for easy import
  const frontendLibDir = path.join(__dirname, "../../frontend/src/lib");
  if (fs.existsSync(frontendLibDir)) {
    fs.writeFileSync(
      path.join(frontendLibDir, "deployments.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\nFrontend deployments.json updated.");
  }

  console.log(`\nDeployment saved to: ${outPath}`);
  console.log("\n========================================");
  console.log("  DONE! Copy these to your .env:");
  console.log("========================================");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n  Verify contracts on Etherscan:");
    console.log(`  npx hardhat verify --network ${network.name} ${factoryAddress}`);
  }

  console.log("========================================\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
