-- ArtCurve Indexer — PostgreSQL Schema
-- Run once on a fresh database.
-- All BigInt / uint256 values stored as TEXT to preserve 256-bit precision.

CREATE TABLE IF NOT EXISTS artworks (
    address         TEXT        PRIMARY KEY,
    name            TEXT        NOT NULL,
    artist          TEXT        NOT NULL,
    ipfs_cid        TEXT        NOT NULL,
    k               TEXT        NOT NULL,
    p0              TEXT        NOT NULL,
    supply          TEXT        NOT NULL DEFAULT '0',
    reserve         TEXT        NOT NULL DEFAULT '0',
    graduated       BOOLEAN     NOT NULL DEFAULT false,
    total_volume    TEXT        NOT NULL DEFAULT '0',
    volume_24h      TEXT        NOT NULL DEFAULT '0',
    trending_score  FLOAT8      NOT NULL DEFAULT 0,
    created_block   TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    artwork_address TEXT        NOT NULL REFERENCES artworks(address) ON DELETE CASCADE,
    type            TEXT        NOT NULL CHECK (type IN ('BUY', 'SELL')),
    trader          TEXT        NOT NULL,
    shares          TEXT        NOT NULL,
    eth_amount      TEXT        NOT NULL,
    royalty         TEXT        NOT NULL,
    supply          TEXT        NOT NULL,
    price           TEXT        NOT NULL,
    tx_hash         TEXT        NOT NULL UNIQUE,
    block_number    TEXT        NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL
);

-- Singleton row: tracks the last synced block
CREATE TABLE IF NOT EXISTS sync_state (
    id          INTEGER     PRIMARY KEY DEFAULT 1,
    last_block  TEXT        NOT NULL DEFAULT '0',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT  single_row  CHECK (id = 1)
);

-- Seed sync_state
INSERT INTO sync_state (id, last_block)
VALUES (1, '0')
ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artworks_trending  ON artworks (trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_created   ON artworks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_artist    ON artworks (artist);
CREATE INDEX IF NOT EXISTS idx_artworks_graduated ON artworks (graduated);

CREATE INDEX IF NOT EXISTS idx_trades_artwork     ON trades (artwork_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_trader      ON trades (trader);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp   ON trades (timestamp DESC);
