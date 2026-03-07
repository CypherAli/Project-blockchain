// IPFS upload via Pinata
// Get free API key at: https://pinata.cloud

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || "";
const PINATA_SECRET = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || "";
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || "";

export interface ArtworkMetadata {
  name: string;
  description: string;
  artist: string;
  image: string; // ipfs://CID
  attributes?: { trait_type: string; value: string }[];
}

/**
 * Upload a file (artwork image) to IPFS via Pinata
 * Returns the IPFS CID
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const metadata = JSON.stringify({ name: file.name });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({ cidVersion: 1 });
  formData.append("pinataOptions", options);

  const headers: HeadersInit = {};
  if (PINATA_JWT) {
    headers["Authorization"] = `Bearer ${PINATA_JWT}`;
  } else if (PINATA_API_KEY && PINATA_SECRET) {
    headers["pinata_api_key"] = PINATA_API_KEY;
    headers["pinata_secret_api_key"] = PINATA_SECRET;
  } else {
    // Fallback: return a placeholder for local dev
    console.warn("No Pinata API key — using placeholder CID for dev mode");
    return "QmPlaceholderCIDForLocalDev123456789";
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata upload failed: ${err}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

/**
 * Upload artwork metadata JSON to IPFS via Pinata
 * Returns the IPFS CID for the metadata
 */
export async function uploadMetadataToIPFS(metadata: ArtworkMetadata): Promise<string> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (PINATA_JWT) {
    headers["Authorization"] = `Bearer ${PINATA_JWT}`;
  } else if (PINATA_API_KEY && PINATA_SECRET) {
    headers["pinata_api_key"] = PINATA_API_KEY;
    headers["pinata_secret_api_key"] = PINATA_SECRET;
  } else {
    console.warn("No Pinata API key — using placeholder CID");
    return "QmMetadataPlaceholderCID123456789";
  }

  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: { name: `${metadata.name}-metadata` },
  });

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`Pinata metadata upload failed: ${await res.text()}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

/** Convert IPFS CID to gateway URL */
export function cidToUrl(cid: string): string {
  if (!cid || cid.startsWith("http")) return cid || "/placeholder.png";
  return `https://ipfs.io/ipfs/${cid}`;
}

/** Fetch metadata JSON from IPFS */
export async function fetchMetadata(cid: string): Promise<ArtworkMetadata | null> {
  try {
    const res = await fetch(cidToUrl(cid));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
