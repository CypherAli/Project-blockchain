/**
 * Demo data for ArtCurve — shown when no factory is deployed.
 * Allows the full app to be explored without a live blockchain.
 */

import type { ArtworkInfo, TradeEvent } from './contracts';

export const DEMO_ARTWORKS: ArtworkInfo[] = [
  { address: '0xdemo1', name: 'Mona Lisa',                 artist: '0xLeonardo' as `0x${string}`,   ipfsCID: '', price: 120_000_000_000_000_000n, supply: 9n,  reserve: 24_200_000_000_000_000_000n, totalVolume: 463_000_000_000_000_000_000n, createdAt: 1705000000n, graduated: true,  k: 1n, p0: 1n, marketCap: 1_080_000_000_000_000_000n, totalRoyalties: 23_150_000_000_000_000_000n },
  { address: '0xdemo2', name: 'Girl with a Pearl Earring', artist: '0xVermeer'   as `0x${string}`,   ipfsCID: '', price:  58_900_000_000_000_000n, supply: 7n,  reserve: 14_200_000_000_000_000_000n, totalVolume: 187_000_000_000_000_000_000n, createdAt: 1705010000n, graduated: false, k: 1n, p0: 1n, marketCap:   412_300_000_000_000_000n, totalRoyalties:  9_350_000_000_000_000_000n },
  { address: '0xdemo3', name: 'The Great Wave',            artist: '0xHokusai'  as `0x${string}`,   ipfsCID: '', price:  43_100_000_000_000_000n, supply: 6n,  reserve:  9_100_000_000_000_000_000n, totalVolume:  98_000_000_000_000_000_000n, createdAt: 1705020000n, graduated: false, k: 1n, p0: 1n, marketCap:   258_600_000_000_000_000n, totalRoyalties:  4_900_000_000_000_000_000n },
  { address: '0xdemo4', name: 'Starry Night',              artist: '0xVanGogh'  as `0x${string}`,   ipfsCID: '', price:  68_000_000_000_000_000n, supply: 8n,  reserve: 18_500_000_000_000_000_000n, totalVolume: 320_000_000_000_000_000_000n, createdAt: 1705030000n, graduated: false, k: 1n, p0: 1n, marketCap:   544_000_000_000_000_000n, totalRoyalties: 16_000_000_000_000_000_000n },
  { address: '0xdemo5', name: 'The Kiss',                  artist: '0xKlimt'    as `0x${string}`,   ipfsCID: '', price:  31_200_000_000_000_000n, supply: 4n,  reserve:  6_700_000_000_000_000_000n, totalVolume:  45_000_000_000_000_000_000n, createdAt: 1705040000n, graduated: false, k: 1n, p0: 1n, marketCap:   124_800_000_000_000_000n, totalRoyalties:  2_250_000_000_000_000_000n },
  { address: '0xdemo6', name: 'Birth of Venus',            artist: '0xBotticelli' as `0x${string}`, ipfsCID: '', price:  22_400_000_000_000_000n, supply: 3n,  reserve:  3_800_000_000_000_000_000n, totalVolume:  28_000_000_000_000_000_000n, createdAt: 1705050000n, graduated: false, k: 1n, p0: 1n, marketCap:    67_200_000_000_000_000n, totalRoyalties:  1_400_000_000_000_000_000n },
];

export const DEMO_IMGS: Record<string, string> = {
  '0xdemo1': '/demo/mona-lisa.jpg',
  '0xdemo2': '/demo/girl-pearl.jpg',
  '0xdemo3': '/demo/great-wave.jpg',
  '0xdemo4': '/demo/starry-night.jpg',
  '0xdemo5': '/demo/the-kiss.jpg',
  '0xdemo6': '/demo/birth-of-venus.jpg',
};

// Mock trade history for demo artworks
const MOCK_TRADERS = [
  '0xA1b2C3d4E5f6789012345678901234567890AbCd' as `0x${string}`,
  '0xB2c3D4e5F67890123456789012345678901BcDe' as `0x${string}`,
  '0xC3d4E5f6789012345678901234567890abcDEF1' as `0x${string}`,
  '0xD4e5F678901234567890123456789012AbcDef2' as `0x${string}`,
  '0xE5f6789012345678901234567890123456789012' as `0x${string}`,
];

export function getDemoTradeHistory(artworkAddress: string): TradeEvent[] {
  const artwork = DEMO_ARTWORKS.find(a => a.address === artworkAddress);
  if (!artwork) return [];

  // Seed based on address index for deterministic output
  const artworkIndex = DEMO_ARTWORKS.findIndex(a => a.address === artworkAddress);
  const seedNum = (artworkIndex >= 0 ? artworkIndex : 0) * 7 + 3;

  const trades: TradeEvent[] = [];
  const totalTrades = 8 + (seedNum % 6); // 8–13 trades
  let supply = 0n;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < totalTrades; i++) {
    const isBuy = i < totalTrades - 2 || i % 3 !== 0;
    const trader = MOCK_TRADERS[(i + seedNum) % MOCK_TRADERS.length];
    const shares = BigInt(1 + ((i + seedNum) % 3));
    const price = artwork.price - BigInt(i) * 5_000_000_000_000_000n;
    const ethAmount = price * shares;
    const royalty = ethAmount * 5n / 100n;

    if (isBuy) supply += shares;
    else supply = supply > shares ? supply - shares : 0n;

    trades.push({
      type: isBuy ? 'BUY' : 'SELL',
      trader,
      shares,
      ethAmount,
      royalty,
      newSupply: supply,
      newPrice: price,
      blockNumber: BigInt(19_000_000 + i * 100 + seedNum),
      timestamp: now - (totalTrades - i) * 3600 - (seedNum * 60),
      txHash: `0x${artworkIndex.toString(16).padStart(2, '0')}${i.toString().padStart(62, '0')}` as `0x${string}`,
    });
  }

  return trades.reverse(); // newest first
}

export const isDemoAddress = (addr: string) => addr.toLowerCase().startsWith('0xdemo');
