/**
 * GET /api/stats — platform-wide statistics
 */

import { Router } from 'express';
import { prisma } from '../db/client';

export const statsRouter = Router();

statsRouter.get('/', async (_req, res) => {
  try {
    const [artworks, trades] = await Promise.all([
      prisma.artwork.findMany({ select: { totalVolume: true, graduated: true } }),
      prisma.trade.aggregate({
        _sum: { royalty: true },
        _count: { _all: true },
      }),
    ]);

    const totalVolume = artworks.reduce((sum, a) => sum + BigInt(a.totalVolume), 0n);
    const totalRoyalties = BigInt(trades._sum.royalty ?? '0');
    const graduatedCount = artworks.filter((a) => a.graduated).length;

    res.json({
      totalArtworks: artworks.length,
      totalVolume: totalVolume.toString(),
      totalRoyaltiesPaid: totalRoyalties.toString(),
      graduatedCount,
      totalTrades: trades._count._all,
      tradingArtworks: artworks.filter((a) => BigInt(a.totalVolume) > 0n).length,
    });
  } catch (err) {
    console.error('[GET /stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
