// Package api exposes the REST API via Gin.
package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/artcurve/indexer/internal/config"
	"github.com/artcurve/indexer/internal/db"
)

// Server wraps the Gin engine + deps.
type Server struct {
	cfg    *config.Config
	db     *db.Pool
	engine *gin.Engine
}

// New configures the Gin engine with all routes and middleware.
func New(cfg *config.Config, pool *db.Pool) *Server {
	if cfg.IsProd() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(zerologMiddleware())

	// ── CORS ─────────────────────────────────────────────────────────────────
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL, "http://localhost:3000"},
		AllowMethods:     []string{"GET", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		MaxAge:           12 * time.Hour,
		AllowCredentials: false,
	}))

	s := &Server{cfg: cfg, db: pool, engine: r}
	s.registerRoutes()
	return s
}

// registerRoutes wires all API endpoints.
func (s *Server) registerRoutes() {
	api := s.engine.Group("/api")

	// Health
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "ts": time.Now().Unix()})
	})

	// Artworks
	api.GET("/artworks",                     s.listArtworks)
	api.GET("/artworks/:address",            s.getArtwork)
	api.GET("/artworks/:address/trades",     s.listTrades)

	// Stats
	api.GET("/stats", s.getStats)
}

// Start runs the HTTP server; blocks until ctx is cancelled or fatal error.
func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf(":%d", s.cfg.APIPort)
	srv  := &http.Server{Addr: addr, Handler: s.engine}

	errCh := make(chan error, 1)
	go func() {
		log.Info().Str("addr", addr).Msg("api: listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(shutCtx)
	case err := <-errCh:
		return err
	}
}

// ─── Zerolog request logger middleware ───────────────────────────────────────

func zerologMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info().
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(start)).
			Msg("api")
	}
}
