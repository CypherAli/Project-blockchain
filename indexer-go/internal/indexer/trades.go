package indexer

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	ethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/rs/zerolog/log"

	"github.com/artcurve/indexer/internal/db"
	"github.com/artcurve/indexer/pkg/curve"
)

// indexTrades fetches SharesBought, SharesSold and Graduated events
// for a set of bonding curve addresses over [from, to].
func (ix *Indexer) indexTrades(ctx context.Context, from, to uint64, addresses []string) error {
	buyID  := ix.bcABI.Events["SharesBought"].ID
	sellID := ix.bcABI.Events["SharesSold"].ID
	gradID := ix.bcABI.Events["Graduated"].ID

	query := filterQuery(from, to,
		[][]common.Hash{{buyID, sellID, gradID}},
		addresses...,
	)

	logs, err := ix.eth.FilterLogs(ctx, query)
	if err != nil {
		return err
	}
	if len(logs) == 0 {
		return nil
	}

	// ── Pre-fetch unique block timestamps in one pass ────────────────────────
	blockNums := uniqueBlockNums(logs)
	timestamps, err := ix.fetchTimestamps(ctx, blockNums)
	if err != nil {
		log.Warn().Err(err).Msg("indexer: some timestamps unavailable")
	}

	// ── Process each log ─────────────────────────────────────────────────────
	for _, vlog := range logs {
		artworkAddr := strings.ToLower(vlog.Address.Hex())
		ts := timestamps[vlog.BlockNumber]

		switch vlog.Topics[0] {
		case buyID:
			ix.handleBuy(ctx, vlog, artworkAddr, ts)
		case sellID:
			ix.handleSell(ctx, vlog, artworkAddr, ts)
		case gradID:
			if err := ix.db.SetGraduated(ctx, artworkAddr); err != nil {
				log.Error().Err(err).Str("address", artworkAddr).Msg("indexer: set graduated")
			} else {
				log.Info().Str("address", artworkAddr).Msg("indexer: 🎓 artwork graduated")
			}
		}
	}
	return nil
}

// ─── Buy ─────────────────────────────────────────────────────────────────────

type buyEvent struct {
	Amount        *big.Int
	EthCost       *big.Int
	Royalty       *big.Int
	PlatformFee   *big.Int
	NewTotalSupply *big.Int
}

func (ix *Indexer) handleBuy(ctx context.Context, vlog ethtypes.Log, artworkAddr string, ts time.Time) {
	if len(vlog.Topics) < 2 {
		return
	}
	buyer := strings.ToLower(common.HexToAddress(vlog.Topics[1].Hex()).Hex())

	var ev buyEvent
	if err := ix.bcABI.UnpackIntoInterface(&ev, "SharesBought", vlog.Data); err != nil {
		log.Error().Err(err).Str("tx", vlog.TxHash.Hex()).Msg("indexer: unpack SharesBought")
		return
	}

	// Current artwork state for reserve/volume update
	art, err := ix.db.GetArtwork(ctx, artworkAddr)
	if err != nil {
		log.Error().Err(err).Str("address", artworkAddr).Msg("indexer: get artwork for buy")
		return
	}

	// curve cost = ethCost - royalty - platformFee
	curveCost := new(big.Int).Sub(ev.EthCost, ev.Royalty)
	curveCost.Sub(curveCost, ev.PlatformFee)

	oldReserve  := curve.ParseBig(art.Reserve)
	oldVolume   := curve.ParseBig(art.TotalVolume)
	newReserve  := new(big.Int).Add(oldReserve, curveCost)
	newVolume   := new(big.Int).Add(oldVolume, curveCost)

	supply := ev.NewTotalSupply
	k      := curve.ParseBig(art.K)
	p0     := curve.ParseBig(art.P0)
	price  := curve.CurrentPrice(supply, k, p0)

	trade := db.Trade{
		ArtworkAddress: artworkAddr,
		Type:           "BUY",
		Trader:         buyer,
		Shares:         ev.Amount.String(),
		EthAmount:      ev.EthCost.String(),
		Royalty:        ev.Royalty.String(),
		Supply:         supply.String(),
		Price:          price.String(),
		TxHash:         vlog.TxHash.Hex(),
		BlockNumber:    vlog.BlockNumber.String(),
		Timestamp:      ts,
	}

	if err := ix.db.UpsertTrade(ctx, trade); err != nil {
		log.Error().Err(err).Str("tx", vlog.TxHash.Hex()).Msg("indexer: upsert buy trade")
		return
	}

	if err := ix.db.UpdateArtworkState(ctx,
		artworkAddr, supply.String(), newReserve.String(), newVolume.String(),
	); err != nil {
		log.Error().Err(err).Str("address", artworkAddr).Msg("indexer: update artwork after buy")
	}
}

