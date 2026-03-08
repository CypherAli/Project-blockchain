/**
 * ArtCurve Indexer — Main Entry Point
 *
 * 1. Starts Express API server
 * 2. Catches up on historical events from START_BLOCK to current
 * 3. Polls for new blocks and indexes new events in real-time
 * 4. Updates trending scores every 5 minutes
 */

import { createPublicClient, http, type Address } from 'viem';
import { hardhat, sepolia, polygonAmoy, baseSepolia } from 'viem/chains';
import { prisma } from './db/client';
import { config } from './config';
import { indexArtworkCreatedEvents } from './listeners/artworkCreated';
import { indexTradeEvents, updateTrendingScores } from './listeners/trades';
import app from './api/server';

// ─── Viem client ──────────────────────────────────────────────────────────────

const CHAINS: Record<number, typeof hardhat> = {
  31337: hardhat,
  11155111: sepolia as unknown as typeof hardhat,
  80002: polygonAmoy as unknown as typeof hardhat,
  84532: baseSepolia as unknown as typeof hardhat,
};

const chain = CHAINS[config.chainId] ?? hardhat;

const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl, {
    timeout: 30_000,
    retryCount: 3,
    retryDelay: 1_000,
  }),
});

// ─── Main sync loop ───────────────────────────────────────────────────────────

async function getOrCreateSyncState(): Promise<bigint> {
  const state = await prisma.syncState.upsert({
    where: { id: 1 },
    create: { id: 1, lastBlock: config.startBlock.toString() },
    update: {},
  });
  return BigInt(state.lastBlock);
}

async function syncBlocks(fromBlock: bigint, toBlock: bigint): Promise<void> {
  // Batch getLogs to avoid RPC limits (max 2000 blocks per call)
  const BATCH = config.logsBatchSize;

  for (let start = fromBlock; start <= toBlock; start += BATCH) {
    const end = start + BATCH - 1n < toBlock ? start + BATCH - 1n : toBlock;

    try {
      // 1. Index new artworks
      await indexArtworkCreatedEvents(publicClient as Parameters<typeof indexArtworkCreatedEvents>[0], start, end);

      // 2. Get all known artwork addresses
      const addresses = await prisma.artwork.findMany({ select: { address: true } });
      const artworkAddresses = addresses.map((a) => a.address as Address);

      // 3. Index trades on known artworks
      if (artworkAddresses.length > 0) {
        await indexTradeEvents(publicClient as Parameters<typeof indexTradeEvents>[0], artworkAddresses, start, end);
      }

      // 4. Update last processed block
      await prisma.syncState.update({
        where: { id: 1 },
        data: { lastBlock: end.toString() },
      });

    } catch (err) {
      console.error(`[Sync] Error processing blocks ${start}-${end}:`, err);
      // Continue with next batch rather than stopping
    }
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       ArtCurve Indexer Starting          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`  Chain     : ${chain.name} (${config.chainId})`);
  console.log(`  RPC       : ${config.rpcUrl.slice(0, 40)}...`);
  console.log(`  Factory   : ${config.factoryAddress}`);
  console.log(`  API Port  : ${config.apiPort}`);
  console.log('╚══════════════════════════════════════════╝\n');

  // 1. Test DB connection
  await prisma.$connect();
  console.log('✅ Database connected');

  // 2. Start API server
  const server = app.listen(config.apiPort, () => {
    console.log(`✅ API server listening on http://localhost:${config.apiPort}`);
  });

  // 3. Get starting block
  let lastBlock = await getOrCreateSyncState();
  const currentBlock = await publicClient.getBlockNumber();
  console.log(`📦 Catching up: block ${lastBlock} → ${currentBlock}\n`);

  // 4. Catch-up sync
  if (lastBlock < currentBlock) {
    await syncBlocks(lastBlock, currentBlock);
    lastBlock = currentBlock;
    console.log(`✅ Catch-up complete at block ${currentBlock}`);
  }

  // 5. Initial trending score update
  await updateTrendingScores();

  // 6. Real-time polling loop
  console.log(`\n🔄 Polling for new blocks every ${config.pollIntervalMs}ms...\n`);

  setInterval(async () => {
    try {
      const newBlock = await publicClient.getBlockNumber();
      if (newBlock > lastBlock) {
        await syncBlocks(lastBlock + 1n, newBlock);
        lastBlock = newBlock;
      }
    } catch (err) {
      console.error('[Poll] Error:', err);
    }
  }, config.pollIntervalMs);

  // 7. Trending score refresh every 5 minutes
  setInterval(async () => {
    await updateTrendingScores().catch(console.error);
  }, 5 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Shutdown] Closing...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
