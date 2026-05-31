/**
 * Service Analytics Controller
 * Handles service-level analytics requests for providers
 */
import { Request, Response, NextFunction } from 'express';
import { serviceAnalyticsService } from '../services/serviceAnalytics.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Get All Services Analytics
 * GET /api/analytics/services
 */
export const getServicesAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const {
      serviceIds,
      category,
      startDate,
      endDate,
      limit = 20,
    } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const filters: {
      providerId?: string;
      serviceIds?: string[];
      category?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {
      providerId,
      limit: parseInt(limit as string, 10) || 20,
    };

    if (serviceIds) {
      filters.serviceIds = Array.isArray(serviceIds)
        ? serviceIds.map((id) => id.toString())
        : [serviceIds.toString()];
    }

    if (category) {
      filters.category = category.toString();
    }

    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }

    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const analytics = await serviceAnalyticsService.getAllServicesMetrics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Service Analytics
 * GET /api/analytics/services/:serviceId
 */
export const getServiceAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const { serviceId } = req.params;
    const { startDate, endDate } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!serviceId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new ApiError(400, 'Invalid service ID');
    }

    const filters: { startDate?: Date; endDate?: Date } = {};
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const analytics = await serviceAnalyticsService.getServiceMetrics(serviceId, filters.startDate, filters.endDate);

    if (!analytics) {
      throw new ApiError(404, 'Service not found');
    }

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Service Comparison
 * GET /api/analytics/services/compare
 */
export const getServiceComparison = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const { startDate, endDate } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const filters: { startDate?: Date; endDate?: Date } = {};
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const comparison = await serviceAnalyticsService.getMarketComparison(providerId, filters.startDate, filters.endDate);

    res.status(200).json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Top Services
 * GET /api/analytics/services/top
 */
export const getTopServices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const {
      limit = 5,
      sortBy = 'revenue',
      startDate,
      endDate,
    } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const validSortOptions = ['revenue', 'bookings', 'rating', 'conversion'];
    const effectiveSortBy = validSortOptions.includes(sortBy as string) ? sortBy as string : 'revenue';

    const filters: {
      startDate?: Date;
      endDate?: Date;
    } = {};
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const topServices = await serviceAnalyticsService.getTopServices(
      providerId,
      parseInt(limit as string, 10) || 5,
      effectiveSortBy as 'revenue' | 'bookings' | 'rating' | 'conversion',
      filters.startDate,
      filters.endDate
    );

    res.status(200).json({
      success: true,
      data: topServices,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Category Breakdown
 * GET /api/analytics/services/categories
 */
export const getCategoryBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const { startDate, endDate } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const filters: { startDate?: Date; endDate?: Date } = {};
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const breakdown = await serviceAnalyticsService.getCategoryBreakdown(providerId, filters.startDate, filters.endDate);

    res.status(200).json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Revenue Trend
 * GET /api/analytics/services/:serviceId/trend
 */
export const getRevenueTrend = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const { serviceId } = req.params;
    const { days = 30 } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!serviceId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new ApiError(400, 'Invalid service ID');
    }

    const trend = await serviceAnalyticsService.getRevenueTrend(
      serviceId,
      parseInt(days as string, 10) || 30
    );

    res.status(200).json({
      success: true,
      data: trend,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Summary Stats
 * GET /api/analytics/services/summary
 */
export const getSummaryStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providerId = req.user?.id;
    const { startDate, endDate } = req.query;

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const filters: { startDate?: Date; endDate?: Date } = {};
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    const summary = await serviceAnalyticsService.getSummaryStats(providerId, filters.startDate, filters.endDate);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};
