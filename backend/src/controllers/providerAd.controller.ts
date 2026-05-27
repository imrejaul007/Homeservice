import { Request, Response } from 'express';
import { providerAdService, CreateAdInput, UpdateAdInput } from '../services/providerAd.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { formatProviderAd } from '../utils/formatProviderAd';
import logger from '../utils/logger';

/**
 * Create a new ad campaign
 * POST /api/provider/ads
 */
export const createAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const userId = (req.user as any)._id.toString();

  logger.debug('Creating ad campaign', {
    context: 'ProviderAdController',
    action: 'CREATE_AD',
    providerId,
  });

  const input: CreateAdInput = {
    name: req.body.name,
    description: req.body.description,
    budget: req.body.budget,
    bidAmount: req.body.bidAmount,
    bidType: req.body.bidType,
    targeting: req.body.targeting,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    content: req.body.content,
    relatedServiceIds: req.body.relatedServiceIds,
    limits: req.body.limits,
    scheduling: req.body.scheduling,
    priority: req.body.priority,
  };

  const ad = await providerAdService.createAd(providerId, userId, input);

  res.status(201).json({
    success: true,
    message: 'Ad campaign created successfully',
    data: { ad: formatProviderAd(ad.toObject() as Record<string, unknown>) },
  });
});

/**
 * Get all ads for the provider
 * GET /api/provider/ads
 */
export const getMyAds = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();

  const {
    status,
    page = '1',
    limit = '20',
    sortBy = 'createdAt',
    order = 'desc',
    search,
    startDate,
    endDate,
  } = req.query;

  const filters = {
    status: status as string | undefined,
    page: parseInt(page as string, 10),
    limit: parseInt(limit as string, 10),
    sortBy: sortBy as string,
    order: order as 'asc' | 'desc',
    search: search as string | undefined,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  };

  const result = await providerAdService.getAdsByProvider(providerId, filters);

  res.json({
    success: true,
    data: {
      ads: result.ads.map((ad) =>
        formatProviderAd(ad as unknown as Record<string, unknown>),
      ),
      pagination: result.pagination,
    },
  });
});

/**
 * Get a single ad by ID
 * GET /api/provider/ads/:id
 */
export const getAdById = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { id } = req.params;

  const ad = await providerAdService.getAdById(id, providerId);

  if (!ad) {
    throw new ApiError(404, 'Ad not found or access denied');
  }

  res.json({
    success: true,
    data: { ad },
  });
});

/**
 * Update an ad
 * PUT /api/provider/ads/:id
 */
export const updateAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const userId = (req.user as any)._id.toString();
  const { id } = req.params;

  logger.debug('Updating ad', {
    context: 'ProviderAdController',
    action: 'UPDATE_AD',
    adId: id,
    providerId,
  });

  const input: UpdateAdInput = {
    name: req.body.name,
    description: req.body.description,
    budget: req.body.budget,
    bidAmount: req.body.bidAmount,
    bidType: req.body.bidType,
    targeting: req.body.targeting,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    content: req.body.content,
    relatedServiceIds: req.body.relatedServiceIds,
    limits: req.body.limits,
    scheduling: req.body.scheduling,
    priority: req.body.priority,
  };

  const ad = await providerAdService.updateAd(id, providerId, userId, input);

  if (!ad) {
    throw new ApiError(404, 'Ad not found or access denied');
  }

  res.json({
    success: true,
    message: 'Ad updated successfully',
    data: { ad },
  });
});

/**
 * Delete an ad
 * DELETE /api/provider/ads/:id
 */
export const deleteAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { id } = req.params;

  logger.debug('Deleting ad', {
    context: 'ProviderAdController',
    action: 'DELETE_AD',
    adId: id,
    providerId,
  });

  await providerAdService.deleteAd(id, providerId);

  res.json({
    success: true,
    message: 'Ad deleted successfully',
  });
});

/**
 * Pause an ad
 * POST /api/provider/ads/:id/pause
 */
export const pauseAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { id } = req.params;

  logger.debug('Pausing ad', {
    context: 'ProviderAdController',
    action: 'PAUSE_AD',
    adId: id,
    providerId,
  });

  const ad = await providerAdService.pauseAd(id, providerId);

  res.json({
    success: true,
    message: 'Ad paused successfully',
    data: { ad },
  });
});

/**
 * Resume a paused ad
 * POST /api/provider/ads/:id/resume
 */
export const resumeAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { id } = req.params;

  logger.debug('Resuming ad', {
    context: 'ProviderAdController',
    action: 'RESUME_AD',
    adId: id,
    providerId,
  });

  const ad = await providerAdService.resumeAd(id, providerId);

  res.json({
    success: true,
    message: 'Ad resumed successfully',
    data: { ad },
  });
});

/**
 * Launch a draft ad
 * POST /api/provider/ads/:id/launch
 */
export const launchAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { id } = req.params;

  logger.debug('Launching ad', {
    context: 'ProviderAdController',
    action: 'LAUNCH_AD',
    adId: id,
    providerId,
  });

  const ad = await providerAdService.launchAd(id, providerId);

  res.json({
    success: true,
    message: 'Ad launched successfully',
    data: { ad },
  });
});

/**
 * Get provider's ad statistics
 * GET /api/provider/ads/stats
 */
export const getAdStats = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();

  const stats = await providerAdService.getProviderAdStats(providerId);

  res.json({
    success: true,
    data: { stats },
  });
});

/**
 * Get detailed analytics for a specific ad
 * GET /api/provider/ads/:id/analytics
 */
export const getAdAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { id } = req.params;

  const analytics = await providerAdService.getAdAnalytics(id, providerId);

  res.json({
    success: true,
    data: { analytics },
  });
});

/**
 * Get available targeting categories
 * GET /api/provider/ads/categories
 */
export const getTargetingCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await providerAdService.getTargetingCategories();

  res.json({
    success: true,
    data: { categories },
  });
});

/**
 * Bulk pause ads
 * POST /api/provider/ads/bulk/pause
 */
export const bulkPauseAds = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { adIds } = req.body;

  if (!Array.isArray(adIds) || adIds.length === 0) {
    throw new ApiError(400, 'Ad IDs array is required');
  }

  const results = await Promise.allSettled(
    adIds.map((adId: string) => providerAdService.pauseAd(adId, providerId))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.json({
    success: true,
    message: `Paused ${succeeded} ads, ${failed} failed`,
    data: {
      succeeded,
      failed,
    },
  });
});

/**
 * Bulk resume ads
 * POST /api/provider/ads/bulk/resume
 */
export const bulkResumeAds = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { adIds } = req.body;

  if (!Array.isArray(adIds) || adIds.length === 0) {
    throw new ApiError(400, 'Ad IDs array is required');
  }

  const results = await Promise.allSettled(
    adIds.map((adId: string) => providerAdService.resumeAd(adId, providerId))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.json({
    success: true,
    message: `Resumed ${succeeded} ads, ${failed} failed`,
    data: {
      succeeded,
      failed,
    },
  });
});

/**
 * Bulk delete ads
 * POST /api/provider/ads/bulk/delete
 */
export const bulkDeleteAds = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id.toString();
  const { adIds } = req.body;

  if (!Array.isArray(adIds) || adIds.length === 0) {
    throw new ApiError(400, 'Ad IDs array is required');
  }

  const results = await Promise.allSettled(
    adIds.map((adId: string) => providerAdService.deleteAd(adId, providerId))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.json({
    success: true,
    message: `Deleted ${succeeded} ads, ${failed} failed`,
    data: {
      succeeded,
      failed,
    },
  });
});
