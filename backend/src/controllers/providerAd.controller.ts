import { Request, Response } from 'express';
import { providerAdService, CreateAdInput, UpdateAdInput } from '../services/providerAd.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { formatProviderAd } from '../utils/formatProviderAd';
import logger from '../utils/logger';
import { IUser } from '../models/user.model';
import mongoose from 'mongoose';

/**
 * Create a new ad campaign
 * POST /api/provider/ads
 */
export const createAd = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id.toString();
  const userId = (req.user as IUser)._id.toString();

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
 * Validates and sanitizes query parameters to prevent injection and invalid data
 */
export const getMyAds = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id.toString();

  // Parse and validate query parameters with strict type coercion
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const order = (req.query.order as string) || 'desc';
  const search = req.query.search as string | undefined;

  // Validate enum values
  const validSortFields = ['createdAt', 'updatedAt', 'name', 'budget', 'status'];
  const validOrderValues = ['asc', 'desc'];
  const validStatuses = ['draft', 'active', 'paused', 'completed', 'cancelled'];

  if (!validSortFields.includes(sortBy)) {
    throw new ApiError(400, 'Invalid sortBy field');
  }
  if (!validOrderValues.includes(order)) {
    throw new ApiError(400, 'Invalid order value');
  }

  // Validate pagination bounds
  if (page < 1) {
    throw new ApiError(400, 'Page must be at least 1');
  }
  if (limit < 1 || limit > 100) {
    throw new ApiError(400, 'Limit must be between 1 and 100');
  }

  // Validate status if provided
  const status = req.query.status as string | undefined;
  if (status && !validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status value');
  }

  // Parse and validate dates
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (req.query.startDate) {
    startDate = new Date(req.query.startDate as string);
    if (isNaN(startDate.getTime())) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
  }

  if (req.query.endDate) {
    endDate = new Date(req.query.endDate as string);
    if (isNaN(endDate.getTime())) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }
  }

  // Validate date range
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError(400, 'endDate must be after startDate');
  }

  // Validate search term
  if (search && search.length > 100) {
    throw new ApiError(400, 'Search term must be 100 characters or less');
  }

  const filters = {
    status,
    page,
    limit,
    sortBy,
    order: order as 'asc' | 'desc',
    search,
    startDate,
    endDate,
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
  const providerId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();
  const userId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();

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
  const providerId = (req.user as IUser)._id.toString();
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
  const providerId = (req.user as IUser)._id.toString();
  const { adIds } = req.body;

  if (!Array.isArray(adIds) || adIds.length === 0) {
    throw new ApiError(400, 'Ad IDs array is required');
  }

  const MAX_BULK_SIZE = 100;
  if (adIds.length > MAX_BULK_SIZE) {
    throw new ApiError(400, `Cannot process more than ${MAX_BULK_SIZE} items at once`);
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
  const providerId = (req.user as IUser)._id.toString();
  const { adIds } = req.body;

  if (!Array.isArray(adIds) || adIds.length === 0) {
    throw new ApiError(400, 'Ad IDs array is required');
  }

  const MAX_BULK_SIZE = 100;
  if (adIds.length > MAX_BULK_SIZE) {
    throw new ApiError(400, `Cannot process more than ${MAX_BULK_SIZE} items at once`);
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
  const providerId = (req.user as IUser)._id.toString();
  const { adIds } = req.body;

  if (!Array.isArray(adIds) || adIds.length === 0) {
    throw new ApiError(400, 'Ad IDs array is required');
  }

  const MAX_BULK_SIZE = 100;
  if (adIds.length > MAX_BULK_SIZE) {
    throw new ApiError(400, `Cannot process more than ${MAX_BULK_SIZE} items at once`);
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
