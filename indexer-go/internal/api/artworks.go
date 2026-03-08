package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/artcurve/indexer/internal/db"
	"github.com/artcurve/indexer/pkg/curve"
)

// GET /api/artworks
// Query params: sort, search, artist, graduated, graduating, page, limit
func (s *Server) listArtworks(c *gin.Context) {
	q := db.ListArtworksParams{
		Sort:   c.DefaultQuery("sort", "trending"),
		Search: strings.ToLower(c.Query("search")),
		Artist: strings.ToLower(c.Query("artist")),
		Page:   intQ(c, "page", 1),
		Limit:  intQ(c, "limit", 20),
	}

	// graduated filter
	if g := c.Query("graduated"); g != "" {
		b := g == "true"
		q.Graduated = &b
	}
	// graduating = near graduation, not yet there
	q.Graduating = c.Query("graduating") == "true"

	res, err := s.db.ListArtworks(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    enrichArtworks(res.Artworks),
		"total":   res.Total,
		"page":    q.Page,
		"limit":   q.Limit,
		"hasMore": q.Page*q.Limit < res.Total,
	})
}

// GET /api/artworks/:address
func (s *Server) getArtwork(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))
	art, err := s.db.GetArtwork(c.Request.Context(), address)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "artwork not found"})
		return
	}
	c.JSON(http.StatusOK, enrichArtwork(*art))
}

// GET /api/artworks/:address/trades
// Query params: page, limit
func (s *Server) listTrades(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))
	q := db.ListTradesParams{
		ArtworkAddress: address,
		Page:           intQ(c, "page", 1),
		Limit:          intQ(c, "limit", 50),
	}

	res, err := s.db.ListTrades(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    res.Trades,
		"total":   res.Total,
		"page":    q.Page,
		"limit":   q.Limit,
		"hasMore": q.Page*q.Limit < res.Total,
	})
}

// ─── enrichment — add computed fields ─────────────────────────────────────────

type apiArtwork struct {
	db.Artwork
	Price             string  `json:"price"`
	MarketCap         string  `json:"marketCap"`
	GraduationProgress int    `json:"graduationProgress"`
}

func enrichArtwork(a db.Artwork) apiArtwork {
	supply := curve.ParseBig(a.Supply)
	k      := curve.ParseBig(a.K)
	p0     := curve.ParseBig(a.P0)
	reserve := curve.ParseBig(a.Reserve)

	return apiArtwork{
		Artwork:            a,
		Price:              curve.CurrentPrice(supply, k, p0).String(),
		MarketCap:          curve.MarketCap(supply, k, p0).String(),
		GraduationProgress: curve.GraduationProgress(reserve),
	}
}

func enrichArtworks(artworks []db.Artwork) []apiArtwork {
	result := make([]apiArtwork, len(artworks))
	for i, a := range artworks {
		result[i] = enrichArtwork(a)
	}
	return result
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func intQ(c *gin.Context, key string, fallback int) int {
	if v := c.Query(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}
