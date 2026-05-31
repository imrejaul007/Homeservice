/**
 * Geolocation Services Routes
 *
 * Handles nearby services and providers queries based on location
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler';
import { geolocationService } from '../services/geolocation.service';

const router = Router();

/**
 * GET /api/nearby/services
 * Get nearby services within radius
 */
router.get(
  '/services',
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required (-90 to 90)'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required (-180 to 180)'),
    query('radius').optional().isFloat({ min: 0.1, max: 100 }).withMessage('Radius must be 0.1-100 km'),
    query('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    query('priceRange').optional().isString().matches(/^\d+-\d+$/).withMessage('Price range must be format: min-max'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
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
        lat,
        lng,
        radius = '10',
        categoryId,
        minRating,
        priceRange,
        limit = '20',
        page = '1',
      } = req.query;

      // Parse price range
      let minPrice: number | undefined;
      let maxPrice: number | undefined;
      if (priceRange) {
        const [min, max] = (priceRange as string).split('-').map(Number);
        minPrice = min;
        maxPrice = max;
      }

      // Get nearby services from geolocation service
      const result = await geolocationService.findNearbyServices({
        coordinates: {
          lat: parseFloat(lat as string),
          lng: parseFloat(lng as string),
        },
        radius: parseFloat(radius as string),
        categoryId: categoryId as string | undefined,
        minRating: minRating ? parseFloat(minRating as string) : undefined,
        minPrice,
        maxPrice,
        limit: parseInt(limit as string, 10),
        offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
      });

      res.status(200).json({
        success: true,
        data: {
          services: result.services,
          metadata: {
            location: {
              lat: parseFloat(lat as string),
              lng: parseFloat(lng as string),
            },
            radius: parseFloat(radius as string),
            filters: {
              categoryId: categoryId || null,
              minRating: minRating ? parseFloat(minRating as string) : null,
              priceRange: priceRange || null,
            },
            pagination: {
              page: parseInt(page as string, 10),
              limit: parseInt(limit as string, 10),
              total: result.total,
              pages: Math.ceil(result.total / parseInt(limit as string, 10)),
              hasMore: result.hasMore,
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/nearby/providers
 * Get nearby providers within radius
 */
router.get(
  '/providers',
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required (-90 to 90)'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required (-180 to 180)'),
    query('radius').optional().isFloat({ min: 0.1, max: 100 }).withMessage('Radius must be 0.1-100 km'),
    query('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    query('availableOnly').optional().isBoolean().withMessage('Available only must be boolean'),
    query('verifiedOnly').optional().isBoolean().withMessage('Verified only must be boolean'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
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
        lat,
        lng,
        radius = '10',
        categoryId,
        minRating,
        availableOnly = 'false',
        verifiedOnly = 'false',
        limit = '20',
        page = '1',
      } = req.query;

      // Get nearby providers from geolocation service
      const providers = await geolocationService.findNearbyProviders(
        {
          lat: parseFloat(lat as string),
          lng: parseFloat(lng as string),
        },
        {
          radius: parseFloat(radius as string),
          categoryId: categoryId as string | undefined,
          minRating: minRating ? parseFloat(minRating as string) : undefined,
          verifiedOnly: verifiedOnly === 'true',
          limit: parseInt(limit as string, 10),
        }
      );

      res.status(200).json({
        success: true,
        data: {
          providers,
          metadata: {
            location: {
              lat: parseFloat(lat as string),
              lng: parseFloat(lng as string),
            },
            radius: parseFloat(radius as string),
            filters: {
              categoryId: categoryId || null,
              minRating: minRating ? parseFloat(minRating as string) : null,
              availableOnly: availableOnly === 'true',
              verifiedOnly: verifiedOnly === 'true',
            },
            pagination: {
              page: parseInt(page as string, 10),
              limit: parseInt(limit as string, 10),
              total: providers.length,
              pages: 1,
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

export default router;
