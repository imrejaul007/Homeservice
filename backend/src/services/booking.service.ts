import mongoose from 'mongoose';
import crypto from 'crypto';
import Booking from '../models/booking.model';
import BookingNotification from '../models/bookingNotification.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import { validateProviderSlotAvailability } from '../utils/availabilityHelper';
import { eventBus, EVENT_TYPES } from '../event-bus';
import logger from '../utils/logger';
import { addTenantFilter, getTenantContext } from '../utils/tenantFilter';
import { cache, isRedisAvailable } from '../config/redis';
import {
  BookingInputDTO,
  GuestBookingInputDTO,
  BookingFiltersDTO,
  BookingResult,
  CancellationResult,
  GuestBookingResult,
  PaginatedBookingsResult,
  ProviderBookingsStatsDTO,
  PublicBookingTrackingDTO,
} from '../dto/booking.dto';
import {
  escapeRegex,
  formatBookingListItem,
} from '../utils/formatBookingListItem';

// ============================================
// Slot Locking Constants
// ============================================
const SLOT_LOCK_TTL_SECONDS = 30; // 30 second TTL for slot locks
const SLOT_LOCK_PREFIX = 'slot:lock:';

interface SlotLockResult {
  acquired: boolean;
  lockKey?: string;
  expiresIn?: number;
  reason?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Strip HTML tags to prevent XSS attacks
 * Used for user-provided text fields like specialRequests and accessInstructions
 */
function stripHtmlTags(input: string): string {
  if (!input) return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Get cancellation window hours from settings (default: 24)
 */
async function getCancellationWindowHours(): Promise<number> {
  try {
    const { getSetting } = await import('./settings.service');
    return await getSetting('cancellationWindowHours') || 24;
  } catch {
    return 24; // Default fallback
  }
}

// ============================================
// Slot Locking Functions (Redis-based)
// ============================================

/**
 * Generate a unique slot lock key
 */
function generateSlotLockKey(providerId: string, scheduledDate: string | Date, scheduledTime: string): string {
  // Convert Date to ISO string date part if needed
  const dateStr = scheduledDate instanceof Date
    ? scheduledDate.toISOString().split('T')[0]
    : scheduledDate;
  return `${SLOT_LOCK_PREFIX}${providerId}:${dateStr}:${scheduledTime}`;
}

/**
 * Acquire a Redis-based lock for a time slot during checkout
 * Uses SET NX (set if not exists) with TTL for atomic lock acquisition
 * @returns SlotLockResult with acquired status and lock details
 */
async function acquireSlotLock(
  providerId: string,
  scheduledDate: string | Date,
  scheduledTime: string,
  sessionId: string
): Promise<SlotLockResult> {
  const lockKey = generateSlotLockKey(providerId, scheduledDate, scheduledTime);

  try {
    // Check if Redis is available
    if (!isRedisAvailable()) {
      // SECURITY FIX: Fail closed when Redis is unavailable
      // Proceeding without locking could allow double-booking
      logger.error('Redis unavailable for slot lock, failing closed', {
        action: 'SLOT_LOCK_REDIS_UNAVAILABLE',
        providerId,
        scheduledDate,
        scheduledTime,
      });
      return {
        acquired: false,
        reason: 'Service temporarily unavailable. Please try again.',
      };
    }

    // Attempt atomic lock acquisition using SET NX with TTL
    const redisClient = cache.client;
    if (!redisClient) {
      // SECURITY FIX: Fail closed when Redis client is unavailable
      logger.error('Redis client unavailable for slot lock, failing closed', {
        action: 'SLOT_LOCK_CLIENT_UNAVAILABLE',
        providerId,
      });
      return {
        acquired: false,
        reason: 'Service temporarily unavailable. Please try again.',
      };
    }

    // Use SET with NX (only set if not exists) and EX (expire in seconds)
    // This is atomic - prevents race conditions in lock acquisition
    const lockValue = JSON.stringify({
      sessionId,
      lockedAt: Date.now(),
    });

    const result = await redisClient.set(lockKey, lockValue, 'EX', SLOT_LOCK_TTL_SECONDS, 'NX');

    if (result === 'OK') {
      logger.info('Slot lock acquired successfully', {
        action: 'SLOT_LOCK_ACQUIRED',
        lockKey,
        sessionId,
        ttl: SLOT_LOCK_TTL_SECONDS,
      });
      return {
        acquired: true,
        lockKey,
        expiresIn: SLOT_LOCK_TTL_SECONDS,
      };
    } else {
      // Lock already exists - another session has it
      const existingLock = await redisClient.get(lockKey);
      logger.warn('Slot lock acquisition failed - slot already locked', {
        action: 'SLOT_LOCK_CONFLICT',
        lockKey,
        existingLock,
        requestedBy: sessionId,
      });
      return { acquired: false };
    }
  } catch (error) {
    logger.error('Slot lock acquisition error', {
      action: 'SLOT_LOCK_ERROR',
      lockKey,
      error: (error as Error).message,
    });
    // SECURITY FIX: Fail closed when lock acquisition fails
    // Proceeding without locking could allow double-booking
    return {
      acquired: false,
      reason: 'Service temporarily unavailable. Please try again.',
    };
  }
}

/**
 * Release a Redis-based slot lock
 * Only releases if the lock is owned by the given sessionId (prevents releasing others' locks)
 */
async function releaseSlotLock(
  providerId: string,
  scheduledDate: string | Date,
  scheduledTime: string,
  sessionId: string
): Promise<boolean> {
  const lockKey = generateSlotLockKey(providerId, scheduledDate, scheduledTime);

  try {
    if (!isRedisAvailable()) {
      logger.debug('Redis unavailable for slot release', {
        action: 'SLOT_RELEASE_REDIS_UNAVAILABLE',
        lockKey,
      });
      return true;
    }

    const redisClient = cache.client;
    if (!redisClient) {
      return true;
    }

    // Lua script for atomic check-and-delete (only delete if we own the lock)
    const luaScript = `
      local lockValue = redis.call('GET', KEYS[1])
      if lockValue then
        local lock = cjson.decode(lockValue)
        if lock.sessionId == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        end
        return 0
      end
      return 1
    `;

    const result = await redisClient.eval(luaScript, 1, lockKey, sessionId);

    if (result === 1 || result === 0) {
      logger.info('Slot lock released', {
        action: 'SLOT_LOCK_RELEASED',
        lockKey,
        sessionId,
        wasOwned: result === 1,
      });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Slot lock release error', {
      action: 'SLOT_RELEASE_ERROR',
      lockKey,
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Extend a slot lock TTL (useful for long checkouts)
 */
async function extendSlotLock(
  providerId: string,
  scheduledDate: string | Date,
  scheduledTime: string,
  sessionId: string,
  additionalSeconds: number = SLOT_LOCK_TTL_SECONDS
): Promise<boolean> {
  const lockKey = generateSlotLockKey(providerId, scheduledDate, scheduledTime);

  try {
    if (!isRedisAvailable()) {
      return true;
    }

    const redisClient = cache.client;
    if (!redisClient) {
      return true;
    }

    // Lua script for atomic check-and-extend
    const luaScript = `
      local lockValue = redis.call('GET', KEYS[1])
      if lockValue then
        local lock = cjson.decode(lockValue)
        if lock.sessionId == ARGV[1] then
          return redis.call('EXPIRE', KEYS[1], ARGV[2])
        end
        return 0
      end
      return 0
    `;

    const result = await redisClient.eval(luaScript, 1, lockKey, sessionId, additionalSeconds);

    if (result === 1) {
      logger.debug('Slot lock extended', {
        action: 'SLOT_LOCK_EXTENDED',
        lockKey,
        additionalSeconds,
      });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Slot lock extend error', {
      action: 'SLOT_EXTEND_ERROR',
      lockKey,
      error: (error as Error).message,
    });
    return false;
  }
}

// ============================================
// Status Transition Logging
// ============================================

interface StatusTransitionLog {
  bookingId: string;
  bookingNumber: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: 'customer' | 'provider' | 'system' | 'admin' | 'payment';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  sagaStep?: string;
  compensationTriggered?: boolean;
}

/**
 * Log a booking status transition with full audit trail
 */
function logStatusTransition(transition: StatusTransitionLog): void {
  const logEntry = {
    ...transition,
    action: 'BOOKING_STATUS_TRANSITION',
    type: 'STATUS_TRANSITION',
  };

  // Use appropriate log level based on transition type
  if (transition.toStatus === 'cancelled' || transition.toStatus === 'failed') {
    logger.warn('Booking status transitioned', logEntry);
  } else if (transition.compensationTriggered) {
    logger.warn('Booking status transitioned (saga compensation)', logEntry);
  } else {
    logger.info('Booking status transitioned', logEntry);
  }
}

/**
 * Log saga step execution for multi-step booking flow
 */
function logSagaStep(
  bookingId: string,
  bookingNumber: string,
  step: string,
  status: 'started' | 'completed' | 'failed' | 'compensating',
  details?: Record<string, any>
): void {
  logger.info('Saga step', {
    action: 'SAGA_STEP',
    type: 'SAGA',
    bookingId,
    bookingNumber,
    step,
    status,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// RBAC Helper Functions
// ============================================

interface AdminPermission {
  hasPermission: boolean;
  missingPermissions?: string[];
}

/**
 * Check if user has admin booking permissions
 * SECURITY FIX: RBAC permission checks for admin booking operations
 */
async function checkAdminBookingPermission(userId: string, permission: string): Promise<AdminPermission> {
  const user = await User.findById(userId);

  if (!user) {
    return { hasPermission: false };
  }

  // Admin role has all permissions
  if (user.role === 'admin') {
    // Additional check for specific permissions
    if (permission === 'booking:update:all') {
      // Check if user has the specific admin permission for bulk booking updates
      // In a real system, this would check a permissions table
      // For now, we just check if they are an admin
      return { hasPermission: true };
    }
    return { hasPermission: true };
  }

  return {
    hasPermission: false,
    missingPermissions: [`booking:update:all`]
  };
}

/**
 * Log admin booking action for audit trail
 */
function logAdminBookingAction(
  action: string,
  adminId: string,
  bookingId: string,
  details: Record<string, any>
): void {
  logger.info('ADMIN_BOOKING_AUDIT', {
    action,
    adminId,
    bookingId,
    ...details,
    timestamp: new Date().toISOString(),
    type: 'ADMIN_AUDIT'
  });
}

// ============================================
// BookingService Class
// ============================================

interface TimeSlotConflictResult {
  hasConflict: boolean;
  conflictingBookingId?: string;
  conflictingBookingNumber?: string;
  conflictType?: 'exact' | 'overlap';
}

export class BookingService {

  // ========================================
  // Time Slot Conflict Detection
  // ========================================

  /**
   * Check for time slot conflicts before accepting a booking
   * SECURITY: Prevents accepting bookings that conflict with existing confirmed bookings
   *
   * @param providerId - The provider's ID
   * @param excludeBookingId - Booking ID to exclude from conflict check (the one being accepted)
   * @param scheduledDate - The date to check
   * @param scheduledTime - The start time to check
   * @param duration - The duration in minutes
   * @returns TimeSlotConflictResult indicating if a conflict exists
   */
  async checkForTimeSlotConflicts(
    providerId: string,
    excludeBookingId: string,
    scheduledDate: Date | string,
    scheduledTime: string,
    duration: number
  ): Promise<TimeSlotConflictResult> {
    const requestedDate = scheduledDate instanceof Date
      ? scheduledDate
      : new Date(scheduledDate);

    // Get provider profile for buffer time
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });
    const bufferTime = providerProfile?.availability?.bufferTime || 0;

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const requestedStartMinutes = hours * 60 + minutes;
    const requestedEndMinutes = requestedStartMinutes + duration + bufferTime;

    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all active bookings for this provider on this date, excluding the one being accepted
    const activeBookings = await Booking.find({
      providerId: new mongoose.Types.ObjectId(providerId),
      _id: { $ne: new mongoose.Types.ObjectId(excludeBookingId) },
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'in_progress'] }
    }).select('bookingNumber scheduledTime duration').lean();

    // Check for conflicts
    for (const booking of activeBookings) {
      const bookingStartMinutes = (() => {
        const [h, m] = booking.scheduledTime.split(':').map(Number);
        return h * 60 + m;
      })();
      const bookingEndMinutes = bookingStartMinutes + booking.duration + bufferTime;

      // Check if time ranges overlap
      // Two ranges overlap if: start1 < end2 AND start2 < end1
      const overlaps = requestedStartMinutes < bookingEndMinutes && bookingStartMinutes < requestedEndMinutes;

      if (overlaps) {
        // Determine conflict type
        const isExactConflict = (
          requestedStartMinutes === bookingStartMinutes &&
          requestedEndMinutes === bookingEndMinutes
        );

        return {
          hasConflict: true,
          conflictingBookingId: booking._id.toString(),
          conflictingBookingNumber: booking.bookingNumber,
          conflictType: isExactConflict ? 'exact' : 'overlap'
        };
      }
    }

    return { hasConflict: false };
  }
  // ========================================
  // Create Customer Booking (with Slot Locking & Saga)
  // ========================================

  async createCustomerBooking(customerId: string, data: BookingInputDTO): Promise<BookingResult> {
    // Generate unique lock owner ID for this booking attempt
    const lockOwnerId = data.metadata?.sessionId || crypto.randomUUID();
    const bookingNumber = this.generateBookingNumber();

    // Log saga start
    logSagaStep('pending', bookingNumber, 'slot_lock_acquisition', 'started', {
      providerId: data.providerId,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      lockOwner: lockOwnerId,
    });

    // STEP 1: Acquire Redis slot lock to prevent double-booking during checkout
    const lockResult = await acquireSlotLock(
      data.providerId,
      data.scheduledDate,
      data.scheduledTime,
      lockOwnerId
    );

    if (!lockResult.acquired) {
      throw new ApiError(409, 'This time slot is currently being booked by another user. Please select a different time or try again.');
    }

    logSagaStep('pending', bookingNumber, 'slot_lock_acquisition', 'completed', {
      lockKey: lockResult.lockKey,
      ttl: lockResult.expiresIn,
    });

    // STEP 2: Validate service and provider (outside transaction - read-only)
    const service = await Service.findById(data.serviceId).populate('providerId');
    if (!service || !service.isActive) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(404, 'Service not found or inactive');
    }

    const provider = await User.findById(data.providerId);
    if (!provider || provider.role !== 'provider') {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(404, 'Provider not found');
    }

    // Calculate pricing (done outside transaction - read-only operation)
    const pricing = this.calculatePricing(service, data.addOns, data.selectedDuration);

    // Apply coupon discount if provided
    let couponDiscount = 0;
    let couponCode = data.couponCode;
    if (couponCode) {
      // Check for existing discounts to prevent coupon stacking
      if (pricing.discounts && pricing.discounts.length > 0) {
        await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
        throw new ApiError(400, 'Only one coupon can be applied per booking');
      }
      try {
        const { OfferService } = await import("./offer.service");
        const offerService = new OfferService();
        const validation = await offerService.validatePromoCode(couponCode, customerId, pricing.totalAmount);
        if (validation.valid && validation.discount) {
          couponDiscount = validation.discount;
        }
      } catch (error) {
        logger.error('Coupon validation error', {
          context: 'BookingService',
          action: 'COUPON_VALIDATION_ERROR',
          customerId,
          couponCode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate times
    const requestedDate = new Date(data.scheduledDate);
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(requestedDate);
    serviceStart.setHours(hours, minutes, 0, 0);
    const estimatedEndTime = new Date(serviceStart.getTime() + (pricing.bookingDuration * 60 * 1000));
    const cancellationWindowHours = await getCancellationWindowHours();
    const cancellationDeadline = new Date(serviceStart.getTime() - cancellationWindowHours * 60 * 60 * 1000);

    // Process location
    const processedLocation = this.processLocation(data.location);

    // Create booking object (will be saved within transaction)
    const bookingData = {
      bookingNumber,
      customerId,
      providerId: data.providerId,
      serviceId: data.serviceId,
      scheduledDate: requestedDate,
      scheduledTime: data.scheduledTime,
      duration: pricing.bookingDuration,
      estimatedEndTime,
      locationType: data.locationType || 'at_home',
      selectedDuration: pricing.bookingDuration,
      professionalPreference: data.professionalPreference || 'no_preference',
      paymentMethod: data.paymentMethod || 'credit_card',
      location: processedLocation,
      pricing: {
        basePrice: pricing.basePrice,
        addOns: data.addOns || [],
        discounts: couponDiscount > 0 ? [{
          type: 'coupon',
          code: couponCode,
          amount: couponDiscount
        }] : [],
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        totalAmount: Math.max(0, pricing.totalAmount - couponDiscount),
        couponDiscount: couponDiscount,
        currency: pricing.currency,
      },
      customerInfo: {
        firstName: data.customerInfo?.firstName || '',
        lastName: data.customerInfo?.lastName || '',
        email: data.customerInfo?.email || '',
        phone: data.customerInfo?.phone || '',
        specialRequests: stripHtmlTags(data.customerInfo?.specialRequests || data.specialRequests || ''),
        accessInstructions: stripHtmlTags(data.customerInfo?.accessInstructions || ''),
      },
      cancellationPolicy: {
        allowedUntil: cancellationDeadline,
        refundPercentage: 100,
        cancellationFee: 0,
      },
      metadata: {
        bookingSource: data.metadata?.bookingSource || 'search',
        deviceType: data.metadata?.deviceType || 'desktop',
        sessionId: lockOwnerId,
      },
      status: 'pending',
    };

    // Use transaction to prevent race condition (TOCTOU vulnerability fix)
    // The partial unique index on (providerId, scheduledDate, scheduledTime, status)
    // will reject duplicate bookings at the database level
    const session = await mongoose.startSession();
    let booking: any;

    logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'started');

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // Re-validate availability within transaction to ensure consistency
      const availabilityResult = await validateProviderSlotAvailability({
        providerId: data.providerId,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        serviceDurationMinutes: service.duration,
        session,
      });

      if (!availabilityResult.isValid) {
        await session.abortTransaction();
        logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'failed', {
          reason: 'slot_availability_failed',
          error: availabilityResult.errorMessage,
        });

        // Release slot lock on failure
        await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);

        const error: any = new ApiError(
          availabilityResult.errorCode === 'CONFLICT' ? 409 : 400,
          availabilityResult.errorMessage!
        );
        error.availableSlots = availabilityResult.availableSlots;
        throw error;
      }

      // Create and save booking within transaction
      booking = new Booking(bookingData);
      await booking.save({ session });

      await session.commitTransaction();

      // Log successful booking creation with status transition
      logStatusTransition({
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        fromStatus: 'none',
        toStatus: 'pending',
        triggeredBy: 'customer',
        reason: 'Booking created',
        metadata: {
          providerId: data.providerId,
          serviceId: data.serviceId,
          totalAmount: booking.pricing.totalAmount,
        },
        timestamp: new Date().toISOString(),
      });

      logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'completed', {
        bookingId: booking._id.toString(),
      });

      logger.info('Booking created successfully', {
        context: 'BookingService',
        action: 'BOOKING_CREATED',
        bookingNumber: booking.bookingNumber,
        sagaCompleted: true,
      });
    } catch (error: any) {
      // Abort transaction if still active
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      // Release slot lock on failure (saga compensation)
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);

      logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'failed', {
        compensation: 'slot_lock_released',
        error: error.message,
      });

      // Handle duplicate key error from partial unique index
      if (error.code === 11000) {
        logger.warn('Double-booking attempt prevented', {
          context: 'BookingService',
          action: 'DOUBLE_BOOKING_PREVENTED',
          providerId: data.providerId,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
        });
        throw new ApiError(409, 'This time slot has already been booked. Please select a different time.');
      }

      // Re-throw other errors
      throw error;
    } finally {
      session.endSession();
    }

