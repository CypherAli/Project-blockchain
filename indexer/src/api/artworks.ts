/**
 * GET /api/artworks  — paginated, sorted artwork list
 * GET /api/artworks/:address — single artwork
 * GET /api/artworks/:address/trades — trade history for artwork
 */

import { Router } from 'express';
import { prisma } from '../db/client';

export const artworksRouter = Router();

// ─── GET /api/artworks ────────────────────────────────────────────────────────

artworksRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10)));
    const sort = (req.query.sort as string) ?? 'trending';
    const search = (req.query.search as string) ?? '';
    const artist = (req.query.artist as string) ?? '';
    const offset = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (artist) {
      where.artist = artist.toLowerCase();
    }
    if (sort === 'graduated') {
      where.graduated = true;
    }
    if (sort === 'graduating') {
      where.graduated = false;
      // reserve >= 50% of 24 ETH = 12 ETH (12e18)
      where.reserve = { gte: (12n * 10n ** 18n).toString() };
    }

    // Build orderBy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    switch (sort) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'price':
        orderBy = { trendingScore: 'desc' }; // proxy for now
        break;
      case 'trending':
      case 'graduating':
      case 'graduated':
      default:
        orderBy = { trendingScore: 'desc' };
    }

    const [artworks, total] = await Promise.all([
      prisma.artwork.findMany({ where, orderBy, skip: offset, take: limit }),
      prisma.artwork.count({ where }),
    ]);

    res.json({
      data: artworks,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    console.error('[GET /artworks]', err);
    res.status(500).json({ error: 'Failed to fetch artworks' });
  }
});

// ─── GET /api/artworks/:address ───────────────────────────────────────────────

artworksRouter.get('/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const artwork = await prisma.artwork.findUnique({ where: { address } });

    if (!artwork) {
      return res.status(404).json({ error: 'Artwork not found' });
    }

    return res.json(artwork);
  } catch (err) {
    console.error('[GET /artworks/:address]', err);
    return res.status(500).json({ error: 'Failed to fetch artwork' });
  }
});

// ─── GET /api/artworks/:address/trades ────────────────────────────────────────

artworksRouter.get('/:address/trades', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10)));
    const offset = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { artworkAddress: address },
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.trade.count({ where: { artworkAddress: address } }),
    ]);

    return res.json({
      data: trades,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    console.error('[GET /artworks/:address/trades]', err);
    return res.status(500).json({ error: 'Failed to fetch trades' });
  }
});
