// Package indexer synchronises on-chain events into PostgreSQL.
// Architecture:
//   1. On startup: catch up from lastSyncedBlock → currentBlock in batches.
//   2. After catch-up: poll every PollIntervalMs for new blocks.
//   3. Every 5 minutes: recalculate trending scores.
package indexer

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"

	"github.com/artcurve/indexer/internal/config"
	"github.com/artcurve/indexer/internal/db"
	"github.com/artcurve/indexer/pkg/abis"
)

// Indexer drives the sync loop.
type Indexer struct {
	cfg    *config.Config
	db     *db.Pool
	eth    *ethclient.Client
	factABI abi.ABI
	bcABI   abi.ABI
}

// New creates an Indexer, parsing ABIs eagerly so errors are caught early.
func New(cfg *config.Config, pool *db.Pool, eth *ethclient.Client) (*Indexer, error) {
	factABI, err := abi.JSON(strings.NewReader(abis.FactoryABI))
	if err != nil {
		return nil, fmt.Errorf("indexer: parse factory ABI: %w", err)
	}
	bcABI, err := abi.JSON(strings.NewReader(abis.BondingCurveABI))
	if err != nil {
		return nil, fmt.Errorf("indexer: parse bonding curve ABI: %w", err)
	}
	return &Indexer{cfg: cfg, db: pool, eth: eth, factABI: factABI, bcABI: bcABI}, nil
}

// Run blocks until ctx is cancelled.
func (ix *Indexer) Run(ctx context.Context) {
	log.Info().Msg("indexer: starting")

	// ── Catch-up loop ────────────────────────────────────────────────────────
	if err := ix.catchUp(ctx); err != nil {
		if ctx.Err() != nil {
			return
		}
		log.Error().Err(err).Msg("indexer: catch-up failed")
	}

	// ── Poll ticker ──────────────────────────────────────────────────────────
	pollTick    := time.NewTicker(time.Duration(ix.cfg.PollIntervalMs) * time.Millisecond)
	trendTick   := time.NewTicker(5 * time.Minute)
	defer pollTick.Stop()
	defer trendTick.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("indexer: shutting down")
			return

		case <-pollTick.C:
			if err := ix.pollOnce(ctx); err != nil && ctx.Err() == nil {
				log.Error().Err(err).Msg("indexer: poll error")
			}

		case <-trendTick.C:
			if err := ix.db.UpdateTrending(ctx); err != nil && ctx.Err() == nil {
				log.Error().Err(err).Msg("indexer: trending update error")
			} else {
				log.Debug().Msg("indexer: trending scores updated")
			}
		}
	}
}

// catchUp processes all blocks from the last synced block to the current head.
func (ix *Indexer) catchUp(ctx context.Context) error {
	lastBlock, err := ix.db.GetLastBlock(ctx)
	if err != nil {
		return fmt.Errorf("get last block: %w", err)
	}

	// Use START_BLOCK if we've never synced before
	if lastBlock == 0 && ix.cfg.StartBlock > 0 {
		lastBlock = ix.cfg.StartBlock - 1
	}

	head, err := ix.eth.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get head: %w", err)
	}

	if lastBlock >= head {
		log.Info().Uint64("at", head).Msg("indexer: already up to date")
		return nil
	}

	batch := uint64(ix.cfg.LogsBatchSize)
	total := head - lastBlock
	log.Info().
		Uint64("from", lastBlock+1).
		Uint64("to", head).
		Uint64("blocks", total).
		Msg("indexer: catching up")

	for from := lastBlock + 1; from <= head; from += batch {
		to := from + batch - 1
		if to > head {
			to = head
		}
		if err := ix.indexRange(ctx, from, to); err != nil {
			return fmt.Errorf("range %d-%d: %w", from, to, err)
		}
		pct := float64(to-lastBlock) / float64(total) * 100
		log.Info().
			Uint64("block", to).
			Str("progress", fmt.Sprintf("%.1f%%", pct)).
			Msg("indexer: catch-up progress")
	}

	log.Info().Uint64("head", head).Msg("indexer: catch-up complete")
	return nil
}

// pollOnce checks for new blocks since the last sync.
func (ix *Indexer) pollOnce(ctx context.Context) error {
	lastBlock, err := ix.db.GetLastBlock(ctx)
	if err != nil {
		return err
	}
	head, err := ix.eth.BlockNumber(ctx)
	if err != nil {
		return err
	}
	if lastBlock >= head {
		return nil
	}
	return ix.indexRange(ctx, lastBlock+1, head)
}

// indexRange processes a contiguous range of blocks [from, to].
func (ix *Indexer) indexRange(ctx context.Context, from, to uint64) error {
	// 1. Index new artworks from Factory
	if err := ix.indexArtworkCreated(ctx, from, to); err != nil {
		return fmt.Errorf("artworkCreated: %w", err)
	}

	// 2. Load all known artwork addresses
	addresses, err := ix.db.GetArtworkAddresses(ctx)
	if err != nil {
		return fmt.Errorf("get addresses: %w", err)
	}

	// 3. Index trades on those artworks (batch to respect RPC limits)
	const addrBatch = 50
	for i := 0; i < len(addresses); i += addrBatch {
		end := i + addrBatch
		if end > len(addresses) {
			end = len(addresses)
		}
		batch := addresses[i:end]
		if err := ix.indexTrades(ctx, from, to, batch); err != nil {
			log.Error().Err(err).Msg("indexer: trade batch error (continuing)")
		}
	}

	// 4. Advance sync cursor
	return ix.db.SetLastBlock(ctx, to)
}

// filterQuery builds an ethereum.FilterQuery for the given range and contracts.
func filterQuery(from, to uint64, topics [][]common.Hash, addrs ...string) ethereum.FilterQuery {
	var contracts []common.Address
	for _, a := range addrs {
		contracts = append(contracts, common.HexToAddress(a))
	}
	return ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(from),
		ToBlock:   new(big.Int).SetUint64(to),
		Addresses: contracts,
		Topics:    topics,
	}
}
