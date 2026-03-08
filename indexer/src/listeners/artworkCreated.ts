/**
 * Listener: ArtworkCreated events from ArtFactory
 *
 * When a new artwork is created, saves it to the database so it appears
 * in the explore feed immediately.
 */

import { type PublicClient } from 'viem';
import { prisma } from '../db/client';
import { config } from '../config';

const ART_FACTORY_ABI = [
  {
    name: 'ArtworkCreated',
    type: 'event',
    inputs: [
      { name: 'contractAddress', type: 'address', indexed: true },
      { name: 'artist', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'ipfsCID', type: 'string', indexed: false },
      { name: 'k', type: 'uint256', indexed: false },
      { name: 'p0', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

const ART_BONDING_CURVE_ABI = [
  {
    name: 'DEFAULT_K',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export async function indexArtworkCreatedEvents(
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  const logs = await client.getLogs({
    address: config.factoryAddress,
    event: ART_FACTORY_ABI[0],
    fromBlock,
    toBlock,
  });

  if (logs.length === 0) return;

  console.log(`[ArtworkCreated] Found ${logs.length} new artwork(s)`);

  for (const log of logs) {
    const args = log.args as {
      contractAddress: `0x${string}`;
      artist: `0x${string}`;
      name: string;
      ipfsCID: string;
      k: bigint;
      p0: bigint;
      timestamp: bigint;
    };

    const address = args.contractAddress.toLowerCase();

    // Check if already indexed
    const exists = await prisma.artwork.findUnique({ where: { address } });
    if (exists) continue;

    try {
      const block = await client.getBlock({ blockNumber: log.blockNumber! });

      await prisma.artwork.create({
        data: {
          address,
          name: args.name,
          artist: args.artist.toLowerCase(),
          ipfsCID: args.ipfsCID,
          k: args.k.toString(),
          p0: args.p0.toString(),
          supply: '0',
          reserve: '0',
          graduated: false,
          totalVolume: '0',
          volume24h: '0',
          trendingScore: 0,
          createdBlock: log.blockNumber!.toString(),
          createdAt: new Date(Number(block.timestamp) * 1000),
        },
      });

      console.log(`  ✓ Indexed artwork: ${args.name} (${address.slice(0, 10)}...)`);
    } catch (err) {
      console.error(`  ✗ Failed to index artwork ${address}:`, err);
    }
  }
}