    // STEP 3: Post-booking operations (outside transaction - these are idempotent)
    // Mark coupon as used if applicable
    if (couponCode && couponDiscount > 0) {
      try {
        const { OfferService } = await import("./offer.service");
        const offerService = new OfferService();
        await offerService.markCouponAsUsed(couponCode, customerId, booking._id.toString());
      } catch (error) {
        logger.error('Failed to mark coupon as used', {
          context: 'BookingService',
          action: 'MARK_COUPON_USED_FAILED',
          couponCode,
          customerId,
          bookingId: booking._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Create notifications
    await this.createBookingNotifications(booking, 'booking_request');

    // Populate for response
    await booking.populate([
      { path: 'customer', select: 'firstName lastName email avatar' },
      { path: 'provider', select: 'firstName lastName email businessInfo' },
      { path: 'service', select: 'name category price duration images' },
    ]);

    // Send email
    await this.sendBookingRequestEmail(booking, service, provider);

    // Emit event for analytics, notifications, loyalty points, etc.
    eventBus.publish(EVENT_TYPES.BOOKING_CREATED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
      serviceId: booking.serviceId,
      totalAmount: booking.pricing.totalAmount,
      status: booking.status,
    });

    return { booking };
  }

  // ========================================
  // Create Guest Booking (with Slot Locking & Saga)
  // ========================================

  async createGuestBooking(data: GuestBookingInputDTO): Promise<GuestBookingResult> {
    // Validate guest info
    if (!data.guestInfo?.name || !data.guestInfo?.email || !data.guestInfo?.phone) {
      throw new ApiError(400, 'Guest name, email, and phone are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.guestInfo.email)) {
      throw new ApiError(400, 'Please provide a valid email address');
    }

    // Generate unique lock owner ID for this booking attempt
    const lockOwnerId = crypto.randomUUID();
    const bookingNumber = this.generateBookingNumber();

    // Log saga start
    logSagaStep('pending', bookingNumber, 'slot_lock_acquisition', 'started', {
      providerId: data.providerId,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      isGuest: true,
    });

    // STEP 1: Acquire Redis slot lock to prevent double-booking during checkout
    const lockResult = await acquireSlotLock(
      data.providerId,
      data.scheduledDate,
      data.scheduledTime,
      lockOwnerId
    );

    if (!lockResult.acquired) {
      throw new ApiError(409, 'This time slot is currently being booked by another user. Please select a different time or try again.');
    }

    // Validate service exists and is active
    const service = await Service.findById(data.serviceId);
    if (!service || !service.isActive) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(404, 'Service not found or inactive');
    }

    // Validate provider
    const provider = await User.findById(data.providerId);
    if (!provider || provider.role !== 'provider') {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(404, 'Provider not found');
    }

    // Calculate pricing (done outside transaction - read-only operation)
    const pricing = this.calculatePricing(service, data.addOns, data.selectedDuration);

    // Apply coupon discount if provided (for guest bookings too)
    let couponDiscount = 0;
    let couponCode = data.couponCode;
    if (couponCode) {
      // Check for existing discounts to prevent coupon stacking
      if (pricing.discounts && pricing.discounts.length > 0) {
        await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
        throw new ApiError(400, 'Only one coupon can be applied per booking');
      }
      try {
        const { OfferService } = await import('./offer.service');
        const offerService = new OfferService();
        // For guest, create a unique identifier from email hash instead of hardcoded ID
        // This prevents bypassing per-user coupon limits across different guests
        const guestIdentifier = crypto.createHash('sha256')
          .update(data.guestInfo.email)
          .digest('hex')
          .substring(0, 24);
        const validation = await offerService.validatePromoCode(couponCode, guestIdentifier, pricing.totalAmount);
        if (validation.valid && validation.discount) {
          couponDiscount = validation.discount;
        }
      } catch (error) {
        logger.error('Coupon validation error (guest booking)', {
          context: 'BookingService',
          action: 'GUEST_COUPON_VALIDATION_ERROR',
          couponCode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate times
    const requestedDate = new Date(data.scheduledDate);
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(requestedDate);
    serviceStart.setHours(hours, minutes, 0, 0);
    const estimatedEndTime = new Date(serviceStart.getTime() + (pricing.bookingDuration * 60 * 1000));
    const cancellationWindowHours = await getCancellationWindowHours();
    const cancellationDeadline = new Date(serviceStart.getTime() - cancellationWindowHours * 60 * 60 * 1000);

    // Process location
    const processedLocation = this.processLocation(data.location);

    // Create guest booking object (will be saved within transaction)
    const bookingData = {
      bookingNumber,
      customerId: null,
      isGuestBooking: true,
      guestInfo: {
        name: data.guestInfo.name,
        email: data.guestInfo.email,
        phone: data.guestInfo.phone,
      },
      providerId: data.providerId,
      serviceId: data.serviceId,
      scheduledDate: requestedDate,
      scheduledTime: data.scheduledTime,
      duration: pricing.bookingDuration,
      estimatedEndTime,
      locationType: data.locationType || 'at_home',
      selectedDuration: pricing.bookingDuration,
      professionalPreference: data.professionalPreference || 'no_preference',
      paymentMethod: data.paymentMethod || 'credit_card',
      location: processedLocation,
      pricing: {
        basePrice: pricing.basePrice,
        addOns: data.addOns || [],
        discounts: couponDiscount > 0 ? [{
          type: 'coupon',
          code: couponCode,
          amount: couponDiscount
        }] : [],
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        totalAmount: Math.max(0, pricing.totalAmount - couponDiscount),
        couponDiscount: couponDiscount,
        currency: pricing.currency,
      },
      customerInfo: {
        firstName: data.guestInfo.name.split(' ')[0] || data.guestInfo.name,
        lastName: data.guestInfo.name.split(' ').slice(1).join(' ') || '',
        email: data.guestInfo.email,
        phone: data.guestInfo.phone,
        specialRequests: stripHtmlTags(data.specialRequests || ''),
      },
      cancellationPolicy: {
        allowedUntil: cancellationDeadline,
        refundPercentage: 100,
        cancellationFee: 0,
      },
      metadata: {
        bookingSource: 'search',
        deviceType: 'desktop',
        sessionId: lockOwnerId,
      },
      status: 'pending',
    };

    // Use transaction to prevent race condition (TOCTOU vulnerability fix)
    // The partial unique index on (providerId, scheduledDate, scheduledTime, status)
    // will reject duplicate bookings at the database level
    const session = await mongoose.startSession();
    let booking: any;

    logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'started', { isGuest: true });

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // Re-validate availability within transaction to ensure consistency
      const availabilityResult = await validateProviderSlotAvailability({
        providerId: data.providerId,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        serviceDurationMinutes: service.duration,
        session,
      });

      if (!availabilityResult.isValid) {
        await session.abortTransaction();
        logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'failed', {
          reason: 'slot_availability_failed',
          error: availabilityResult.errorMessage,
        });

        // Release slot lock on failure
        await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);

        const error: any = new ApiError(
          availabilityResult.errorCode === 'CONFLICT' ? 409 : 400,
          availabilityResult.errorMessage!
        );
        error.availableSlots = availabilityResult.availableSlots;
        throw error;
      }

      // Create and save booking within transaction
      booking = new Booking(bookingData);
      await booking.save({ session });

      await session.commitTransaction();

      // Log successful booking creation with status transition
      logStatusTransition({
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        fromStatus: 'none',
        toStatus: 'pending',
        triggeredBy: 'customer',
        reason: 'Guest booking created',
        metadata: {
          providerId: data.providerId,
          serviceId: data.serviceId,
          totalAmount: booking.pricing.totalAmount,
          isGuest: true,
        },
        timestamp: new Date().toISOString(),
      });

      logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'completed', {
        bookingId: booking._id.toString(),
        isGuest: true,
      });

      logger.info('Guest booking created successfully', {
        context: 'BookingService',
        action: 'GUEST_BOOKING_CREATED',
        bookingNumber: booking.bookingNumber,
        sagaCompleted: true,
      });
    } catch (error: any) {
      // Abort transaction if still active
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      // Release slot lock on failure (saga compensation)
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);

      logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'failed', {
        compensation: 'slot_lock_released',
        error: error.message,
        isGuest: true,
      });

      // Handle duplicate key error from partial unique index
      if (error.code === 11000) {
        logger.warn('Double-booking attempt prevented (guest)', {
          context: 'BookingService',
          action: 'GUEST_DOUBLE_BOOKING_PREVENTED',
          providerId: data.providerId,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
        });
        throw new ApiError(409, 'This time slot has already been booked. Please select a different time.');
      }

      // Re-throw other errors
      throw error;
    } finally {
      session.endSession();
    }

