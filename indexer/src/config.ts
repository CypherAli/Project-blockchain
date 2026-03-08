/**
 * Indexer Configuration
 * Validates required environment variables on startup.
 */

import 'dotenv/config';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `[Config] Missing required environment variable: ${key}\n` +
      `  → Add it to indexer/.env`
    );
  }
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  /** PostgreSQL connection string */
  databaseUrl: requireEnv('DATABASE_URL'),

  /** Ethereum JSON-RPC endpoint (e.g. Alchemy) */
  rpcUrl: requireEnv('RPC_URL'),

  /** ArtFactory contract address */
  factoryAddress: requireEnv('FACTORY_ADDRESS') as `0x${string}`,

  /** Chain ID */
  chainId: parseInt(optionalEnv('CHAIN_ID', '31337'), 10),

  /** Block number to start indexing from (0 = genesis) */
  startBlock: BigInt(optionalEnv('START_BLOCK', '0')),

  /** Express API port */
  apiPort: parseInt(optionalEnv('API_PORT', '3001'), 10),

  /** Block polling interval in ms */
  pollIntervalMs: parseInt(optionalEnv('POLL_INTERVAL_MS', '3000'), 10),

  /** Number of blocks to fetch per getLogs batch */
  logsBatchSize: BigInt(optionalEnv('LOGS_BATCH_SIZE', '2000')),
} as const;
