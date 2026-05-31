/**
 * Review Draft Service
 * Handles save, update, submit, and auto-cleanup of review drafts
 */
import mongoose from 'mongoose';
import ReviewDraft from '../models/reviewDraft.model';
import Review from '../models/review.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import BookingNotification from '../models/bookingNotification.model';
import { eventBus, EVENT_TYPES } from '../event-bus';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';

export interface SaveDraftResult {
  success: boolean;
  draft?: any;
  error?: string;
  isComplete?: boolean;
}

export interface SubmitDraftResult {
  success: boolean;
  reviewId?: string;
  error?: string;
}

export interface DraftListItem {
  draftId: string;
  bookingId: string;
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  scheduledDate: Date;
  rating?: number;
  comment?: string;
  title?: string;
  isComplete: boolean;
  expiresAt: Date;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    isExpired: boolean;
    formatted: string;
  };
  lastSavedAt: Date;
}

/**
 * Strip HTML tags to prevent XSS attacks
 */
function sanitizeHtml(input: string): string {
  if (!input) return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Validate draft content
 */
function validateDraftContent(data: {
  rating?: number;
  title?: string;
  comment?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.rating !== undefined) {
    if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) {
      errors.push('Rating must be between 1 and 5');
    }
  }

  if (data.title !== undefined && data.title !== null) {
    if (typeof data.title !== 'string') {
      errors.push('Title must be a string');
    } else if (data.title.length > 100) {
      errors.push('Title cannot exceed 100 characters');
    }
  }

  if (data.comment !== undefined && data.comment !== null) {
    if (typeof data.comment !== 'string') {
      errors.push('Comment must be a string');
    } else if (data.comment.trim().length < 10) {
      errors.push('Comment must be at least 10 characters');
    } else if (data.comment.length > 1000) {
      errors.push('Comment cannot exceed 1000 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Save draft (create or update)
 */
export async function saveDraft(
  userId: string,
  bookingId: string,
  data: {
    rating?: number;
    title?: string;
    comment?: string;
    photos?: string[];
  },
  userType: 'customer' | 'provider' = 'customer'
): Promise<SaveDraftResult> {
  // Validate inputs
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { success: false, error: 'Invalid user ID' };
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid booking ID' };
  }

  // Validate content
  const validation = validateDraftContent(data);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  // Sanitize content
  const sanitizedData = {
    rating: data.rating,
    title: data.title ? sanitizeHtml(data.title) : undefined,
    comment: data.comment ? sanitizeHtml(data.comment) : undefined,
    photos: data.photos,
  };

  try {
    // Find existing draft or create new one
    let draft = await ReviewDraft.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      bookingId: new mongoose.Types.ObjectId(bookingId),
      userType,
    });

    if (draft) {
      // Check if draft is expired
      if (draft.expiresAt < new Date()) {
        // Extend expiration
        draft.extendExpiration();
      }

      // Update existing draft
      draft.updateContent(sanitizedData);
      await draft.save();

      logger.debug('Review draft updated', {
        context: 'ReviewDraftService',
        action: 'DRAFT_UPDATED',
        draftId: draft._id.toString(),
        userId,
        bookingId,
      });
    } else {
      // Get booking info for additional references
      const booking = await Booking.findById(bookingId).select('serviceId providerId customerId');
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Create new draft
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

      draft = new ReviewDraft({
        userId: new mongoose.Types.ObjectId(userId),
        bookingId: new mongoose.Types.ObjectId(bookingId),
        userType,
        serviceId: booking.serviceId,
        providerId: userType === 'customer' ? booking.providerId : booking.customerId,
        ...sanitizedData,
        expiresAt,
        isComplete: false,
        version: 1,
      });

      // Check if content makes it complete
      if (draft.checkCompleteness()) {
        draft.isComplete = true;
      }

      await draft.save();

      logger.debug('Review draft created', {
        context: 'ReviewDraftService',
        action: 'DRAFT_CREATED',
        draftId: draft._id.toString(),
        userId,
        bookingId,
      });
    }

    return {
      success: true,
      draft: {
        id: draft._id,
        rating: draft.rating,
        title: draft.title,
        comment: draft.comment,
        photos: draft.photos,
        isComplete: draft.isComplete,
        lastSavedAt: draft.lastSavedAt,
        expiresAt: draft.expiresAt,
      },
      isComplete: draft.isComplete,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save review draft', {
      context: 'ReviewDraftService',
      action: 'SAVE_DRAFT_ERROR',
      userId,
      bookingId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Get draft by booking ID
 */
export async function getDraft(
  userId: string,
  bookingId: string,
  userType: 'customer' | 'provider' = 'customer'
): Promise<SaveDraftResult> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid ID format' };
  }

  const draft = await ReviewDraft.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    bookingId: new mongoose.Types.ObjectId(bookingId),
    userType,
  }).populate('bookingId', 'bookingNumber scheduledDate')
    .populate('serviceId', 'name category images')
    .populate('providerId', 'firstName lastName');

  if (!draft) {
    return { success: false, error: 'Draft not found' };
  }

  // Check if draft is expired
  const isExpired = draft.expiresAt < new Date();

  return {
    success: true,
    draft: {
      id: draft._id,
      booking: draft.bookingId,
      service: draft.serviceId,
      provider: draft.providerId,
      rating: draft.rating,
      title: draft.title,
      comment: draft.comment,
      photos: draft.photos,
      isComplete: draft.isComplete,
      isExpired,
      lastSavedAt: draft.lastSavedAt,
      expiresAt: draft.expiresAt,
      timeRemaining: draft.getTimeRemaining(),
      version: draft.version,
    },
    isComplete: draft.isComplete,
  };
}

