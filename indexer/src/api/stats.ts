/**
 * GET /api/stats — platform-wide statistics
 */

import { Router } from 'express';
import { prisma } from '../db/client';

export const statsRouter = Router();

statsRouter.get('/', async (_req, res) => {
  try {
    // Note: royalty is stored as String (BigInt in wei), so we can't use _sum.
    // We use count() for totalTrades and aggregate volume manually from artworks.
    const [artworks, totalTrades] = await Promise.all([
      prisma.artwork.findMany({ select: { totalVolume: true, graduated: true } }),
      prisma.trade.count(),
    ]);

    const totalVolume = artworks.reduce((sum, a) => sum + BigInt(a.totalVolume), 0n);
    const graduatedCount = artworks.filter((a) => a.graduated).length;

    res.json({
      totalArtworks: artworks.length,
      totalVolume: totalVolume.toString(),
      graduatedCount,
      totalTrades,
      tradingArtworks: artworks.filter((a) => BigInt(a.totalVolume) > 0n).length,
    });
  } catch (err) {
    console.error('[GET /stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
