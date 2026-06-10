/**
 * Bundle Admin Routes
 *
 * Handles admin management of service bundles including approval, rejection, and CRUD operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { bundleSalesService } from '../services/bundleSales.service';
import Bundle from '../models/bundle.model';
import User from '../models/user.model';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * Validation middleware helper
 */
const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array(),
    });
    return;
  }
  next();
};

/**
 * GET /admin/bundles
 * List all bundles with filters
 * Query: ?status=pending|approved|rejected, ?page=1&limit=20, ?search=term, ?providerId=xxx
 * Returns: bundles with pagination, provider info, usage stats
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Status must be pending, approved, or rejected'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim(),
    query('providerId').optional().isMongoId().withMessage('Valid provider ID required'),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      status,
      page = 1,
      limit = 20,
      search,
      providerId,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const filter: Record<string, unknown> = {};

    if (status) {
      filter.status = status;
    }

    if (providerId) {
      filter.providerId = new mongoose.Types.ObjectId(providerId as string);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query with pagination
    const [bundles, total] = await Promise.all([
      Bundle.find(filter)
        .populate('providerId', 'firstName lastName email phone businessName')
        .populate('categoryId', 'name')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Bundle.countDocuments(filter),
    ]);

    // Get usage stats for each bundle
    const bundleIds = bundles.map((b: any) => b._id);
    const stats = await Bundle.aggregate([
      { $match: { _id: { $in: bundleIds } } },
      {
        $group: {
          _id: '$_id',
          totalBookings: { $sum: '$bookingCount' },
          totalRedemptions: { $sum: '$redemptionsUsed' },
        },
      },
    ]);

    const statsMap = new Map(stats.map((s: any) => [s._id.toString(), s]));

    // Attach stats to bundles
    const bundlesWithStats = bundles.map((bundle: any) => ({
      ...bundle,
      stats: {
        totalBookings: statsMap.get(bundle._id.toString())?.totalBookings || 0,
        totalRedemptions: statsMap.get(bundle._id.toString())?.totalRedemptions || 0,
      },
    }));

    res.json({
      status: 'success',
      data: {
        bundles: bundlesWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

/**
 * GET /admin/bundles/pending
 * Get pending bundles count
 * Returns: { count: number, bundles: [...] }
 */
router.get(
  '/pending',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [bundles, total] = await Promise.all([
      Bundle.find({ status: 'pending' })
        .populate('providerId', 'firstName lastName email phone businessName')
        .populate('categoryId', 'name')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bundle.countDocuments({ status: 'pending' }),
    ]);

    res.json({
      status: 'success',
      data: {
        count: total,
        bundles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

/**
 * GET /admin/bundles/:id
 * Get single bundle by ID with full details
 */
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid bundle ID required'),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const bundle = await Bundle.findById(id)
      .populate('providerId', 'firstName lastName email phone businessName')
      .populate('categoryId', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('services.serviceId', 'name description price duration');

    if (!bundle) {
      res.status(404).json({
        status: 'error',
        message: 'Bundle not found',
      });
      return;
    }

    res.json({
      status: 'success',
      data: bundle,
    });
  })
);

/**
 * PUT /admin/bundles/:id/approve
 * Approve a bundle - sets status to 'approved' and makes it visible on /packages
 */
router.put(
  '/:id/approve',
  [
    param('id').isMongoId().withMessage('Valid bundle ID required'),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      res.status(404).json({
        status: 'error',
        message: 'Bundle not found',
      });
      return;
    }

    if (bundle.status === 'approved') {
      res.status(400).json({
        status: 'error',
        message: 'Bundle is already approved',
      });
      return;
    }

    // Update bundle status to approved
    bundle.status = 'approved';
    bundle.isActive = true;
    bundle.updatedBy = new mongoose.Types.ObjectId(req.user?._id);
    await bundle.save();

    res.json({
      status: 'success',
      message: 'Bundle approved successfully',
      data: {
        bundleId: bundle._id,
        name: bundle.name,
        status: bundle.status,
        isActive: bundle.isActive,
      },
    });
  })
);

/**
 * PUT /admin/bundles/:id/reject
 * Reject a bundle - sets status to 'rejected' and hides it from customers
 */
router.put(
  '/:id/reject',
  [
    param('id').isMongoId().withMessage('Valid bundle ID required'),
    body('reason').isString().notEmpty().trim().withMessage('Rejection reason is required'),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      res.status(404).json({
        status: 'error',
        message: 'Bundle not found',
      });
      return;
    }

    if (bundle.status === 'rejected') {
      res.status(400).json({
        status: 'error',
        message: 'Bundle is already rejected',
      });
      return;
    }

    // Update bundle status to rejected
    bundle.status = 'rejected';
    bundle.isActive = false;
    bundle.rejectionReason = reason;
    bundle.updatedBy = new mongoose.Types.ObjectId(req.user?._id);
    await bundle.save();

    res.json({
      status: 'success',
      message: 'Bundle rejected successfully',
      data: {
        bundleId: bundle._id,
        name: bundle.name,
        status: bundle.status,
        rejectionReason: bundle.rejectionReason,
        isActive: bundle.isActive,
      },
    });
  })
);

