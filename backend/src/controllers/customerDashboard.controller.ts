import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { customerDashboardService } from '../services/customerDashboard.service';

/**
 * GET /api/customer/dashboard
 * Get unified dashboard data for the authenticated customer
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  const tenantId = req.tenantId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const dashboardData = await customerDashboardService.getDashboardData(userId, tenantId);

  res.json({
    success: true,
    data: dashboardData,
  });
});

/**
 * GET /api/packages
 * Get service packages available for customers
 */
export const getPackages = asyncHandler(async (req: Request, res: Response) => {
  const {
    category,
    minPrice,
    maxPrice,
    sortBy,
    page,
    limit,
    featured,
  } = req.query;

  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const result = await customerDashboardService.getServicePackages(tenantId, {
    category: category as string,
    minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
    sortBy: sortBy as 'price' | 'rating' | 'popularity' | undefined,
    page: page ? parseInt(page as string, 10) : 1,
    limit: limit ? Math.min(parseInt(limit as string, 10), 100) : 20,
    isFeatured: featured === 'true' ? true : featured === 'false' ? false : undefined,
  });

  res.json({
    success: true,
    data: {
      packages: result.packages,
      pagination: result.pagination,
    },
  });
});

/**
 * GET /api/packages/:id
 * Get a single service package by ID
 */
export const getPackageById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Package ID is required',
    });
    return;
  }

  const result = await customerDashboardService.getPackageById(id, tenantId);

  if (!result) {
    res.status(404).json({
      success: false,
      message: 'Package not found',
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/dashboard/activity
 * Get recent activity feed for the authenticated customer
 */
export const getActivityFeed = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  const tenantId = req.tenantId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const { limit = '20' } = req.query;
  const activities = await customerDashboardService.getActivityFeed(
    userId,
    tenantId,
    Math.min(parseInt(limit as string, 10), 50)
  );

  res.json({
    success: true,
    data: activities,
  });
});

/**
 * GET /api/dashboard/recommended-pros
 * Get recommended professionals based on user's booking history
 */
export const getRecommendedPros = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  const tenantId = req.tenantId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const { limit = '10' } = req.query;
  const pros = await customerDashboardService.getRecommendedPros(
    userId,
    tenantId,
    Math.min(parseInt(limit as string, 10), 20)
  );

  res.json({
    success: true,
    data: pros,
  });
});

/**
 * GET /api/customer/dashboard/stats
 * Get dashboard statistics only
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  const tenantId = req.tenantId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const stats = await customerDashboardService.getStats(userId, tenantId);

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/customer/dashboard/loyalty
 * Get loyalty points data only
 */
export const getDashboardLoyalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  const tenantId = req.tenantId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const loyalty = await customerDashboardService.getLoyaltyData(userId, tenantId);

  res.json({
    success: true,
    data: loyalty,
  });
});

/**
 * GET /api/customer/dashboard/streak
 * Get streak data only
 */
export const getDashboardStreak = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  const tenantId = req.tenantId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  const streak = await customerDashboardService.getStreakData(userId, tenantId);

  res.json({
    success: true,
    data: streak,
  });
});

export default {
  getDashboard,
  getPackages,
  getPackageById,
  getActivityFeed,
  getRecommendedPros,
  getDashboardStats,
  getDashboardLoyalty,
  getDashboardStreak,
};
