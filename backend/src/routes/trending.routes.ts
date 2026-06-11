/**
 * Trending Services Routes
 *
 * Handles trending services and category data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler';
import { trendingService } from '../services/trending.service';

const router = Router();

// Map period to TimeWindow
const mapPeriodToWindow = (period: string | undefined): '24h' | '7d' | '30d' | '90d' => {
  switch (period) {
    case 'daily': return '24h';
    case 'monthly': return '30d';
    default: return '7d';
  }
};

/**
 * GET /api/trending
 * Get trending services
 */
router.get(
  '/',
  [
    query('location').optional().isString().withMessage('Location must be a string'),
    query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    query('radius').optional().isFloat({ min: 1, max: 100 }).withMessage('Radius must be 1-100 km'),
    query('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const {
        location,
        lat,
        lng,
        radius = '15',
        categoryId,
        limit = '20',
        period = 'weekly',
      } = req.query;

      const window = mapPeriodToWindow(period as string);
      const limitNum = parseInt(limit as string, 10);

      let trending;
      if (lat && lng) {
        const locationTrending = await trendingService.getTrendingByLocation(
          { lat: parseFloat(lat as string), lng: parseFloat(lng as string) },
          parseFloat(radius as string),
          window,
          { limit: limitNum }
        );
        trending = locationTrending.topServices || [];
      } else {
        trending = await trendingService.getTrendingServices(window, {
          limit: limitNum,
          categoryId: categoryId as string | undefined,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          trending,
          metadata: {
            period,
            location: location || null,
            lat: lat ? parseFloat(lat as string) : null,
            lng: lng ? parseFloat(lng as string) : null,
            categoryId: categoryId || null,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/trending/categories
 * Get trending categories
 */
router.get(
  '/categories',
  [
    query('location').optional().isString().withMessage('Location must be a string'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be 1-20'),
    query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const {
        location,
        limit = '10',
        period = 'weekly',
      } = req.query;

      const window = mapPeriodToWindow(period as string);
      const limitNum = parseInt(limit as string, 10);

      // Get trending categories from the trending service
      const categories = await trendingService.getTrendingCategories(window, {
        limit: limitNum,
      });

      res.status(200).json({
        success: true,
        data: {
          categories,
          metadata: {
            period,
            location: location || null,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

export default router;