// ─── Sell ─────────────────────────────────────────────────────────────────────

type sellEvent struct {
	Amount        *big.Int
	EthReturned   *big.Int
	Royalty       *big.Int
	PlatformFee   *big.Int
	NewTotalSupply *big.Int
}

func (ix *Indexer) handleSell(ctx context.Context, vlog ethtypes.Log, artworkAddr string, ts time.Time) {
	if len(vlog.Topics) < 2 {
		return
	}
	seller := strings.ToLower(common.HexToAddress(vlog.Topics[1].Hex()).Hex())

	var ev sellEvent
	if err := ix.bcABI.UnpackIntoInterface(&ev, "SharesSold", vlog.Data); err != nil {
		log.Error().Err(err).Str("tx", vlog.TxHash.Hex()).Msg("indexer: unpack SharesSold")
		return
	}

	art, err := ix.db.GetArtwork(ctx, artworkAddr)
	if err != nil {
		log.Error().Err(err).Str("address", artworkAddr).Msg("indexer: get artwork for sell")
		return
	}

	// On sell: reserve decreases by gross return, volume increases by gross return
	grossReturn := new(big.Int).Add(ev.EthReturned, ev.Royalty)
	grossReturn.Add(grossReturn, ev.PlatformFee)

	oldReserve := curve.ParseBig(art.Reserve)
	oldVolume  := curve.ParseBig(art.TotalVolume)
	newReserve := new(big.Int).Sub(oldReserve, grossReturn)
	if newReserve.Sign() < 0 {
		newReserve.SetInt64(0)
	}
	newVolume := new(big.Int).Add(oldVolume, grossReturn)

	supply := ev.NewTotalSupply
	k      := curve.ParseBig(art.K)
	p0     := curve.ParseBig(art.P0)
	price  := curve.CurrentPrice(supply, k, p0)

	trade := db.Trade{
		ArtworkAddress: artworkAddr,
		Type:           "SELL",
		Trader:         seller,
		Shares:         ev.Amount.String(),
		EthAmount:      ev.EthReturned.String(),
		Royalty:        ev.Royalty.String(),
		Supply:         supply.String(),
		Price:          price.String(),
		TxHash:         vlog.TxHash.Hex(),
		BlockNumber:    vlog.BlockNumber.String(),
		Timestamp:      ts,
	}

	if err := ix.db.UpsertTrade(ctx, trade); err != nil {
		log.Error().Err(err).Str("tx", vlog.TxHash.Hex()).Msg("indexer: upsert sell trade")
		return
	}

	if err := ix.db.UpdateArtworkState(ctx,
		artworkAddr, supply.String(), newReserve.String(), newVolume.String(),
	); err != nil {
		log.Error().Err(err).Str("address", artworkAddr).Msg("indexer: update artwork after sell")
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func uniqueBlockNums(logs []ethtypes.Log) []uint64 {
	seen := map[uint64]struct{}{}
	var result []uint64
	for _, l := range logs {
		if _, ok := seen[l.BlockNumber]; !ok {
			seen[l.BlockNumber] = struct{}{}
			result = append(result, l.BlockNumber)
		}
	}
	return result
}

func (ix *Indexer) fetchTimestamps(ctx context.Context, blocks []uint64) (map[uint64]time.Time, error) {
	result := make(map[uint64]time.Time, len(blocks))
	for _, n := range blocks {
		header, err := ix.eth.HeaderByNumber(ctx, new(big.Int).SetUint64(n))
		if err != nil {
			result[n] = time.Now().UTC()
			continue
		}
		result[n] = time.Unix(int64(header.Time), 0).UTC()
	}
	return result, nil
}
