/**
 * Bundle Sales Routes
 *
 * Handles CRUD operations for service bundles and bundle bookings
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { bundleSalesService } from '../services/bundleSales.service';
import Bundle from '../models/bundle.model';
import { getTenantContext, TenantContext } from '../utils/tenantFilter';

const router = Router();

// Validation middleware for bundle creation
const createBundleValidation = [
  body('name').isString().notEmpty().withMessage('Bundle name is required'),
  body('description').isString().notEmpty().withMessage('Description is required'),
  body('services').isArray({ min: 1 }).withMessage('At least one service is required'),
  body('services.*.serviceId').isMongoId().withMessage('Valid service ID required'),
  body('services.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be positive'),
  body('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
  body('validFrom').isISO8601().withMessage('Valid from date required'),
  body('validUntil').isISO8601().withMessage('Valid until date required'),
  body('image').optional().isString(),
  body('tags').optional().isArray(),
  body('terms').optional().isString(),
];

// Validation for booking a bundle
const bookBundleValidation = [
  body('customerId').optional().isMongoId().withMessage('Valid customer ID required'),
  body('addressId').optional().isMongoId().withMessage('Valid address ID required'),
  body('scheduledDate').isISO8601().withMessage('Scheduled date required'),
  body('scheduledTime').optional().isString().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('notes').optional().isString(),
];

/**
 * POST /api/bundles
 * Create a new bundle (provider only, status: pending)
 */
