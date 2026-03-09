// Package db — SQL query functions.
// All BigInt/uint256 values are exchanged as decimal strings.
package db

import (
	"context"
	"fmt"
	"time"
)

// ─── Sync state ───────────────────────────────────────────────────────────────

// GetLastBlock returns the last indexed block number.
func (p *Pool) GetLastBlock(ctx context.Context) (uint64, error) {
	var s string
	err := p.QueryRow(ctx, `SELECT last_block FROM sync_state WHERE id = 1`).Scan(&s)
	if err != nil {
		return 0, err
	}
	var n uint64
	fmt.Sscanf(s, "%d", &n)
	return n, nil
}

// SetLastBlock updates the sync cursor.
func (p *Pool) SetLastBlock(ctx context.Context, block uint64) error {
	_, err := p.Exec(ctx,
		`UPDATE sync_state SET last_block = $1, updated_at = NOW() WHERE id = 1`,
		fmt.Sprintf("%d", block),
	)
	return err
}

// ─── Artworks ─────────────────────────────────────────────────────────────────

// Artwork represents one row in the artworks table.
type Artwork struct {
	Address       string
	Name          string
	Artist        string
	IpfsCID       string
	K             string
	P0            string
	Supply        string
	Reserve       string
	Graduated     bool
	TotalVolume   string
	Volume24h     string
	TrendingScore float64
	CreatedBlock  string
	CreatedAt     time.Time
	SyncedAt      time.Time
}

// UpsertArtwork inserts a new artwork; skips if address already exists.
func (p *Pool) UpsertArtwork(ctx context.Context, a Artwork) error {
	_, err := p.Exec(ctx, `
		INSERT INTO artworks
			(address, name, artist, ipfs_cid, k, p0, supply, reserve,
			 graduated, total_volume, volume_24h, trending_score,
			 created_block, created_at, synced_at)
		VALUES ($1,$2,$3,$4,$5,$6,'0','0',false,'0','0',0,$7,$8,NOW())
		ON CONFLICT (address) DO NOTHING`,
		a.Address, a.Name, a.Artist, a.IpfsCID, a.K, a.P0,
		a.CreatedBlock, a.CreatedAt,
	)
	return err
}

