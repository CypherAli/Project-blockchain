// Package db manages the PostgreSQL connection pool and schema migrations.
package db

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var initSQL string

// Pool is a thin wrapper around pgxpool.Pool.
type Pool struct {
	*pgxpool.Pool
}

// Connect opens a connection pool and runs the embedded migration.
func Connect(ctx context.Context, dsn string) (*Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: parse DSN: %w", err)
	}

	// Tune pool — modest defaults, fine for Railway free tier
	cfg.MaxConns = 10
	cfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: open pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("db: ping: %w", err)
	}

	// Run embedded migration (idempotent — all statements use IF NOT EXISTS)
	if _, err := pool.Exec(ctx, initSQL); err != nil {
		return nil, fmt.Errorf("db: migrate: %w", err)
	}

	return &Pool{pool}, nil
}
