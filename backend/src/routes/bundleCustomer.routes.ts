/**
 * Bundle Customer Routes
 *
 * Handles customer-facing bundle purchase and management operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import bundleBookingService from '../services/bundleBooking.service';
import Bundle from '../models/bundle.model';
import BundleBooking from '../models/bundleBooking.model';
import { ApiError } from '../utils/ApiError';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const purchaseBundleValidation = [
  param('id').isMongoId().withMessage('Valid bundle ID required'),
  body('addressId').optional().isMongoId().withMessage('Valid address ID required'),
  body('scheduledDate').optional().isISO8601().withMessage('Valid scheduled date required'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
];

const redeemServiceValidation = [
  param('purchaseId').isMongoId().withMessage('Valid purchase ID required'),
  body('serviceName').isString().notEmpty().withMessage('Service name is required'),
  body('bookingDetails').isObject().withMessage('Booking details required'),
  body('bookingDetails.addressId').optional().isMongoId().withMessage('Valid address ID required'),
  body('bookingDetails.scheduledDate').optional().isISO8601().withMessage('Valid scheduled date required'),
  body('bookingDetails.scheduledTime').optional().isString(),
  body('bookingDetails.notes').optional().isString().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate remaining credits for a bundle purchase
 */
async function calculateRemainingCredits(
  bundleBooking: InstanceType<typeof BundleBooking>,
  bundle: InstanceType<typeof Bundle>
): Promise<{
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  expiresAt: Date;
}> {
  const usedServices = bundleBooking.services.filter(
    (s) => ['completed', 'confirmed', 'in_progress'].includes(s.status)
  ).length;

  const totalCredits = bundle.services.length;
  const remainingCredits = Math.max(0, totalCredits - usedServices);

  return {
    totalCredits,
    usedCredits: usedServices,
    remainingCredits,
    expiresAt: bundle.validUntil,
  };
}

/**
 * Format bundle purchase response
 */
async function formatPurchaseResponse(
  bundleId: string,
  customerId: string
): Promise<{
  purchaseId: string;
  bundle: Record<string, unknown>;
  credits: number;
  expiresAt: Date;
}> {
  const bundleBooking = await BundleBooking.findOne({
    bundleId,
    customerId,
  }).sort({ createdAt: -1 });

  if (!bundleBooking) {
    throw ApiError.notFound('Bundle purchase not found');
  }

  const bundle = await Bundle.findById(bundleId);
  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  const creditsInfo = await calculateRemainingCredits(bundleBooking, bundle);

  return {
    purchaseId: bundleBooking._id.toString(),
    bundle: {
      id: bundle._id,
      name: bundle.name,
      description: bundle.description,
      bundlePrice: bundle.bundlePrice,
      currency: bundle.currency,
      services: bundle.services.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        quantity: s.quantity,
        originalPrice: s.originalPrice,
      })),
      validFrom: bundle.validFrom,
      validUntil: bundle.validUntil,
    },
    credits: creditsInfo.remainingCredits,
    expiresAt: bundle.validUntil,
  };
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /my/bundles/:id/purchase
 * Customer purchases a bundle
 */
