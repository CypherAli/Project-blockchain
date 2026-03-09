package indexer

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/rs/zerolog/log"

	"github.com/artcurve/indexer/internal/db"
)

// indexArtworkCreated fetches and persists ArtworkCreated events from the Factory.
func (ix *Indexer) indexArtworkCreated(ctx context.Context, from, to uint64) error {
	eventID := ix.factABI.Events["ArtworkCreated"].ID

	query := filterQuery(from, to,
		[][]common.Hash{{eventID}},
		ix.cfg.FactoryAddress,
	)

	logs, err := ix.eth.FilterLogs(ctx, query)
	if err != nil {
		return err
	}
	if len(logs) == 0 {
		return nil
	}

	log.Info().Int("count", len(logs)).Msg("indexer: ArtworkCreated events found")

	for _, vlog := range logs {
		// Indexed params: topics[1]=contractAddress, topics[2]=artist
		if len(vlog.Topics) < 3 {
			continue
		}
		artworkAddr := strings.ToLower(common.HexToAddress(vlog.Topics[1].Hex()).Hex())
		artist      := strings.ToLower(common.HexToAddress(vlog.Topics[2].Hex()).Hex())

		// Non-indexed params: name, ipfsCID, k, p0, timestamp
		type nonIndexed struct {
			Name      string
			IpfsCID   string
			K         *big.Int
			P0        *big.Int
			Timestamp *big.Int
		}
		var ni nonIndexed
		if err := ix.factABI.UnpackIntoInterface(&ni, "ArtworkCreated", vlog.Data); err != nil {
			log.Error().Err(err).Str("tx", vlog.TxHash.Hex()).Msg("indexer: unpack ArtworkCreated")
			continue
		}

		createdAt := time.Unix(ni.Timestamp.Int64(), 0).UTC()
		a := db.Artwork{
			Address:      artworkAddr,
			Name:         ni.Name,
			Artist:       artist,
			IpfsCID:      ni.IpfsCID,
			K:            ni.K.String(),
			P0:           ni.P0.String(),
			CreatedBlock: vlog.BlockNumber.String(),
			CreatedAt:    createdAt,
		}

		if err := ix.db.UpsertArtwork(ctx, a); err != nil {
			log.Error().Err(err).Str("address", artworkAddr).Msg("indexer: upsert artwork")
		} else {
			log.Info().Str("address", artworkAddr).Str("name", ni.Name).Msg("indexer: artwork indexed")
		}
	}
	return nil
}
