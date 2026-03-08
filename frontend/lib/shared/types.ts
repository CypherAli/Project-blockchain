/**
 * Shared TypeScript types used across frontend and indexer.
 * Source of truth for all data structures.
 */

// ─── Artwork ──────────────────────────────────────────────────────────────────

export interface ArtworkInfo {
  /** Contract address of the bonding curve */
  address: `0x${string}`;
  /** Human-readable name */
  name: string;
  /** Artist wallet address */
  artist: `0x${string}`;
  /** IPFS CID for metadata */
  ipfsCID: string;
  /** Bonding curve slope k (in wei) */
  k: bigint;
  /** Initial price p0 (in wei) */
  p0: bigint;
  /** Total shares minted */
  supply: bigint;
  /** Spot price of next share (in wei) */
  price: bigint;
  /** ETH reserve held in contract (in wei) */
  reserve: bigint;
  /** Market cap = price × supply (in wei) */
  marketCap: bigint;
  /** Whether reserve hit 24 ETH graduation threshold */
  graduated: boolean;
  /** Block timestamp of artwork creation */
  createdAt: bigint;
  /** Cumulative ETH paid to artist as royalties */
  totalRoyalties: bigint;
  /** Cumulative ETH trading volume */
  totalVolume: bigint;
}

// ─── Trades ───────────────────────────────────────────────────────────────────

export type TradeType = 'BUY' | 'SELL';

export interface TradeEvent {
  type: TradeType;
  /** Trader wallet address */
  trader: `0x${string}`;
  /** Number of shares bought or sold */
  shares: bigint;
  /** Total ETH paid (buy) or received (sell) including fees */
  ethAmount: bigint;
  /** ETH royalty paid to artist in this trade */
  royalty: bigint;
  /** Supply after trade */
  newSupply: bigint;
  /** Spot price after trade */
  newPrice: bigint;
  /** Block number of the trade */
  blockNumber: bigint;
  /** Unix timestamp */
  timestamp: number;
  /** Transaction hash */
  txHash: `0x${string}`;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiArtwork {
  address: string;
  name: string;
  artist: string;
  ipfsCID: string;
  supply: string;    // BigInt serialized as string
  reserve: string;
  price: string;
  marketCap: string;
  graduated: boolean;
  totalVolume: string;
  volume24h: string;
  trendingScore: number;
  createdAt: string; // ISO date string
}

export interface ApiTrade {
  id: string;
  artworkAddress: string;
  type: TradeType;
  trader: string;
  shares: string;
  ethAmount: string;
  royalty: string;
  supply: string;
  price: string;
  txHash: string;
  blockNumber: string;
  timestamp: string;
}

export interface ApiStats {
  totalArtworks: number;
  totalVolume: string;
  totalRoyaltiesPaid: string;
  graduatedCount: number;
  tradingArtworks: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface DeploymentInfo {
  chainId: number;
  network: string;
  factoryAddress: `0x${string}`;
  deployedAt: string;
}

// ─── Bonding Curve Params ─────────────────────────────────────────────────────

export interface CurveParams {
  k: bigint;
  p0: bigint;
}

export interface QuoteResult {
  /** Gross ETH amount (before fees) */
  gross: bigint;
  /** Artist royalty (5%) */
  royalty: bigint;
  /** Platform fee (1%) */
  platformFee: bigint;
  /** Net ETH (after fees) — total user pays (buy) or receives (sell) */
  net: bigint;
}
