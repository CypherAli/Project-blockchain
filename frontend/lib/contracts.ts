/**
 * ArtCurve — Contract ABIs and Address Resolution
 *
 * ABIs use the human-readable format (wagmi compatible).
 * Factory address is loaded from environment (set by deploy.js).
 *
 * Math utilities are re-exported from shared/bondingCurve.ts
 * to ensure frontend and indexer always use identical formulas.
 */

import { config, getExplorerUrl, ipfsToHttp, getIpfsUrlsForFallback } from './config';
export { getExplorerUrl, ipfsToHttp, getIpfsUrlsForFallback };

// ─── ABIs (human-readable — wagmi parses these automatically) ─────────────────

export const ART_FACTORY_ABI = [
  // ── Read ──────────────────────────────────────────────────────────────
  'function listingFee() external view returns (uint256)',
  'function totalArtworks() external view returns (uint256)',
  'function getAllArtworks() external view returns (address[])',
  'function getArtworksByArtist(address artist) external view returns (address[])',
  'function getArtworksPaginated(uint256 offset, uint256 limit) external view returns (address[] result, uint256 total)',
  'function isArtwork(address) external view returns (bool)',
  'function owner() external view returns (address)',
  'function DEFAULT_K() external view returns (uint256)',
  'function DEFAULT_P0() external view returns (uint256)',
  // ── Write ─────────────────────────────────────────────────────────────
  'function createArtworkDefault(string name, string ipfsCID) external payable returns (address)',
  'function createArtwork(string name, string ipfsCID, uint256 k, uint256 p0) external payable returns (address)',
  'function setListingFee(uint256 newFee) external',
  'function withdrawFees() external',
  // ── Events ────────────────────────────────────────────────────────────
  'event ArtworkCreated(address indexed contractAddress, address indexed artist, string name, string ipfsCID, uint256 k, uint256 p0, uint256 timestamp)',
  'event ListingFeeUpdated(uint256 oldFee, uint256 newFee)',
] as const;

export const ART_BONDING_CURVE_ABI = [
  // ── ERC-20 ────────────────────────────────────────────────────────────
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  // ── Immutable state ───────────────────────────────────────────────────
  'function artist() external view returns (address)',
  'function platform() external view returns (address)',
  'function k() external view returns (uint256)',
  'function p0() external view returns (uint256)',
  'function ROYALTY_BPS() external view returns (uint256)',
  'function PLATFORM_BPS() external view returns (uint256)',
  'function MAX_SUPPLY() external view returns (uint256)',
  'function GRADUATION_THRESHOLD() external view returns (uint256)',
  // ── Mutable state ─────────────────────────────────────────────────────
  'function ipfsCID() external view returns (string)',
  'function reserve() external view returns (uint256)',
  'function graduated() external view returns (bool)',
  'function createdAt() external view returns (uint256)',
  'function totalRoyaltiesPaid() external view returns (uint256)',
  'function totalVolume() external view returns (uint256)',
  // ── Price math ────────────────────────────────────────────────────────
  'function currentPrice() external view returns (uint256)',
  'function marketCap() external view returns (uint256)',
  'function getBuyCost(uint256 amount) external view returns (uint256)',
  'function getSellReturn(uint256 amount) external view returns (uint256)',
  'function quoteBuy(uint256 amount) external view returns (uint256 totalCost, uint256 curveCost, uint256 royalty, uint256 platformFee)',
  'function quoteSell(uint256 amount) external view returns (uint256 netReturn, uint256 grossReturn, uint256 royalty, uint256 platformFee)',
  // ── Trading ───────────────────────────────────────────────────────────
  'function buy(uint256 amount, uint256 maxEth) external payable',
  'function sell(uint256 amount, uint256 minEth) external',
  // ── Aggregated info ───────────────────────────────────────────────────
  'function getInfo() external view returns (address _artist, string _ipfsCID, uint256 _k, uint256 _p0, uint256 _supply, uint256 _price, uint256 _reserve, uint256 _marketCap, bool _graduated, uint256 _createdAt, uint256 _totalRoyalties, uint256 _totalVolume)',
  // ── Events ────────────────────────────────────────────────────────────
  'event SharesBought(address indexed buyer, uint256 shares, uint256 ethCost, uint256 royalty, uint256 platformFee, uint256 newTotalSupply, uint256 newPrice)',
  'event SharesSold(address indexed seller, uint256 shares, uint256 ethReturned, uint256 royalty, uint256 platformFee, uint256 newTotalSupply, uint256 newPrice)',
  'event Graduated(uint256 reserve, uint256 totalSupply, uint256 timestamp)',
] as const;

// ─── Factory address ──────────────────────────────────────────────────────────

/**
 * Returns the ArtFactory address from env vars.
 * Throws with a helpful message if not configured.
 */
export function getFactoryAddress(): `0x${string}` {
  const addr = config.factoryAddress;
  if (!addr || addr === '0x') {
    throw new Error(
      '[ArtCurve] NEXT_PUBLIC_FACTORY_ADDRESS is not set.\n' +
      '  → Run: cd blockchain && npm run deploy:local\n' +
      '  → Then update frontend/.env.local'
    );
  }
  return addr;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtworkInfo {
  address: `0x${string}`;
  name: string;
  artist: `0x${string}`;
  ipfsCID: string;
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
  type: 'BUY' | 'SELL';
  trader: `0x${string}`;
  shares: bigint;
  ethAmount: bigint;
  royalty: bigint;
  newSupply: bigint;
  newPrice: bigint;
  blockNumber: bigint;
  timestamp: number;
  txHash: `0x${string}`;
}

// ─── USD price helper (mock rate, updated when real price feed is available) ──
/** Mock ETH→USD rate. Replace with a real price feed when live. */
export const ETH_USD_RATE = 3_500; // $3,500/ETH

/** Format ETH wei value as USD string: "$1,234.56" */
export function formatUsd(wei: bigint, decimals = 2): string {
  const eth = Number(wei) / 1e18;
  const usd = eth * ETH_USD_RATE;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd < 0.01)       return `<$0.01`;
  return `$${usd.toFixed(decimals)}`;
}

// ─── Math utilities (re-exported from shared/) ────────────────────────────────

export {
  getBuyCost,
  getSellReturn,
  quoteBuy  as calcBuyQuote,
  quoteSell as calcSellQuote,
  addFees,
  deductFees,
  applyBuySlippage,
  applySellSlippage,
  graduationProgress,
  formatEth,
  formatNumber,
  shortAddress,
  timeAgo,
  GRADUATION_THRESHOLD,
  ROYALTY_BPS,
  PLATFORM_BPS,
  DEFAULT_K,
  DEFAULT_P0,
} from '@/lib/shared/bondingCurve';
