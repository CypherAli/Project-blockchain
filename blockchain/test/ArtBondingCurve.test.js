const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─── Constants ────────────────────────────────────────────────────────────────
const K  = ethers.parseEther("0.0001"); // 0.0001 ETH / share (slope)
const P0 = ethers.parseEther("0.001"); // 0.001  ETH / share (initial price)

const ROYALTY_BPS  = 500n;   // 5%
const PLATFORM_BPS = 100n;   // 1%
const BPS_DENOM    = 10_000n;

// ─── Math helpers (mirrors Solidity) ──────────────────────────────────────────
function getBuyCost(k, p0, supply, amount) {
  return (k * amount * (2n * supply + amount)) / 2n + p0 * amount;
}

function getSellReturn(k, p0, supply, amount) {
  return (k * amount * (2n * supply - amount)) / 2n + p0 * amount;
}

function addFees(gross) {
  const royalty  = (gross * ROYALTY_BPS)  / BPS_DENOM;
  const platform = (gross * PLATFORM_BPS) / BPS_DENOM;
  return { totalCost: gross + royalty + platform, royalty, platform };
}

function deductFees(gross) {
  const royalty  = (gross * ROYALTY_BPS)  / BPS_DENOM;
  const platform = (gross * PLATFORM_BPS) / BPS_DENOM;
  return { netReturn: gross - royalty - platform, royalty, platform };
}

