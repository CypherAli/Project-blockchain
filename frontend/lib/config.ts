/**
 * Environment Configuration with validation.
 * Crashes early with a clear error if required env vars are missing.
 *
 * All NEXT_PUBLIC_* vars are available on client + server.
 * Never import server-only vars (without NEXT_PUBLIC_) in client components.
 */

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    // In development, warn but don't crash for optional vars
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Config] Missing env var: ${key}`);
      return '';
    }
    throw new Error(
      `[Config] Missing required environment variable: ${key}\n` +
      `  → Add it to frontend/.env.local`
    );
  }
  return value;
}

// ─── Public config (safe for client-side) ────────────────────────────────────

export const config = {
  /** WalletConnect project ID from https://cloud.walletconnect.com */
  walletConnectProjectId: getEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'demo'),

  /** ArtFactory contract address on the current chain */
  factoryAddress: getEnv('NEXT_PUBLIC_FACTORY_ADDRESS', '') as `0x${string}`,

  /** Target chain ID (31337 local, 11155111 sepolia, etc.) */
  chainId: parseInt(getEnv('NEXT_PUBLIC_CHAIN_ID', '31337'), 10),

  /** Indexer API base URL (optional — falls back to direct RPC reads) */
  indexerUrl: getEnv('NEXT_PUBLIC_INDEXER_URL', ''),

  /** Whether indexer is configured */
  get hasIndexer(): boolean {
    return this.indexerUrl.length > 0;
  },

  /** App metadata */
  app: {
    name: 'ArtCurve',
    description: 'Bonding curve art trading — pump.fun for real artists',
    url: getEnv('NEXT_PUBLIC_APP_URL', 'https://artcurve.fun'),
  },
} as const;

// ─── Chain-specific explorer URLs ─────────────────────────────────────────────

const EXPLORERS: Record<number, string> = {
  31337:    'http://localhost:8545',
  11155111: 'https://sepolia.etherscan.io',
  80002:    'https://amoy.polygonscan.com',
  84532:    'https://sepolia.basescan.org',
  1:        'https://etherscan.io',
  137:      'https://polygonscan.com',
  8453:     'https://basescan.org',
};

export function getExplorerUrl(
  type: 'address' | 'tx',
  hash: string,
  chainId = config.chainId
): string {
  const base = EXPLORERS[chainId] ?? 'https://etherscan.io';
  return `${base}/${type}/${hash}`;
}

// ─── IPFS gateway config ──────────────────────────────────────────────────────

/**
 * Ordered list of IPFS gateways to try.
 * Falls back to next gateway if the first times out.
 */
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
] as const;

/**
 * Convert an IPFS CID to a HTTP URL using the first available gateway.
 * Use `ipfsToHttpWithFallback` for production (tries multiple gateways).
 */
export function ipfsToHttp(cid: string, gatewayIndex = 0): string {
  if (!cid) return '';
  // Handle ipfs:// protocol
  const cleanCid = cid.replace('ipfs://', '').replace(/^\/ipfs\//, '');
  const gateway = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0];
  return `${gateway}${cleanCid}`;
}

/**
 * Returns a URL that uses an img fallback chain via query param tricks.
 * For use in <img> onError handlers.
 */
export function getIpfsUrlsForFallback(cid: string): string[] {
  if (!cid) return [];
  const cleanCid = cid.replace('ipfs://', '').replace(/^\/ipfs\//, '');
  return IPFS_GATEWAYS.map((gw) => `${gw}${cleanCid}`);
}