    // Post-booking operations (outside transaction - these are idempotent)
    // Send email to guest
    await this.sendGuestBookingEmail(booking, service, provider);

    // Send notification to provider
    await this.createBookingNotifications(booking, 'booking_request');

    return {
      booking: {
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        duration: booking.duration,
        pricing: booking.pricing,
        guestInfo: {
          name: data.guestInfo.name,
          email: data.guestInfo.email,
        },
      },
      trackingUrl: `/track/${booking.bookingNumber}`,
    };
  }

  // ========================================
  // Get Customer Bookings (Cursor-based pagination)
  // ========================================

  async getCustomerBookings(
    customerId: string,
    filters: BookingFiltersDTO,
    tenantContext?: { tenantId?: string; isAdmin?: boolean }
  ): Promise<PaginatedBookingsResult> {
    // CRITICAL: Add tenant filter to prevent cross-tenant data access
    const query: any = { customerId };

    // Add tenant filter if not admin and tenantId provided
    if (tenantContext?.tenantId && !tenantContext?.isAdmin) {
      query.tenantId = tenantContext.tenantId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }

    // Search: search by service name, provider name, or booking number
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'service.name': searchRegex },
          { 'provider.firstName': searchRegex },
          { 'provider.lastName': searchRegex },
          { bookingNumber: searchRegex },
        ],
      });
    }

    const limit = Math.min(filters.limit || 20, 100);

    // Build sort object from filters
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    const sortField = (filters.sortBy as string) || 'createdAt';
    const sortObj: any = { [sortField]: sortOrder, _id: -1 };

    // Cursor-based pagination using sort field + _id for stable ordering
    if (filters.cursor) {
      try {
        const cursor = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('utf-8'));
        if (!cursor[sortField] || !cursor._id) {
          throw new ApiError(400, 'Invalid pagination cursor: missing required fields');
        }
        const cursorValue = new Date(cursor[sortField]);
        if (isNaN(cursorValue.getTime())) {
          throw new ApiError(400, 'Invalid pagination cursor: invalid date');
        }
        query.$or = [
          { [sortField]: { [sortOrder === 1 ? '$gt' : '$lt']: cursorValue } },
          { [sortField]: cursorValue, _id: { $lt: cursor._id } },
        ];
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(400, 'Invalid pagination cursor');
      }
    }

    const bookings = await Booking.find(query)
      .populate('provider', 'firstName lastName avatar')
      .populate('service', 'name duration basePrice')
      .sort(sortObj)
      .lean()
      .limit(Math.min(limit + 1, 101)); // Fetch one extra to determine if there are more, max 101

    const hasMore = bookings.length > limit;
    if (hasMore) {
      bookings.pop(); // Remove the extra item
    }

    // Generate next cursor from last item
    let nextCursor: string | undefined;
    if (hasMore && bookings.length > 0) {
      const lastBooking = bookings[bookings.length - 1];
      const cursorData: any = {
        _id: lastBooking._id.toString(),
      };
      // Handle both date fields and other sortable fields
      if (sortField === 'scheduledDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
        cursorData[sortField] = new Date((lastBooking as any)[sortField]).toISOString();
      } else {
        cursorData[sortField] = (lastBooking as any)[sortField];
      }
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
      bookings: bookings as any,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    };
  }

  // ========================================
  // Get Provider Bookings (offset pagination + stats)
  // ========================================

  private async buildProviderBookingSearchOr(
    providerObjectId: mongoose.Types.ObjectId,
    searchTerm: string,
  ): Promise<Record<string, unknown>[]> {
    const trimmed = searchTerm.trim();
    if (!trimmed) return [];

    const searchRegex = new RegExp(escapeRegex(trimmed), 'i');
    const orConditions: Record<string, unknown>[] = [
      { bookingNumber: searchRegex },
      { 'customerInfo.firstName': searchRegex },
      { 'customerInfo.lastName': searchRegex },
      { 'customerInfo.email': searchRegex },
      { 'customerInfo.phone': searchRegex },
      { 'guestInfo.name': searchRegex },
      { 'guestInfo.email': searchRegex },
      { 'guestInfo.phone': searchRegex },
    ];

    const [matchingCustomers, matchingServices] = await Promise.all([
      User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      })
        .select('_id')
        .limit(50)
        .lean(),
      Service.find({ name: searchRegex }).select('_id').limit(50).lean(),
    ]);

    if (matchingCustomers.length > 0) {
      orConditions.push({
        customerId: { $in: matchingCustomers.map((c) => c._id) },
      });
    }

    if (matchingServices.length > 0) {
      orConditions.push({
        serviceId: { $in: matchingServices.map((s) => s._id) },
      });
    }

    return orConditions;
  }

  private async getProviderBookingStats(
    providerObjectId: mongoose.Types.ObjectId,
  ): Promise<ProviderBookingsStatsDTO> {
    const rows = await Booking.aggregate([
      { $match: { providerId: providerObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats: ProviderBookingsStatsDTO = {
      pending: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      total: 0,
    };

    for (const row of rows) {
      const status = String(row._id) as keyof ProviderBookingsStatsDTO;
      if (status !== 'total' && Object.prototype.hasOwnProperty.call(stats, status)) {
        stats[status] = row.count;
      }
      stats.total += row.count;
    }

    return stats;
  }

  async getProviderBookings(
    providerId: string,
    filters: BookingFiltersDTO,
  ): Promise<PaginatedBookingsResult> {
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const providerObjectId = new mongoose.Types.ObjectId(providerId);
    const query: Record<string, unknown> = { providerId: providerObjectId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      const scheduledDate: Record<string, Date> = {};
      if (filters.startDate) {
        scheduledDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        scheduledDate.$lte = end;
      }
      query.scheduledDate = scheduledDate;
    }

    if (filters.search?.trim()) {
      const searchOr = await this.buildProviderBookingSearchOr(
        providerObjectId,
        filters.search,
      );
      if (searchOr.length > 0) {
        query.$or = searchOr;
      }
    }

    const limit = Math.min(filters.limit || 20, 100);
    const page = Math.max(filters.page || 1, 1);
    const skip = (page - 1) * limit;

    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    const allowedSortFields = [
      'scheduledDate',
      'createdAt',
      'updatedAt',
      'status',
      'bookingNumber',
    ];
    const sortField = allowedSortFields.includes(filters.sortBy || '')
      ? (filters.sortBy as string)
      : 'createdAt';
    const sortObj: Record<string, 1 | -1> = {
      [sortField]: sortOrder,
      _id: sortOrder,
    };

    const populateOptions = [
      { path: 'customer', select: 'firstName lastName avatar email phone' },
      {
        path: 'service',
        select: 'name category subcategory description duration price images',
      },
    ];

    const [total, bookings, stats] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .populate(populateOptions)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      this.getProviderBookingStats(providerObjectId),
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));

    return {
      bookings: bookings.map((b) => formatBookingListItem(b)),
      pagination: {
        page,
        limit,
        total,
        pages,
        hasMore: page < pages,
      },
      stats,
    };
  }

  // ========================================
  // Get Booking By ID
  // ========================================

  async getBookingById(bookingId: string, userId: string, userRole: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    const booking = await Booking.findById(bookingId)
      .populate('customer', 'firstName lastName email avatar loyaltySystem')
      .populate('provider', 'firstName lastName email businessInfo rating')
      .populate('service', 'name category subcategory description price duration images tags')
      .lean();

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    const isAuthorized =
      (booking.customerId && userId === booking.customerId.toString()) ||
      userId === booking.providerId.toString() ||
      userRole === 'admin';

    if (!isAuthorized) {
      throw new ApiError(403, 'Access denied');
    }

    return booking;
  }

  // ========================================
  // Track Booking (Public)
  // ========================================

  async trackBooking(bookingNumber: string): Promise<PublicBookingTrackingDTO> {
    const booking = await Booking.findOne({ bookingNumber })
      .populate('providerId', 'firstName lastName')
      .populate('serviceId', 'name category subcategory price duration images')
      .lean();

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      statusHistory: booking.statusHistory.map((s: any) => ({
        status: s.status,
        timestamp: s.timestamp,
        reason: s.reason,
      })),
      service: booking.serviceId
        ? {
            name: (booking.serviceId as any).name,
            category: (booking.serviceId as any).category,
            subcategory: (booking.serviceId as any).subcategory,
            image: (booking.serviceId as any).images?.[0],
          }
        : undefined,
      provider: booking.providerId
        ? {
            name: `${(booking.providerId as any).firstName} ${(booking.providerId as any).lastName}`,
          }
        : undefined,
      location: booking.location,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration,
      pricing: {
        basePrice: booking.pricing.basePrice,
        addOns: booking.pricing.addOns,
        discounts: booking.pricing.discounts,
        subtotal: booking.pricing.subtotal,
        tax: booking.pricing.tax,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
      },
      customerInfo: booking.customerInfo,
      isGuestBooking: booking.isGuestBooking,
      createdAt: booking.createdAt,
    };
  }

  // ========================================
  // Accept Booking
  // ========================================

  async acceptBooking(bookingId: string, providerId: string, data?: { notes?: string; estimatedArrival?: string }): Promise<any> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    if (booking.providerId.toString() !== providerId) {
      throw new ApiError(403, 'Only the assigned provider can accept this booking');
    }

    // Check if booking can be accepted
    if (booking.status !== 'pending') {
      const error: any = new ApiError(400, 'Booking cannot be accepted');
      error.currentStatus = booking.status;
      throw error;
    }

    const previousStatus = booking.status;

    // Log status transition before change
    logStatusTransition({
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      fromStatus: previousStatus,
      toStatus: 'confirmed',
      triggeredBy: 'provider',
      reason: 'Booking accepted by provider',
      metadata: { notes: data?.notes },
      timestamp: new Date().toISOString(),
    });

    // Update booking
    await booking.updateStatus('confirmed', 'provider', 'Booking accepted by provider', data?.notes);

    if (data?.estimatedArrival) {
      booking.providerResponse.estimatedArrival = new Date(data.estimatedArrival);
    }
    booking.providerResponse.acceptedAt = new Date();
    booking.providerResponse.notes = data?.notes;

    await booking.save();

    // Send notifications
    await this.createBookingNotifications(booking, 'booking_confirmed');

    // Send confirmation email
    await this.sendBookingConfirmationEmail(booking);

    // Emit event for analytics and notifications
    eventBus.publish(EVENT_TYPES.BOOKING_CONFIRMED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
      totalAmount: booking.pricing.totalAmount,
    });

    return booking;
  }

  // ========================================
  // Reject Booking
  // ========================================

  async rejectBooking(bookingId: string, providerId: string, data?: { reason?: string }): Promise<any> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    if (booking.providerId.toString() !== providerId) {
      throw new ApiError(403, 'Only the assigned provider can reject this booking');
    }

    // Check if booking can be rejected
    if (booking.status !== 'pending') {
      const error: any = new ApiError(400, 'Booking cannot be rejected');
      error.currentStatus = booking.status;
      throw error;
    }

    const previousStatus = booking.status;

    // Log status transition before change
    logStatusTransition({
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      fromStatus: previousStatus,
      toStatus: 'cancelled',
      triggeredBy: 'provider',
      reason: data?.reason || 'Rejected by provider',
      metadata: { rejectionReason: data?.reason },
      timestamp: new Date().toISOString(),
    });

    // Update booking
    await booking.updateStatus('cancelled', 'provider', data?.reason || 'Rejected by provider');

    booking.providerResponse.rejectedAt = new Date();
    booking.providerResponse.rejectionReason = data?.reason;

    booking.cancellationDetails = {
      cancelledBy: 'provider',
      cancelledAt: new Date(),
      reason: data?.reason || 'Rejected by provider',
      refundAmount: booking.pricing.totalAmount,
      refundStatus: 'pending',
    };

    await booking.save();

    // Send notification
    await this.createBookingNotifications(booking, 'booking_rejected');

    // Emit event for analytics and notifications
    eventBus.publish(EVENT_TYPES.BOOKING_REJECTED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
      cancelledBy: 'provider',
      reason: data?.reason,
    });

    return booking;
  }

  // ========================================
  // Start Booking
  // ========================================

  async startBooking(bookingId: string, providerId: string, data?: { notes?: string }): Promise<any> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    if (booking.providerId.toString() !== providerId) {
      throw new ApiError(403, 'Only the assigned provider can start this booking');
    }

    // Check if booking can be started
    if (booking.status !== 'confirmed') {
      const error: any = new ApiError(400, 'Booking cannot be started');
      error.currentStatus = booking.status;
      throw error;
    }

    const previousStatus = booking.status;

    // Log status transition before change
    logStatusTransition({
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      fromStatus: previousStatus,
      toStatus: 'in_progress',
      triggeredBy: 'provider',
      reason: 'Service started by provider',
      metadata: { notes: data?.notes },
      timestamp: new Date().toISOString(),
    });

    // Update booking status
    await booking.updateStatus('in_progress', 'provider', 'Service started by provider', data?.notes);

    booking.providerResponse.arrivalTime = new Date();
    if (data?.notes) {
      booking.providerResponse.notes = data.notes;
    }

    await booking.save();

    // Send notification
    await this.createBookingNotifications(booking, 'booking_started');

    // Emit event for analytics
    eventBus.publish(EVENT_TYPES.BOOKING_STARTED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
    });

    return booking;
  }

  // ========================================
  // Complete Booking
  // ========================================

  async completeBooking(bookingId: string, providerId: string, data?: { notes?: string; actualDuration?: number }): Promise<any> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    if (booking.providerId.toString() !== providerId) {
      throw new ApiError(403, 'Only the assigned provider can complete this booking');
    }

    // Check if booking can be completed
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      const error: any = new ApiError(400, 'Booking cannot be completed');
      error.currentStatus = booking.status;
      throw error;
    }

    const previousStatus = booking.status;

    // Log status transition before change
    logStatusTransition({
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      fromStatus: previousStatus,
      toStatus: 'completed',
      triggeredBy: 'provider',
      reason: 'Service completed by provider',
      metadata: { notes: data?.notes, actualDuration: data?.actualDuration },
      timestamp: new Date().toISOString(),
    });

    // Update booking
    await booking.markAsCompleted();

    booking.providerResponse.completedAt = new Date();
    booking.providerResponse.notes = data?.notes;

    if (data?.actualDuration) {
      booking.duration = data.actualDuration;
    }

    await booking.save();

    // Update provider analytics
    await this.updateProviderAnalytics(booking.providerId);

    // Send completion notification
    await this.createBookingNotifications(booking, 'booking_completed');

    // Emit event for analytics, loyalty points, etc.
    // FIX: Added customerEmail for notification emails and providerPayout for payout processing
    eventBus.publish(EVENT_TYPES.BOOKING_COMPLETED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      customerEmail: booking.customerInfo?.email,
      providerId: booking.providerId,
      totalAmount: booking.pricing.totalAmount,
      providerPayout: booking.pricing.totalAmount * 0.85, // 85% to provider (15% commission)
      serviceId: booking.serviceId,
    });

    return booking;
  }

  // ========================================
  // Cancel Booking (Customer)
  // ========================================

  async cancelBooking(bookingId: string, customerId: string, data?: { reason?: string }): Promise<CancellationResult> {
    const session = await mongoose.startSession();
    let booking: any;
    let refundAmount = 0;
    const previousStatus = 'pending'; // Will be updated after fetch

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // Find booking within transaction to prevent race condition
      booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found');
      }

      // Authorization check
      // FIX: Handle guest bookings where customerId is null
      // For guest bookings, we need to verify via booking email or other means
      if (booking.customerId) {
        // Registered user booking - check customerId match
        if (booking.customerId.toString() !== customerId) {
          await session.abortTransaction();
          throw new ApiError(403, 'Only the customer who made the booking can cancel it');
        }
      } else if (booking.guestEmail) {
        // Guest booking - in a real system, you'd verify via email link or OTP
        // For now, allow cancellation if they have the booking ID
        // In production, implement email verification for guest cancellation
        logger.info('Guest booking cancellation attempt', {
          bookingId,
          guestEmail: booking.guestEmail,
          action: 'GUEST_CANCELLATION',
        });
      } else {
        await session.abortTransaction();
        throw new ApiError(403, 'Cannot verify booking ownership');
      }

      // Check if booking can be cancelled
      if (!booking.canCustomerCancel()) {
        await session.abortTransaction();
        const error: any = new ApiError(400, 'Booking cannot be cancelled');
        error.currentStatus = booking.status;
        error.cancellationDeadline = booking.cancellationPolicy.allowedUntil;
        throw error;
      }

      // Check if already cancelled to prevent double refund
      if (booking.status === 'cancelled') {
        await session.abortTransaction();
        throw new ApiError(400, 'Booking has already been cancelled');
      }

      // Store previous status for logging
      const statusBeforeCancel = booking.status;

      // Calculate refund
      refundAmount = booking.calculateRefund();

      // Update booking within transaction
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationDetails = {
        cancelledBy: 'customer',
        cancelledAt: new Date(),
        reason: data?.reason || 'Cancelled by customer',
        refundAmount,
        refundStatus: 'pending',
      };

      await booking.save({ session });

      await session.commitTransaction();

      // Log status transition after successful commit
      logStatusTransition({
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        fromStatus: statusBeforeCancel,
        toStatus: 'cancelled',
        triggeredBy: 'customer',
        reason: data?.reason || 'Cancelled by customer',
        metadata: { refundAmount, refundProcessingTime: '3-5 business days' },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

    // Send notifications (outside transaction - idempotent)
    await this.createBookingNotifications(booking, 'booking_cancelled');

    // Emit event for analytics and notifications
    eventBus.publish(EVENT_TYPES.BOOKING_CANCELLED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
      cancelledBy: 'customer',
      reason: data?.reason,
      refundAmount,
    });

    return {
      booking: booking as any,
      refundAmount,
      refundProcessingTime: '3-5 business days',
    };
  }

  // ========================================
  // Reschedule Booking
  // ========================================

  async rescheduleBooking(
    bookingId: string,
    userId: string,
    userRole: string,
    data: { scheduledDate: string; scheduledTime: string; reason?: string }
  ): Promise<any> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check - allow customer or provider to reschedule
    const isCustomer = booking.customerId && booking.customerId.toString() === userId;
    const isProvider = booking.providerId.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ApiError(403, 'Not authorized to reschedule this booking');
    }

    // Check if booking status allows reschedule
    if (!['pending', 'confirmed'].includes(booking.status)) {
      const error: any = new ApiError(400, 'Booking cannot be rescheduled');
      error.currentStatus = booking.status;
      throw error;
    }

    // Validate new date is not in the past
    const requestedDate = new Date(data.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      throw new ApiError(400, 'Cannot reschedule to a past date');
    }

    // Validate availability with new time slot
    const service = await Service.findById(booking.serviceId);
    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    // Store original schedule for status history (needed outside transaction)
    const originalScheduledDate = booking.scheduledDate;
    const originalScheduledTime = booking.scheduledTime;

    // Use transaction to prevent race condition (TOCTOU vulnerability fix)
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // Re-validate availability within transaction to ensure consistency
      const availabilityResult = await validateProviderSlotAvailability({
        providerId: booking.providerId.toString(),
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        serviceDurationMinutes: booking.duration,
        session,
      });

      if (!availabilityResult.isValid) {
        await session.abortTransaction();
        const error: any = new ApiError(
          availabilityResult.errorCode === 'CONFLICT' ? 409 : 400,
          availabilityResult.errorMessage || 'Time slot is not available'
        );
        if (availabilityResult.availableSlots) {
          error.availableSlots = availabilityResult.availableSlots;
        }
        throw error;
      }

      // Update booking with new schedule
      const newScheduledDate = new Date(data.scheduledDate);
      const [hours, minutes] = data.scheduledTime.split(':').map(Number);
      const serviceStart = new Date(newScheduledDate);
      serviceStart.setHours(hours, minutes, 0, 0);
      booking.scheduledDate = newScheduledDate;
      booking.scheduledTime = data.scheduledTime;
      booking.estimatedEndTime = new Date(serviceStart.getTime() + (booking.duration * 60 * 1000));

      // Update cancellation policy deadline if needed
      const cancellationWindowHours = await getCancellationWindowHours();
      const cancellationDeadline = new Date(serviceStart.getTime() - cancellationWindowHours * 60 * 60 * 1000);
      booking.cancellationPolicy.allowedUntil = cancellationDeadline;

      // Add reschedule entry to status history
      const rescheduledBy = isCustomer ? 'customer' : isProvider ? 'provider' : 'admin';
      booking.statusHistory.push({
        status: 'rescheduled',
        timestamp: new Date(),
        reason: data.reason || 'Booking rescheduled',
        updatedBy: rescheduledBy as 'customer' | 'provider' | 'system' | 'admin',
        notes: `Rescheduled from ${originalScheduledDate.toLocaleDateString()} ${originalScheduledTime} to ${newScheduledDate.toLocaleDateString()} ${data.scheduledTime}`,
      });

      // Save within transaction
      await booking.save({ session });

      await session.commitTransaction();
      logger.info('Booking rescheduled successfully', {
        context: 'BookingService',
        action: 'BOOKING_RESCHEDULED',
        bookingNumber: booking.bookingNumber,
        bookingId,
      });
    } catch (error: any) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      // Handle duplicate key error from partial unique index
      if (error.code === 11000) {
        logger.warn('Double-booking prevented during reschedule', {
          context: 'BookingService',
          action: 'RESCHEDULE_DOUBLE_BOOKING_PREVENTED',
          bookingId,
        });
        throw new ApiError(409, 'This time slot has already been booked. Please select a different time.');
      }

      throw error;
    } finally {
      session.endSession();
    }

    // Send notifications (outside transaction - idempotent)
    await this.createBookingNotifications(booking, 'booking_rescheduled');

    // Emit event for analytics and notifications
    eventBus.publish(EVENT_TYPES.BOOKING_RESCHEDULED, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
      originalDate: originalScheduledDate,
      originalTime: originalScheduledTime,
      newDate: booking.scheduledDate,
      newTime: booking.scheduledTime,
      rescheduledBy: isCustomer ? 'customer' : isProvider ? 'provider' : 'admin',
      reason: data.reason,
    });

    return booking;
  }

  // ========================================
  // Mark Booking as No-Show
  // ========================================

  async markNoShow(bookingId: string, providerId: string, notes?: string): Promise<any> {
    const session = await mongoose.startSession();
    let booking: any;

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found');
      }

      // Validate provider ownership
      if (booking.providerId.toString() !== providerId) {
        await session.abortTransaction();
        throw new ApiError(403, 'Only the assigned provider can mark a booking as no-show');
      }

      // Check booking is in valid state (confirmed or in_progress)
      if (!['confirmed', 'in_progress'].includes(booking.status)) {
        await session.abortTransaction();
        throw new ApiError(400, `Cannot mark booking as no-show. Current status: ${booking.status}. Booking must be confirmed or in progress.`);
      }

      // Update booking status to no_show
      booking.status = 'no_show';
      booking.noShowDetails = {
        markedAt: new Date(),
        notes: notes || 'Customer did not show up',
      };

      // Add to status history
      booking.statusHistory.push({
        status: 'no_show',
        timestamp: new Date(),
        reason: 'Customer no-show',
        updatedBy: 'provider',
        notes: notes || 'Customer did not show up',
      });

      await booking.save({ session });

      await session.commitTransaction();
      logger.info('Booking marked as no-show', {
        context: 'BookingService',
        action: 'NO_SHOW_MARKED',
        bookingNumber: booking.bookingNumber,
        providerId,
      });
    } catch (error: any) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

    // Send notifications (outside transaction - idempotent)
    await this.createBookingNotifications(booking, 'booking_no_show');

    // Emit event for analytics
    eventBus.publish(EVENT_TYPES.BOOKING_NO_SHOW, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
    });

    return booking;
  }

  // ========================================
  // Add Message
  // ========================================

  async addMessage(bookingId: string, userId: string, data: { message: string }): Promise<number> {
    if (!data.message || data.message.trim().length === 0) {
      throw new ApiError(400, 'Message content is required');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    const isAuthorized =
      (booking.customerId && userId === booking.customerId.toString()) ||
      userId === booking.providerId.toString();

    if (!isAuthorized) {
      throw new ApiError(403, 'Access denied');
    }

    // Add message
    await booking.addMessage(new mongoose.Types.ObjectId(userId), data.message.trim());

    // Send notification to the other party
    const recipientId =
      booking.customerId && userId === booking.customerId.toString()
        ? booking.providerId
        : booking.customerId;

    if (recipientId) {
      await this.createMessageNotification(booking, recipientId);
    }

    return booking.messages.length;
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private calculatePricing(service: any, addOns?: any[], selectedDuration?: number): any {
    let bookingDuration = service.duration;
    let basePrice = service.price.amount;

    // Check for duration options
    if (selectedDuration && service.durationOptions && service.durationOptions.length > 0) {
      const selectedOption = service.durationOptions.find((opt: any) => opt.duration === selectedDuration);
      if (selectedOption) {
        bookingDuration = selectedOption.duration;
        basePrice = selectedOption.price;
      }
    } else if (selectedDuration) {
      bookingDuration = selectedDuration;
    }

    // Calculate add-ons
    let addOnTotal = 0;
    if (addOns && addOns.length > 0) {
      addOnTotal = addOns.reduce((total: number, addOn: any) => total + addOn.price, 0);
    }

    const subtotal = basePrice + addOnTotal;
    const tax = subtotal * 0.05; // 5% UAE VAT
    const totalAmount = subtotal + tax;
    const currency = service.price.currency || 'AED';

    return {
      bookingDuration,
      basePrice,
      addOnTotal,
      subtotal,
      tax,
      totalAmount,
      currency,
    };
  }

  private processLocation(location: any): any {
    const processed: any = {
      type: location.type,
      notes: location.notes,
    };

    if (location.type === 'customer_address' && location.address) {
      processed.address = {
        street: location.address.street,
        city: location.address.city,
        state: location.address.state,
        zipCode: location.address.zipCode,
        country: location.address.country || 'AE',
      };
    }

    return processed;
  }

  private generateBookingNumber(): string {
    const now = new Date();
    return `RZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
  }

  private async createBookingNotifications(booking: any, type: string): Promise<void> {
    try {
      // Notification for customer
      if (booking.customerId) {
        const customerNotification = new BookingNotification({
          bookingId: booking._id,
          recipientId: booking.customerId,
          type,
          title: this.getNotificationTitle(type, 'customer'),
          message: this.getNotificationMessage(type, 'customer'),
          metadata: {
            bookingNumber: booking.bookingNumber,
            serviceName: booking.service?.name,
            providerName: booking.provider?.businessInfo?.businessName,
            scheduledDate: booking.scheduledDate,
            totalAmount: booking.pricing.totalAmount,
            currency: booking.pricing.currency,
          },
        });
        await customerNotification.save();
      }

      // Notification for provider
      const providerNotification = new BookingNotification({
        bookingId: booking._id,
        recipientId: booking.providerId,
        type,
        title: this.getNotificationTitle(type, 'provider'),
        message: this.getNotificationMessage(type, 'provider'),
        metadata: {
          bookingNumber: booking.bookingNumber,
          serviceName: booking.service?.name,
          customerName: booking.isGuestBooking
            ? booking.guestInfo?.name
            : `${booking.customerInfo?.firstName} ${booking.customerInfo?.lastName}`,
          scheduledDate: booking.scheduledDate,
          totalAmount: booking.pricing.totalAmount,
          currency: booking.pricing.currency,
        },
      });
      await providerNotification.save();
    } catch (error) {
      logger.error('Error creating booking notifications', {
        context: 'BookingService',
        action: 'CREATE_NOTIFICATIONS_ERROR',
        bookingId: booking._id.toString(),
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async createMessageNotification(booking: any, recipientId: any): Promise<void> {
    try {
      const notification = new BookingNotification({
        bookingId: booking._id,
        recipientId,
        type: 'message_received',
        title: 'New Message',
        message: `You have a new message about booking ${booking.bookingNumber}`,
        actionText: 'View Message',
        actionUrl: `/bookings/${booking._id}`,
        metadata: {
          bookingNumber: booking.bookingNumber,
          serviceName: booking.service?.name,
        },
      });
      await notification.save();
    } catch (error) {
      logger.error('Error creating message notification', {
        context: 'BookingService',
        action: 'CREATE_MESSAGE_NOTIFICATION_ERROR',
        bookingId: booking._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getNotificationTitle(type: string, recipient: string): string {
    const titles: { [key: string]: { [key: string]: string } } = {
      booking_request: { customer: 'Booking Request Submitted', provider: 'New Booking Request' },
      booking_confirmed: { customer: 'Booking Confirmed', provider: 'Booking Accepted' },
      booking_cancelled: { customer: 'Booking Cancelled', provider: 'Booking Cancelled' },
      booking_rejected: { customer: 'Booking Request Declined', provider: 'Booking Rejected' },
      booking_started: { customer: 'Service Started', provider: 'Service Started' },
      booking_completed: { customer: 'Service Completed', provider: 'Service Completed' },
      booking_rescheduled: { customer: 'Booking Rescheduled', provider: 'Booking Rescheduled' },
    };
    return titles[type]?.[recipient] || 'Booking Update';
  }

  private getNotificationMessage(type: string, recipient: string): string {
    const messages: { [key: string]: { [key: string]: string } } = {
      booking_request: {
        customer: 'Your booking request has been submitted.',
        provider: 'You have a new booking request.',
      },
      booking_confirmed: {
        customer: 'Your booking has been confirmed.',
        provider: 'You have accepted the booking.',
      },
      booking_cancelled: { customer: 'Your booking has been cancelled.', provider: 'Booking cancelled.' },
      booking_rejected: {
        customer: 'Your booking request has been declined.',
        provider: 'You have declined the booking.',
      },
      booking_started: { customer: 'Your service has started.', provider: 'Service started.' },
      booking_completed: {
        customer: 'Your service has been completed.',
        provider: 'Service completed successfully.',
      },
      booking_rescheduled: {
        customer: 'Your booking has been rescheduled.',
        provider: 'A booking has been rescheduled.',
      },
    };
    return messages[type]?.[recipient] || 'Your booking has been updated.';
  }

  private async updateProviderAnalytics(providerId: any): Promise<void> {
    try {
      const providerBookings = await Booking.find({ providerId });
      const totalBookings = providerBookings.length;
      const completedBookings = providerBookings.filter((b) => b.status === 'completed').length;
      const cancelledBookings = providerBookings.filter((b) => b.status === 'cancelled').length;
      const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

      const customerIds = providerBookings.filter((b) => b.customerId).map((b) => b.customerId?.toString());
      const uniqueCustomers = new Set(customerIds).size;
      const repeatCustomers = customerIds.length - uniqueCustomers;
      const repeatCustomerRate = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;

      const completedWithPrice = providerBookings.filter((b) => b.status === 'completed' && b.pricing?.totalAmount);
      const averageBookingValue =
        completedWithPrice.length > 0
          ? completedWithPrice.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0) / completedWithPrice.length
          : 0;

      // Calculate revenue stats
      const totalEarnings = completedWithPrice.reduce(
        (sum, b) => sum + (b.pricing?.totalAmount || 0), 0
      );
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthCompleted = completedWithPrice.filter(
        (b) => b.completedAt && new Date(b.completedAt) >= startOfMonth
      );
      const currentMonthEarnings = currentMonthCompleted.reduce(
        (sum, b) => sum + (b.pricing?.totalAmount || 0), 0
      );

      await ProviderProfile.findOneAndUpdate(
        { userId: providerId },
        {
          $set: {
            'analytics.bookingStats.totalBookings': totalBookings,
            'analytics.bookingStats.completedBookings': completedBookings,
            'analytics.bookingStats.cancelledBookings': cancelledBookings,
            'analytics.bookingStats.repeatCustomerRate': repeatCustomerRate,
            'analytics.bookingStats.averageBookingValue': Math.round(averageBookingValue),
            'analytics.performanceMetrics.completionRate': completionRate,
            'analytics.customerMetrics.totalCustomers': uniqueCustomers,
            'analytics.customerMetrics.repeatCustomers': repeatCustomers,
            'analytics.customerMetrics.customerRetentionRate': repeatCustomerRate,
            'analytics.revenueStats.totalEarnings': totalEarnings,
            'analytics.revenueStats.currentMonthEarnings': currentMonthEarnings,
          },
        }
      );
    } catch (error) {
      logger.warn('Failed to update provider analytics', {
        context: 'BookingService',
        action: 'UPDATE_ANALYTICS_ERROR',
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendBookingRequestEmail(booking: any, service: any, provider: any): Promise<void> {
    try {
      const { sendBookingRequestEmail } = await import('./email.service');
      const customerUser = await User.findById(booking.customerId);
      if (customerUser?.email) {
        await sendBookingRequestEmail(customerUser.email, customerUser.firstName || 'Customer', {
          bookingNumber: booking.bookingNumber,
          serviceName: service.name,
          providerName: provider.firstName || 'Provider',
          scheduledDate: new Date(booking.scheduledDate).toLocaleDateString(),
          scheduledTime: booking.scheduledTime,
          duration: booking.duration,
          location: booking.location?.address?.street || 'At Home',
          currency: booking.pricing.currency,
          totalAmount: booking.pricing.totalAmount.toFixed(2),
        });
      }
    } catch (error) {
      logger.error('Failed to send booking email', {
        context: 'BookingService',
        action: 'SEND_BOOKING_EMAIL_ERROR',
        bookingNumber: booking.bookingNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendGuestBookingEmail(booking: any, service: any, provider: any): Promise<void> {
    try {
      const { sendBookingRequestEmail } = await import('./email.service');
      await sendBookingRequestEmail(booking.guestInfo.email, booking.guestInfo.name, {
        bookingNumber: booking.bookingNumber,
        serviceName: service.name,
        providerName: provider.firstName + ' ' + provider.lastName,
        scheduledDate: new Date(booking.scheduledDate).toLocaleDateString(),
        scheduledTime: booking.scheduledTime,
        duration: booking.duration,
        location: booking.location?.address?.city || 'Dubai',
        currency: booking.pricing.currency,
        totalAmount: booking.pricing.totalAmount.toFixed(2),
      });
    } catch (error) {
      logger.error('Failed to send guest booking email', {
        context: 'BookingService',
        action: 'SEND_GUEST_EMAIL_ERROR',
        bookingNumber: booking.bookingNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendBookingConfirmationEmail(booking: any): Promise<void> {
    try {
      const { sendBookingConfirmationEmail } = await import('./email.service');
      const service = await Service.findById(booking.serviceId);
      const provider = await User.findById(booking.providerId);

      if (booking.isGuestBooking && booking.guestInfo?.email) {
        await sendBookingConfirmationEmail(booking.guestInfo.email, booking.guestInfo.name || 'Guest', {
          bookingNumber: booking.bookingNumber,
          serviceName: service?.name || 'Service',
          providerName: provider?.firstName || 'Provider',
          providerEmail: provider?.email || '',
          scheduledDate: new Date(booking.scheduledDate).toLocaleDateString(),
          scheduledTime: booking.scheduledTime,
          duration: booking.duration,
          location: booking.location?.address?.street || 'At location',
          currency: booking.pricing?.currency || 'AED',
          totalAmount: (booking.pricing?.totalAmount || 0).toFixed(2),
        });
      } else {
        const customer = await User.findById(booking.customerId);
        if (customer?.email) {
          await sendBookingConfirmationEmail(customer.email, customer.firstName || 'Customer', {
            bookingNumber: booking.bookingNumber,
            serviceName: service?.name || 'Service',
            providerName: provider?.firstName || 'Provider',
            providerEmail: provider?.email || '',
            scheduledDate: new Date(booking.scheduledDate).toLocaleDateString(),
            scheduledTime: booking.scheduledTime,
            duration: booking.duration,
            location: booking.location?.address?.street || 'At location',
            currency: booking.pricing?.currency || 'AED',
            totalAmount: (booking.pricing?.totalAmount || 0).toFixed(2),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to send confirmation email', {
        context: 'BookingService',
        action: 'SEND_CONFIRMATION_EMAIL_ERROR',
        bookingNumber: booking.bookingNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const bookingService = new BookingService();