router.post(
  '/:id/purchase',
  authenticate,
  requireRole('customer'),
  purchaseBundleValidation,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { addressId, scheduledDate, notes } = req.body;
      const customerId = req.user!._id.toString();

      // Check if bundle is approved
      const bundle = await Bundle.findById(id);
      if (!bundle) {
        throw ApiError.notFound('Bundle not found');
      }

      if (bundle.status !== 'approved') {
        throw ApiError.badRequest('This bundle is not available for purchase');
      }

      if (!bundle.isActive) {
        throw ApiError.badRequest('This bundle is no longer available');
      }

      const now = new Date();
      if (new Date(bundle.validFrom) > now) {
        throw ApiError.badRequest('This bundle is not yet available for purchase');
      }

      if (new Date(bundle.validUntil) < now) {
        throw ApiError.badRequest('This bundle has expired');
      }

      // Check max purchases per customer
      if (bundle.maxPurchasesPerCustomer) {
        const existingPurchases = await BundleBooking.countDocuments({
          bundleId: bundle._id,
          customerId: new (require('mongoose').Types.ObjectId)(customerId),
        });

        if (existingPurchases >= bundle.maxPurchasesPerCustomer) {
          throw ApiError.badRequest(
            `You have reached the maximum number of purchases for this bundle (${bundle.maxPurchasesPerCustomer})`
          );
        }
      }

      // Book the bundle
      const result = await bundleBookingService.bookBundle({
        bundleId: id,
        customerId,
        addressId,
        scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
        notes,
      });

      const bundleBooking = await BundleBooking.findById(result.bookingId);
      if (!bundleBooking) {
        throw ApiError.notFound('Bundle booking not found');
      }

      const creditsInfo = await calculateRemainingCredits(bundleBooking, bundle);

      res.status(201).json({
        status: 'success',
        purchaseId: result.bookingId,
        bundle: {
          id: bundle._id,
          name: bundle.name,
          description: bundle.description,
          bundlePrice: bundle.bundlePrice,
          currency: bundle.currency,
          services: bundle.services.map((s) => ({
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            quantity: s.quantity,
            originalPrice: s.originalPrice,
          })),
        },
        credits: creditsInfo.remainingCredits,
        expiresAt: bundle.validUntil,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /my/bundles
 * Customer's purchased bundles
 */
router.get(
  '/',
  authenticate,
  requireRole('customer'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = req.user!._id.toString();
      const { status, page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: Record<string, unknown> = {
        customerId: new (require('mongoose').Types.ObjectId)(customerId),
      };

      if (status && ['confirmed', 'partially_redeemed', 'fully_redeemed', 'completed', 'cancelled'].includes(status as string)) {
        query.status = status;
      }

      // Get bundle bookings
      const [bundleBookings, total] = await Promise.all([
        BundleBooking.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        BundleBooking.countDocuments(query),
      ]);

      // Get bundle details for each purchase
      const purchases = await Promise.all(
        bundleBookings.map(async (booking) => {
          const bundle = await Bundle.findById(booking.bundleId);
          if (!bundle) return null;

          const creditsInfo = await calculateRemainingCredits(
            booking as unknown as InstanceType<typeof BundleBooking>,
            bundle
          );

          return {
            purchaseId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            bundle: {
              id: bundle._id,
              name: bundle.name,
              description: bundle.description,
              image: bundle.image,
              bundlePrice: bundle.bundlePrice,
              currency: bundle.currency,
              services: bundle.services.map((s) => ({
                serviceId: s.serviceId,
                serviceName: s.serviceName,
                quantity: s.quantity,
                originalPrice: s.originalPrice,
              })),
            },
            status: booking.status,
            remainingCredits: creditsInfo.remainingCredits,
            totalCredits: creditsInfo.totalCredits,
            expiresAt: bundle.validUntil,
            purchasedAt: booking.createdAt,
          };
        })
      );

      const validPurchases = purchases.filter((p) => p !== null);

      res.json({
        status: 'success',
        data: validPurchases,
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
 * POST /my/bundles/:purchaseId/redeem
 * Redeem a service from bundle
 */
router.post(
  '/:purchaseId/redeem',
  authenticate,
  requireRole('customer'),
  redeemServiceValidation,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { purchaseId } = req.params;
      const { serviceName, bookingDetails } = req.body;
      const customerId = req.user!._id.toString();

      // Find the bundle purchase
      const bundleBooking = await BundleBooking.findOne({
        _id: purchaseId,
        customerId: new (require('mongoose').Types.ObjectId)(customerId),
      });

      if (!bundleBooking) {
        throw ApiError.notFound('Bundle purchase not found');
      }

      if (['cancelled', 'completed'].includes(bundleBooking.status)) {
        throw ApiError.badRequest('Cannot redeem from this bundle');
      }

      const bundle = await Bundle.findById(bundleBooking.bundleId);
      if (!bundle) {
        throw ApiError.notFound('Bundle not found');
      }

      // Check if bundle is still valid
      if (new Date(bundle.validUntil) < new Date()) {
        throw ApiError.badRequest('This bundle has expired');
      }

      // Find the service in bundle
      const bundleService = bundle.services.find(
        (s) => s.serviceName.toLowerCase() === serviceName.toLowerCase()
      );

      if (!bundleService) {
        throw ApiError.badRequest('Service not found in this bundle');
      }

      // Check if service already redeemed
      const alreadyRedeemed = bundleBooking.services.some(
        (s) =>
          s.serviceId.toString() === bundleService.serviceId.toString() &&
          ['completed', 'confirmed', 'in_progress'].includes(s.status)
      );

      if (alreadyRedeemed) {
        throw ApiError.badRequest('This service has already been redeemed');
      }

      // Redeem remaining services (creates booking for this service)
      const result = await bundleBookingService.redeemRemainingServices(
        customerId,
        bundleBooking.bundleId.toString(),
        [
          {
            serviceId: bundleService.serviceId.toString(),
            date: bookingDetails?.scheduledDate || new Date().toISOString().split('T')[0],
            time: bookingDetails?.scheduledTime,
          },
        ]
      );

      // Get updated credits
      const updatedBooking = await BundleBooking.findById(purchaseId);
      const creditsInfo = await calculateRemainingCredits(
        updatedBooking!,
        bundle
      );

      res.json({
        status: 'success',
        message: 'Service redeemed successfully',
        bookingId: result.bookingId,
        bookingNumber: result.bookingNumber,
        serviceName,
        remainingCredits: creditsInfo.remainingCredits,
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /my/bundles/:purchaseId/history
 * Get redemption history
 */
router.get(
  '/:purchaseId/history',
  authenticate,
  param('purchaseId').isMongoId().withMessage('Valid purchase ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { purchaseId } = req.params;
      const customerId = req.user!._id.toString();

      const bundleBooking = await BundleBooking.findOne({
        _id: purchaseId,
        customerId: new (require('mongoose').Types.ObjectId)(customerId),
      });

      if (!bundleBooking) {
        throw ApiError.notFound('Bundle purchase not found');
      }

      const bundle = await Bundle.findById(bundleBooking.bundleId);
      if (!bundle) {
        throw ApiError.notFound('Bundle not found');
      }

      // Format redemption history
      const redemptionHistory = bundleBooking.services.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        originalPrice: s.originalPrice,
        scheduledDate: s.scheduledDate,
        scheduledTime: s.scheduledTime,
        status: s.status,
        redeemedAt: s.usedAt || null,
      }));

      const creditsInfo = await calculateRemainingCredits(bundleBooking, bundle);

      res.json({
        status: 'success',
        data: {
          purchaseId: bundleBooking._id.toString(),
          bookingNumber: bundleBooking.bookingNumber,
          bundle: {
            id: bundle._id,
            name: bundle.name,
            bundlePrice: bundle.bundlePrice,
            currency: bundle.currency,
          },
          status: bundleBooking.status,
          summary: {
            totalCredits: creditsInfo.totalCredits,
            usedCredits: creditsInfo.usedCredits,
            remainingCredits: creditsInfo.remainingCredits,
          },
          redemptionHistory,
          purchasedAt: bundleBooking.createdAt,
          expiresAt: bundle.validUntil,
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /my/bundles/:id
 * Get specific purchased bundle details
 */
router.get(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('Valid purchase ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const customerId = req.user!._id.toString();

      const bundleBooking = await BundleBooking.findOne({
        _id: id,
        customerId: new (require('mongoose').Types.ObjectId)(customerId),
      });

      if (!bundleBooking) {
        throw ApiError.notFound('Bundle purchase not found');
      }

      const bundle = await Bundle.findById(bundleBooking.bundleId);
      if (!bundle) {
        throw ApiError.notFound('Bundle not found');
      }

      const creditsInfo = await calculateRemainingCredits(bundleBooking, bundle);

      // Get used services details
      const usedServices = bundleBooking.services
        .filter((s) => ['completed', 'confirmed', 'in_progress'].includes(s.status))
        .map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          status: s.status,
          scheduledDate: s.scheduledDate,
          scheduledTime: s.scheduledTime,
          usedAt: s.usedAt,
        }));

      res.json({
        status: 'success',
        data: {
          purchaseId: bundleBooking._id.toString(),
          bookingNumber: bundleBooking.bookingNumber,
          bundle: {
            id: bundle._id,
            name: bundle.name,
            description: bundle.description,
            image: bundle.image,
            bundlePrice: bundle.bundlePrice,
            currency: bundle.currency,
            services: bundle.services.map((s) => ({
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              quantity: s.quantity,
              originalPrice: s.originalPrice,
            })),
            terms: bundle.terms,
          },
          status: bundleBooking.status,
          remainingCredits: creditsInfo.remainingCredits,
          totalCredits: creditsInfo.totalCredits,
          usedServices,
          expiresAt: bundle.validUntil,
          purchasedAt: bundleBooking.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

export default router;
