/**
 * ArtCurve — Seed Script (Local Development Only)
 *
 * Creates sample artworks and simulates trades on a local hardhat node.
 * Gives you realistic data to develop with.
 *
 * Usage:
 *   npm run seed
 *   (Requires `npm run node` and `npm run deploy:local` first)
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Sample artwork data
const ARTWORKS = [
  {
    name: "Starry Night Redux",
    cid: "QmStarryNight123456789abcdefArtCurveDemo",
    description: "A reimagining of Van Gogh's masterpiece",
  },
  {
    name: "Crypto Punk #0001",
    cid: "QmCryptoPunk000001abcdefArtCurveDemo123",
    description: "The first punk on the ArtCurve platform",
  },
  {
    name: "Digital Dreams",
    cid: "QmDigitalDreamsArtCurveDemo456789abcdef",
    description: "Abstract digital art exploring the metaverse",
  },
  {
    name: "Neon Genesis",
    cid: "QmNeonGenesisArtCurveDemo789012abcdefgh",
    description: "Neon-infused generative art collection",
  },
  {
    name: "The Last Sunset",
    cid: "QmLastSunsetArtCurveDemoabcdef123456789",
    description: "AI-generated sunset photograph series",
  },
];

async function main() {
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.error("❌ Seed script is for LOCAL development only!");
    console.error(`   Current network: ${network.name}`);
    process.exit(1);
  }

  const deploymentPath = path.join(
    __dirname, "..", "deployments", `${network.name}.json`
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      "No deployment found. Run: npm run deploy:local first."
    );
  }

  const { factoryAddress } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const signers = await ethers.getSigners();

  // Use signers[0] as platform/deployer, 1-5 as artists, 6-9 as buyers
  const [platform, artist1, artist2, artist3, buyer1, buyer2, buyer3] = signers;

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║       ArtCurve — Seed Local Data         ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`  Factory  : ${factoryAddress}`);
  console.log(`  Platform : ${platform.address}`);
  console.log("╚══════════════════════════════════════════╝\n");

  // Attach to factory
  const factory = await ethers.getContractAt("ArtFactory", factoryAddress);
  const listingFee = await factory.listingFee();

  const artists = [artist1, artist2, artist1, artist3, artist2];
  const deployedArtworks = [];

  // ── 1. Create artworks ────────────────────────────────────────────────────
  console.log("🎨 Creating artworks...");
  for (let i = 0; i < ARTWORKS.length; i++) {
    const { name, cid } = ARTWORKS[i];
    const artist = artists[i];

    const tx = await factory.connect(artist).createArtworkDefault(name, cid, {
      value: listingFee,
    });
    const receipt = await tx.wait();

    const event = receipt.logs.find(
      (log) => log.fragment?.name === "ArtworkCreated"
    );
    const artworkAddress = event?.args?.[0];

    console.log(`  ✅ "${name}" → ${artworkAddress}`);
    deployedArtworks.push({ address: artworkAddress, name, artist });
  }

  // ── 2. Simulate trades ────────────────────────────────────────────────────
  console.log("\n📈 Simulating trades...");
  const buyers = [buyer1, buyer2, buyer3];

  // Artwork 0 (Starry Night) — high volume, close to graduation
  const starryNight = await ethers.getContractAt(
    "ArtBondingCurve", deployedArtworks[0].address
  );
  await simulateBuys(starryNight, [buyer1, buyer2, buyer3], [50, 100, 200], "Starry Night Redux");
  await simulateSells(starryNight, buyer1, 10, "Starry Night Redux (partial sell)");

  // Artwork 1 (Crypto Punk) — medium volume
  const cryptoPunk = await ethers.getContractAt(
    "ArtBondingCurve", deployedArtworks[1].address
  );
  await simulateBuys(cryptoPunk, [buyer1, buyer3], [20, 30], "Crypto Punk #0001");

  // Artwork 2 (Digital Dreams) — low volume / new
  const digitalDreams = await ethers.getContractAt(
    "ArtBondingCurve", deployedArtworks[2].address
  );
  await simulateBuys(digitalDreams, [buyer2], [5], "Digital Dreams");

  // Artwork 3 (Neon Genesis) — fresh, no trades
  // (intentionally left as new artwork)

  // Artwork 4 (Last Sunset) — some activity
  const lastSunset = await ethers.getContractAt(
    "ArtBondingCurve", deployedArtworks[4].address
  );
  await simulateBuys(lastSunset, [buyer1, buyer2], [15, 25], "The Last Sunset");

  // ── 3. Print summary ──────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║              SEED COMPLETE                           ║");
  console.log("╠══════════════════════════════════════════════════════╣");

  for (const { address, name } of deployedArtworks) {
    const curve = await ethers.getContractAt("ArtBondingCurve", address);
    const [, , , , supply, price, reserve, , graduated] = await curve.getInfo();
    console.log(
      `  ${name.padEnd(20)} | ${String(supply).padEnd(8)} shares | ` +
      `${ethers.formatEther(reserve).substring(0, 8)} ETH reserve` +
      (graduated ? " | 🎓 GRADUATED" : "")
    );
  }

  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("  Start frontend: cd ../frontend && npm run dev");
  console.log("╚══════════════════════════════════════════════════════╝\n");
}

async function simulateBuys(contract, buyers, amounts, name) {
  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    const amount = amounts[i];
    const [totalCost] = await contract.quoteBuy(amount);
    // Add 2% buffer for safety
    const maxEth = totalCost + totalCost / 50n;
    const tx = await contract.connect(buyer).buy(amount, maxEth, { value: maxEth });
    await tx.wait();
    process.stdout.write(".");
  }
  console.log(` bought into "${name}"`);
}

async function simulateSells(contract, seller, amount, name) {
  const [netReturn] = await contract.quoteSell(amount);
  const minEth = netReturn - netReturn / 50n;
  const tx = await contract.connect(seller).sell(amount, minEth);
  await tx.wait();
  console.log(`  . sold from "${name}"`);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
