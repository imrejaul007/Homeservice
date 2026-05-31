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
import { enrichBookingLocation } from './bookingLocation.service';
import { addTenantFilter, getTenantContext } from '../utils/tenantFilter';
import { cache, isRedisAvailable } from '../config/redis';
import { calculateCommission } from './settlement.service';
import {
  BookingInputDTO,
  GuestBookingInputDTO,
  BookingFiltersDTO,
  BookingResult,
  CancellationResult,
  CancellationDataDTO,
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
const SLOT_LOCK_TTL_SECONDS = 900; // 15 minute TTL for slot locks
const SLOT_LOCK_COOLDOWN_SECONDS = 5; // FIX: 5 second cooldown after lock release to prevent race conditions
const SLOT_LOCK_PREFIX = 'slot:lock:';
const SLOT_COOLDOWN_PREFIX = 'slot:cooldown:';

interface SlotLockResult {
  acquired: boolean;
  lockKey?: string;
  expiresIn?: number;
  reason?: string;
}

// ============================================
// State Machine Constants
// ============================================
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled', 'no_show'],
  completed: ['refunded'],
  cancelled: [],
  no_show: [],
};

/**
 * Validates state transition and throws ApiError if invalid
 */
function validateStateTransition(currentStatus: string, newStatus: string): void {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    throw new ApiError(
      400,
      `Invalid state transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: [${allowedTransitions?.join(', ') || 'none'}]`
    );
  }
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

    // FIX: Use atomic Lua script to check cooldown AND acquire lock in single operation
    // This prevents race conditions between cooldown check and lock acquisition
    const cooldownKey = `${SLOT_COOLDOWN_PREFIX}${providerId}:${new Date(scheduledDate).toISOString().split('T')[0]}:${scheduledTime}`;

    const luaScript = `
      -- Check if slot is in cooldown period
      local cooldown = redis.call('GET', KEYS[2])
      if cooldown then
        return {-2, 'cooldown'}
      end

      -- Try to acquire lock with NX (only if not exists)
      local result = redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX')
      if result == 'OK' then
        return {1, 'acquired'}
      else
        return {-1, 'locked'}
      end
    `;

    const result = await redisClient.eval(
      luaScript,
      2, // number of keys
      lockKey,      // KEYS[1] - the lock key
      cooldownKey,  // KEYS[2] - the cooldown key
      lockValue,                      // ARGV[1] - lock value
      SLOT_LOCK_TTL_SECONDS.toString() // ARGV[2] - TTL
    );

    const [statusCode, status] = result as [number, string];

    if (status === 'acquired') {
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
    } else if (status === 'cooldown') {
      // Slot is in cooldown period - prevent race condition
      logger.warn('Slot lock acquisition failed - slot in cooldown period', {
        action: 'SLOT_LOCK_COOLDOWN',
        lockKey,
        cooldownKey,
        requestedBy: sessionId,
      });
      return {
        acquired: false,
        reason: 'This time slot was just released. Please wait a moment and try again.',
      };
    } else {
      // Lock already exists - another session has it
      logger.warn('Slot lock acquisition failed - slot already locked', {
        action: 'SLOT_LOCK_CONFLICT',
        lockKey,
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

      // FIX: Set cooldown to prevent race condition between lock release and reacquisition
      // This ensures the slot is reserved during the booking creation process
      const cooldownKey = `${SLOT_COOLDOWN_PREFIX}${providerId}:${new Date(scheduledDate).toISOString().split('T')[0]}:${scheduledTime}`;
      await redisClient.setex(cooldownKey, SLOT_LOCK_COOLDOWN_SECONDS, JSON.stringify({
        releasedAt: Date.now(),
        previousSessionId: sessionId,
      }));

      logger.debug('Slot cooldown set', {
        action: 'SLOT_COOLDOWN_SET',
        cooldownKey,
        cooldownSeconds: SLOT_LOCK_COOLDOWN_SECONDS,
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
      status: { $in: ['pending', 'confirmed', 'in_progress'] },
      deletedAt: { $exists: false } // FIX: Exclude deleted bookings (soft delete uses deletedAt)
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

    // SECURITY FIX: Idempotency check - prevent duplicate bookings from retry
    // CRITICAL FIX: Generate server-side idempotency key if not provided
    const clientIdempotencyKey = data.metadata?.idempotencyKey;
    const idempotencyKey = clientIdempotencyKey || crypto.randomUUID();

    // Always store idempotency key in metadata for tracking
    const existingBooking = await Booking.findOne({
      customerId,
      'metadata.idempotencyKey': idempotencyKey,
      status: { $nin: ['failed', 'cancelled'] },
      deletedAt: { $exists: false } // FIX: Exclude deleted bookings (soft delete uses deletedAt)
    });
    if (existingBooking) {
      logger.info('Duplicate booking request detected', {
        bookingId: existingBooking._id.toString(),
        idempotencyKey,
        wasClientProvided: !!clientIdempotencyKey,
      });
      return {
        booking: existingBooking,
        message: 'Booking already exists',
      };
    }

    // RACE CONDITION FIX: Pre-validate coupon BEFORE acquiring lock to prevent holding lock during external calls
    let preValidatedCouponDiscount = 0;
    let preValidatedCouponCode = data.couponCode;
    if (preValidatedCouponCode) {
      try {
        const { OfferService } = await import("./offer.service");
        const offerService = new OfferService();
        // First get base pricing to check for existing discounts
        const tempService = await Service.findById(data.serviceId);
        if (tempService) {
          const tempPricing = this.calculatePricing(tempService, data.addOns, data.selectedDuration);
          // Check for existing discounts to prevent coupon stacking
          if (tempPricing.discounts && tempPricing.discounts.length > 0) {
            throw new ApiError(400, 'Only one coupon can be applied per booking');
          }
          // Validate coupon against total amount
          const validation = await offerService.validatePromoCode(preValidatedCouponCode, customerId, tempPricing.totalAmount);
          if (validation.valid && validation.discount) {
            preValidatedCouponDiscount = validation.discount;
          }
        }
      } catch (error) {
        if (error instanceof ApiError) throw error; // Re-throw our ApiError
        logger.error('Coupon pre-validation error', {
          context: 'BookingService',
          action: 'COUPON_PRE_VALIDATION_ERROR',
          customerId,
          couponCode: preValidatedCouponCode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Log saga start
    logSagaStep('pending', 'PENDING', 'slot_lock_acquisition', 'started', {
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

    // SECURITY FIX: Generate booking number AFTER lock acquisition to prevent sequence waste on failed requests
    const bookingNumber = this.generateBookingNumber();

    logSagaStep('pending', bookingNumber || 'PENDING', 'slot_lock_acquisition', 'completed', {
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

    // CRITICAL: Check provider is verified to receive bookings
    if ((provider as any).verificationStatus?.overall !== 'approved') {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(403, 'Provider is not verified to receive bookings');
    }

    // CRITICAL: Check provider is not suspended (explicit check)
    if ((provider as any).verificationStatus?.overall === 'suspended') {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(403, 'Provider account is suspended');
    }

    // Calculate pricing (done outside transaction - read-only operation)
    const pricing = this.calculatePricing(service, data.addOns, data.selectedDuration);

    // RACE CONDITION FIX: Re-validate within lock context to ensure atomicity
    // If coupon was pre-validated, re-check pricing.discounts is still empty
    if (preValidatedCouponCode && pricing.discounts && pricing.discounts.length > 0) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(400, 'Only one coupon can be applied per booking');
    }

    // Use pre-validated coupon values (validated BEFORE lock acquisition)
    const couponDiscount = preValidatedCouponDiscount;
    const couponCode = preValidatedCouponCode;

    // Calculate times
    const requestedDate = new Date(data.scheduledDate);
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(requestedDate);
    serviceStart.setHours(hours, minutes, 0, 0);
    const estimatedEndTime = new Date(serviceStart.getTime() + (pricing.bookingDuration * 60 * 1000));
    const cancellationWindowHours = await getCancellationWindowHours();
    const cancellationDeadline = new Date(serviceStart.getTime() - cancellationWindowHours * 60 * 60 * 1000);

    // Process and enrich location from booking input + customer/provider profiles
    const processedLocation = await enrichBookingLocation(
      customerId,
      data.providerId,
      data.location,
      data.locationType
    );

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
        idempotencyKey: idempotencyKey, // Always store idempotency key
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

      // FIX: Mark coupon as used INSIDE the transaction to ensure atomicity
      // This prevents scenarios where booking succeeds but coupon marking fails
      if (couponCode && couponDiscount > 0) {
        try {
          const { OfferService } = await import("./offer.service");
          const offerService = new OfferService();
          // Pass session for transactional consistency
          const couponMarked = await offerService.markCouponAsUsedAtomic(
            couponCode,
            customerId,
            booking._id.toString(),
            session
          );
          if (!couponMarked) {
            // Coupon marking failed within transaction - abort
            await session.abortTransaction();
            logger.warn('Coupon marking failed, booking aborted', {
              context: 'BookingService',
              action: 'COUPON_ATOMIC_FAILED',
              couponCode,
              bookingId: booking._id.toString(),
            });
            throw new ApiError(400, 'Coupon could not be applied. Please try again without the coupon.');
          }
        } catch (couponError) {
          await session.abortTransaction();
          throw couponError;
        }
      }

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
    // Note: Coupon marking is now done inside the transaction above

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

    // Emit event for analytics, loyalty points, etc.
// SECURITY FIX: Use calculated commission instead of hardcoded 85%
let providerPayout = booking.pricing.totalAmount;
try {
  // FIX: Use imported calculateCommission from settlement.service instead of non-existent method
  const commissionResult = await calculateCommission(booking._id);
  providerPayout = commissionResult.netAmount;
} catch (commissionError) {
  logger.error('Commission calculation failed', {
    context: 'BookingService',
    action: 'COMMISSION_CALC_ERROR',
    bookingId: booking._id.toString(),
    error: commissionError instanceof Error ? commissionError.message : String(commissionError),
  });
}

eventBus.publish(EVENT_TYPES.BOOKING_CREATED, {
  bookingId: booking._id,
  bookingNumber: booking.bookingNumber,
  customerId: booking.customerId,
  customerEmail: booking.customerInfo?.email,
  providerId: booking.providerId,
  totalAmount: booking.pricing.totalAmount,
  providerPayout: providerPayout,
  serviceId: booking.serviceId,
});

    return booking;
  }

  // ========================================
  // Cancel Booking (Customer) - ATOMIC with Refund Creation
  // ========================================

  async cancelBooking(bookingId: string, customerId: string, data?: CancellationDataDTO): Promise<CancellationResult> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new ApiError(400, 'Invalid customer ID');
    }

    const session = await mongoose.startSession();
    let booking: any;
    let refundAmount = 0;
    let refundRecord: any = null;

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
        // FIX: Guest booking cancellation requires email verification token
        // Guest cancellation is only allowed if:
        // 1. A valid cancellation token was provided in the request, OR
        // 2. The request includes the guest email and it matches the booking
        // This prevents anyone with a booking ID from cancelling guest bookings
        const cancellationToken = data?.cancellationToken;
        const providedEmail = data?.email;

        // For guest bookings, require either a valid cancellation token or matching email
        if (!cancellationToken && (!providedEmail || providedEmail.toLowerCase() !== booking.guestEmail.toLowerCase())) {
          await session.abortTransaction();
          throw new ApiError(403, 'Guest booking cancellation requires email verification. Please use the cancellation link from your confirmation email or provide the email address used for the booking.');
        }

        // Validate cancellation token if provided (token should be a secure hash sent via email)
        if (cancellationToken) {
          const { hashBookingCancellationToken } = await import('../utils/tokenUtil');
          const expectedToken = hashBookingCancellationToken(bookingId, booking.guestEmail);
          if (cancellationToken !== expectedToken) {
            await session.abortTransaction();
            throw new ApiError(403, 'Invalid or expired cancellation token. Please use the cancellation link from your confirmation email.');
          }
        }

        logger.info('Guest booking cancellation authorized', {
          bookingId,
          guestEmail: booking.guestEmail,
          action: 'GUEST_CANCELLATION_AUTHORIZED',
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

      // ATOMIC FIX: Create refund record INSIDE the transaction before booking cancellation
      // This ensures if booking is cancelled, there is a pending refund record
      // Stripe refund will be processed asynchronously via webhook or job
      if (refundAmount > 0 && booking.payment?.transactionId) {
        const RefundRequest = mongoose.model('RefundRequest');
        const refundNumber = await this.generateRefundNumberForCancellation();

        refundRecord = new RefundRequest({
          refundNumber,
          bookingId: booking._id,
          requestedBy: booking.customerId || new mongoose.Types.ObjectId(),
          amount: refundAmount,
          originalAmount: booking.pricing?.totalAmount || 0,
          reason: 'cancellation',
          description: data?.reason || 'Cancelled by customer',
          status: 'pending',
          type: refundAmount === booking.pricing?.totalAmount ? 'full' : 'partial',
          stripeChargeId: booking.payment.transactionId,
          refundPercentage: Math.round((refundAmount / (booking.pricing?.totalAmount || 1)) * 100),
          timeline: [{
            action: 'cancellation_initiated',
            performedBy: booking.customerId || new mongoose.Types.ObjectId(),
            performedByRole: 'customer',
            timestamp: new Date(),
            details: `Cancellation refund initiated for ${refundAmount.toFixed(2)} ${booking.pricing?.currency || 'AED'}`,
            previousStatus: undefined,
            newStatus: 'pending',
          }],
        });

        await refundRecord.save({ session });
      }

      // Update booking within transaction
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationDetails = {
        cancelledBy: 'customer',
        cancelledAt: new Date(),
        reason: data?.reason || 'Cancelled by customer',
        refundAmount,
        refundStatus: refundRecord ? 'pending' : 'not_applicable',
      };

      // Update payment status if refund record was created
      if (refundRecord) {
        if (!booking.payment) {
          booking.payment = { status: 'pending' };
        }
        (booking.payment as any).refundStatus = 'pending';
      }

      await booking.save({ session });

      // ATOMIC: Commit transaction only AFTER both booking cancellation AND refund record are saved
      await session.commitTransaction();

      // Log status transition after successful commit
      logStatusTransition({
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        fromStatus: statusBeforeCancel,
        toStatus: 'cancelled',
        triggeredBy: 'customer',
        reason: data?.reason || 'Cancelled by customer',
        metadata: { refundAmount, refundProcessingTime: '3-5 business days', refundId: refundRecord?._id?.toString() },
        timestamp: new Date().toISOString(),
      });

      // Post-transaction: Trigger async refund processing via webhook/job
      // The refund record exists with 'pending' status - job will pick it up
      if (refundRecord) {
        eventBus.publish(EVENT_TYPES.REFUND_PENDING, {
          refundId: refundRecord._id,
          refundNumber: refundRecord.refundNumber,
          bookingId: booking._id,
          amount: refundAmount,
          stripeChargeId: booking.payment?.transactionId,
          triggeredBy: 'booking_cancellation',
        });
      }
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
      refundId: refundRecord?._id?.toString(),
    });

    return {
      booking: booking as any,
      refundAmount,
      refundProcessingTime: '3-5 business days',
      refundId: refundRecord?._id?.toString(),
    };
  }

  /**
   * Generate unique refund number for cancellation-initiated refunds
   */
  private async generateRefundNumberForCancellation(): Promise<string> {
    const RefundRequest = mongoose.model('RefundRequest');
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const count = await RefundRequest.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `REF-${year}${month}${day}-${sequence}`;
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
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Role validation - only allowed roles can reschedule
    const allowedRoles = ['customer', 'provider', 'admin'];
    if (!allowedRoles.includes(userRole)) {
      throw new ApiError(403, 'Not authorized to reschedule bookings');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // SECURITY FIX: Exclude deleted bookings
    if (booking.deletedAt) {
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
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for provider ID
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

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

      // FIX: Exclude deleted bookings
      if (booking.deletedAt) {
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
  // Report Provider No-Show (Customer Reporting)
  // ========================================

  async reportProviderNoShow(bookingId: string, customerId: string, notes?: string): Promise<any> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new ApiError(400, 'Invalid customer ID');
    }

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

      // FIX: Exclude deleted bookings
      if (booking.deletedAt) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found');
      }

      // Verify customer ownership
      if (!booking.customerId || booking.customerId.toString() !== customerId) {
        await session.abortTransaction();
        throw new ApiError(403, 'Not authorized to report no-show for this booking');
      }

      // Can report no-show if status is 'confirmed' or 'in_progress'
      if (!['confirmed', 'in_progress'].includes(booking.status)) {
        await session.abortTransaction();
        throw new ApiError(400, 'Cannot report provider no-show for this booking. Booking must be confirmed or in progress.');
      }

      // Update booking status to no_show
      booking.status = 'no_show';
      booking.noShowDetails = {
        reportedBy: 'customer',
        reportedAt: new Date(),
        notes: notes || 'Customer reported that provider did not show up',
      };

      // Add to status history
      booking.statusHistory.push({
        status: 'no_show',
        timestamp: new Date(),
        reason: 'Provider no-show reported by customer',
        updatedBy: 'customer',
        notes: notes || 'Customer reported that provider did not show up',
      });

      await booking.save({ session });

      await session.commitTransaction();
      logger.info('Provider no-show reported by customer', {
        context: 'BookingService',
        action: 'PROVIDER_NO_SHOW_REPORTED',
        bookingNumber: booking.bookingNumber,
        customerId,
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
      reportedBy: 'customer',
    });

    // Flag provider for no-show
    await this.flagProviderNoShow(booking.providerId);

    return booking;
  }

  /**
   * Flag provider for no-show behavior
   * Updates provider analytics and may trigger escalation if threshold exceeded
   */
  private async flagProviderNoShow(providerId: mongoose.Types.ObjectId): Promise<void> {
    try {
      // Increment no-show count on provider profile
      const providerProfile = await ProviderProfile.findOneAndUpdate(
        { userId: providerId },
        {
          $inc: { 'analytics.bookingStats.noShowBookings': 1 },
        },
        { new: true }
      );

      if (!providerProfile) {
        logger.warn('Provider profile not found for no-show flagging', {
          providerId: providerId.toString(),
          action: 'NO_SHOW_FLAG_PROVIDER_NOT_FOUND',
        });
        return;
      }

      const noShowCount = providerProfile.analytics?.bookingStats?.noShowBookings || 0;
      logger.info('Provider flagged for no-show', {
        providerId: providerId.toString(),
        noShowCount,
        action: 'PROVIDER_NO_SHOW_FLAGGED',
      });

      // CRITICAL: Flag provider for review if threshold exceeded
      // After 3 no-shows, provider should be flagged for manual review
      if (noShowCount >= 3) {
        await this.escalateProviderNoShow(providerId, noShowCount);
      }
    } catch (error) {
      logger.error('Failed to flag provider for no-show', {
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : String(error),
        action: 'NO_SHOW_FLAG_ERROR',
      });
    }
  }

  /**
   * Escalate provider no-show for admin review
   */
  private async escalateProviderNoShow(providerId: mongoose.Types.ObjectId, noShowCount: number): Promise<void> {
    try {
      // Publish anomaly event for monitoring/alerting
      eventBus.publish(EVENT_TYPES.ANOMALY_DETECTED, {
        anomalyType: 'provider_no_show_pattern',
        providerId: providerId,
        severity: 'high',
        details: {
          noShowCount,
          threshold: 3,
          message: `Provider has ${noShowCount} no-show bookings - exceeds threshold of 3`,
        },
        timestamp: new Date(),
      });

      logger.warn('Provider no-show pattern escalated for admin review', {
        providerId: providerId.toString(),
        noShowCount,
        action: 'PROVIDER_NO_SHOW_ESCALATED',
      });
    } catch (error) {
      logger.error('Failed to escalate provider no-show', {
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : String(error),
        action: 'NO_SHOW_ESCALATION_ERROR',
      });
    }
  }

  // ========================================
  // Add Message
  // ========================================

  async addMessage(bookingId: string, userId: string, data: { message: string }): Promise<number> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    if (!data.message || data.message.trim().length === 0) {
      throw new ApiError(400, 'Message content is required');
    }

    // FIX: Enforce maximum message length to prevent unbounded content
    if (data.message.length > 2000) {
      throw new ApiError(400, 'Message exceeds maximum length of 2000 characters');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // FIX: Exclude deleted bookings (check deletedAt)
    if (booking.deletedAt) {
      throw new ApiError(404, 'Booking not found');
    }

    // SECURITY FIX: Explicit ownership verification with detailed checks
    const isCustomer = booking.customerId && userId === booking.customerId.toString();
    const isProvider = userId === booking.providerId.toString();
    const isAdmin = false; // Admins should not add messages directly

    // Authorization check - only customer or provider can add messages
    if (!isCustomer && !isProvider) {
      throw new ApiError(403, 'Access denied. Only the booking customer or provider can add messages.');
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
  // Get Customer Bookings (Interface Implementation)
  // ========================================

  async getCustomerBookings(
    customerId: string,
    filters?: BookingFiltersDTO,
    options?: { tenantContext?: { tenantId?: string; isAdmin?: boolean }; page?: number; limit?: number }
  ): Promise<{ bookings: any[]; pagination: any }> {
    const page = options?.page || 1;
    // FIX: Enforce maximum pagination limit to prevent excessive queries
    const limit = Math.min(options?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: any = { customerId: new mongoose.Types.ObjectId(customerId), deletedAt: { $exists: false } }; // FIX: Exclude deleted bookings

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }
    if (filters?.search) {
      query.$or = [
        { bookingNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // PERFORMANCE FIX: Use projection to limit fields returned, reducing data transfer
    const projection = {
      bookingNumber: 1,
      status: 1,
      scheduledDate: 1,
      scheduledTime: 1,
      duration: 1,
      pricing: 1,
      customerInfo: 1,
      locationType: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [bookings, total] = await Promise.all([
      Booking.find(query, projection)
        .populate('serviceId', 'name category images')
        .populate('providerId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query)
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    };
  }

  // ========================================
  // Get Booking By ID (Interface Implementation)
  // ========================================

  async getBookingById(bookingId: string, userId: string, userRole: string): Promise<any> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    // PERFORMANCE FIX: Use lean() for better performance and add projection to limit fields
    const booking = await Booking.findById(bookingId, {
      bookingNumber: 1,
      status: 1,
      scheduledDate: 1,
      scheduledTime: 1,
      duration: 1,
      pricing: 1,
      customerInfo: 1,
      location: 1,
      locationType: 1,
      statusHistory: 1,
      providerResponse: 1,
      cancellationPolicy: 1,
      cancellationDetails: 1,
      payment: 1,
      metadata: 1,
      messages: 1,
      isGuestBooking: 1,
      guestInfo: 1,
      createdAt: 1,
      updatedAt: 1,
      completedAt: 1,
      cancelledAt: 1,
    })
      .populate('customerId', 'firstName lastName email phone avatar')
      .populate('providerId', 'firstName lastName email avatar')
      .populate('serviceId', 'name category duration images price');

    if (!booking || (booking as any).deletedAt) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    const isCustomer = (booking as any).customerId?._id?.toString() === userId;
    const isProvider = (booking as any).providerId?._id?.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ApiError(403, 'Access denied');
    }

    return booking;
  }

  // ========================================
  // Get Provider Bookings (Interface Implementation)
  // ========================================

  async getProviderBookings(
    providerId: string,
    filters?: BookingFiltersDTO,
    pagination?: { page?: number; limit?: number }
  ): Promise<{ bookings: any[]; pagination: any }> {
    const page = pagination?.page || 1;
    // FIX: Enforce maximum pagination limit to prevent excessive queries
    const limit = Math.min(pagination?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: any = { providerId: new mongoose.Types.ObjectId(providerId), deletedAt: { $exists: false } }; // FIX: Exclude deleted bookings

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }
    if (filters?.search) {
      query.$or = [
        { bookingNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // PERFORMANCE FIX: Use projection to limit fields returned, reducing data transfer
    const projection = {
      bookingNumber: 1,
      status: 1,
      scheduledDate: 1,
      scheduledTime: 1,
      duration: 1,
      pricing: 1,
      customerInfo: 1,
      locationType: 1,
      location: 1,
      providerResponse: 1,
      statusHistory: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [bookings, total] = await Promise.all([
      Booking.find(query, projection)
        .populate('customerId', 'firstName lastName phone')
        .populate('serviceId', 'name category duration images')
        .sort({ scheduledDate: 1, scheduledTime: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query)
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    };
  }

  // ========================================
  // Accept Booking (Interface Implementation)
  // ========================================

  async acceptBooking(bookingId: string, providerId: string, data?: { notes?: string; estimatedArrival?: string }): Promise<any> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for provider ID
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1. Read booking with session to ensure consistency
      const booking = await Booking.findOne({
        _id: bookingId,
        status: 'pending',
        deletedAt: { $exists: false }
      }).session(session);

      if (!booking) {
        throw new ApiError(404, 'Booking not found or no longer available');
      }

      // 2. Check for time slot conflicts WITHIN transaction (atomic check)
      const conflictResult = await this.checkForTimeSlotConflicts(
        providerId,
        bookingId,
        booking.scheduledDate,
        booking.scheduledTime,
        booking.duration
      );

      if (conflictResult.hasConflict) {
        throw new ApiError(409, 'Time slot conflict with existing booking');
      }

      // 3. Update booking status atomically - only if still 'pending'
      // CRITICAL: This findOneAndUpdate ensures only ONE provider can accept
      const confirmedBooking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: 'pending',
          deletedAt: { $exists: false }
        },
        {
          $set: {
            status: 'confirmed',
            providerId: new mongoose.Types.ObjectId(providerId),
            'providerResponse.notes': data?.notes || undefined,
            'providerResponse.estimatedArrival': data?.estimatedArrival ? new Date(data.estimatedArrival) : undefined
          },
          $push: {
            statusHistory: {
              status: 'confirmed',
              timestamp: new Date(),
              reason: 'Booking accepted by provider',
              updatedBy: 'provider',
              notes: data?.notes
            }
          }
        },
        { new: true, session }
      );

      if (!confirmedBooking) {
        // Another process already accepted this booking
        throw new ApiError(409, 'Booking already accepted by another provider');
      }

      // 4. Create notifications for booking confirmation
      await this.createBookingNotifications(confirmedBooking, 'booking_confirmed');

      // 5. Emit event
      eventBus.publish(EVENT_TYPES.BOOKING_CONFIRMED, {
        bookingId: confirmedBooking._id,
        bookingNumber: confirmedBooking.bookingNumber,
        customerId: confirmedBooking.customerId,
        providerId: confirmedBooking.providerId,
      });

      await session.commitTransaction();
      return confirmedBooking;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      if (session && !session.hasEnded) {
        await session.endSession();
      }
    }
  }

  // ========================================
  // Reject Booking (Interface Implementation)
  // ========================================

  async rejectBooking(bookingId: string, providerId: string, data?: { reason?: string }): Promise<any> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for provider ID
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // FIX: Add explicit ownership verification (same pattern as acceptBooking)
      // FIX: Include deletedAt check in the query to prevent operating on deleted bookings
      const anyBooking = await Booking.findOne({
        _id: bookingId,
        status: 'pending',
        deletedAt: { $exists: false }
      }).session(session).select('_id providerId deletedAt');

      if (!anyBooking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found or already processed');
      }

      // FIX: Explicitly verify requesting provider owns this booking
      if (anyBooking.providerId.toString() !== providerId) {
        await session.abortTransaction();
        throw new ApiError(403, 'Booking does not belong to this provider');
      }

      // FIX: Add explicit isDeleted check to prevent operating on deleted bookings
      const booking = await Booking.findOne({
        _id: bookingId,
        providerId: new mongoose.Types.ObjectId(providerId),
        status: 'pending',
        deletedAt: { $exists: false }
      }).session(session);

      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found or already processed');
      }

      // CRITICAL: Validate state transition
      validateStateTransition(booking.status, 'cancelled');

      booking.status = 'cancelled';
      booking.providerResponse = booking.providerResponse || {};
      booking.providerResponse.rejectionReason = data?.reason || 'Declined by provider';
      // FIX: Provider rejection should trigger full refund (refundAmount = totalAmount)
      // When provider rejects, customer should not lose their payment
      booking.cancellationDetails = {
        cancelledBy: 'provider',
        cancelledAt: new Date(),
        reason: data?.reason || 'Declined by provider',
        refundAmount: booking.pricing?.totalAmount || 0,
        refundStatus: 'pending' as const
      };
      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        reason: data?.reason || 'Booking rejected by provider',
        updatedBy: 'provider'
      });

      await booking.save({ session });

      // ATOMIC: Create refund record INSIDE the transaction before booking cancellation
      // This ensures if booking is cancelled, there is a pending refund record
      if (booking.pricing?.totalAmount && booking.payment?.transactionId) {
        const RefundRequest = mongoose.model('RefundRequest');
        const refundNumber = await this.generateRefundNumberForCancellation();

        const refundRecord = new RefundRequest({
          refundNumber,
          bookingId: booking._id,
          requestedBy: booking.customerId || new mongoose.Types.ObjectId(),
          amount: booking.pricing.totalAmount,
          originalAmount: booking.pricing.totalAmount,
          reason: 'provider_rejection',
          description: data?.reason || 'Declined by provider',
          status: 'pending',
          type: 'full',
          stripeChargeId: booking.payment.transactionId,
          refundPercentage: 100,
          timeline: [{
            action: 'provider_rejection_initiated',
            performedBy: new mongoose.Types.ObjectId(providerId),
            performedByRole: 'provider',
            timestamp: new Date(),
            details: `Full refund of ${booking.pricing.totalAmount} ${booking.pricing.currency || 'AED'} initiated for provider rejection`,
            previousStatus: undefined,
            newStatus: 'pending',
          }],
        });

        await refundRecord.save({ session });

        // Update payment status - use type assertion since payment might not have refundStatus
        if (!booking.payment) {
          booking.payment = { status: 'pending' };
        }
        (booking.payment as any).refundStatus = 'pending';
        await booking.save({ session });
      }

      await session.commitTransaction();
      return booking;

    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ========================================
  // Start Booking (Interface Implementation)
  // ========================================

  async startBooking(bookingId: string, providerId: string): Promise<any> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for provider ID
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // FIX: Add explicit isDeleted check to prevent operating on deleted bookings
      const booking = await Booking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        providerId: new mongoose.Types.ObjectId(providerId),
        status: 'confirmed',
        deletedAt: { $exists: false }
      }).session(session);

      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found or not in confirmed status');
      }

      // CRITICAL: Validate state transition
      validateStateTransition(booking.status, 'in_progress');

      booking.status = 'in_progress';
      booking.providerResponse = booking.providerResponse || {};
      booking.providerResponse.arrivalTime = new Date();
      booking.statusHistory.push({
        status: 'in_progress',
        timestamp: new Date(),
        reason: 'Service started by provider',
        updatedBy: 'provider'
      });

      await booking.save({ session });

      await session.commitTransaction();

      // Create booking_started notification for both customer and provider
      await this.createBookingNotifications(booking, 'booking_started');

      eventBus.publish(EVENT_TYPES.BOOKING_STARTED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
      });

      return booking;

    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ========================================
  // Complete Booking (Interface Implementation)
  // ========================================

  async completeBooking(bookingId: string, providerId: string, data?: { notes?: string; actualDuration?: number }): Promise<any> {
    // SECURITY FIX: Input validation for booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    // SECURITY FIX: Input validation for provider ID
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // FIX: Add explicit isDeleted check to prevent operating on deleted bookings
      const booking = await Booking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        providerId: new mongoose.Types.ObjectId(providerId),
        status: 'in_progress',
        deletedAt: { $exists: false }
      }).session(session);

      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found or not in progress');
      }

      // CRITICAL: Validate state transition
      validateStateTransition(booking.status, 'completed');

      booking.status = 'completed';
      booking.providerResponse = booking.providerResponse || {};
      booking.providerResponse.completedAt = new Date();
      if (data?.notes) booking.providerResponse.notes = data.notes;
      booking.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        reason: 'Service completed by provider',
        updatedBy: 'provider',
        notes: data?.notes
      });

      await booking.save({ session });

      await session.commitTransaction();

      // CRITICAL FIX: Process booking completion - add provider earnings to pending balance
      // This is done outside the transaction since it may involve external services (Stripe, etc.)
      try {
        const { processBookingCompletion } = require('./settlement.service');
        const settlementResult = await processBookingCompletion(bookingId);

        if (!settlementResult.success) {
          logger.warn('Booking completion processed but settlement skipped', {
            bookingId,
            action: 'SETTLEMENT_SKIPPED',
          });
        } else {
          logger.info('Booking completion settlement processed', {
            bookingId,
            settlementId: settlementResult.settlementId,
            providerEarnings: settlementResult.providerEarnings,
            commission: settlementResult.commission,
            action: 'SETTLEMENT_PROCESSED',
          });
        }
      } catch (settlementError) {
        // Log error but don't fail the booking completion
        logger.error('Failed to process booking settlement', {
          bookingId,
          error: settlementError instanceof Error ? settlementError.message : String(settlementError),
          action: 'SETTLEMENT_ERROR',
        });
      }

      eventBus.publish(EVENT_TYPES.BOOKING_COMPLETED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
        totalAmount: booking.pricing?.totalAmount,
      });

      return booking;

    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ========================================
  // Create Guest Booking (Interface Implementation)
  // ========================================

  async createGuestBooking(data: GuestBookingInputDTO): Promise<any> {
    // Guest bookings use guestInfo instead of customerInfo
    // Create the booking with guest info
    const result = await this.createCustomerBooking('guest', {
      ...data,
      customerInfo: {
        firstName: data.guestInfo.name.split(' ')[0] || data.guestInfo.name,
        lastName: data.guestInfo.name.split(' ').slice(1).join(' ') || '',
        email: data.guestInfo.email,
        phone: data.guestInfo.phone
      }
    } as any);

    // Return guest-specific result
    return {
      booking: {
        bookingNumber: result.booking.bookingNumber,
        status: result.booking.status,
        scheduledDate: result.booking.scheduledDate,
        scheduledTime: result.booking.scheduledTime,
        duration: result.booking.duration,
        pricing: result.booking.pricing,
        guestInfo: data.guestInfo
      },
      trackingUrl: `/track/${result.booking.bookingNumber}`
    };
  }

  // ========================================
  // Track Booking (Interface Implementation)
  // ========================================

  async trackBooking(bookingNumber: string): Promise<any> {
    const booking = await Booking.findOne({ bookingNumber, deletedAt: { $exists: false } }) // FIX: Exclude deleted bookings
      .populate('serviceId', 'name category subcategory images')
      .populate('providerId', 'firstName lastName businessInfo phone');

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      statusHistory: booking.statusHistory || [],
      service: booking.serviceId ? {
        name: (booking.serviceId as any).name,
        category: (booking.serviceId as any).category,
        subcategory: (booking.serviceId as any).subcategory,
        image: (booking.serviceId as any).images?.[0]
      } : undefined,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      provider: booking.providerId ? {
        name: `${(booking.providerId as any).firstName} ${(booking.providerId as any).lastName}`,
        businessName: (booking.providerId as any).businessInfo?.businessName,
        phone: (booking.providerId as any).phone
      } : undefined
    };
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Calculate pricing for a booking
   * SECURITY FIX: All prices are calculated server-side, client prices are NEVER trusted
   * This prevents price manipulation attacks
   */
  private calculatePricing(service: any, addOns?: any[], selectedDuration?: number): any {
    // CRITICAL: Server-side price calculation - NEVER trust client prices
    // Validate service exists and is active
    if (!service || !service.isActive) {
      throw new ApiError(400, 'Service is not available');
    }

    let bookingDuration = service.duration;
    // FIX: Use database price, NEVER client-provided price
    let basePrice = service.price?.amount;

    // FIX: Validate price is a positive number (prevent manipulation)
    if (typeof basePrice !== 'number' || basePrice < 0) {
      throw new ApiError(400, 'Invalid service price');
    }

    // FIX: Enforce decimal precision (max 2 decimal places for currency)
    basePrice = Math.round(basePrice * 100) / 100;

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
      // FIX: Validate each add-on price
      for (const addOn of addOns) {
        if (typeof addOn.price !== 'number' || addOn.price < 0) {
          throw new ApiError(400, 'Invalid add-on price');
        }
        // FIX: Enforce decimal precision
        addOnTotal += Math.round(addOn.price * 100) / 100;
      }
    }

    // FIX: Enforce decimal precision throughout
    const subtotal = Math.round((basePrice + addOnTotal) * 100) / 100;
    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% UAE VAT
    const totalAmount = Math.round((subtotal + tax) * 100) / 100;
    const currency = service.price?.currency || 'AED';

    // FIX: Validate currency is allowed
    const allowedCurrencies = ['AED', 'USD', 'INR', 'EUR', 'GBP'];
    if (!allowedCurrencies.includes(currency)) {
      throw new ApiError(400, 'Invalid currency');
    }

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
      // Build notification data
      const customerNotificationData = booking.customerId ? {
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
      } : null;

      const providerNotificationData = {
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
      };

      // Create notifications in parallel
      const notificationsToCreate = [
        customerNotificationData,
        providerNotificationData,
      ].filter(Boolean);

      await Promise.all(
        notificationsToCreate.map(data =>
          new BookingNotification(data!).save()
        )
      );
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
      booking_no_show: { customer: 'Booking Marked as No-Show', provider: 'Customer No-Show Marked' },
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
      booking_no_show: {
        customer: 'Your booking has been marked as a no-show.',
        provider: 'The customer has been marked as a no-show.',
      },
    };
    return messages[type]?.[recipient] || 'Your booking has been updated.';
  }

  private async updateProviderAnalytics(providerId: any): Promise<void> {
    try {
      const providerObjectId = providerId instanceof mongoose.Types.ObjectId
        ? providerId
        : new mongoose.Types.ObjectId(providerId);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // PERFORMANCE FIX: Single aggregation pipeline to get all stats at once
      // This replaces multiple sequential queries with 1 efficient pipeline
      const [analyticsStats] = await Promise.all([
        Booking.aggregate([
          { $match: { providerId: providerObjectId } },
          {
            $facet: {
              // Status breakdown and total bookings
              statusStats: [
                { $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                }},
              ],
              // Unique customers and customer bookings
              customerStats: [
                { $match: { customerId: { $exists: true, $ne: null } } },
                { $group: {
                  _id: null,
                  uniqueCustomers: { $addToSet: '$customerId' },
                  totalCustomerBookings: { $sum: 1 },
                }},
                { $project: {
                  _id: 0,
                  uniqueCustomers: { $size: {
                    $filter: {
                      input: '$uniqueCustomers',
                      as: 'cid',
                      cond: { $ne: ['$$cid', null] }
                    }
                  }},
                  totalCustomerBookings: 1,
                }},
              ],
              // Revenue stats (completed bookings)
              revenueStats: [
                { $match: { status: 'completed' } },
                { $group: {
                  _id: null,
                  totalRevenue: { $sum: '$pricing.totalAmount' },
                  avgValue: { $avg: '$pricing.totalAmount' },
                  count: { $sum: 1 },
                }},
              ],
              // Monthly revenue (completed in current month)
              monthlyStats: [
                { $match: {
                  status: 'completed',
                  completedAt: { $gte: startOfMonth },
                }},
                { $group: {
                  _id: null,
                  monthlyEarnings: { $sum: '$pricing.totalAmount' },
                }},
              ],
            },
          },
        ]),
      ]);

      // Extract results from facet
      const result = analyticsStats[0] || {};
      const statusStats: Array<{_id: string; count: number}> = result.statusStats || [];
      const customerData = result.customerStats?.[0] || { uniqueCustomers: 0, totalCustomerBookings: 0 };
      const revenueData = result.revenueStats?.[0] || { totalRevenue: 0, avgValue: 0, count: 0 };
      const monthlyData = result.monthlyStats?.[0] || { monthlyEarnings: 0 };

      // Process status stats
      const statusMap = new Map<string, number>(statusStats.map((s) => [s._id, s.count]));
      const totalBookings = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);
      const completedBookings = statusMap.get('completed') || 0;
      const cancelledBookings = statusMap.get('cancelled') || 0;
      const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

      // Process customer stats
      const uniqueCustomers = customerData.uniqueCustomers || 0;
      const totalCustomerBookings = customerData.totalCustomerBookings || 0;
      const repeatCustomers = Math.max(0, totalCustomerBookings - uniqueCustomers);
      const repeatCustomerRate = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;

      // Process revenue stats
      const totalEarnings = revenueData.totalRevenue || 0;
      const averageBookingValue = Math.round(revenueData.avgValue || 0);
      const currentMonthEarnings = monthlyData.monthlyEarnings || 0;

      await ProviderProfile.findOneAndUpdate(
        { userId: providerId },
        {
          $set: {
            'analytics.bookingStats.totalBookings': totalBookings,
            'analytics.bookingStats.completedBookings': completedBookings,
            'analytics.bookingStats.cancelledBookings': cancelledBookings,
            'analytics.bookingStats.repeatCustomerRate': repeatCustomerRate,
            'analytics.bookingStats.averageBookingValue': averageBookingValue,
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

  // ========================================
  // Slot Lock Heartbeat (For Long Checkouts)
  // ========================================

  /**
   * Extend slot lock TTL to prevent expiration during long checkout processes
   * Call this periodically during payment flow to keep the slot reserved
   *
   * @param bookingId - The booking ID to extend the lock for
   * @param sessionId - The session ID that originally acquired the lock
   * @returns true if lock was extended, false if lock expired or doesn't exist
   */
  async extendSlotLockHeartbeat(bookingId: string, sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const booking = await Booking.findById(bookingId).select('_id providerId scheduledDate scheduledTime');
      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      const extended = await extendSlotLock(
        booking.providerId.toString(),
        booking.scheduledDate,
        booking.scheduledTime,
        sessionId,
        SLOT_LOCK_TTL_SECONDS // Reset to full TTL
      );

      if (extended) {
        logger.debug('Slot lock heartbeat successful', {
          bookingId,
          sessionId,
          action: 'SLOT_HEARTBEAT_SUCCESS',
        });
        return { success: true, message: 'Lock extended' };
      } else {
        logger.warn('Slot lock heartbeat failed - lock expired or belongs to another session', {
          bookingId,
          sessionId,
          action: 'SLOT_HEARTBEAT_FAILED',
        });
        return { success: false, message: 'Lock expired or session mismatch' };
      }
    } catch (error) {
      logger.error('Slot lock heartbeat error', {
        bookingId,
        sessionId,
        error: (error as Error).message,
        action: 'SLOT_HEARTBEAT_ERROR',
      });
      return { success: false, message: 'Internal error' };
    }
  }
}

// Export singleton instance
export const bookingService = new BookingService();