/**
 * Get all drafts for a user
 */
export async function getUserDrafts(
  userId: string,
  userType: 'customer' | 'provider' = 'customer',
  options: {
    includeExpired?: boolean;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ drafts: DraftListItem[]; total: number; page: number; totalPages: number }> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  const { includeExpired = false, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    userType,
  };

  if (!includeExpired) {
    query.expiresAt = { $gt: new Date() };
  }

  const [drafts, total] = await Promise.all([
    ReviewDraft.find(query)
      .populate('bookingId', 'bookingNumber scheduledDate')
      .populate('serviceId', 'name category images')
      .populate('providerId', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ReviewDraft.countDocuments(query),
  ]);

  const formattedDrafts: DraftListItem[] = drafts.map((draft: any) => ({
    draftId: draft._id.toString(),
    bookingId: draft.bookingId?._id?.toString() || '',
    bookingNumber: draft.bookingId?.bookingNumber || '',
    serviceName: draft.serviceId?.name || '',
    providerName: draft.providerId
      ? `${draft.providerId.firstName} ${draft.providerId.lastName}`
      : '',
    scheduledDate: draft.bookingId?.scheduledDate,
    rating: draft.rating,
    comment: draft.comment,
    title: draft.title,
    isComplete: draft.isComplete,
    expiresAt: draft.expiresAt,
    timeRemaining: {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: draft.expiresAt < new Date(),
      formatted: '',
    },
    lastSavedAt: draft.lastSavedAt,
  }));

  return {
    drafts: formattedDrafts,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Delete draft
 */
export async function deleteDraft(
  userId: string,
  bookingId: string,
  userType: 'customer' | 'provider' = 'customer'
): Promise<{ success: boolean; error?: string }> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid ID format' };
  }

  try {
    const result = await ReviewDraft.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      bookingId: new mongoose.Types.ObjectId(bookingId),
      userType,
    });

    if (result.deletedCount === 0) {
      return { success: false, error: 'Draft not found' };
    }

    logger.debug('Review draft deleted', {
      context: 'ReviewDraftService',
      action: 'DRAFT_DELETED',
      userId,
      bookingId,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Submit draft as review
 */
export async function submitDraft(
  userId: string,
  bookingId: string,
  userType: 'customer' | 'provider' = 'customer'
): Promise<SubmitDraftResult> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid ID format' };
  }

  // Find draft
  const draft = await ReviewDraft.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    bookingId: new mongoose.Types.ObjectId(bookingId),
    userType,
  });

  if (!draft) {
    return { success: false, error: 'Draft not found' };
  }

  // Check if expired
  if (draft.expiresAt < new Date()) {
    return { success: false, error: 'Draft has expired. Please create a new review.' };
  }

  // Check completeness
  if (!draft.checkCompleteness()) {
    return {
      success: false,
      error: 'Draft is not complete. Please provide a rating and comment.',
    };
  }

  // Check if review already exists
  const existingReview = await Review.findOne({
    bookingId: new mongoose.Types.ObjectId(bookingId),
    reviewerId: new mongoose.Types.ObjectId(userId),
  });

  if (existingReview) {
    return { success: false, error: 'Review already exists for this booking' };
  }

  // Get booking for additional info
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  try {
    // Create review from draft
    const review = new Review({
      bookingId: draft.bookingId,
      reviewerId: draft.userId,
      reviewerType: userType,
      revieweeId: userType === 'customer' ? booking.providerId : booking.customerId,
      revieweeType: userType === 'customer' ? 'provider' : 'customer',
      rating: draft.rating!,
      title: draft.title,
      comment: draft.comment!,
      photos: draft.photos,
      isVerified: true, // Since it came from a completed booking
      moderationStatus: 'pending',
    });

    await review.save();

    // Delete draft after successful submission
    await ReviewDraft.deleteOne({ _id: draft._id });

    // Update booking with review reference
    if (userType === 'customer') {
      await Booking.findByIdAndUpdate(bookingId, { customerReview: review._id });
    } else {
      await Booking.findByIdAndUpdate(bookingId, { providerReview: review._id });
    }

    // Recalculate service/provider ratings
    if (userType === 'customer') {
      await Service.recalculateRating(booking.serviceId);
      await ProviderProfile.recalculateReviewsData(booking.providerId);
    }

    // Create notification for the reviewed party
    const notification = new BookingNotification({
      bookingId: booking._id,
      recipientId: userType === 'customer' ? booking.providerId : booking.customerId,
      type: 'new_review',
      title: 'New Review Received',
      message: `You received a ${draft.rating}-star review!`,
      metadata: {
        bookingNumber: booking.bookingNumber,
        rating: draft.rating,
        comment: draft.comment?.substring(0, 100),
      },
    });
    await notification.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.REVIEW_SUBMITTED, {
      reviewId: review._id,
      bookingId: booking._id,
      reviewerId: draft.userId,
      revieweeId: userType === 'customer' ? booking.providerId : booking.customerId,
      rating: draft.rating,
    });

    logger.info('Review submitted from draft', {
      context: 'ReviewDraftService',
      action: 'DRAFT_SUBMITTED',
      draftId: draft._id.toString(),
      reviewId: review._id.toString(),
      bookingId,
      userId,
    });

    return { success: true, reviewId: review._id.toString() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to submit review from draft', {
      context: 'ReviewDraftService',
      action: 'SUBMIT_DRAFT_ERROR',
      draftId: draft._id.toString(),
      bookingId,
      userId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Submit review directly (bypassing draft)
 */
export async function submitReview(
  userId: string,
  bookingId: string,
  data: {
    rating: number;
    title?: string;
    comment: string;
    photos?: string[];
  },
  userType: 'customer' | 'provider' = 'customer'
): Promise<SubmitDraftResult> {
  // Validate inputs
  const validation = validateDraftContent(data);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid ID format' };
  }

  // Check if booking exists and is completed
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status !== 'completed') {
    return { success: false, error: 'Can only review completed bookings' };
  }

  // Check if review already exists
  const existingReview = await Review.findOne({
    bookingId: new mongoose.Types.ObjectId(bookingId),
    reviewerId: new mongoose.Types.ObjectId(userId),
  });

  if (existingReview) {
    return { success: false, error: 'Review already exists for this booking' };
  }

  // Delete any existing draft
  await ReviewDraft.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    bookingId: new mongoose.Types.ObjectId(bookingId),
    userType,
  });

  try {
    // Create review
    const review = new Review({
      bookingId: new mongoose.Types.ObjectId(bookingId),
      reviewerId: new mongoose.Types.ObjectId(userId),
      reviewerType: userType,
      revieweeId: userType === 'customer' ? booking.providerId : booking.customerId,
      revieweeType: userType === 'customer' ? 'provider' : 'customer',
      rating: data.rating,
      title: data.title ? sanitizeHtml(data.title) : undefined,
      comment: sanitizeHtml(data.comment),
      photos: data.photos,
      isVerified: true,
      moderationStatus: 'pending',
    });

    await review.save();

    // Update booking with review reference
    if (userType === 'customer') {
      await Booking.findByIdAndUpdate(bookingId, { customerReview: review._id });
    } else {
      await Booking.findByIdAndUpdate(bookingId, { providerReview: review._id });
    }

    // Recalculate service/provider ratings
    if (userType === 'customer') {
      await Service.recalculateRating(booking.serviceId);
      await ProviderProfile.recalculateReviewsData(booking.providerId);
    }

    // Create notification
    const notification = new BookingNotification({
      bookingId: booking._id,
      recipientId: userType === 'customer' ? booking.providerId : booking.customerId,
      type: 'new_review',
      title: 'New Review Received',
      message: `You received a ${data.rating}-star review!`,
      metadata: {
        bookingNumber: booking.bookingNumber,
        rating: data.rating,
      },
    });
    await notification.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.REVIEW_SUBMITTED, {
      reviewId: review._id,
      bookingId: booking._id,
      reviewerId: userId,
      revieweeId: userType === 'customer' ? booking.providerId : booking.customerId,
      rating: data.rating,
    });

    logger.info('Review submitted directly', {
      context: 'ReviewDraftService',
      action: 'REVIEW_SUBMITTED',
      reviewId: review._id.toString(),
      bookingId,
      userId,
    });

    return { success: true, reviewId: review._id.toString() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to submit review', {
      context: 'ReviewDraftService',
      action: 'SUBMIT_REVIEW_ERROR',
      bookingId,
      userId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Auto-cleanup expired drafts (called by scheduled job)
 */
export async function cleanupExpiredDrafts(batchSize: number = 100): Promise<{ deleted: number }> {
  try {
    const result = await ReviewDraft.cleanupExpired(batchSize);
    return result;
  } catch (error) {
    logger.error('Failed to cleanup expired drafts', {
      context: 'ReviewDraftService',
      action: 'CLEANUP_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { deleted: 0 };
  }
}

/**
 * Notify users about expiring drafts
 */
export async function notifyExpiringDrafts(hoursThreshold: number = 48): Promise<void> {
  // Find all users with expiring drafts
  const expiringDrafts = await ReviewDraft.getExpiringSoon(hoursThreshold);

  // Group by user
  const draftsByUser = new Map<string, typeof expiringDrafts>();
  for (const draft of expiringDrafts) {
    const userId = draft.userId.toString();
    if (!draftsByUser.has(userId)) {
      draftsByUser.set(userId, []);
    }
    draftsByUser.get(userId)!.push(draft);
  }

  // Create notifications
  for (const [userId, drafts] of draftsByUser) {
    const notification = new BookingNotification({
      recipientId: new mongoose.Types.ObjectId(userId),
      type: 'draft_expiring',
      title: 'Review Drafts Expiring Soon',
      message: `You have ${drafts.length} review draft(s) that will expire soon.`,
      metadata: {
        draftCount: drafts.length,
        firstDraftExpiresAt: drafts[0].expiresAt,
      },
    });
    await notification.save();
  }

  logger.info('Expiring draft notifications sent', {
    context: 'ReviewDraftService',
    action: 'EXPIRING_NOTIFICATIONS',
    userCount: draftsByUser.size,
    draftCount: expiringDrafts.length,
  });
}

/**
 * Review Draft Service Class
 */
export class ReviewDraftService {
  /**
   * Save draft with auto-save support
   */
  async save(
    userId: string,
    bookingId: string,
    data: {
      rating?: number;
      title?: string;
      comment?: string;
      photos?: string[];
    },
    userType: 'customer' | 'provider' = 'customer'
  ): Promise<SaveDraftResult> {
    return saveDraft(userId, bookingId, data, userType);
  }

  /**
   * Get single draft
   */
  async get(
    userId: string,
    bookingId: string,
    userType: 'customer' | 'provider' = 'customer'
  ): Promise<SaveDraftResult> {
    return getDraft(userId, bookingId, userType);
  }

  /**
   * Get all user drafts
   */
  async getAll(
    userId: string,
    userType: 'customer' | 'provider' = 'customer',
    options?: {
      includeExpired?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ drafts: DraftListItem[]; total: number; page: number; totalPages: number }> {
    return getUserDrafts(userId, userType, options || {});
  }

  /**
   * Delete draft
   */
  async delete(
    userId: string,
    bookingId: string,
    userType: 'customer' | 'provider' = 'customer'
  ): Promise<{ success: boolean; error?: string }> {
    return deleteDraft(userId, bookingId, userType);
  }

  /**
   * Submit draft as review
   */
  async submit(
    userId: string,
    bookingId: string,
    userType: 'customer' | 'provider' = 'customer'
  ): Promise<SubmitDraftResult> {
    return submitDraft(userId, bookingId, userType);
  }

  /**
   * Submit review directly (bypass draft)
   */
  async submitReview(
    userId: string,
    bookingId: string,
    data: {
      rating: number;
      title?: string;
      comment: string;
      photos?: string[];
    },
    userType: 'customer' | 'provider' = 'customer'
  ): Promise<SubmitDraftResult> {
    return submitReview(userId, bookingId, data, userType);
  }

  /**
   * Cleanup expired drafts
   */
  async cleanup(batchSize?: number): Promise<{ deleted: number }> {
    return cleanupExpiredDrafts(batchSize);
  }

  /**
   * Send expiration warnings
   */
  async sendExpirationWarnings(hoursThreshold?: number): Promise<void> {
    return notifyExpiringDrafts(hoursThreshold);
  }
}

// Export singleton instance
export const reviewDraftService = new ReviewDraftService();
