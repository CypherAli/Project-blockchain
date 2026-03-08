/**
 * Listener: SharesBought + SharesSold events from all artwork contracts
 *
 * For each trade:
 * 1. Saves the trade to the database
 * 2. Updates the artwork's supply, reserve, volume, trendingScore
 */

import { type PublicClient, type Address } from 'viem';
import { prisma } from '../db/client';

const SHARES_BOUGHT_EVENT = {
  name: 'SharesBought',
  type: 'event',
  inputs: [
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'shares', type: 'uint256', indexed: false },
    { name: 'ethCost', type: 'uint256', indexed: false },
    { name: 'royalty', type: 'uint256', indexed: false },
    { name: 'platformFee', type: 'uint256', indexed: false },
    { name: 'newTotalSupply', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

const SHARES_SOLD_EVENT = {
  name: 'SharesSold',
  type: 'event',
  inputs: [
    { name: 'seller', type: 'address', indexed: true },
    { name: 'shares', type: 'uint256', indexed: false },
    { name: 'ethReturned', type: 'uint256', indexed: false },
    { name: 'royalty', type: 'uint256', indexed: false },
    { name: 'platformFee', type: 'uint256', indexed: false },
    { name: 'newTotalSupply', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

const GRADUATED_EVENT = {
  name: 'Graduated',
  type: 'event',
  inputs: [
    { name: 'reserve', type: 'uint256', indexed: false },
    { name: 'totalSupply', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ],
} as const;

export async function indexTradeEvents(
  client: PublicClient,
  artworkAddresses: Address[],
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  if (artworkAddresses.length === 0) return;

  // Process in batches of 50 artworks to avoid oversized getLogs calls
  const ADDR_BATCH = 50;
  for (let i = 0; i < artworkAddresses.length; i += ADDR_BATCH) {
    const batch = artworkAddresses.slice(i, i + ADDR_BATCH);
    await processAddressBatch(client, batch, fromBlock, toBlock);
  }
}

async function processAddressBatch(
  client: PublicClient,
  addresses: Address[],
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  const [buyLogs, sellLogs, graduatedLogs] = await Promise.all([
    client.getLogs({ address: addresses, event: SHARES_BOUGHT_EVENT, fromBlock, toBlock }),
    client.getLogs({ address: addresses, event: SHARES_SOLD_EVENT, fromBlock, toBlock }),
    client.getLogs({ address: addresses, event: GRADUATED_EVENT, fromBlock, toBlock }),
  ]);

  if (buyLogs.length === 0 && sellLogs.length === 0 && graduatedLogs.length === 0) return;

  // Collect block timestamps for all involved blocks
  const blockNumbers = [...new Set([
    ...buyLogs.map((l) => l.blockNumber),
    ...sellLogs.map((l) => l.blockNumber),
  ].filter(Boolean))] as bigint[];

  const timestampMap = new Map<bigint, Date>();
  await Promise.all(
    blockNumbers.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: bn });
      timestampMap.set(bn, new Date(Number(block.timestamp) * 1000));
    })
  );

  // Process buy events
  for (const log of buyLogs) {
    const args = log.args as {
      buyer: `0x${string}`;
      shares: bigint;
      ethCost: bigint;
      royalty: bigint;
      platformFee: bigint;
      newTotalSupply: bigint;
      newPrice: bigint;
    };

    const artworkAddress = log.address.toLowerCase();
    const timestamp = timestampMap.get(log.blockNumber!) ?? new Date();

    try {
      // Upsert trade (idempotent — txHash is unique)
      await prisma.trade.upsert({
        where: { txHash: log.transactionHash! },
        create: {
          artworkAddress,
          type: 'BUY',
          trader: args.buyer.toLowerCase(),
          shares: args.shares.toString(),
          ethAmount: args.ethCost.toString(),
          royalty: args.royalty.toString(),
          supply: args.newTotalSupply.toString(),
          price: args.newPrice.toString(),
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!.toString(),
          timestamp,
        },
        update: {}, // Skip if already exists
      });

      // Update artwork state
      await prisma.artwork.update({
        where: { address: artworkAddress },
        data: {
          supply: args.newTotalSupply.toString(),
          // Add curveCost to reserve (ethCost - royalty - platformFee)
          reserve: {
            // We'll recompute reserve in a separate sync pass for accuracy
          },
          totalVolume: {
            increment: undefined, // handled below
          },
          syncedAt: new Date(),
        },
      });

      // Increment totalVolume separately (Prisma doesn't support bigint increment natively)
      const artwork = await prisma.artwork.findUnique({ where: { address: artworkAddress } });
      if (artwork) {
        const curveCost = args.ethCost - args.royalty - args.platformFee;
        const newVolume = BigInt(artwork.totalVolume) + curveCost;
        const newReserve = BigInt(artwork.reserve) + curveCost;
        await prisma.artwork.update({
          where: { address: artworkAddress },
          data: {
            supply: args.newTotalSupply.toString(),
            reserve: newReserve.toString(),
            totalVolume: newVolume.toString(),
          },
        });
      }
    } catch (err: unknown) {
      // P2002 = unique constraint violation (trade already indexed)
      if ((err as { code?: string }).code !== 'P2002') {
        console.error(`[Trade] Failed to index BUY ${log.transactionHash}:`, err);
      }
    }
  }

  // Process sell events
  for (const log of sellLogs) {
    const args = log.args as {
      seller: `0x${string}`;
      shares: bigint;
      ethReturned: bigint;
      royalty: bigint;
      platformFee: bigint;
      newTotalSupply: bigint;
      newPrice: bigint;
    };

    const artworkAddress = log.address.toLowerCase();
    const timestamp = timestampMap.get(log.blockNumber!) ?? new Date();

    try {
      await prisma.trade.upsert({
        where: { txHash: log.transactionHash! },
        create: {
          artworkAddress,
          type: 'SELL',
          trader: args.seller.toLowerCase(),
          shares: args.shares.toString(),
          ethAmount: args.ethReturned.toString(),
          royalty: args.royalty.toString(),
          supply: args.newTotalSupply.toString(),
          price: args.newPrice.toString(),
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!.toString(),
          timestamp,
        },
        update: {},
      });

      // Update artwork state on sell
      const artwork = await prisma.artwork.findUnique({ where: { address: artworkAddress } });
      if (artwork) {
        const grossReturn = args.ethReturned + args.royalty + args.platformFee;
        const newVolume = BigInt(artwork.totalVolume) + grossReturn;
        const currentReserve = BigInt(artwork.reserve);
        const newReserve = currentReserve >= grossReturn ? currentReserve - grossReturn : 0n;
        await prisma.artwork.update({
          where: { address: artworkAddress },
          data: {
            supply: args.newTotalSupply.toString(),
            reserve: newReserve.toString(),
            totalVolume: newVolume.toString(),
          },
        });
      }
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'P2002') {
        console.error(`[Trade] Failed to index SELL ${log.transactionHash}:`, err);
      }
    }
  }

  // Handle graduation events
  for (const log of graduatedLogs) {
    const artworkAddress = log.address.toLowerCase();
    await prisma.artwork.update({
      where: { address: artworkAddress },
      data: { graduated: true },
    }).catch(() => { /* artwork may not be indexed yet */ });
    console.log(`  🎓 Graduated: ${artworkAddress}`);
  }
}

/**
 * Recompute trending scores for all artworks.
 * Score = volume24h * 0.7 + totalVolume * 0.3
 * Run this periodically (e.g., every 5 minutes).
 */
export async function updateTrendingScores(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const artworks = await prisma.artwork.findMany({
    include: {
      trades: {
        where: { timestamp: { gte: cutoff } },
        select: { ethAmount: true },
      },
    },
  });

  await Promise.all(
    artworks.map(async (artwork) => {
      const volume24h = artwork.trades.reduce(
        (sum, t) => sum + BigInt(t.ethAmount),
        0n
      );

      const totalVolume = BigInt(artwork.totalVolume);
      // Normalize to ETH (divide by 1e18) for scoring
      const score =
        Number(volume24h) / 1e18 * 0.7 +
        Number(totalVolume) / 1e18 * 0.3;

      await prisma.artwork.update({
        where: { address: artwork.address },
        data: {
          volume24h: volume24h.toString(),
          trendingScore: score,
        },
      });
    })
  );
}