// ─── Fixture ──────────────────────────────────────────────────────────────────
async function deployFixture() {
  const [owner, artist, buyer1, buyer2, platform] = await ethers.getSigners();

  const ArtBondingCurve = await ethers.getContractFactory("ArtBondingCurve");
  const curve = await ArtBondingCurve.deploy(
    artist.address,
    platform.address,
    "Starry Night Redux",
    "QmTestCID123",
    K,
    P0
  );

  return { curve, owner, artist, buyer1, buyer2, platform };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────────────

describe("ArtBondingCurve", function () {

  // ── Deployment ──────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("stores artist and platform addresses correctly", async function () {
      const { curve, artist, platform } = await loadFixture(deployFixture);
      expect(await curve.artist()).to.equal(artist.address);
      expect(await curve.platform()).to.equal(platform.address);
    });

    it("stores curve parameters correctly", async function () {
      const { curve } = await loadFixture(deployFixture);
      expect(await curve.k()).to.equal(K);
      expect(await curve.p0()).to.equal(P0);
    });

    it("starts with zero supply and zero reserve", async function () {
      const { curve } = await loadFixture(deployFixture);
      expect(await curve.totalSupply()).to.equal(0n);
      expect(await curve.reserve()).to.equal(0n);
    });

    it("returns 0 decimals (whole shares)", async function () {
      const { curve } = await loadFixture(deployFixture);
      expect(await curve.decimals()).to.equal(0);
    });

    it("initial price equals p0 at supply = 0", async function () {
      const { curve } = await loadFixture(deployFixture);
      expect(await curve.currentPrice()).to.equal(P0);
    });
  });

  // ── Bonding curve math ───────────────────────────────────────────────────────
  describe("Bonding curve math", function () {
    it("getBuyCost matches manual integral (buy 10 shares from supply 0)", async function () {
      const { curve } = await loadFixture(deployFixture);
      const amount = 10n;
      const expected = getBuyCost(K, P0, 0n, amount);
      expect(await curve.getBuyCost(amount)).to.equal(expected);
    });

    it("getBuyCost matches manual integral (buy 5 shares from supply 10)", async function () {
      const { curve, buyer1, artist, platform } = await loadFixture(deployFixture);
      // First buy 10 shares to set supply = 10
      const { totalCost: cost10 } = addFees(getBuyCost(K, P0, 0n, 10n));
      await curve.connect(buyer1).buy(10n, cost10, { value: cost10 });

      const amount = 5n;
      const expected = getBuyCost(K, P0, 10n, amount);
      expect(await curve.getBuyCost(amount)).to.equal(expected);
    });

    it("getSellReturn matches manual integral (sell 5 from supply 10)", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const { totalCost } = addFees(getBuyCost(K, P0, 0n, 10n));
      await curve.connect(buyer1).buy(10n, totalCost, { value: totalCost });

      const amount = 5n;
      const expected = getSellReturn(K, P0, 10n, amount);
      expect(await curve.getSellReturn(amount)).to.equal(expected);
    });

    it("currentPrice increases after each buy", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const price0 = await curve.currentPrice();
      const { totalCost } = addFees(getBuyCost(K, P0, 0n, 10n));
      await curve.connect(buyer1).buy(10n, totalCost, { value: totalCost });
      const price1 = await curve.currentPrice();
      expect(price1).to.be.gt(price0);
    });

    it("sell return <= buy cost (bonding curve is conservative)", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 10n;
      const gross = getBuyCost(K, P0, 0n, amount);
      const { totalCost } = addFees(gross);
      await curve.connect(buyer1).buy(amount, totalCost, { value: totalCost });

      // Sell return should be same gross (symmetric curve)
      const grossReturn = await curve.getSellReturn(amount);
      expect(grossReturn).to.equal(gross);
    });
  });

  // ── Buy function ─────────────────────────────────────────────────────────────
  describe("buy()", function () {
    it("mints correct number of shares to buyer", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 5n;
      const { totalCost } = addFees(getBuyCost(K, P0, 0n, amount));
      await curve.connect(buyer1).buy(amount, totalCost, { value: totalCost });
      expect(await curve.balanceOf(buyer1.address)).to.equal(amount);
    });

    it("increases totalSupply correctly", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 7n;
      const { totalCost } = addFees(getBuyCost(K, P0, 0n, amount));
      await curve.connect(buyer1).buy(amount, totalCost, { value: totalCost });
      expect(await curve.totalSupply()).to.equal(amount);
    });

    it("adds curveCost to reserve", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 10n;
      const gross = getBuyCost(K, P0, 0n, amount);
      const { totalCost } = addFees(gross);
      await curve.connect(buyer1).buy(amount, totalCost, { value: totalCost });
      expect(await curve.reserve()).to.equal(gross);
    });

    it("sends royalty (5%) to artist", async function () {
      const { curve, buyer1, artist } = await loadFixture(deployFixture);
      const amount = 10n;
      const gross = getBuyCost(K, P0, 0n, amount);
      const { totalCost, royalty } = addFees(gross);

      const artistBefore = await ethers.provider.getBalance(artist.address);
      await curve.connect(buyer1).buy(amount, totalCost, { value: totalCost });
      const artistAfter = await ethers.provider.getBalance(artist.address);

      expect(artistAfter - artistBefore).to.equal(royalty);
    });

    it("sends platform fee (1%) to platform", async function () {
      const { curve, buyer1, platform } = await loadFixture(deployFixture);
      const amount = 10n;
      const gross = getBuyCost(K, P0, 0n, amount);
      const { totalCost, platform: fee } = addFees(gross);

      const platformBefore = await ethers.provider.getBalance(platform.address);
      await curve.connect(buyer1).buy(amount, totalCost, { value: totalCost });
      const platformAfter = await ethers.provider.getBalance(platform.address);

      expect(platformAfter - platformBefore).to.equal(fee);
    });

    it("refunds excess ETH to buyer", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 10n;
      const { totalCost } = addFees(getBuyCost(K, P0, 0n, amount));
      const extraEth = ethers.parseEther("1"); // send 1 ETH extra

      const balBefore = await ethers.provider.getBalance(buyer1.address);
      const tx = await curve.connect(buyer1).buy(amount, totalCost, {
        value: totalCost + extraEth,
      });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer1.address);

      // Net deduction = totalCost + gas (excess refunded)
      expect(balBefore - balAfter).to.equal(totalCost + gasCost);
    });

    it("reverts if ETH sent is insufficient", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 10n;
      const { totalCost } = addFees(getBuyCost(K, P0, 0n, amount));
      await expect(
        curve.connect(buyer1).buy(amount, totalCost, { value: totalCost - 1n })
      ).to.be.revertedWith("ArtBC: insufficient ETH");
    });

    it("reverts on slippage (price moved above maxEth)", async function () {
      const { curve, buyer1, buyer2 } = await loadFixture(deployFixture);
      const amount = 10n;
      const { totalCost: cost1 } = addFees(getBuyCost(K, P0, 0n, amount));
      // buyer2 buys first, raising the price
      await curve.connect(buyer2).buy(amount, cost1, { value: cost1 });

      // buyer1 tries to buy with old maxEth — should revert
      await expect(
        curve.connect(buyer1).buy(amount, cost1, { value: cost1 * 2n })
      ).to.be.revertedWith("ArtBC: slippage price moved up");
    });

    it("reverts if amount is 0", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await expect(
        curve.connect(buyer1).buy(0n, 0n, { value: 0n })
      ).to.be.revertedWith("ArtBC: amount is 0");
    });

    it("emits SharesBought event with correct data", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const amount = 5n;
      const gross = getBuyCost(K, P0, 0n, amount);
      const { totalCost, royalty, platform: fee } = addFees(gross);

      await expect(
        curve.connect(buyer1).buy(amount, totalCost, { value: totalCost })
      )
        .to.emit(curve, "SharesBought")
        .withArgs(
          buyer1.address,
          amount,
          totalCost,
          royalty,
          fee,
          amount,      // new total supply
          K * amount + P0  // new price after buying `amount`
        );
    });
  });

  // ── Sell function ────────────────────────────────────────────────────────────
  describe("sell()", function () {
    async function buyFirst(curve, buyer, amount) {
      const supply = await curve.totalSupply();
      const gross = getBuyCost(K, P0, supply, amount);
      const { totalCost } = addFees(gross);
      await curve.connect(buyer).buy(amount, totalCost, { value: totalCost });
    }

    it("burns shares from seller balance", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);
      await curve.connect(buyer1).sell(5n, 0n);
      expect(await curve.balanceOf(buyer1.address)).to.equal(5n);
    });

    it("decreases totalSupply correctly", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);
      await curve.connect(buyer1).sell(3n, 0n);
      expect(await curve.totalSupply()).to.equal(7n);
    });

    it("decreases reserve by grossReturn", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);
      const reserveBefore = await curve.reserve();
      const gross = getSellReturn(K, P0, 10n, 5n);
      await curve.connect(buyer1).sell(5n, 0n);
      const reserveAfter = await curve.reserve();
      expect(reserveBefore - reserveAfter).to.equal(gross);
    });

    it("sends net ETH to seller (gross minus 5%+1% fees)", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);

      const gross = getSellReturn(K, P0, 10n, 5n);
      const { netReturn } = deductFees(gross);

      const balBefore = await ethers.provider.getBalance(buyer1.address);
      const tx = await curve.connect(buyer1).sell(5n, 0n);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer1.address);

      expect(balAfter - balBefore + gasCost).to.equal(netReturn);
    });

    it("sends royalty to artist on sell", async function () {
      const { curve, buyer1, artist } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);

      const gross = getSellReturn(K, P0, 10n, 5n);
      const { royalty } = deductFees(gross);

      const artistBefore = await ethers.provider.getBalance(artist.address);
      await curve.connect(buyer1).sell(5n, 0n);
      const artistAfter = await ethers.provider.getBalance(artist.address);

      expect(artistAfter - artistBefore).to.equal(royalty);
    });

    it("reverts if seller has insufficient shares", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 5n);
      await expect(curve.connect(buyer1).sell(10n, 0n)).to.be.revertedWith(
        "ArtBC: insufficient shares"
      );
    });

    it("reverts on slippage (minEth not met)", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);
      const gross = getSellReturn(K, P0, 10n, 5n);
      const { netReturn } = deductFees(gross);
      await expect(
        curve.connect(buyer1).sell(5n, netReturn + 1n)
      ).to.be.revertedWith("ArtBC: slippage price moved down");
    });

    it("emits SharesSold event", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await buyFirst(curve, buyer1, 10n);

      const gross = getSellReturn(K, P0, 10n, 5n);
      const { netReturn, royalty, platform: fee } = deductFees(gross);

      await expect(curve.connect(buyer1).sell(5n, 0n))
        .to.emit(curve, "SharesSold")
        .withArgs(
          buyer1.address,
          5n,
          netReturn,
          royalty,
          fee,
          5n, // new supply
          K * 5n + P0 // new price
        );
    });
  });

  // ── Graduation ───────────────────────────────────────────────────────────────
  describe("Graduation", function () {
    it("is not graduated initially", async function () {
      const { curve } = await loadFixture(deployFixture);
      expect(await curve.graduated()).to.equal(false);
    });

    // Note: reaching 24 ETH threshold requires many buys; test the flag logic
    it("graduation flag flips when reserve hits threshold (deploy mini curve)", async function () {
      // Deploy a curve with VERY low graduation threshold by using a high-k curve
      // We override k to make graduation easy: set threshold-like conditions
      // Since GRADUATION_THRESHOLD is a constant (24 ETH), we just test the event
      // is emitted once reserve crosses. We'll manually verify the condition.

      const [owner, artist, platform, buyer] = await ethers.getSigners();
      const ArtBondingCurve = await ethers.getContractFactory("ArtBondingCurve");

      // High k so price escalates fast and we can pump reserve up
      const highK = ethers.parseEther("1"); // 1 ETH per share per share
      const highP0 = ethers.parseEther("1"); // 1 ETH starting
      const curve2 = await ArtBondingCurve.deploy(
        artist.address,
        platform.address,
        "Test",
        "QmXyz",
        highK,
        highP0
      );

      // Buy 5 shares: cost = 1*5*(0+5)/2 + 1*5 = 12.5 + 5 = 17.5 ETH (curve cost)
      // Total with fees: 17.5 * 1.06 = 18.55 ETH
      const gross = getBuyCost(highK, highP0, 0n, 5n);
      const { totalCost } = addFees(gross);

      // This should push reserve >= 24 ETH threshold? Let's check:
      // gross = 17.5 ETH, which is less than 24 ETH — need more shares
      // Buy 6 shares: 1*6*(0+6)/2 + 1*6 = 18 + 6 = 24 ETH curve cost — exactly meets threshold!
      const gross6 = getBuyCost(highK, highP0, 0n, 6n);
      const { totalCost: cost6 } = addFees(gross6);

      await expect(
        curve2.connect(buyer).buy(6n, cost6, { value: cost6 })
      ).to.emit(curve2, "Graduated");

      expect(await curve2.graduated()).to.equal(true);
    });
  });

  // ── quoteBuy / quoteSell ──────────────────────────────────────────────────────
  describe("Quote functions", function () {
    it("quoteBuy returns correct components", async function () {
      const { curve } = await loadFixture(deployFixture);
      const amount = 10n;
      const gross = getBuyCost(K, P0, 0n, amount);
      const royalty = (gross * ROYALTY_BPS) / BPS_DENOM;
      const fee = (gross * PLATFORM_BPS) / BPS_DENOM;
      const total = gross + royalty + fee;

      const [totalCost, curveCost, r, f] = await curve.quoteBuy(amount);
      expect(totalCost).to.equal(total);
      expect(curveCost).to.equal(gross);
      expect(r).to.equal(royalty);
      expect(f).to.equal(fee);
    });

    it("quoteSell returns correct components", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const gross10 = getBuyCost(K, P0, 0n, 10n);
      const { totalCost } = addFees(gross10);
      await curve.connect(buyer1).buy(10n, totalCost, { value: totalCost });

      const amount = 5n;
      const gross = getSellReturn(K, P0, 10n, amount);
      const royalty = (gross * ROYALTY_BPS) / BPS_DENOM;
      const fee = (gross * PLATFORM_BPS) / BPS_DENOM;
      const net = gross - royalty - fee;

      const [netReturn, grossReturn, r, f] = await curve.quoteSell(amount);
      expect(netReturn).to.equal(net);
      expect(grossReturn).to.equal(gross);
      expect(r).to.equal(royalty);
      expect(f).to.equal(fee);
    });
  });

  // ── Security ──────────────────────────────────────────────────────────────────
  describe("Security", function () {
    it("rejects direct ETH transfers (receive() reverts)", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      await expect(
        buyer1.sendTransaction({ to: await curve.getAddress(), value: ethers.parseEther("1") })
      ).to.be.revertedWith("ArtBC: use buy()");
    });

    it("cannot buy more than MAX_SUPPLY", async function () {
      const { curve, buyer1 } = await loadFixture(deployFixture);
      const maxSupply = await curve.MAX_SUPPLY();
      // This should revert — we won't actually try to send that much ETH,
      // just check the overflow check triggers
      const hugeAmount = maxSupply + 1n;
      await expect(
        curve.connect(buyer1).buy(hugeAmount, ethers.MaxUint256, {
          value: ethers.parseEther("100"),
        })
      ).to.be.revertedWith("ArtBC: exceeds max supply");
    });
  });
});
