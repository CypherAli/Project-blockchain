/**
 * Bonding Curve Math Utilities
 *
 * Mirrors the Solidity formulas in ArtBondingCurve.sol exactly.
 * Used by both frontend (quote display) and indexer (price tracking).
 *
 * Linear bonding curve:  price(s) = k * s + p0
 * Buy cost integral:     ∫[S to S+n] (k*x + p0) dx = k*n*(2S+n)/2 + p0*n
 * Sell return integral:  ∫[S-n to S] (k*x + p0) dx = k*n*(2S-n)/2 + p0*n
 */

import type { QuoteResult } from './types.js';

// ─── Constants (must match ArtBondingCurve.sol) ───────────────────────────────

export const ROYALTY_BPS = 500n;   // 5%
export const PLATFORM_BPS = 100n;  // 1%
export const TOTAL_FEES_BPS = ROYALTY_BPS + PLATFORM_BPS; // 6%
export const BPS_DENOMINATOR = 10_000n;

export const MAX_SUPPLY = 1_000_000n;
export const GRADUATION_THRESHOLD = 24n * 10n ** 18n; // 24 ETH in wei

// Default factory params
export const DEFAULT_K = 100_000_000_000_000n;   // 0.0001 ETH in wei
export const DEFAULT_P0 = 1_000_000_000_000_000n; // 0.001 ETH in wei

// ─── Core Math ────────────────────────────────────────────────────────────────

/**
 * Gross cost to buy `amount` shares from supply `currentSupply`.
 * Formula: k * n * (2S + n) / 2 + p0 * n
 * @param amount - number of shares to buy
 * @param currentSupply - current total supply
 * @param k - slope parameter (wei)
 * @param p0 - initial price (wei)
 */
export function getBuyCost(
  amount: bigint,
  currentSupply: bigint,
  k: bigint,
  p0: bigint,
): bigint {
  if (amount === 0n) return 0n;
  return (k * amount * (2n * currentSupply + amount)) / 2n + p0 * amount;
}

/**
 * Gross return from selling `amount` shares from supply `currentSupply`.
 * Formula: k * n * (2S - n) / 2 + p0 * n
 * @param amount - number of shares to sell
 * @param currentSupply - current total supply
 * @param k - slope parameter (wei)
 * @param p0 - initial price (wei)
 */
export function getSellReturn(
  amount: bigint,
  currentSupply: bigint,
  k: bigint,
  p0: bigint,
): bigint {
  if (amount === 0n) return 0n;
  if (amount > currentSupply) throw new Error('Cannot sell more than supply');
  return (k * amount * (2n * currentSupply - amount)) / 2n + p0 * amount;
}

/**
 * Spot price of the next share (marginal price).
 * Formula: k * supply + p0
 */
export function currentPrice(supply: bigint, k: bigint, p0: bigint): bigint {
  return k * supply + p0;
}

// ─── Fee Calculations ─────────────────────────────────────────────────────────

/**
 * Calculate fees on a gross amount (for BUY: fees added on top of curve cost).
 * totalCost = gross + royalty + platformFee
 */
export function addFees(grossCost: bigint): QuoteResult {
  const royalty = (grossCost * ROYALTY_BPS) / BPS_DENOMINATOR;
  const platformFee = (grossCost * PLATFORM_BPS) / BPS_DENOMINATOR;
  return {
    gross: grossCost,
    royalty,
    platformFee,
    net: grossCost + royalty + platformFee,
  };
}

/**
 * Calculate fees deducted from gross return (for SELL: fees subtracted from curve return).
 * netReturn = gross - royalty - platformFee
 */
export function deductFees(grossReturn: bigint): QuoteResult {
  const royalty = (grossReturn * ROYALTY_BPS) / BPS_DENOMINATOR;
  const platformFee = (grossReturn * PLATFORM_BPS) / BPS_DENOMINATOR;
  return {
    gross: grossReturn,
    royalty,
    platformFee,
    net: grossReturn - royalty - platformFee,
  };
}

// ─── Full Quote (convenience wrappers) ───────────────────────────────────────

/**
 * Full buy quote including fees.
 * Returns breakdown: gross curve cost, royalty, platform fee, total user pays.
 */
export function quoteBuy(
  amount: bigint,
  currentSupply: bigint,
  k: bigint,
  p0: bigint,
): QuoteResult {
  const gross = getBuyCost(amount, currentSupply, k, p0);
  return addFees(gross);
}

/**
 * Full sell quote after fees.
 * Returns breakdown: gross curve return, royalty, platform fee, user receives.
 */
export function quoteSell(
  amount: bigint,
  currentSupply: bigint,
  k: bigint,
  p0: bigint,
): QuoteResult {
  const gross = getSellReturn(amount, currentSupply, k, p0);
  return deductFees(gross);
}

// ─── Slippage ─────────────────────────────────────────────────────────────────

/**
 * Apply slippage tolerance to a buy maxEth (add tolerance %).
 * e.g. slippageBps = 100 means +1% tolerance
 */
export function applyBuySlippage(amount: bigint, slippageBps = 100n): bigint {
  return amount + (amount * slippageBps) / BPS_DENOMINATOR;
}

/**
 * Apply slippage tolerance to a sell minEth (subtract tolerance %).
 */
export function applySellSlippage(amount: bigint, slippageBps = 100n): bigint {
  return amount - (amount * slippageBps) / BPS_DENOMINATOR;
}

// ─── Graduation ───────────────────────────────────────────────────────────────

/** Percentage progress toward 24 ETH graduation threshold (0-100) */
export function graduationProgress(reserve: bigint): number {
  if (reserve >= GRADUATION_THRESHOLD) return 100;
  return Number((reserve * 100n) / GRADUATION_THRESHOLD);
}

// ─── Market Cap ───────────────────────────────────────────────────────────────

/** Market cap = spot price × total supply */
export function marketCap(supply: bigint, k: bigint, p0: bigint): bigint {
  if (supply === 0n) return 0n;
  return currentPrice(supply, k, p0) * supply;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format wei to ETH string with given decimal places.
 * e.g. 1500000000000000n → "0.0015"
 */
export function formatEth(wei: bigint, decimals = 4): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return '0';
  if (eth < 0.0001) return '< 0.0001';
  return eth.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Format large numbers with K/M suffix.
 * e.g. 1500 → "1.5K", 2000000 → "2M"
 */
export function formatNumber(n: number | bigint): string {
  const num = typeof n === 'bigint' ? Number(n) : n;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

/**
 * Shorten an Ethereum address: 0x1234...abcd
 */
export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

/**
 * Time ago string from unix timestamp.
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
