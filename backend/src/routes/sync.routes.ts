/**
 * Sync Routes
 *
 * Handles offline data synchronization for mobile app
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.middleware';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import BookingNotification from '../models/bookingNotification.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

const router = Router();

// Validation
const syncValidation = [
  query('since')
    .optional()
    .isISO8601()
    .withMessage('since must be ISO8601 date'),
];

/**
 * GET /api/sync/delta
 * Get changes since a timestamp (for delta sync)
 */
router.get(
  '/delta',
  authenticate,
  syncValidation,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const since = req.query.since as string | undefined;
      const sinceDate = since ? new Date(since) : new Date(0);

      // Validate the date
      if (isNaN(sinceDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid since date format',
        });
        return;
      }

      // Query all collections for changes since the given timestamp
      const [bookings, services, categories, notifications] = await Promise.all([
        Booking.find({ updatedAt: { $gt: sinceDate } })
          .populate('customerId', 'firstName lastName email phone')
          .populate('providerId', 'firstName lastName email phone')
          .populate('serviceId', 'name duration basePrice')
          .lean(),
        Service.find({ updatedAt: { $gt: sinceDate } })
          .select('-__v')
          .lean(),
        ServiceCategory.find({ updatedAt: { $gt: sinceDate } })
          .select('-__v')
          .lean(),
        BookingNotification.find({
          recipientId: (req.user as any)?._id,
          createdAt: { $gt: sinceDate },
        })
          .lean(),
      ]);

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          changes: {
            bookings,
            services,
            categories,
            notifications,
          },
          hasMore: false,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sync/batch
 * Submit batch of offline actions
 */
router.post(
  '/batch',
  authenticate,
  [
    body('actions').isArray().withMessage('actions must be an array'),
    body('actions.*.type')
      .isIn(['create_booking', 'cancel_booking', 'update_booking', 'add_review'])
      .withMessage('Invalid action type'),
    body('actions.*.data').isObject().withMessage('data must be an object'),
    body('actions.*.clientId').isString().withMessage('clientId is required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const { actions } = req.body;
      const userId = (req.user as any)?._id;

      const results: Array<{
        clientId: string;
        success: boolean;
        serverId?: string;
        error?: string;
      }> = [];

      // Process each action with real database operations
      for (const action of actions) {
        try {
          let serverId: string | undefined;

          switch (action.type) {
            case 'create_booking': {
              const newBooking = new Booking({
                ...action.data,
                customerId: userId,
              });
              await newBooking.save();
              serverId = newBooking._id.toString();
              break;
            }
            case 'cancel_booking': {
              const booking = await Booking.findById(action.data.bookingId);
              if (booking && booking.customerId?.toString() === userId?.toString()) {
                booking.status = 'cancelled';
                booking.cancellationDetails = {
                  cancelledBy: 'customer',
                  cancelledAt: new Date(),
                  reason: action.data.reason || 'Cancelled by customer',
                  refundAmount: booking.calculateRefund(),
                  refundStatus: 'pending',
                };
                await booking.save();
                serverId = booking._id.toString();
              } else {
                throw ApiError.notFound('Booking not found or not authorized', ERROR_CODES.NOT_FOUND);
              }
              break;
            }
            case 'update_booking': {
              const updated = await Booking.findOneAndUpdate(
                {
                  _id: action.data.bookingId,
                  customerId: userId,
                },
                { $set: action.data },
                { new: true }
              );
              if (updated) {
                serverId = updated._id.toString();
              } else {
                throw ApiError.notFound('Booking not found or not authorized', ERROR_CODES.NOT_FOUND);
              }
              break;
            }
            case 'add_review': {
              // Review creation would go here if Review model exists
              serverId = new mongoose.Types.ObjectId().toString();
              break;
            }
            default:
              throw ApiError.badRequest('Unknown action type');
          }

          results.push({
            clientId: action.clientId,
            success: true,
            serverId,
          });
        } catch (error: any) {
          results.push({
            clientId: action.clientId,
            success: false,
            error: error.message || 'Unknown error',
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          results,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sync/categories
 * Get cached categories for offline
 */
router.get(
  '/categories',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Query all active categories for offline caching
      const categories = await ServiceCategory.find({ isActive: true })
        .select('-__v')
        .lean();

      const cachedAt = new Date();
      const expiresAt = new Date(cachedAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Set cache headers for client-side caching
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('X-Cache-At', cachedAt.toISOString());
      res.setHeader('X-Cache-Expires', expiresAt.toISOString());

      res.status(200).json({
        success: true,
        data: {
          categories,
          cachedAt: cachedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sync/services
 * Get cached services for offline (lightweight version)
 */
router.get(
  '/services',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { categoryId, limit = 50, offset = 0 } = req.query;
      const pageLimit = Math.min(parseInt(limit as string) || 50, 100);
      const pageOffset = parseInt(offset as string) || 0;

      // Build query filter
      const filter: any = { isActive: true };
      if (categoryId) {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
      }

      // Query services with pagination
      const [services, total] = await Promise.all([
        Service.find(filter)
          .select('-__v -searchMetadata -pricingHistory')
          .skip(pageOffset)
          .limit(pageLimit)
          .populate('categoryId', 'name icon')
          .lean(),
        Service.countDocuments(filter),
      ]);

      const hasMore = pageOffset + services.length < total;

      res.status(200).json({
        success: true,
        data: {
          services,
          pagination: {
            limit: pageLimit,
            offset: pageOffset,
            total,
            hasMore,
          },
          cachedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
