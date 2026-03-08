/**
 * ArtCurve — IPFS Upload & Retrieval
 *
 * Upload: Uses Pinata API (set NEXT_PUBLIC_PINATA_JWT in .env.local)
 * Retrieve: Multi-gateway fallback (Pinata → Cloudflare → ipfs.io → dweb.link)
 *
 * Setup: https://pinata.cloud → API Keys → Create new key
 */

import { IPFS_GATEWAYS } from './config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtworkMetadata {
  name: string;
  description: string;
  image: string;          // ipfs://CID format
  artist: string;         // wallet address
  createdAt: string;      // ISO date
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

// ─── Internal: Pinata auth headers ───────────────────────────────────────────

function getPinataHeaders(): Record<string, string> | null {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (jwt) return { Authorization: `Bearer ${jwt}` };

  const key = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const secret = process.env.NEXT_PUBLIC_PINATA_API_SECRET;
  if (key && secret) return { pinata_api_key: key, pinata_secret_api_key: secret };

  return null; // Not configured
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload an image file to IPFS via Pinata.
 * Falls back to a placeholder CID in dev mode if Pinata is not configured.
 * @returns IPFS CID string (without ipfs:// prefix)
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  const headers = getPinataHeaders();

  if (!headers) {
    // Development fallback — unique per upload so multiple artworks get different CIDs
    console.warn('[IPFS] No Pinata key — using dev placeholder. Set NEXT_PUBLIC_PINATA_JWT.');
    return `QmDevImg${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({
    name: `artcurve-image-${Date.now()}-${file.name}`,
  }));
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`[IPFS] Image upload failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

/**
 * Upload artwork metadata JSON to IPFS via Pinata.
 * @returns IPFS CID string
 */
export async function uploadMetadataToIPFS(metadata: ArtworkMetadata): Promise<string> {
  const headers = getPinataHeaders();

  if (!headers) {
    console.warn('[IPFS] No Pinata key — using dev placeholder for metadata.');
    return `QmDevMeta${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }

  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: { name: `artcurve-meta-${Date.now()}-${metadata.name}` },
    pinataOptions: { cidVersion: 1 },
  });

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`[IPFS] Metadata upload failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

// ─── Retrieval with multi-gateway fallback ────────────────────────────────────

const FETCH_TIMEOUT_MS = 8_000;

function cleanCid(cid: string): string {
  return cid.replace('ipfs://', '').replace(/^\/ipfs\//, '');
}

/**
 * Fetch JSON metadata from IPFS, trying gateways in order.
 * Automatically falls back if a gateway is slow or unavailable.
 */
export async function fetchMetadata(cid: string): Promise<ArtworkMetadata | null> {
  if (!cid) return null;
  const id = cleanCid(cid);

  for (const gateway of IPFS_GATEWAYS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${gateway}${id}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return (await res.json()) as ArtworkMetadata;
    } catch {
      clearTimeout(timeoutId);
      // Silent: try next gateway
    }
  }

  console.warn(`[IPFS] All gateways failed for CID: ${cid}`);
  return null;
}

/**
 * Returns all candidate image URLs for a CID, ordered by reliability.
 * Use with onError handler to cycle through fallbacks.
 *
 * @example
 *   const urls = getImageUrls(cid);
 *   const [src, setSrc] = useState(urls[0]);
 *   <img src={src} onError={createFallbackHandler(urls, setSrc)} />
 */
export function getImageUrls(cid: string): string[] {
  if (!cid) return ['/placeholder-art.png'];
  if (cid.startsWith('http')) return [cid, '/placeholder-art.png'];
  const id = cleanCid(cid);
  return [
    ...IPFS_GATEWAYS.map((gw) => `${gw}${id}`),
    '/placeholder-art.png',
  ];
}

/**
 * Creates an onError handler that tries the next URL in the fallback chain.
 */
export function createFallbackHandler(
  urls: string[],
  setSrc: (url: string) => void
): () => void {
  let index = 0;
  return () => {
    index += 1;
    if (index < urls.length) setSrc(urls[index]);
  };
}

/** Convenience: CID → first available HTTP URL */
export function cidToUrl(cid: string): string {
  return getImageUrls(cid)[0];
}
