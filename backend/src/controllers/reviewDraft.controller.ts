/**
 * Review Draft Controller
 * Handles review draft CRUD operations and submission
 */
import { Request, Response, NextFunction } from 'express';
import { reviewDraftService } from '../services/reviewDraft.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Save or Update Draft
 * POST /api/reviews/drafts
 */
export const saveDraft = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { bookingId, rating, title, comment, photos } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!bookingId) {
      throw new ApiError(400, 'Booking ID is required');
    }

    const result = await reviewDraftService.save(
      userId,
      bookingId,
      { rating, title, comment, photos },
      'customer' // Default to customer type
    );

    if (!result.success) {
      throw new ApiError(400, result.error || 'Failed to save draft');
    }

    res.status(200).json({
      success: true,
      data: result.draft,
      message: 'Draft saved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Draft by Booking ID
 * GET /api/reviews/drafts/:bookingId
 */
export const getDraft = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { bookingId } = req.params;
    const { type = 'customer' } = req.query;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!bookingId) {
      throw new ApiError(400, 'Booking ID is required');
    }

    const result = await reviewDraftService.get(
      userId,
      bookingId,
      type as 'customer' | 'provider'
    );

    if (!result.success) {
      throw new ApiError(404, result.error || 'Draft not found');
    }

    res.status(200).json({
      success: true,
      data: result.draft,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All User Drafts
 * GET /api/reviews/drafts
 */
export const getUserDrafts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      type = 'customer',
      includeExpired = 'false',
      page = '1',
      limit = '20',
    } = req.query;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const result = await reviewDraftService.getAll(
      userId,
      type as 'customer' | 'provider',
      {
        includeExpired: includeExpired === 'true',
        page: parseInt(page as string, 10) || 1,
        limit: Math.min(parseInt(limit as string, 10) || 20, 100),
      }
    );

    res.status(200).json({
      success: true,
      data: result.drafts,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Draft
 * DELETE /api/reviews/drafts/:bookingId
 */
export const deleteDraft = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { bookingId } = req.params;
    const { type = 'customer' } = req.query;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!bookingId) {
      throw new ApiError(400, 'Booking ID is required');
    }

    const result = await reviewDraftService.delete(
      userId,
      bookingId,
      type as 'customer' | 'provider'
    );

    if (!result.success) {
      throw new ApiError(404, result.error || 'Draft not found');
    }

    res.status(200).json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit Draft as Review
 * POST /api/reviews/drafts/:bookingId/submit
 */
export const submitDraft = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { bookingId } = req.params;
    const { type = 'customer' } = req.query;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!bookingId) {
      throw new ApiError(400, 'Booking ID is required');
    }

    const result = await reviewDraftService.submit(
      userId,
      bookingId,
      type as 'customer' | 'provider'
    );

    if (!result.success) {
      throw new ApiError(400, result.error || 'Failed to submit review');
    }

    logger.info('Review draft submitted', {
      context: 'ReviewDraftController',
      action: 'SUBMIT_DRAFT',
      userId,
      bookingId,
      reviewId: result.reviewId,
    });

    res.status(201).json({
      success: true,
      data: { reviewId: result.reviewId },
      message: 'Review submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit Review Directly (without draft)
 * POST /api/reviews
 */
export const submitReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { bookingId, rating, title, comment, photos } = req.body;
    const { type = 'customer' } = req.query;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!bookingId) {
      throw new ApiError(400, 'Booking ID is required');
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating is required and must be between 1 and 5');
    }

    if (!comment || comment.trim().length < 10) {
      throw new ApiError(400, 'Comment is required and must be at least 10 characters');
    }

    const result = await reviewDraftService.submitReview(
      userId,
      bookingId,
      { rating, title, comment, photos },
      type as 'customer' | 'provider'
    );

    if (!result.success) {
      throw new ApiError(400, result.error || 'Failed to submit review');
    }

    logger.info('Review submitted directly', {
      context: 'ReviewDraftController',
      action: 'SUBMIT_REVIEW',
      userId,
      bookingId,
      reviewId: result.reviewId,
    });

    res.status(201).json({
      success: true,
      data: { reviewId: result.reviewId },
      message: 'Review submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Draft Count
 * GET /api/reviews/drafts/count
 */
export const getDraftCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { type = 'customer' } = req.query;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const ReviewDraft = (await import('../models/reviewDraft.model')).default;
    const count = await ReviewDraft.getDraftCount(
      userId,
      type as 'customer' | 'provider'
    );

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};
