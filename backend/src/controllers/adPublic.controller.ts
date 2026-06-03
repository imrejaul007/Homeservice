import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { providerAdService } from '../services/providerAd.service';
import { formatProviderAd } from '../utils/formatProviderAd';

/**
 * GET /api/ads/public/feed
 * Active ads for customer placements (homepage, search, etc.)
 */
export const getPublicAdFeed = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || 5), 10) || 5, 20);
  const category = req.query.category ? String(req.query.category) : undefined;

  const ads = await providerAdService.getActivePublicAds({ limit, category });

  res.json({
    success: true,
    data: {
      ads: ads.map((ad) => formatProviderAd(ad as unknown as Record<string, unknown>)),
    },
  });
});

/**
 * POST /api/ads/public/:id/impression
 */
export const recordPublicImpression = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await providerAdService.recordView(id);
  res.json({ success: true });
});

/**
 * POST /api/ads/public/:id/click
 */
export const recordPublicClick = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ad } = await providerAdService.recordClick(id);
  res.json({
    success: true,
    data: {
      landingUrl: ad?.content?.landingUrl || null,
    },
  });
});