/**
 * PUT /admin/bundles/:id
 * Admin can edit any bundle - bypasses ownership check
 */
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid bundle ID required'),
    body('name').optional().isString().notEmpty().trim().withMessage('Bundle name cannot be empty'),
    body('description').optional().isString().notEmpty().trim().withMessage('Description cannot be empty'),
    body('services').optional().isArray({ min: 1 }).withMessage('At least one service is required'),
    body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be positive'),
    body('bundlePrice').optional().isFloat({ min: 0 }).withMessage('Bundle price must be positive'),
    body('savingsPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Savings percentage must be between 0 and 100'),
    body('validFrom').optional().isISO8601().withMessage('Valid from date must be valid'),
    body('validUntil').optional().isISO8601().withMessage('Valid until date must be valid'),
    body('maxRedemptions').optional().isInt({ min: 1 }).withMessage('Max redemptions must be positive'),
    body('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be boolean'),
    body('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Status must be pending, approved, or rejected'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('terms').optional().isString().trim(),
    body('image').optional().isString().trim(),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      res.status(404).json({
        status: 'error',
        message: 'Bundle not found',
      });
      return;
    }

    // Apply updates (admin bypasses ownership check)
    const allowedUpdates = [
      'name', 'description', 'services', 'originalPrice', 'bundlePrice',
      'savingsPercentage', 'validFrom', 'validUntil', 'maxRedemptions',
      'categoryId', 'isActive', 'isFeatured', 'status', 'tags', 'terms',
      'image', 'images', 'maxPurchasesPerCustomer',
    ];

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        (bundle as any)[key] = updates[key];
      }
    }

    bundle.updatedBy = new mongoose.Types.ObjectId(req.user?._id);
    await bundle.save();

    const updatedBundle = await Bundle.findById(id)
      .populate('providerId', 'firstName lastName email businessName')
      .populate('categoryId', 'name')
      .populate('services.serviceId', 'name description price');

    res.json({
      status: 'success',
      message: 'Bundle updated successfully',
      data: updatedBundle,
    });
  })
);

/**
 * DELETE /admin/bundles/:id
 * Admin can delete any bundle (soft delete by deactivating)
 */
router.delete(
  '/:id',
  [
    param('id').isMongoId().withMessage('Valid bundle ID required'),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      res.status(404).json({
        status: 'error',
        message: 'Bundle not found',
      });
      return;
    }

    if (hardDelete) {
      // Hard delete - remove from database
      await Bundle.findByIdAndDelete(id);

      res.json({
        status: 'success',
        message: 'Bundle permanently deleted',
        data: {
          bundleId: id,
          name: bundle.name,
          deletedAt: new Date(),
        },
      });
    } else {
      // Soft delete - deactivate
      bundle.isActive = false;
      bundle.status = 'rejected';
      bundle.rejectionReason = 'Deleted by admin';
      bundle.updatedBy = new mongoose.Types.ObjectId(req.user?._id);
      await bundle.save();

      res.json({
        status: 'success',
        message: 'Bundle deactivated successfully',
        data: {
          bundleId: bundle._id,
          name: bundle.name,
          isActive: bundle.isActive,
          status: bundle.status,
        },
      });
    }
  })
);

/**
 * POST /admin/bundles/:id/toggle-featured
 * Toggle featured status of a bundle
 */
router.post(
  '/:id/toggle-featured',
  [
    param('id').isMongoId().withMessage('Valid bundle ID required'),
  ],
  handleValidation,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      res.status(404).json({
        status: 'error',
        message: 'Bundle not found',
      });
      return;
    }

    // Only approved bundles can be featured
    if (bundle.status !== 'approved') {
      res.status(400).json({
        status: 'error',
        message: 'Only approved bundles can be featured',
      });
      return;
    }

    bundle.isFeatured = !bundle.isFeatured;
    bundle.updatedBy = new mongoose.Types.ObjectId(req.user?._id);
    await bundle.save();

    res.json({
      status: 'success',
      message: `Bundle ${bundle.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: {
        bundleId: bundle._id,
        name: bundle.name,
        isFeatured: bundle.isFeatured,
      },
    });
  })
);

/**
 * GET /admin/bundles/stats
 * Get bundle statistics for admin dashboard
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const [totalBundles, pendingBundles, approvedBundles, rejectedBundles, featuredBundles] = await Promise.all([
      Bundle.countDocuments(),
      Bundle.countDocuments({ status: 'pending' }),
      Bundle.countDocuments({ status: 'approved' }),
      Bundle.countDocuments({ status: 'rejected' }),
      Bundle.countDocuments({ status: 'approved', isFeatured: true }),
    ]);

    // Get revenue stats
    const revenueStats = await Bundle.aggregate([
      {
        $match: { status: 'approved' }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ['$bundlePrice', '$redemptionsUsed'] } },
          totalOriginalValue: { $sum: { $multiply: ['$originalPrice', '$redemptionsUsed'] } },
          totalBookings: { $sum: '$bookingCount' },
          totalRedemptions: { $sum: '$redemptionsUsed' },
          avgSavingsPercentage: { $avg: '$savingsPercentage' },
        },
      },
    ]);

    const stats = revenueStats[0] || {
      totalRevenue: 0,
      totalOriginalValue: 0,
      totalBookings: 0,
      totalRedemptions: 0,
      avgSavingsPercentage: 0,
    };

    res.json({
      status: 'success',
      data: {
        counts: {
          total: totalBundles,
          pending: pendingBundles,
          approved: approvedBundles,
          rejected: rejectedBundles,
          featured: featuredBundles,
        },
        revenue: {
          totalRevenue: stats.totalRevenue,
          totalOriginalValue: stats.totalOriginalValue,
          totalSavings: stats.totalOriginalValue - stats.totalRevenue,
          totalBookings: stats.totalBookings,
          totalRedemptions: stats.totalRedemptions,
          avgSavingsPercentage: Math.round(stats.avgSavingsPercentage * 100) / 100,
        },
      },
    });
  })
);

export default router;
