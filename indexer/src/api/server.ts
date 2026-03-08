/**
 * ArtCurve Indexer — Express REST API
 *
 * Endpoints:
 *   GET /health
 *   GET /api/artworks?sort=trending&page=1&limit=20&search=&artist=
 *   GET /api/artworks/:address
 *   GET /api/artworks/:address/trades?page=1&limit=50
 *   GET /api/stats
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { artworksRouter } from './artworks';
import { statsRouter } from './stats';
// Note: trades are served under /api/artworks/:address/trades (in artworksRouter)

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  methods: ['GET'],
}));
app.use(express.json());

// Request logger in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`  → ${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/artworks', artworksRouter);
app.use('/api/stats', statsRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