router.post(
  '/',
  authenticate,
  requireRole(['provider']),
  createBundleValidation,
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

      const { name, description, services, categoryId, validFrom, validUntil, image, tags, terms } = req.body;

      // Extract service IDs from services array
      const serviceIds = services.map((s: { serviceId: string }) => s.serviceId);

      // Calculate discount percentage from originalPrice and bundlePrice
      const originalPrice = services.reduce((sum: number, s: { originalPrice?: number }) => sum + (s.originalPrice || 0), 0);
      const bundlePrice = req.body.bundlePrice || originalPrice;
      const discountPercentage = originalPrice > 0
        ? Math.round(((originalPrice - bundlePrice) / originalPrice) * 100)
        : 0;

      const result = await bundleSalesService.createBundle({
        name,
        description,
        serviceIds,
        discountPercentage,
        providerId: req.user!._id.toString(),
        categoryId,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        maxRedemptions: req.body.maxRedemptions,
        tags,
        terms,
        image,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to create bundle',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Bundle created successfully and pending approval',
        data: result.bundle,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles
 * List bundles - public (approved), admin (all with status filter), provider (own bundles)
 * Query params: ?status=pending|approved|rejected, ?page=1&limit=10, ?featured=true, ?provider=true
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('featured').optional().isBoolean().toBoolean(),
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

      const tenantContext: TenantContext = getTenantContext(req);
      const { status, categoryId, page = 1, limit = 20, featured } = req.query as {
        status?: string;
        categoryId?: string;
        page?: number;
        limit?: number;
        featured?: boolean | string;
      };
      const isAdmin = req.user && req.user.role === 'admin';
      const isProvider = req.user && req.user.role === 'provider';

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build query based on role
      const query: Record<string, unknown> = {};

      // Add tenant filter for non-admin requests
      if (!tenantContext.isAdmin && tenantContext.tenantId) {
        query.tenantId = tenantContext.tenantId;
      }

      if (isAdmin && status) {
        // Admin can filter by status
        query.status = status;
      } else if (isProvider && req.query.provider === 'true') {
        // Provider viewing their own bundles
        query.providerId = req.user!._id;
        if (status) {
          query.status = status;
        }
      } else if (isProvider) {
        // Provider can also see public approved bundles
        query.status = 'approved';
        query.isActive = true;
      } else {
        // Public: only approved, active bundles within validity period
        query.status = 'approved';
        query.isActive = true;
        query.validFrom = { $lte: new Date() };
        query.validUntil = { $gte: new Date() };
      }

      if (categoryId) {
        query.categoryId = categoryId;
      }

      if (featured === true) {
        query.isFeatured = true;
      }

      const [bundles, total] = await Promise.all([
        Bundle.find(query)
          .populate('services.serviceId', 'name images')
          .populate('categoryId', 'name')
          .populate('providerId', 'firstName lastName businessName')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Bundle.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: bundles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/:id
 * Get bundle details - public can see approved, provider can see their own
 */
router.get(
  '/:id',
  param('id').isMongoId().withMessage('Valid bundle ID required'),
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

      const { id } = req.params;
      const isAdmin = req.user && req.user.role === 'admin';
      const isProvider = req.user && req.user.role === 'provider';
      const isOwner = isProvider && req.user!._id.toString();

      const bundle = await Bundle.findById(id)
        .populate('services.serviceId', 'name images description duration')
        .populate('categoryId', 'name')
        .populate('providerId', 'firstName lastName businessName profileImage')
        .lean();

      if (!bundle) {
        res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
        return;
      }

      // Access control: public can only see approved bundles
      if (bundle.status !== 'approved' && !isAdmin) {
        // Provider can see their own bundles regardless of status
        if (!isProvider || (bundle as any).providerId?._id?.toString() !== isOwner) {
          res.status(404).json({
            success: false,
            message: 'Bundle not found',
          });
          return;
        }
      }

      res.json({
        success: true,
        data: bundle,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * PUT /api/bundles/:id
 * Update a bundle (provider only, status reset to 'pending')
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['provider']),
  param('id').isMongoId().withMessage('Valid bundle ID required'),
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

      const { id } = req.params;
      const providerId = req.user!._id.toString();

      // Find bundle and verify ownership
      const bundle = await Bundle.findById(id);

      if (!bundle) {
        res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
        return;
      }

      if (bundle.providerId?.toString() !== providerId) {
        res.status(403).json({
          success: false,
          message: 'You can only update your own bundles',
        });
        return;
      }

      // Build updates object (only allowed fields)
      const allowedFields = [
        'name', 'description', 'services', 'categoryId', 'validFrom',
        'validUntil', 'maxRedemptions', 'image', 'tags', 'terms', 'isFeatured'
      ];

      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      // Reset status to pending on any update
      updates.status = 'pending';

      // Recalculate pricing if services or prices changed
      if (req.body.services) {
        const services = req.body.services;
        const originalPrice = services.reduce((sum: number, s: { originalPrice?: number }) => sum + (s.originalPrice || 0), 0);
        const bundlePrice = req.body.bundlePrice || originalPrice;
        updates.originalPrice = originalPrice;
        updates.bundlePrice = bundlePrice;
        updates.savingsAmount = originalPrice - bundlePrice;
        updates.savingsPercentage = originalPrice > 0
          ? Math.round(((originalPrice - bundlePrice) / originalPrice) * 100)
          : 0;
      }

      // Convert date strings to Date objects
      if (updates.validFrom) {
        updates.validFrom = new Date(updates.validFrom as string);
      }
      if (updates.validUntil) {
        updates.validUntil = new Date(updates.validUntil as string);
      }

      updates.updatedBy = req.user!._id;

      const updatedBundle = await Bundle.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      )
        .populate('services.serviceId', 'name images')
        .populate('categoryId', 'name')
        .lean();

      res.json({
        success: true,
        message: 'Bundle updated successfully and resubmitted for approval',
        data: updatedBundle,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * DELETE /api/bundles/:id
 * Delete a bundle (soft delete, provider only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['provider']),
  param('id').isMongoId().withMessage('Valid bundle ID required'),
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

      const { id } = req.params;
      const providerId = req.user!._id.toString();

      // Find bundle and verify ownership
      const bundle = await Bundle.findById(id);

      if (!bundle) {
        res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
        return;
      }

      if (bundle.providerId?.toString() !== providerId) {
        res.status(403).json({
          success: false,
          message: 'You can only delete your own bundles',
        });
        return;
      }

      // Soft delete - set isActive to false
      await Bundle.findByIdAndUpdate(id, {
        isActive: false,
        updatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'Bundle deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/bundles/:id/book
 * Book a bundle
 */
router.post(
  '/:id/book',
  authenticate,
  param('id').isMongoId().withMessage('Valid bundle ID required'),
  bookBundleValidation,
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

      const { id } = req.params;
      const { scheduledDate, scheduledTime, location } = req.body;
      const customerId = req.user!._id.toString();

      const bundle = await Bundle.findById(id);

      if (!bundle) {
        res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
        return;
      }

      // Check if bundle is valid for booking
      const now = new Date();
      if (
        bundle.status !== 'approved' ||
        !bundle.isActive ||
        new Date(bundle.validFrom) > now ||
        new Date(bundle.validUntil) < now
      ) {
        res.status(400).json({
          success: false,
          message: 'Bundle is not available for booking',
        });
        return;
      }

      const result = await bundleSalesService.bookBundle(id, customerId, {
        scheduledDate: new Date(scheduledDate),
        scheduledTime: scheduledTime || '10:00',
        location,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to book bundle',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Bundle booked successfully',
        data: {
          bookingNumber: result.bookingNumber,
          savings: result.savings,
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/my
 * Provider's own bundles (authenticated provider only)
 * Query params: ?page=1&limit=20, ?status=pending|approved|rejected, ?isActive=true|false
 */
router.get(
  '/my',
  authenticate,
  requireRole(['provider']),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, isActive, page = 1, limit = 20 } = req.query as Record<string, string>;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const query: Record<string, unknown> = {
        providerId: req.user!._id,
      };

      // Support both status (admin-style) and isActive (frontend-style) filters
      if (status) {
        query.status = status;
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const [bundles, total] = await Promise.all([
        Bundle.find(query)
          .populate('services.serviceId', 'name images duration')
          .populate('categoryId', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Bundle.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: bundles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/featured
 * Get featured bundles for homepage display
 */
router.get(
  '/featured',
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;
      const now = new Date();

      const bundles = await Bundle.find({
        status: 'approved',
        isActive: true,
        isFeatured: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      })
        .populate('services.serviceId', 'name images duration')
        .populate('categoryId', 'name')
        .populate('providerId', 'firstName lastName businessName profileImage')
        .sort({ savingsPercentage: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: bundles,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/popular
 * Get popular bundles based on booking count
 */
router.get(
  '/popular',
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;
      const now = new Date();

      const bundles = await Bundle.find({
        status: 'approved',
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      })
        .populate('services.serviceId', 'name images duration')
        .populate('categoryId', 'name')
        .populate('providerId', 'firstName lastName businessName profileImage')
        .sort({ bookingCount: -1, redemptionsUsed: -1 })
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: bundles,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/category/:categoryId
 * Get bundles by category
 */
router.get(
  '/category/:categoryId',
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const { page = 1, limit = 20 } = req.query as Record<string, string>;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;
      const now = new Date();

      const query: Record<string, unknown> = {
        categoryId: new mongoose.Types.ObjectId(categoryId),
        status: 'approved',
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      };

      const [bundles, total] = await Promise.all([
        Bundle.find(query)
          .populate('services.serviceId', 'name images duration')
          .populate('categoryId', 'name')
          .populate('providerId', 'firstName lastName businessName profileImage')
          .sort({ savingsPercentage: -1, bookingCount: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Bundle.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: bundles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/:id/availability
 * Get available time slots for a bundle
 */
router.get(
  '/:id/availability',
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { startDate, endDate, providerId } = req.query as Record<string, string>;

      const bundle = await Bundle.findById(id)
        .populate('services.serviceId', 'duration');

      if (!bundle) {
        res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
        return;
      }

      // Calculate total duration from all services
      const totalDuration = (bundle.services as any[]).reduce(
        (sum: number, s: any) => sum + (s.serviceId?.duration || s.duration || 60),
        0
      );

      // Generate availability for the date range
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      const dates: Array<{ date: string; available: boolean; slots: string[] }> = [];
      const current = new Date(start);

      while (current <= end) {
        const dayOfWeek = current.getDay();
        // Assume weekends have limited availability (can be customized per provider)
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Standard business hours (can be overridden by provider settings)
        dates.push({
          date: current.toISOString().split('T')[0],
          available: !isWeekend,
          slots: isWeekend
            ? ['09:00', '10:00', '14:00', '15:00']
            : ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'],
        });
        current.setDate(current.getDate() + 1);
      }

      res.json({
        success: true,
        data: {
          dates,
          totalDuration,
          bundleId: bundle._id.toString(),
          bundleName: bundle.name,
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/bundles/slug/:slug
 * Get bundle by slug (SEO-friendly)
 */
router.get(
  '/slug/:slug',
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slug } = req.params;
      const now = new Date();

      // Look for bundle with matching slug or fallback to name-based slug
      const bundle = await Bundle.findOne({
        $or: [
          { slug: slug },
          { name: { $regex: new RegExp(slug.replace(/-/g, ' '), 'i') } },
        ],
        status: 'approved',
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      })
        .populate('services.serviceId', 'name images description duration')
        .populate('categoryId', 'name')
        .populate('providerId', 'firstName lastName businessName profileImage rating')
        .lean();

      if (!bundle) {
        res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
        return;
      }

      res.json({
        success: true,
        data: bundle,
      });
    } catch (error) {
      next(error);
    }
  })
);

export default router;