// GetArtworkAddresses returns every known artwork address (lowercase).
func (p *Pool) GetArtworkAddresses(ctx context.Context) ([]string, error) {
	rows, err := p.Query(ctx, `SELECT address FROM artworks`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addrs []string
	for rows.Next() {
		var addr string
		if err := rows.Scan(&addr); err != nil {
			return nil, err
		}
		addrs = append(addrs, addr)
	}
	return addrs, rows.Err()
}

// UpdateArtworkState updates supply, reserve, totalVolume and syncedAt.
func (p *Pool) UpdateArtworkState(ctx context.Context,
	address, supply, reserve, totalVolume string,
) error {
	_, err := p.Exec(ctx, `
		UPDATE artworks
		SET supply       = $2,
		    reserve      = $3,
		    total_volume = $4,
		    synced_at    = NOW()
		WHERE address = $1`,
		address, supply, reserve, totalVolume,
	)
	return err
}

// SetGraduated marks an artwork as graduated.
func (p *Pool) SetGraduated(ctx context.Context, address string) error {
	_, err := p.Exec(ctx,
		`UPDATE artworks SET graduated = true, synced_at = NOW() WHERE address = $1`,
		address,
	)
	return err
}

// UpdateTrending recalculates trending_score and volume_24h for all artworks.
func (p *Pool) UpdateTrending(ctx context.Context) error {
	// volume_24h = sum of ethAmount for trades in the last 24 hours
	// trending_score = (volume_24h_eth * 0.7 + total_volume_eth * 0.3)
	// Stored as TEXT; we use psql numeric cast for the calculation.
	_, err := p.Exec(ctx, `
		UPDATE artworks a
		SET
		  volume_24h     = COALESCE(v.vol24, '0'),
		  trending_score = (
		    CAST(COALESCE(v.vol24,'0') AS NUMERIC) * 0.7 +
		    CAST(a.total_volume AS NUMERIC)         * 0.3
		  ) / 1e18,
		  synced_at      = NOW()
		FROM (
		  SELECT artwork_address,
		         SUM(CAST(eth_amount AS NUMERIC))::TEXT AS vol24
		  FROM   trades
		  WHERE  timestamp >= NOW() - INTERVAL '24 hours'
		  GROUP  BY artwork_address
		) v
		WHERE a.address = v.artwork_address`,
	)
	return err
}

// GetArtwork returns a single artwork row.
func (p *Pool) GetArtwork(ctx context.Context, address string) (*Artwork, error) {
	a := &Artwork{}
	err := p.QueryRow(ctx, `
		SELECT address, name, artist, ipfs_cid, k, p0,
		       supply, reserve, graduated, total_volume, volume_24h,
		       trending_score, created_block, created_at, synced_at
		FROM artworks WHERE address = $1`, address,
	).Scan(
		&a.Address, &a.Name, &a.Artist, &a.IpfsCID, &a.K, &a.P0,
		&a.Supply, &a.Reserve, &a.Graduated, &a.TotalVolume, &a.Volume24h,
		&a.TrendingScore, &a.CreatedBlock, &a.CreatedAt, &a.SyncedAt,
	)
	if err != nil {
		return nil, err
	}
	return a, nil
}

// ListArtworksParams controls pagination and filtering for ListArtworks.
type ListArtworksParams struct {
	Sort       string // trending | newest | price | graduating | graduated
	Search     string
	Artist     string
	Graduated  *bool
	Graduating bool
	Page       int
	Limit      int
}

// ListArtworksResult holds a paginated artwork slice plus total count.
type ListArtworksResult struct {
	Artworks []Artwork
	Total    int
}

// ListArtworks returns a filtered, sorted, paginated list of artworks.
func (p *Pool) ListArtworks(ctx context.Context, q ListArtworksParams) (*ListArtworksResult, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit < 1 || q.Limit > 100 {
		q.Limit = 20
	}
	offset := (q.Page - 1) * q.Limit

	// ── WHERE clause ─────────────────────────────────────────────────────────
	where := "WHERE 1=1"
	args  := []any{}
	idx   := 1

	if q.Search != "" {
		where += fmt.Sprintf(" AND LOWER(name) LIKE $%d", idx)
		args = append(args, "%"+q.Search+"%")
		idx++
	}
	if q.Artist != "" {
		where += fmt.Sprintf(" AND artist = $%d", idx)
		args = append(args, q.Artist)
		idx++
	}
	if q.Graduated != nil {
		where += fmt.Sprintf(" AND graduated = $%d", idx)
		args = append(args, *q.Graduated)
		idx++
	}
	// "graduating" = reserve >= 12 ETH but not yet graduated
	if q.Graduating {
		where += fmt.Sprintf(
			" AND graduated = false AND CAST(reserve AS NUMERIC) >= $%d", idx)
		args = append(args, "12000000000000000000") // 12 ETH
		idx++
	}

	// ── ORDER BY ──────────────────────────────────────────────────────────────
	order := "trending_score DESC, created_at DESC"
	switch q.Sort {
	case "newest":
		order = "created_at DESC"
	case "price":
		order = "CAST(supply AS NUMERIC) DESC, trending_score DESC"
	case "graduating":
		order = "CAST(reserve AS NUMERIC) DESC"
	case "graduated":
		order = "graduated DESC, trending_score DESC"
	}

	// ── Count ─────────────────────────────────────────────────────────────────
	var total int
	if err := p.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM artworks %s", where),
		args...,
	).Scan(&total); err != nil {
		return nil, err
	}

	// ── Data query ────────────────────────────────────────────────────────────
	limitArgs := append(args, q.Limit, offset)
	rows, err := p.Query(ctx, fmt.Sprintf(`
		SELECT address, name, artist, ipfs_cid, k, p0,
		       supply, reserve, graduated, total_volume, volume_24h,
		       trending_score, created_block, created_at, synced_at
		FROM   artworks
		%s
		ORDER  BY %s
		LIMIT  $%d OFFSET $%d`,
		where, order, idx, idx+1,
	), limitArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var artworks []Artwork
	for rows.Next() {
		var a Artwork
		if err := rows.Scan(
			&a.Address, &a.Name, &a.Artist, &a.IpfsCID, &a.K, &a.P0,
			&a.Supply, &a.Reserve, &a.Graduated, &a.TotalVolume, &a.Volume24h,
			&a.TrendingScore, &a.CreatedBlock, &a.CreatedAt, &a.SyncedAt,
		); err != nil {
			return nil, err
		}
		artworks = append(artworks, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListArtworksResult{Artworks: artworks, Total: total}, nil
}

// ─── Trades ───────────────────────────────────────────────────────────────────

// Trade represents one row in the trades table.
type Trade struct {
	ID            string
	ArtworkAddress string
	Type          string
	Trader        string
	Shares        string
	EthAmount     string
	Royalty       string
	Supply        string
	Price         string
	TxHash        string
	BlockNumber   string
	Timestamp     time.Time
}

// UpsertTrade inserts a trade; skips if tx_hash already exists (idempotent).
func (p *Pool) UpsertTrade(ctx context.Context, t Trade) error {
	_, err := p.Exec(ctx, `
		INSERT INTO trades
			(artwork_address, type, trader, shares, eth_amount,
			 royalty, supply, price, tx_hash, block_number, timestamp)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (tx_hash) DO NOTHING`,
		t.ArtworkAddress, t.Type, t.Trader, t.Shares, t.EthAmount,
		t.Royalty, t.Supply, t.Price, t.TxHash, t.BlockNumber, t.Timestamp,
	)
	return err
}

// ListTradesParams controls pagination for ListTrades.
type ListTradesParams struct {
	ArtworkAddress string
	Page           int
	Limit          int
}

// ListTradesResult holds a paginated trade slice plus total.
type ListTradesResult struct {
	Trades []Trade
	Total  int
}

// ListTrades returns paginated trades for one artwork.
func (p *Pool) ListTrades(ctx context.Context, q ListTradesParams) (*ListTradesResult, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit < 1 || q.Limit > 200 {
		q.Limit = 50
	}
	offset := (q.Page - 1) * q.Limit

	var total int
	if err := p.QueryRow(ctx,
		`SELECT COUNT(*) FROM trades WHERE artwork_address = $1`,
		q.ArtworkAddress,
	).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := p.Query(ctx, `
		SELECT id, artwork_address, type, trader, shares, eth_amount,
		       royalty, supply, price, tx_hash, block_number, timestamp
		FROM   trades
		WHERE  artwork_address = $1
		ORDER  BY timestamp DESC
		LIMIT  $2 OFFSET $3`,
		q.ArtworkAddress, q.Limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trades []Trade
	for rows.Next() {
		var t Trade
		if err := rows.Scan(
			&t.ID, &t.ArtworkAddress, &t.Type, &t.Trader,
			&t.Shares, &t.EthAmount, &t.Royalty, &t.Supply, &t.Price,
			&t.TxHash, &t.BlockNumber, &t.Timestamp,
		); err != nil {
			return nil, err
		}
		trades = append(trades, t)
	}
	return &ListTradesResult{Trades: trades, Total: total}, rows.Err()
}

// PlatformStats holds aggregate data for the /stats endpoint.
type PlatformStats struct {
	TotalArtworks   int
	TotalVolume     string
	GraduatedCount  int
	TotalTrades     int
	TradingArtworks int
}

// GetStats returns platform-wide aggregate stats.
func (p *Pool) GetStats(ctx context.Context) (*PlatformStats, error) {
	s := &PlatformStats{}

	if err := p.QueryRow(ctx, `
		SELECT
			COUNT(*)                                                     AS total_artworks,
			COALESCE(SUM(CAST(total_volume AS NUMERIC))::TEXT, '0')     AS total_volume,
			COUNT(*) FILTER (WHERE graduated)                           AS graduated_count,
			COUNT(*) FILTER (WHERE CAST(total_volume AS NUMERIC) > 0)   AS trading_artworks
		FROM artworks`,
	).Scan(&s.TotalArtworks, &s.TotalVolume, &s.GraduatedCount, &s.TradingArtworks); err != nil {
		return nil, err
	}

	if err := p.QueryRow(ctx, `SELECT COUNT(*) FROM trades`).Scan(&s.TotalTrades); err != nil {
		return nil, err
	}

	return s, nil
}
