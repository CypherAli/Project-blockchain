const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const LISTING_FEE = ethers.parseEther("0.01");

async function deployFactory() {
  const [owner, artist1, artist2, buyer] = await ethers.getSigners();
  const ArtFactory = await ethers.getContractFactory("ArtFactory");
  const factory = await ArtFactory.deploy();
  return { factory, owner, artist1, artist2, buyer };
}

describe("ArtFactory", function () {
  describe("Deployment", function () {
    it("owner is deployer", async function () {
      const { factory, owner } = await loadFixture(deployFactory);
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("listing fee is 0.01 ETH by default", async function () {
      const { factory } = await loadFixture(deployFactory);
      expect(await factory.listingFee()).to.equal(LISTING_FEE);
    });

    it("starts with zero artworks", async function () {
      const { factory } = await loadFixture(deployFactory);
      expect(await factory.totalArtworks()).to.equal(0n);
    });
  });

  describe("createArtworkDefault()", function () {
    it("deploys a new ArtBondingCurve contract", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      const tx = await factory.connect(artist1).createArtworkDefault(
        "Sunset Over Hanoi",
        "QmABC123",
        { value: LISTING_FEE }
      );
      const receipt = await tx.wait();
      expect(await factory.totalArtworks()).to.equal(1n);
    });

    it("registers artwork in artworks array", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await factory.connect(artist1).createArtworkDefault("Art1", "QmCID1", {
        value: LISTING_FEE,
      });
      const allArtworks = await factory.getAllArtworks();
      expect(allArtworks.length).to.equal(1);
    });

    it("registers artwork under artist's address", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await factory.connect(artist1).createArtworkDefault("Art1", "QmCID1", {
        value: LISTING_FEE,
      });
      const byArtist = await factory.getArtworksByArtist(artist1.address);
      expect(byArtist.length).to.equal(1);
    });

    it("marks contract address as valid artwork", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await factory.connect(artist1).createArtworkDefault("Art1", "QmCID1", {
        value: LISTING_FEE,
      });
      const [addr] = await factory.getAllArtworks();
      expect(await factory.isArtwork(addr)).to.equal(true);
    });

    it("emits ArtworkCreated event with correct args", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await expect(
        factory.connect(artist1).createArtworkDefault("My Masterpiece", "QmXYZ", {
          value: LISTING_FEE,
        })
      )
        .to.emit(factory, "ArtworkCreated")
        .withArgs(
          (v) => v !== ethers.ZeroAddress,  // contract address (any non-zero)
          artist1.address,
          "My Masterpiece",
          "QmXYZ",
          ethers.parseEther("0.0001"),  // DEFAULT_K
          ethers.parseEther("0.001"),   // DEFAULT_P0
          (v) => v > 0n               // timestamp
        );
    });

    it("reverts if listing fee not paid", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await expect(
        factory.connect(artist1).createArtworkDefault("Art", "QmCID", {
          value: 0,
        })
      ).to.be.revertedWith("ArtFactory: listing fee required");
    });

    it("reverts if name is empty", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await expect(
        factory.connect(artist1).createArtworkDefault("", "QmCID", {
          value: LISTING_FEE,
        })
      ).to.be.revertedWith("ArtFactory: name empty");
    });

    it("reverts if CID is empty", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await expect(
        factory.connect(artist1).createArtworkDefault("Art", "", {
          value: LISTING_FEE,
        })
      ).to.be.revertedWith("ArtFactory: CID empty");
    });

    it("refunds excess ETH", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      const extra = ethers.parseEther("0.05");
      const balBefore = await ethers.provider.getBalance(artist1.address);
      const tx = await factory.connect(artist1).createArtworkDefault(
        "Art",
        "QmCID",
        { value: LISTING_FEE + extra }
      );
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * tx.gasPrice;
      const balAfter = await ethers.provider.getBalance(artist1.address);

      // Should only spend listingFee + gas
      expect(balBefore - balAfter).to.equal(LISTING_FEE + gas);
    });
  });

  describe("createArtwork() (custom curve)", function () {
    it("deploys with custom k and p0", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      const customK = ethers.parseEther("0.0005");
      const customP0 = ethers.parseEther("0.005");

      await factory.connect(artist1).createArtwork(
        "Custom Art",
        "QmCustom",
        customK,
        customP0,
        { value: LISTING_FEE }
      );

      const [addr] = await factory.getAllArtworks();
      const ArtBondingCurve = await ethers.getContractAt("ArtBondingCurve", addr);
      expect(await ArtBondingCurve.k()).to.equal(customK);
      expect(await ArtBondingCurve.p0()).to.equal(customP0);
    });
  });

  describe("Multiple artists", function () {
    it("tracks artworks per artist independently", async function () {
      const { factory, artist1, artist2 } = await loadFixture(deployFactory);

      await factory.connect(artist1).createArtworkDefault("Art A", "QmA", {
        value: LISTING_FEE,
      });
      await factory.connect(artist1).createArtworkDefault("Art B", "QmB", {
        value: LISTING_FEE,
      });
      await factory.connect(artist2).createArtworkDefault("Art C", "QmC", {
        value: LISTING_FEE,
      });

      expect(await factory.totalArtworks()).to.equal(3n);
      expect(
        (await factory.getArtworksByArtist(artist1.address)).length
      ).to.equal(2);
      expect(
        (await factory.getArtworksByArtist(artist2.address)).length
      ).to.equal(1);
    });
  });

  describe("Pagination", function () {
    it("returns correct paginated results", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      for (let i = 0; i < 5; i++) {
        await factory.connect(artist1).createArtworkDefault(`Art${i}`, `QmCID${i}`, {
          value: LISTING_FEE,
        });
      }

      const [page1, total] = await factory.getArtworksPaginated(0, 3);
      expect(page1.length).to.equal(3);
      expect(total).to.equal(5n);

      const [page2] = await factory.getArtworksPaginated(3, 3);
      expect(page2.length).to.equal(2);
    });
  });

  describe("Admin", function () {
    it("owner can update listing fee", async function () {
      const { factory, owner } = await loadFixture(deployFactory);
      const newFee = ethers.parseEther("0.05");
      await factory.connect(owner).setListingFee(newFee);
      expect(await factory.listingFee()).to.equal(newFee);
    });

    it("non-owner cannot update listing fee", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await expect(
        factory.connect(artist1).setListingFee(ethers.parseEther("0.05"))
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("owner can withdraw listing fees", async function () {
      const { factory, owner, artist1 } = await loadFixture(deployFactory);
      await factory.connect(artist1).createArtworkDefault("Art", "QmCID", {
        value: LISTING_FEE,
      });

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const tx = await factory.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * tx.gasPrice;
      const ownerAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerAfter - ownerBefore + gas).to.equal(LISTING_FEE);
    });

    it("non-owner cannot withdraw", async function () {
      const { factory, artist1 } = await loadFixture(deployFactory);
      await expect(
        factory.connect(artist1).withdrawFees()
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });
});
