// Package config loads and validates environment variables.
// Call Load() once at startup; it panics on missing required vars.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration.
type Config struct {
	DatabaseURL     string
	RPCURL          string
	FactoryAddress  string // checksummed or lower; normalised to lower in indexer
	ChainID         int64
	StartBlock      uint64
	APIPort         int
	PollIntervalMs  int
	LogsBatchSize   int
	FrontendURL     string
	NodeEnv         string
}

// Load reads .env (if present) and validates required vars.
func Load() *Config {
	// .env is optional — Railway / Docker inject real env vars
	_ = godotenv.Load()

	c := &Config{
		DatabaseURL:    mustEnv("DATABASE_URL"),
		RPCURL:         mustEnv("RPC_URL"),
		FactoryAddress: strings.ToLower(mustEnv("FACTORY_ADDRESS")),
		ChainID:        int64Env("CHAIN_ID", 31337),
		StartBlock:     uint64Env("START_BLOCK", 0),
		APIPort:        intEnv("API_PORT", 3001),
		PollIntervalMs: intEnv("POLL_INTERVAL_MS", 3000),
		LogsBatchSize:  intEnv("LOGS_BATCH_SIZE", 2000),
		FrontendURL:    envOr("FRONTEND_URL", "http://localhost:3000"),
		NodeEnv:        envOr("NODE_ENV", "development"),
	}
	return c
}

// IsProd returns true when NODE_ENV=production.
func (c *Config) IsProd() bool { return c.NodeEnv == "production" }

// ─── helpers ─────────────────────────────────────────────────────────────────

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("config: required env var %q is not set", key))
	}
	return v
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return fallback
}

func int64Env(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			return n
		}
	}
	return fallback
}

func uint64Env(key string, fallback uint64) uint64 {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err == nil {
			return n
		}
	}
	return fallback
}
