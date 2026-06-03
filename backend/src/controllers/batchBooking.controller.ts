/**
 * Batch Booking Controller
 * Handles bulk operations on bookings for providers
 */
import { Request, Response, NextFunction } from 'express';
import { batchBookingService, BatchOperationResult } from '../services/batchBooking.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Batch Accept Bookings
 * POST /api/bookings/batch/accept
 */
export const batchAccept = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { bookingIds } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (userRole !== 'provider') {
      throw new ApiError(403, 'Only providers can perform batch accept operations');
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new ApiError(400, 'Booking IDs array is required');
    }

    if (bookingIds.length > 50) {
      throw new ApiError(400, 'Maximum 50 bookings can be processed at once');
    }

    // Validate booking IDs
    for (const id of bookingIds) {
      if (typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new ApiError(400, `Invalid booking ID: ${id}`);
      }
    }

    const result = await batchBookingService.batchAcceptWithTransaction(bookingIds, userId);

    logger.info('Batch accept completed', {
      context: 'BatchBookingController',
      action: 'BATCH_ACCEPT',
      userId,
      result,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully accepted ${result.success} booking(s)`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Batch Decline Bookings
 * POST /api/bookings/batch/decline
 */
export const batchDecline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { bookingIds, reason } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (userRole !== 'provider') {
      throw new ApiError(403, 'Only providers can perform batch decline operations');
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new ApiError(400, 'Booking IDs array is required');
    }

    if (bookingIds.length > 50) {
      throw new ApiError(400, 'Maximum 50 bookings can be processed at once');
    }

    // Validate booking IDs
    for (const id of bookingIds) {
      if (typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new ApiError(400, `Invalid booking ID: ${id}`);
      }
    }

    // Sanitize reason
    const sanitizedReason = reason
      ? reason.replace(/<[^>]*>/g, '').trim().substring(0, 500)
      : undefined;

    const result = await batchBookingService.batchDeclineWithTransaction(
      bookingIds,
      userId,
      sanitizedReason
    );

    logger.info('Batch decline completed', {
      context: 'BatchBookingController',
      action: 'BATCH_DECLINE',
      userId,
      reason: sanitizedReason,
      result,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully declined ${result.success} booking(s)`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Batch Complete Bookings
 * POST /api/bookings/batch/complete
 */
export const batchComplete = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { bookingIds } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (userRole !== 'provider') {
      throw new ApiError(403, 'Only providers can perform batch complete operations');
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new ApiError(400, 'Booking IDs array is required');
    }

    if (bookingIds.length > 50) {
      throw new ApiError(400, 'Maximum 50 bookings can be processed at once');
    }

    // Validate booking IDs
    for (const id of bookingIds) {
      if (typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new ApiError(400, `Invalid booking ID: ${id}`);
      }
    }

    const result = await batchBookingService.batchCompleteWithTransaction(bookingIds, userId);

    logger.info('Batch complete completed', {
      context: 'BatchBookingController',
      action: 'BATCH_COMPLETE',
      userId,
      result,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully completed ${result.success} booking(s)`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Batch Cancel Bookings
 * POST /api/bookings/batch/cancel
 */
export const batchCancel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { bookingIds, reason, cancelledBy } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (userRole !== 'provider') {
      throw new ApiError(403, 'Only providers can perform batch cancel operations');
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new ApiError(400, 'Booking IDs array is required');
    }

    if (bookingIds.length > 50) {
      throw new ApiError(400, 'Maximum 50 bookings can be processed at once');
    }

    // Validate booking IDs
    for (const id of bookingIds) {
      if (typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new ApiError(400, `Invalid booking ID: ${id}`);
      }
    }

    // Sanitize reason
    const sanitizedReason = reason
      ? reason.replace(/<[^>]*>/g, '').trim().substring(0, 500)
      : undefined;

    // Determine who is cancelling (userRole is guaranteed to be 'provider' at this point)
    const effectiveCancelledBy = cancelledBy || userRole;

    const result = await batchBookingService.batchCancelWithTransaction(
      bookingIds,
      userId,
      sanitizedReason,
      effectiveCancelledBy as 'provider' | 'customer' | 'admin'
    );

    logger.info('Batch cancel completed', {
      context: 'BatchBookingController',
      action: 'BATCH_CANCEL',
      userId,
      userRole,
      reason: sanitizedReason,
      cancelledBy: effectiveCancelledBy,
      result,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully cancelled ${result.success} booking(s)`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Batch Preview
 * POST /api/bookings/batch/preview
 */
export const getBatchPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { bookingIds } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (userRole !== 'provider') {
      throw new ApiError(403, 'Only providers can view batch previews');
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new ApiError(400, 'Booking IDs array is required');
    }

    // Validate booking IDs
    for (const id of bookingIds) {
      if (typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new ApiError(400, `Invalid booking ID: ${id}`);
      }
    }

    const preview = await batchBookingService.getBatchPreview(bookingIds, userId);

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};
