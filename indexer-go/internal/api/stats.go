package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GET /api/stats
func (s *Server) getStats(c *gin.Context) {
	stats, err := s.db.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}
