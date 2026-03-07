// ─────────────────────────────────────────────────────────────────────────────
// Contract ABIs and addresses
// Auto-updated by deploy.js after each deployment
// ─────────────────────────────────────────────────────────────────────────────

export const ART_FACTORY_ABI = [
  // Read
  "function listingFee() external view returns (uint256)",
  "function totalArtworks() external view returns (uint256)",
  "function getAllArtworks() external view returns (address[])",
  "function getArtworksByArtist(address artist) external view returns (address[])",
  "function getArtworksPaginated(uint256 offset, uint256 limit) external view returns (address[] memory result, uint256 total)",
  "function isArtwork(address) external view returns (bool)",
  "function owner() external view returns (address)",
  "function DEFAULT_K() external view returns (uint256)",
  "function DEFAULT_P0() external view returns (uint256)",
  // Write
  "function createArtworkDefault(string name, string ipfsCID) external payable returns (address)",
  "function createArtwork(string name, string ipfsCID, uint256 k, uint256 p0) external payable returns (address)",
  // Events
  "event ArtworkCreated(address indexed contractAddress, address indexed artist, string name, string ipfsCID, uint256 k, uint256 p0, uint256 timestamp)",
] as const;

export const ART_BONDING_CURVE_ABI = [
  // ERC-20
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  // Curve params
  "function artist() external view returns (address)",
  "function platform() external view returns (address)",
  "function k() external view returns (uint256)",
  "function p0() external view returns (uint256)",
  "function ipfsCID() external view returns (string)",
  "function reserve() external view returns (uint256)",
  "function graduated() external view returns (bool)",
  "function createdAt() external view returns (uint256)",
  "function totalRoyaltiesPaid() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",
  "function ROYALTY_BPS() external view returns (uint256)",
  "function PLATFORM_BPS() external view returns (uint256)",
  "function MAX_SUPPLY() external view returns (uint256)",
  // Price math
  "function currentPrice() external view returns (uint256)",
  "function marketCap() external view returns (uint256)",
  "function getBuyCost(uint256 amount) external view returns (uint256)",
  "function getSellReturn(uint256 amount) external view returns (uint256)",
  "function quoteBuy(uint256 amount) external view returns (uint256 totalCost, uint256 curveCost, uint256 royalty, uint256 platformFee)",
  "function quoteSell(uint256 amount) external view returns (uint256 netReturn, uint256 grossReturn, uint256 royalty, uint256 platformFee)",
  // Trading
  "function buy(uint256 amount, uint256 maxEth) external payable",
  "function sell(uint256 amount, uint256 minEth) external",
  // Info
  "function getInfo() external view returns (address artist, string ipfsCID, uint256 k, uint256 p0, uint256 supply, uint256 price, uint256 reserve, uint256 marketCap, bool graduated, uint256 createdAt, uint256 totalRoyalties, uint256 totalVolume)",
  // Events
  "event SharesBought(address indexed buyer, uint256 shares, uint256 ethCost, uint256 royalty, uint256 platformFee, uint256 newTotalSupply, uint256 newPrice)",
  "event SharesSold(address indexed seller, uint256 shares, uint256 ethReturned, uint256 royalty, uint256 platformFee, uint256 newTotalSupply, uint256 newPrice)",
  "event Graduated(uint256 reserve, uint256 totalSupply, uint256 timestamp)",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Network config — update after deploy
// ─────────────────────────────────────────────────────────────────────────────

export const FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
  31337: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Hardhat local (default first deploy)
  11155111: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`) || "0x0000000000000000000000000000000000000000", // Sepolia
  80002: "0x0000000000000000000000000000000000000000", // Polygon Amoy
  84532: "0x0000000000000000000000000000000000000000", // Base Sepolia
};

export function getFactoryAddress(chainId: number): `0x${string}` {
  const addr = FACTORY_ADDRESSES[chainId];
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(`No factory deployed on chain ${chainId}. Run deploy.js first.`);
  }
  return addr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtworkInfo {
  address: `0x${string}`;
  name: string;
  ipfsCID: string;
  artist: `0x${string}`;
  k: bigint;
  p0: bigint;
  supply: bigint;
  price: bigint;
  reserve: bigint;
  marketCap: bigint;
  graduated: boolean;
  createdAt: bigint;
  totalRoyalties: bigint;
  totalVolume: bigint;
}

export interface TradeEvent {
  type: "buy" | "sell";
  address: string;
  shares: bigint;
  ethAmount: bigint;
  royalty: bigint;
  newSupply: bigint;
  newPrice: bigint;
  blockNumber: bigint;
  timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function ipfsToHttp(cid: string): string {
  if (!cid) return "/placeholder-art.png";
  if (cid.startsWith("http")) return cid;
  return `https://ipfs.io/ipfs/${cid}`;
}

export function formatEth(wei: bigint, decimals = 4): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(decimals);
}

export function formatShares(shares: bigint): string {
  return shares.toLocaleString();
}

/** Linear bonding curve cost (mirrors Solidity) */
export function calcBuyCost(k: bigint, p0: bigint, supply: bigint, amount: bigint): bigint {
  return (k * amount * (2n * supply + amount)) / 2n + p0 * amount;
}

/** Linear bonding curve return (mirrors Solidity) */
export function calcSellReturn(k: bigint, p0: bigint, supply: bigint, amount: bigint): bigint {
  if (amount > supply) return 0n;
  return (k * amount * (2n * supply - amount)) / 2n + p0 * amount;
}

export function addFees(gross: bigint): { totalCost: bigint; royalty: bigint; platformFee: bigint } {
  const royalty = (gross * 500n) / 10000n;
  const platformFee = (gross * 100n) / 10000n;
  return { totalCost: gross + royalty + platformFee, royalty, platformFee };
}

export function deductFees(gross: bigint): { netReturn: bigint; royalty: bigint; platformFee: bigint } {
  const royalty = (gross * 500n) / 10000n;
  const platformFee = (gross * 100n) / 10000n;
  return { netReturn: gross - royalty - platformFee, royalty, platformFee };
}
