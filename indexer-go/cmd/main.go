// ArtCurve Indexer — Go edition
// Sync on-chain events from ArtFactory + ArtBondingCurve into PostgreSQL
// and serve them via a REST API.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/artcurve/indexer/internal/api"
	"github.com/artcurve/indexer/internal/config"
	"github.com/artcurve/indexer/internal/db"
	"github.com/artcurve/indexer/internal/indexer"
)

func main() {
	// ── Logging ───────────────────────────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("NODE_ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.Kitchen})
	}

	log.Info().Msg("artcurve indexer starting")

	// ── Config ────────────────────────────────────────────────────────────────
	cfg := config.Load()
	log.Info().
		Int64("chainId", cfg.ChainID).
		Str("factory", cfg.FactoryAddress).
		Uint64("startBlock", cfg.StartBlock).
		Msg("config loaded")

	// ── Context — cancelled on SIGINT / SIGTERM ───────────────────────────────
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// ── Database ──────────────────────────────────────────────────────────────
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("db: connect failed")
	}
	defer pool.Close()
	log.Info().Msg("db: connected")

	// ── Ethereum client ───────────────────────────────────────────────────────
	eth, err := ethclient.DialContext(ctx, cfg.RPCURL)
	if err != nil {
		log.Fatal().Err(err).Msg("eth: dial failed")
	}
	defer eth.Close()
	log.Info().Str("rpc", cfg.RPCURL).Msg("eth: connected")

	// ── Indexer ───────────────────────────────────────────────────────────────
	idx, err := indexer.New(cfg, pool, eth)
	if err != nil {
		log.Fatal().Err(err).Msg("indexer: init failed")
	}

	// ── API server ────────────────────────────────────────────────────────────
	srv := api.New(cfg, pool)

	// ── Run concurrently ─────────────────────────────────────────────────────
	errCh := make(chan error, 2)

	go func() {
		idx.Run(ctx)
		errCh <- nil
	}()

	go func() {
		errCh <- srv.Start(ctx)
	}()

	// Wait for shutdown signal or fatal error
	select {
	case <-ctx.Done():
		log.Info().Msg("shutdown signal received")
	case err := <-errCh:
		if err != nil {
			log.Fatal().Err(err).Msg("fatal error")
		}
	}

	// Graceful shutdown — wait a moment for in-flight requests
	log.Info().Msg("shutting down gracefully…")
	time.Sleep(1 * time.Second)
	log.Info().Msg("bye 🌿")
}
