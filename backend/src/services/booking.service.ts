import mongoose from 'mongoose';
import crypto from 'crypto';
import Booking from '../models/booking.model';
import BookingNotification from '../models/bookingNotification.model';
import { notificationService } from './notification.service';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import { validateProviderSlotAvailability } from '../utils/availabilityHelper';
import { eventBus, EVENT_TYPES } from '../event-bus';
import logger from '../utils/logger';
import { enrichBookingLocation } from './bookingLocation.service';
import { addTenantFilter, getTenantContext } from '../utils/tenantFilter';
import { applyTenantToBookingQuery } from '../utils/tenantBookingQuery';
import { cache, isCacheRedisReady, isRedisAvailable } from '../config/redis';
import { DEFAULT_MONGO_TRANSACTION_OPTIONS } from '../config/database';
import { calculateCommission, getCommissionRate, DEFAULT_PLATFORM_FEE_CONFIG } from './settlement.service';
import { getSocketServer } from '../socket';
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
import {
  getPlatformPolicySync,
  getScheduleSurchargePercent,
  calculateTaxAmount,
  getEffectiveBufferMinutes,
} from './platformSettingsPolicy.service';
import { OfferService } from './offer.service';

// ============================================
// Slot Locking Constants
// ============================================
const SLOT_LOCK_TTL_SECONDS = 120; // 2 minute TTL for slot locks (prevents stale locks)
const SLOT_LOCK_COOLDOWN_SECONDS = 2; // 2 second cooldown after lock release
const SLOT_LOCK_PREFIX = 'slot:lock:';
const SLOT_COOLDOWN_PREFIX = 'slot:cooldown:';
// Maximum time a lock should ever be held (even with extensions)
const MAX_LOCK_HOLD_TIME_MS = SLOT_LOCK_TTL_SECONDS * 1000;

interface SlotLockResult {
  acquired: boolean;
  lockKey?: string;
  expiresIn?: number;
  reason?: string;
  retryAfterSeconds?: number;
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
 * NOTE: For production use, consider using DOMPurify for more comprehensive sanitization
 * DOMPurify can be installed via: npm install dompurify
 * and used as: import DOMPurify from 'dompurify'; return DOMPurify.sanitize(input);
 */
function stripHtmlTags(input: string): string {
  if (!input) return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Prevent iframe injection
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Prevent object embedding
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<^<]*)*/gi, '') // Prevent embed tags
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\s+on\w+\s*=/gi, ' ') // Handle spaces around event handlers
    .trim();
}

/**
 * Get cancellation window hours from settings (default: 24)
 */
async function getCancellationWindowHours(): Promise<number> {
  return getPlatformPolicySync().cancellationWindowHours;
}

function isGuestBookingCustomer(customerId: string): boolean {
  return customerId === 'guest' || !mongoose.Types.ObjectId.isValid(customerId);
}

async function assertBookingPolicy(
  customerId: string,
  data: {
    scheduledDate: string | Date;
    scheduledTime: string;
    providerId: string;
    guestEmail?: string;
  }
): Promise<void> {
  const policy = getPlatformPolicySync();

  const requestedDate = new Date(data.scheduledDate);
  const [hours, minutes] = data.scheduledTime.split(':').map(Number);
  const serviceStart = new Date(requestedDate);
  serviceStart.setHours(hours, minutes, 0, 0);

  const now = new Date();
  const hoursUntil = (serviceStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil < policy.minBookingAdvanceHours) {
    throw new ApiError(
      400,
      `Bookings must be scheduled at least ${policy.minBookingAdvanceHours} hours in advance`
    );
  }

  const daysUntil = hoursUntil / 24;
  if (daysUntil > policy.maxBookingAdvanceDays) {
    throw new ApiError(
      400,
      `Bookings cannot be scheduled more than ${policy.maxBookingAdvanceDays} days in advance`
    );
  }

  const startOfDay = new Date(requestedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedDate);
  endOfDay.setHours(23, 59, 59, 999);

  let dailyCount = 0;

  if (isGuestBookingCustomer(customerId)) {
    if (data.guestEmail) {
      dailyCount = await Booking.countDocuments({
        isGuestBooking: true,
        'guestInfo.email': data.guestEmail.toLowerCase().trim(),
        scheduledDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['cancelled', 'failed'] },
        deletedAt: { $exists: false },
      });
    }
  } else {
    dailyCount = await Booking.countDocuments({
      customerId,
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled', 'failed'] },
      deletedAt: { $exists: false },
    });
  }

  if (dailyCount >= policy.maxDailyBookings) {
    throw new ApiError(
      400,
      `You have reached the maximum of ${policy.maxDailyBookings} bookings per day`
    );
  }

  // Service instantBooking only affects auto-confirm via resolveInitialBookingStatus.
  // Scheduled future bookings must still be allowed when platform instant booking is off.
}

function resolveInitialBookingStatus(
  service: { availability?: { instantBooking?: boolean } }
): 'pending' | 'confirmed' {
  const policy = getPlatformPolicySync();
  if (policy.autoConfirmEnabled) return 'confirmed';
  if (policy.instantBooking && service?.availability?.instantBooking) return 'confirmed';
  return 'pending';
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
 * Re-acquire or extend a lock when the same session already owns it.
 * Used for retries and parallel duplicate requests from the same checkout session.
 */
async function tryReacquireIfOwner(
  redisClient: any,
  lockKey: string,
  sessionId: string,
  lockValue: string
): Promise<boolean> {
  try {
    const existingLockRaw = await redisClient.get(lockKey);
    if (!existingLockRaw) return false;

    const existingLock = JSON.parse(existingLockRaw);
    if (existingLock.sessionId === sessionId) {
      await redisClient.setex(lockKey, SLOT_LOCK_TTL_SECONDS, lockValue);
      logger.info('Slot lock re-acquired by same session', {
        action: 'SLOT_LOCK_REACQUIRED',
        lockKey,
        sessionId,
        ttl: SLOT_LOCK_TTL_SECONDS,
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Clean up stale locks from crashed sessions
 * Checks if lock timestamp is too old and removes it
 */
async function cleanupStaleLock(lockKey: string, redisClient: any): Promise<boolean> {
  try {
    const lockValue = await redisClient.get(lockKey);
    if (!lockValue) return false; // Lock doesn't exist

    const parsed = JSON.parse(lockValue);
    const lockAge = Date.now() - parsed.lockedAt;

    // If lock is older than TTL, it's stale (orphaned from crashed sessions)
    if (lockAge > MAX_LOCK_HOLD_TIME_MS) {
      logger.warn('Removing stale lock', { lockKey, lockAge, lockedAt: new Date(parsed.lockedAt) });
      await redisClient.del(lockKey);
      return true; // Lock was stale and removed
    }
    return false; // Lock is still valid
  } catch (err) {
    logger.error('Error cleaning up stale lock', { lockKey, error: err });
    return false;
  }
}

/**
 * Acquire a Redis-based lock for a time slot during checkout
 * Uses SET NX (set if not exists) with TTL for atomic lock acquisition
 * Automatically cleans up stale locks before attempting acquisition
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
    const redisReady = await isCacheRedisReady();
    if (!redisReady) {
      // SECURITY: Fail closed when Redis is unavailable
      logger.error('Redis unavailable for slot lock, failing closed', {
        action: 'SLOT_LOCK_REDIS_UNAVAILABLE',
        providerId,
        scheduledDate,
        scheduledTime,
      });
      return {
        acquired: false,
        reason: 'Booking is temporarily unavailable. Please wait a moment and try again.',
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
        reason: 'Booking is temporarily unavailable. Please wait a moment and try again.',
      };
    }

    // CRITICAL FIX: Clean up stale locks before attempting to acquire
    // This handles cases where a previous session crashed and left an orphaned lock
    await cleanupStaleLock(lockKey, redisClient);

    const lockValue = JSON.stringify({
      sessionId,
      lockedAt: Date.now(),
    });

    // Re-entrant acquire: same session can reclaim/extend its own lock (retry after failure)
    if (await tryReacquireIfOwner(redisClient, lockKey, sessionId, lockValue)) {
      return {
        acquired: true,
        lockKey,
        expiresIn: SLOT_LOCK_TTL_SECONDS,
      };
    }

    // Use SET with NX (only set if not exists) and EX (expire in seconds)
    // This is atomic - prevents race conditions in lock acquisition
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
      // NX failed — often a parallel duplicate request from the same session (double-click)
      if (await tryReacquireIfOwner(redisClient, lockKey, sessionId, lockValue)) {
        return {
          acquired: true,
          lockKey,
          expiresIn: SLOT_LOCK_TTL_SECONDS,
        };
      }

      // Lock held by a different session
      let retryAfterSeconds = SLOT_LOCK_TTL_SECONDS;
      try {
        const ttl = await redisClient.ttl(lockKey);
        if (typeof ttl === 'number' && ttl > 0) {
          retryAfterSeconds = ttl;
        }
      } catch {
        // Use default TTL estimate
      }
      logger.warn('Slot lock acquisition failed - slot already locked', {
        action: 'SLOT_LOCK_CONFLICT',
        lockKey,
        requestedBy: sessionId,
        retryAfterSeconds,
      });
      return {
        acquired: false,
        reason: 'This time slot is currently being booked. Please wait a moment and try again.',
        retryAfterSeconds,
      };
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
      reason: 'Booking is temporarily unavailable. Please wait a moment and try again.',
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
  sessionId: string,
  options?: { skipCooldown?: boolean }
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
        skipCooldown: options?.skipCooldown === true,
      });

      // Cooldown only after failed/aborted checkout — not after successful booking
      if (!options?.skipCooldown) {
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
      }

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
    const bufferTime = getEffectiveBufferMinutes(providerProfile?.availability?.bufferTime);

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
    const normalizedCustomerId = String(customerId ?? '').trim();
    const isGuestBooking = isGuestBookingCustomer(normalizedCustomerId);
    const rawGuestInfo = (data as GuestBookingInputDTO).guestInfo;
    const guestInfo = rawGuestInfo
      ? {
          name: rawGuestInfo.name.trim(),
          email: rawGuestInfo.email.toLowerCase().trim(),
          phone: rawGuestInfo.phone.trim(),
        }
      : undefined;

    if (isGuestBooking && !guestInfo?.phone) {
      throw new ApiError(400, 'Phone number is required for guest bookings');
    }

    let resolvedCustomerInfo = { ...data.customerInfo };
    if (!isGuestBooking) {
      const customer = await User.findById(normalizedCustomerId)
        .select('firstName lastName email phone')
        .lean();
      if (customer) {
        resolvedCustomerInfo = {
          firstName: resolvedCustomerInfo?.firstName || customer.firstName || '',
          lastName: resolvedCustomerInfo?.lastName || customer.lastName || '',
          email: resolvedCustomerInfo?.email || customer.email || '',
          phone: resolvedCustomerInfo?.phone || customer.phone || '',
          specialRequests: resolvedCustomerInfo?.specialRequests,
          accessInstructions: resolvedCustomerInfo?.accessInstructions,
        };
      }
    }

    const { getPlatformPolicySync } = await import('./platformSettingsPolicy.service');
    const {
      assignMarketplaceProvider,
      validateProviderForService,
    } = await import('./providerAssignment.service');

    let resolvedProviderId = data.providerId;
    let assignmentMeta: Record<string, unknown> = {};

    if (!resolvedProviderId) {
      const policy = getPlatformPolicySync();
      if (!policy.autoAssignmentEnabled) {
        throw new ApiError(400, 'Provider is required when auto-assignment is disabled');
      }
      const serviceForDuration = await Service.findById(data.serviceId).select('duration').lean();
      const assignment = await assignMarketplaceProvider({
        serviceId: data.serviceId,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        serviceDurationMinutes: data.selectedDuration || serviceForDuration?.duration,
        professionalPreference: data.professionalPreference,
      });
      resolvedProviderId = assignment.providerId;
      assignmentMeta = {
        assignmentMethod: assignment.assignmentMethod,
        assignmentCandidateCount: assignment.assignmentCandidateCount,
      };
    } else {
      await validateProviderForService(data.serviceId, resolvedProviderId);
      assignmentMeta = { assignmentMethod: 'manual' };
    }

    data.providerId = resolvedProviderId;
    data.metadata = {
      ...data.metadata,
      ...assignmentMeta,
    };

    // Stable lock owner: same client session can re-acquire lock on retry
    const lockOwnerId =
      data.metadata?.sessionId ||
      data.metadata?.idempotencyKey ||
      crypto.randomUUID();

    // SECURITY FIX: Idempotency check - prevent duplicate bookings from retry
    // CRITICAL FIX: Generate server-side idempotency key if not provided
    const clientIdempotencyKey = data.metadata?.idempotencyKey;
    const idempotencyKey = clientIdempotencyKey || crypto.randomUUID();

    // Always store idempotency key in metadata for tracking
    // FIX: Handle guest bookings where customerId is 'guest' (not a valid ObjectId)
    // Also filter by serviceId to ensure idempotency is service-specific
    const existingBookingQuery: any = {
      'metadata.idempotencyKey': idempotencyKey,
      serviceId: data.serviceId, // Add serviceId to prevent cross-service collision
      status: { $nin: ['failed', 'cancelled'] },
      deletedAt: { $exists: false }
    };
    // Only add customerId filter for actual customers, not guests
    if (!isGuestBooking) {
      existingBookingQuery.customerId = normalizedCustomerId;
    }
    const existingBooking = await Booking.findOne(existingBookingQuery);
    if (existingBooking) {
      const existingDateStr =
        existingBooking.scheduledDate instanceof Date
          ? existingBooking.scheduledDate.toISOString().split('T')[0]
          : String(existingBooking.scheduledDate).split('T')[0];
      const requestDateStr = String(data.scheduledDate).split('T')[0];
      const existingCoupon = (
        existingBooking.couponReservation?.couponCode ||
        existingBooking.pricing?.discounts?.find((d) => d.type === 'coupon')?.code ||
        ''
      ).toUpperCase();
      const requestCoupon = (data.couponCode || '').toUpperCase();
      const payloadMatches =
        existingDateStr === requestDateStr &&
        existingBooking.scheduledTime === data.scheduledTime &&
        existingCoupon === requestCoupon;

      if (payloadMatches) {
        logger.info('Duplicate booking request detected', {
          bookingId: existingBooking._id.toString(),
          idempotencyKey,
          wasClientProvided: !!clientIdempotencyKey,
        });
        return {
          booking: existingBooking,
          message: 'Booking already exists',
          isDuplicate: true,
        };
      }

      logger.warn('Idempotency key reused with different booking payload — creating new booking', {
        bookingId: existingBooking._id.toString(),
        idempotencyKey,
        existingDate: existingDateStr,
        existingTime: existingBooking.scheduledTime,
        existingCoupon,
        requestDate: requestDateStr,
        requestTime: data.scheduledTime,
        requestCoupon,
      });
    }

    // RACE CONDITION FIX: Pre-validate coupon BEFORE acquiring lock to prevent holding lock during external calls
    let preValidatedCouponDiscount = 0;
    let preValidatedCouponCode = data.couponCode;
    logger.info('Booking service received couponCode', {
      context: 'BookingService',
      couponCode: preValidatedCouponCode,
      serviceId: data.serviceId,
    });
    if (preValidatedCouponCode && isGuestBooking) {
      throw new ApiError(400, 'Coupon codes cannot be applied to guest bookings. Please sign in to use a promo code.');
    }
    if (preValidatedCouponCode) {
      try {
        const { OfferService } = await import("./offer.service");
        const offerService = new OfferService();
        // First get base pricing to check for existing discounts
        const tempService = await Service.findById(data.serviceId);
        if (tempService) {
          const tempPricing = this.calculatePricing(
            tempService,
            data.addOns,
            data.selectedDuration,
            undefined,
            data.metadata
          );
          logger.info('Coupon validation pricing info', {
            context: 'BookingService',
            couponCode: preValidatedCouponCode,
            tempPricingSubtotal: tempPricing.subtotal,
            tempPricingTotal: tempPricing.totalAmount,
          });
          // Check for existing discounts to prevent coupon stacking
          if (tempPricing.discounts && tempPricing.discounts.length > 0) {
            throw new ApiError(400, 'Only one coupon can be applied per booking');
          }
          // Validate coupon against total amount
          const validation = await offerService.validatePromoCode(
            preValidatedCouponCode,
            normalizedCustomerId,
            tempPricing.totalAmount,
            data.serviceId,
            tempService.category?.toString?.() ?? (tempService.category as string | undefined),
            data.providerId
          );
          logger.info('Coupon validation result', {
            context: 'BookingService',
            couponCode: preValidatedCouponCode,
            validationValid: validation.valid,
            validationDiscount: validation.discountAmount,
            validationMessage: validation.message,
          });
          if (validation.valid && validation.discountAmount) {
            preValidatedCouponDiscount = validation.discountAmount;
          } else if (!validation.valid) {
            throw new ApiError(400, validation.message || 'Invalid or expired promo code');
          }
        } else {
          logger.warn('Coupon service not found for validation', {
            context: 'BookingService',
            couponCode: preValidatedCouponCode,
            serviceId: data.serviceId,
          });
        }
      } catch (error) {
        if (error instanceof ApiError) throw error; // Re-throw our ApiError
        logger.error('Coupon pre-validation error', {
          context: 'BookingService',
          action: 'COUPON_PRE_VALIDATION_ERROR',
          customerId: normalizedCustomerId,
          couponCode: preValidatedCouponCode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // DEBUG: Log final coupon discount
    logger.info('Final coupon discount values', {
      context: 'BookingService',
      couponCode: preValidatedCouponCode,
      couponDiscount: preValidatedCouponDiscount,
    });

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
      const conflictError = new ApiError(
        409,
        lockResult.reason ||
          'This time slot is currently being booked by another user. Please select a different time or try again.'
      );
      conflictError.data = {
        retryAfterSeconds: lockResult.retryAfterSeconds ?? SLOT_LOCK_TTL_SECONDS,
        errorCode: 'SLOT_LOCK_CONFLICT',
      };
      throw conflictError;
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

    // Verification lives on ProviderProfile (not User) — align with auth.middleware / marketplace
    const providerProfile = await ProviderProfile.findOne({
      userId: data.providerId,
      isDeleted: { $ne: true },
    }).select('verificationStatus.overall isActive');

    if (!providerProfile) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(403, 'Provider profile not found');
    }

    const verificationOverall = providerProfile.verificationStatus?.overall;

    if (verificationOverall === 'suspended') {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(403, 'Provider account is suspended');
    }

    const isVerified =
      verificationOverall === 'approved' || verificationOverall === 'verified';

    if (!isVerified) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(403, 'Provider is not verified to receive bookings');
    }

    if (providerProfile.isActive === false) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(403, 'Provider is not active');
    }

    const requestedDate = new Date(data.scheduledDate);

    await assertBookingPolicy(normalizedCustomerId, {
      ...data,
      providerId: resolvedProviderId,
      guestEmail: guestInfo?.email,
    });

    // Calculate pricing (done outside transaction - read-only operation)
    const pricing = this.calculatePricing(
      service,
      data.addOns,
      data.selectedDuration,
      requestedDate,
      data.metadata
    );

    // RACE CONDITION FIX: Re-validate within lock context to ensure atomicity
    // If coupon was pre-validated, re-check pricing.discounts is still empty
    if (preValidatedCouponCode && pricing.discounts && pricing.discounts.length > 0) {
      await releaseSlotLock(data.providerId, data.scheduledDate, data.scheduledTime, lockOwnerId);
      throw new ApiError(400, 'Only one coupon can be applied per booking');
    }

    // Use pre-validated coupon values (validated BEFORE lock acquisition)
    const couponDiscount = preValidatedCouponDiscount;
    const couponCode = preValidatedCouponCode;

    // FIX: Properly apply coupon discount BEFORE tax calculation
    // Tax should be calculated on the discounted subtotal, not the full subtotal
    const discountedSubtotal = couponDiscount > 0 ? Math.max(0, pricing.subtotal - couponDiscount) : pricing.subtotal;
    const policy = getPlatformPolicySync();
    const discountedTax = calculateTaxAmount(discountedSubtotal, policy);
    const finalTotalAmount = Math.round((discountedSubtotal + discountedTax) * 100) / 100;

    // Calculate times
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(requestedDate);
    serviceStart.setHours(hours, minutes, 0, 0);
    const estimatedEndTime = new Date(serviceStart.getTime() + (pricing.bookingDuration * 60 * 1000));
    const cancellationWindowHours = await getCancellationWindowHours();
    const cancellationDeadline = new Date(serviceStart.getTime() - cancellationWindowHours * 60 * 60 * 1000);

    // Process and enrich location from booking input + customer/provider profiles
    const processedLocation = await enrichBookingLocation(
      isGuestBooking ? undefined : normalizedCustomerId,
      data.providerId,
      data.location,
      data.locationType
    );

    // Create booking object (will be saved within transaction)
    const bookingData: Record<string, unknown> = {
      bookingNumber,
      ...(isGuestBooking ? {} : { customerId: normalizedCustomerId }),
      isGuestBooking: Boolean(isGuestBooking),
      ...(isGuestBooking && guestInfo ? { guestInfo } : {}),
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
        tax: discountedTax, // FIX: Use tax calculated on discounted subtotal
        totalAmount: finalTotalAmount, // FIX: Use corrected total
        couponDiscount: couponDiscount,
        currency: pricing.currency,
      },
      customerInfo: {
        firstName: resolvedCustomerInfo?.firstName || '',
        lastName: resolvedCustomerInfo?.lastName || '',
        email: resolvedCustomerInfo?.email || '',
        phone: resolvedCustomerInfo?.phone || '',
        specialRequests: stripHtmlTags(resolvedCustomerInfo?.specialRequests || data.specialRequests || ''),
        accessInstructions: stripHtmlTags(resolvedCustomerInfo?.accessInstructions || ''),
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
      status: resolveInitialBookingStatus(service),
    };

    if (data.tenantId && mongoose.Types.ObjectId.isValid(data.tenantId)) {
      bookingData.tenantId = new mongoose.Types.ObjectId(data.tenantId);
    }

    // Use transaction to prevent race condition (TOCTOU vulnerability fix)
    // The partial unique index on (providerId, scheduledDate, scheduledTime, status)
    // will reject duplicate bookings at the database level
    const session = await mongoose.startSession();
    let booking: any;

    logSagaStep(bookingNumber, bookingNumber, 'booking_creation', 'started');

    try {
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

      // Re-validate availability within transaction to ensure consistency
      const availabilityResult = await validateProviderSlotAvailability({
        providerId: data.providerId,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        serviceDurationMinutes: pricing.bookingDuration,
        serviceId: data.serviceId,
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

      // FIX: Reserve coupon at booking creation (NOT mark as used)
      // Coupon will be marked as used only after successful payment
      // If payment fails, the reservation will be released
      // Store coupon info on booking for later use
      if (couponCode && couponDiscount > 0 && !isGuestBooking) {
        booking.couponReservation = {
          couponCode,
          userId: normalizedCustomerId,
          reservedAt: new Date(),
        };
        await booking.save({ session });
      }

      await session.commitTransaction();

      // Cash bookings: redeem coupon immediately (no Stripe webhook)
      if (
        couponCode &&
        couponDiscount > 0 &&
        !isGuestBooking &&
        data.paymentMethod === 'cash' &&
        booking.couponReservation &&
        !booking.couponReservation.usedAt
      ) {
        try {
          const redeemSession = await mongoose.startSession();
          await redeemSession.withTransaction(async () => {
            const { OfferService } = await import('./offer.service');
            const offerService = new OfferService();
            const marked = await offerService.markCouponAsUsedAtomic(
              couponCode,
              normalizedCustomerId,
              booking._id.toString(),
              redeemSession,
              couponDiscount
            );
            if (marked) {
              booking.couponReservation!.usedAt = new Date();
              await booking.save({ session: redeemSession });
            }
          });
          redeemSession.endSession();
        } catch (redeemError) {
          logger.error('Cash booking coupon redemption failed', {
            context: 'BookingService',
            bookingId: booking._id.toString(),
            couponCode,
            error: redeemError instanceof Error ? redeemError.message : String(redeemError),
          });
        }
      }

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

    void this.syncProviderAnalytics(booking.providerId);

    // Release lock after successful booking so the slot is not blocked for 120s
    await releaseSlotLock(
      data.providerId,
      data.scheduledDate,
      data.scheduledTime,
      lockOwnerId,
      { skipCooldown: true }
    );

    return {
      booking,
      message: 'Booking created successfully',
    };
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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

      // Find booking within transaction to prevent race condition
      booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found');
      }

      // Cross-tenant IDOR prevention: The booking was fetched using tenant-filtered queries
      // in the controller layer. If we reach here with a valid booking from a different tenant,
      // it means the original query didn't include tenant filtering.
      // Note: For guest bookings, we rely on the email/token verification above.
      // For authenticated users, the controller's query already filters by customerId + tenant.

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

      // FIX: Handle coupon rollback when booking is cancelled
      // If coupon was marked as used (payment succeeded), we need to rollback the usage
      // If coupon was just reserved (payment never happened), we just clear the reservation
      if (booking.couponReservation?.couponCode) {
        const couponCode = booking.couponReservation.couponCode;
        const customerId = (booking.couponReservation.userId?.toString() || booking.customerId?.toString()) as string;

        if (booking.couponReservation.usedAt) {
          // Payment was made and coupon was used - rollback the coupon usage
          // Use atomic rollback within the same transaction
          const offerService = new OfferService();
          try {
            const rollbackSuccess = await offerService.rollbackCouponUsageAtomic(
              couponCode,
              customerId,
              booking._id.toString(),
              'booking_cancelled',
              session
            );

            if (rollbackSuccess) {
              logger.info('Coupon usage rolled back on booking cancellation', {
                bookingId: booking._id,
                couponCode,
                refundAmount,
                sagaStep: 'coupon_usage_rolled_back',
              });
            } else {
              logger.warn('Coupon rollback returned false - may have already been rolled back or not found', {
                bookingId: booking._id,
                couponCode,
                sagaStep: 'coupon_rollback_warning',
              });
            }
          } catch (rollbackError) {
            // Log but don't fail the cancellation - coupon rollback can be retried
            logger.error('Failed to rollback coupon usage on cancellation', {
              bookingId: booking._id,
              couponCode,
              error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
              sagaStep: 'coupon_rollback_error',
            });
          }
        } else {
          logger.info('Coupon reservation cleared - payment never processed', {
            bookingId: booking._id,
            couponCode,
            sagaStep: 'coupon_reservation_cleared',
          });
        }

        // Clear the coupon reservation after rollback
        booking.couponReservation = undefined;
        await booking.save({ session });
      }

      // ATOMIC: Commit transaction only AFTER both booking cancellation AND refund record are saved
      await session.commitTransaction();

      void this.syncProviderAnalytics(booking.providerId);

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
   * Uses atomic RefundCounter (O(1) findOneAndUpdate with $inc)
   * Replaces the previous O(n) countDocuments() scan.
   */
  private async generateRefundNumberForCancellation(): Promise<string> {
    const { generateRefundNumber } = await import('../models/refundCounter.model');
    return generateRefundNumber();
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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

      // Re-validate availability within transaction to ensure consistency
      const availabilityResult = await validateProviderSlotAvailability({
        providerId: booking.providerId.toString(),
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        serviceDurationMinutes: booking.duration,
        serviceId: booking.serviceId?.toString(),
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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

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

    // Emit socket events for real-time updates
    const socketServer = getSocketServer();
    if (socketServer) {
      // Emit to provider (bookingId, bookingNumber, providerId, customerId)
      socketServer.emitBookingNoShow(booking._id.toString(), booking.bookingNumber || '', booking.providerId.toString(), booking.customerId?.toString() || '');
      // Emit to customer (bookingId, bookingNumber, customerId)
      socketServer.emitBookingNoShowToCustomer(booking._id.toString(), booking.bookingNumber || '', booking.customerId?.toString() || '');
    }

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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

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

    // Emit socket events for real-time updates
    const socketServer = getSocketServer();
    if (socketServer) {
      // Emit to provider (bookingId, bookingNumber, providerId, customerId)
      socketServer.emitBookingNoShow(booking._id.toString(), booking.bookingNumber || '', booking.providerId.toString(), booking.customerId?.toString() || '');
      // Emit to customer (bookingId, bookingNumber, customerId)
      socketServer.emitBookingNoShowToCustomer(booking._id.toString(), booking.bookingNumber || '', booking.customerId?.toString() || '');
    }

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
  // Link guest bookings to a registered customer (same email)
  // ========================================

  async linkGuestBookingsToCustomer(
    customerId: string,
    email: string
  ): Promise<{ linkedCount: number; bookingNumbers: string[] }> {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new ApiError(400, 'Invalid customer ID');
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      return { linkedCount: 0, bookingNumbers: [] };
    }

    const filter = {
      isGuestBooking: true,
      $or: [{ customerId: { $exists: false } }, { customerId: null }],
      'guestInfo.email': { $regex: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') },
      deletedAt: { $exists: false },
    };

    const pending = await Booking.find(filter).select('bookingNumber').lean();
    if (!pending.length) {
      return { linkedCount: 0, bookingNumbers: [] };
    }

    await Booking.updateMany(filter, {
      $set: {
        customerId: new mongoose.Types.ObjectId(customerId),
        isGuestBooking: false,
      },
    });

    const bookingNumbers = pending.map((b) => b.bookingNumber);
    logger.info('Guest bookings linked to customer account', {
      context: 'BookingService',
      action: 'GUEST_BOOKINGS_LINKED',
      customerId,
      linkedCount: bookingNumbers.length,
      bookingNumbers,
    });

    return { linkedCount: bookingNumbers.length, bookingNumbers };
  }

  // ========================================
  // Get Customer Bookings (Interface Implementation)
  // ========================================

  async getCustomerBookings(
    customerId: string,
    filters?: BookingFiltersDTO,
    options?: { tenantContext?: { tenantId?: string; isAdmin?: boolean }; page?: number; limit?: number }
  ): Promise<{ bookings: any[]; pagination: any }> {
    const page = filters?.page || options?.page || 1;
    // FIX: Enforce maximum pagination limit to prevent excessive queries
    const limit = Math.min(filters?.limit || options?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'scheduledDate', 'status', 'updatedAt'] as const;
    const sortField = allowedSortFields.includes(filters?.sortBy as typeof allowedSortFields[number])
      ? filters!.sortBy!
      : 'scheduledDate';
    const sortDirection = filters?.sortOrder === 'asc' ? 1 : -1;
    const sortSpec: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const query: any = { customerId: new mongoose.Types.ObjectId(customerId), deletedAt: { $exists: false } }; // FIX: Exclude deleted bookings

    if (options?.tenantContext?.tenantId && !options.tenantContext.isAdmin) {
      applyTenantToBookingQuery(query, options.tenantContext.tenantId);
    }

    if (filters?.reviewable) {
      query.status = 'completed';
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        {
          $or: [
            { customerReview: { $exists: false } },
            { customerReview: null },
          ],
        },
      ];
    } else if (filters?.status) {
      if (filters.status === 'active') {
        query.status = { $in: ['pending', 'confirmed', 'in_progress'] };
      } else {
        query.status = filters.status;
      }
    }
    if (filters?.startDate || filters?.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }
    if (filters?.search) {
      query.$or = [
        { bookingNumber: { $regex: escapeRegex(filters.search), $options: 'i' } }
      ];
    }

    // Category filter - use aggregation pipeline to filter on populated serviceId.category
    // FIX: serviceId is ObjectId reference, so we need aggregation to filter on populated field
    const hasCategoryFilter = !!filters?.category;

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
      address: 1,
      providerResponse: 1,
      statusHistory: 1,
      payment: 1,
      paymentStatus: 1,
      serviceId: 1,
      providerId: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    // Base query excluding category filter (handled by aggregation when needed)
    const baseQuery = { ...query };
    if (hasCategoryFilter) {
      delete baseQuery['serviceId.category'];
    }

    let bookings: any[];
    let total: number;

    if (hasCategoryFilter) {
      // Use aggregation pipeline to properly filter on populated serviceId.category
      const matchStage: any = { ...baseQuery };

      // Count query for total (before pagination)
      const countResult = await Booking.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'servicePopulated'
          }
        },
        { $unwind: { path: '$servicePopulated', preserveNullAndEmptyArrays: true } },
        { $match: { 'servicePopulated.category': filters.category } },
        { $count: 'total' }
      ]);
      total = countResult.length > 0 ? countResult[0].total : 0;

      // Paginated query
      bookings = await Booking.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'servicePopulated'
          }
        },
        { $unwind: { path: '$servicePopulated', preserveNullAndEmptyArrays: true } },
        { $match: { 'servicePopulated.category': filters.category } },
        {
          $lookup: {
            from: 'providers',
            localField: 'providerId',
            foreignField: '_id',
            as: 'providerPopulated'
          }
        },
        {
          $project: {
            ...projection,
            serviceId: {
              _id: '$servicePopulated._id',
              name: '$servicePopulated.name',
              category: '$servicePopulated.category',
              images: '$servicePopulated.images'
            },
            providerId: {
              $cond: {
                if: { $gt: [{ $size: '$providerPopulated' }, 0] },
                then: { _id: { $arrayElemAt: ['$providerPopulated._id', 0] }, firstName: { $arrayElemAt: ['$providerPopulated.firstName', 0] }, lastName: { $arrayElemAt: ['$providerPopulated.lastName', 0] } },
                else: null
              }
            }
          }
        },
        { $sort: sortSpec },
        { $skip: skip },
        { $limit: limit }
      ]);
    } else {
      // Standard query without category filter
      const [bookingsResult, countResult] = await Promise.all([
        Booking.find(baseQuery, projection)
          .populate('service', 'name category images duration price')
          .populate('provider', 'firstName lastName avatar phone businessInfo rating')
          .sort(sortSpec)
          .skip(skip)
          .limit(limit)
          .lean(),
        Booking.countDocuments(baseQuery)
      ]);
      bookings = bookingsResult;
      total = countResult;
    }

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
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
    const bookingCustomerId =
      (booking as any).customerId?._id?.toString() ?? (booking as any).customerId?.toString();
    const isCustomer = bookingCustomerId === userId;
    const isProvider = (booking as any).providerId?._id?.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    let isGuestOwnerByEmail = false;
    if (!isCustomer && !isProvider && !isAdmin && userRole === 'customer') {
      const viewer = await User.findById(userId).select('email').lean();
      const guestEmail = (booking as any).guestInfo?.email;
      if (
        viewer?.email &&
        guestEmail &&
        (booking as any).isGuestBooking &&
        !bookingCustomerId &&
        viewer.email.toLowerCase().trim() === guestEmail.toLowerCase().trim()
      ) {
        isGuestOwnerByEmail = true;
      }
    }

    if (!isCustomer && !isProvider && !isAdmin && !isGuestOwnerByEmail) {
      throw new ApiError(403, 'Access denied');
    }

    // FIX: Extract flat timestamp fields from statusHistory for frontend compatibility
    const bookingObj = (booking as any).toObject ? (booking as any).toObject() : booking;
    const statusTimestamps = this.extractTimestampsFromHistory(bookingObj.statusHistory);

    // FIX: Add estimatedDuration alias for frontend compatibility (frontend expects estimatedDuration, backend returns duration)
    return {
      ...bookingObj,
      estimatedDuration: bookingObj.duration,
      ...statusTimestamps
    };
  }

  // ========================================
  // Helper method to extract timestamps from statusHistory
  // ========================================
  private extractTimestampsFromHistory(statusHistory: Array<{ status: string; timestamp: Date | string }>): Record<string, string | undefined> {
    const timestamps: Record<string, string | undefined> = {
      confirmedAt: undefined,
      startedAt: undefined,
      completedAt: undefined,
      cancelledAt: undefined
    };

    if (!statusHistory || !Array.isArray(statusHistory)) {
      return timestamps;
    }

    for (const entry of statusHistory) {
      const timestamp = entry.timestamp instanceof Date
        ? entry.timestamp.toISOString()
        : (typeof entry.timestamp === 'string' ? entry.timestamp : undefined);

      if (!timestamp) continue;

      switch (entry.status) {
        case 'confirmed':
          if (!timestamps.confirmedAt) timestamps.confirmedAt = timestamp;
          break;
        case 'in_progress':
          if (!timestamps.startedAt) timestamps.startedAt = timestamp;
          break;
        case 'completed':
          if (!timestamps.completedAt) timestamps.completedAt = timestamp;
          break;
        case 'cancelled':
          if (!timestamps.cancelledAt) timestamps.cancelledAt = timestamp;
          break;
      }
    }

    return timestamps;
  }

  // ========================================
  // Get Provider Bookings (Interface Implementation)
  // ========================================

  async getProviderBookings(
    providerId: string,
    filters?: BookingFiltersDTO,
    pagination?: { page?: number; limit?: number }
  ): Promise<{ bookings: any[]; pagination: any }> {
    const page = filters?.page || pagination?.page || 1;
    // FIX: Enforce maximum pagination limit to prevent excessive queries
    const limit = Math.min(filters?.limit || pagination?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const sortField = filters?.sortBy || 'scheduledDate';
    const sortDirection = filters?.sortOrder === 'asc' ? 1 : -1;
    const sortKey =
      sortField === 'totalAmount' ? 'pricing.totalAmount' : sortField;
    const sort: Record<string, 1 | -1> = { [sortKey]: sortDirection };
    if (sortField === 'scheduledDate') {
      sort.scheduledTime = sortDirection;
    }

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
        { bookingNumber: { $regex: escapeRegex(filters.search), $options: 'i' } }
      ];
    }

    // Category filter - filter by service category
    if (filters?.category) {
      query['serviceId.category'] = filters.category;
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
        .sort(sort)
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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

      // 1. Read booking with session to ensure consistency
      const booking = await Booking.findOne({
        _id: bookingId,
        status: 'pending',
        deletedAt: { $exists: false }
      }).session(session);

      if (!booking) {
        throw new ApiError(404, 'Booking not found or no longer available');
      }

      if (booking.providerId.toString() !== providerId) {
        throw new ApiError(403, 'Booking does not belong to this provider');
      }

      // FIX: Race condition fix - First check for conflicts, then do atomic update
      // The key fix is that we do conflict check BEFORE any status change
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

      // FIX: Use atomic update with findOneAndUpdate to prevent race conditions
      // The condition status:'pending' ensures only ONE provider can accept
      // If another provider already accepted, this update will return null
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
        // Another process already accepted this booking - this is the race condition protection
        throw new ApiError(409, 'Booking already accepted by another provider');
      }

      // FIX: Defense-in-depth - Verify no conflicts after update (catches edge cases)
      // This is a safety check in case a conflict was created between our check and update
      const postUpdateConflictCheck = await this.checkForTimeSlotConflicts(
        providerId,
        bookingId,
        confirmedBooking.scheduledDate,
        confirmedBooking.scheduledTime,
        confirmedBooking.duration
      );

      if (postUpdateConflictCheck.hasConflict) {
        // Rollback the confirmation - edge case where race occurred during our transaction
        await Booking.findByIdAndUpdate(bookingId, {
          status: 'pending',
          providerId: booking.providerId,
          $push: {
            statusHistory: {
              status: 'pending',
              timestamp: new Date(),
              reason: 'Auto-reverted due to slot conflict detected post-update',
              updatedBy: 'system'
            }
          }
        }).session(session);
        throw new ApiError(409, 'Time slot conflict detected - please select a different time');
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
      void this.syncProviderAnalytics(providerId);
      return confirmedBooking;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

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

      // FIX: Handle coupon rollback when provider rejects booking
      // If coupon was marked as used (payment succeeded), we need to rollback the usage
      // If coupon was just reserved (payment never happened), we just clear the reservation
      if (booking.couponReservation?.couponCode) {
        const couponCode = booking.couponReservation.couponCode;
        const customerId = (booking.couponReservation.userId?.toString() || booking.customerId?.toString()) as string;

        if (booking.couponReservation.usedAt) {
          // Payment was made and coupon was used - rollback the coupon usage
          const offerService = new OfferService();
          try {
            const rollbackSuccess = await offerService.rollbackCouponUsageAtomic(
              couponCode,
              customerId,
              booking._id.toString(),
              'booking_cancelled',
              session
            );

            if (rollbackSuccess) {
              logger.info('Coupon usage rolled back on provider rejection', {
                bookingId: booking._id,
                couponCode,
                sagaStep: 'coupon_usage_rolled_back',
              });
            } else {
              logger.warn('Coupon rollback returned false on rejection', {
                bookingId: booking._id,
                couponCode,
                sagaStep: 'coupon_rollback_warning',
              });
            }
          } catch (rollbackError) {
            // Log but don't fail the rejection - coupon rollback can be retried
            logger.error('Failed to rollback coupon usage on provider rejection', {
              bookingId: booking._id,
              couponCode,
              error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
              sagaStep: 'coupon_rollback_error',
            });
          }
        } else {
          logger.info('Coupon reservation cleared on provider rejection - payment never processed', {
            bookingId: booking._id,
            couponCode,
            sagaStep: 'coupon_reservation_cleared',
          });
        }

        // Clear the coupon reservation after rollback
        booking.couponReservation = undefined;
        await booking.save({ session });
      }

      await session.commitTransaction();
      void this.syncProviderAnalytics(providerId);
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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

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

      // Emit socket events for real-time updates
      const socketServer = getSocketServer();
      if (socketServer) {
        // emitBookingStarted: (bookingId, bookingNumber, providerId)
        socketServer.emitBookingStarted(booking._id.toString(), booking.bookingNumber || '', booking.providerId.toString());
        // emitBookingStartedToCustomer: (bookingId, bookingNumber, customerId, providerId)
        socketServer.emitBookingStartedToCustomer(booking._id.toString(), booking.bookingNumber || '', booking.customerId?.toString() || '', booking.providerId.toString());
      }

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
      session.startTransaction(DEFAULT_MONGO_TRANSACTION_OPTIONS);

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

      // CRITICAL FIX: Process booking completion within the same transaction
      // Calculate commission and update provider wallet atomically
      try {
        const { calculateCommission } = require('./settlement.service');
        const Wallet = mongoose.model('Wallet');

        // Calculate commission
        const { commission, platformFee, netAmount: providerEarnings } = await calculateCommission(bookingId);

        // Update provider wallet atomically within the transaction
        const providerWallet = await Wallet.findOne({ userId: booking.providerId }).session(session);

        if (!providerWallet) {
          // Create wallet if it doesn't exist
          const newWallet = new Wallet({
            userId: booking.providerId,
            balance: 0,
            pendingBalance: providerEarnings,
            currency: 'AED',
            transactions: [{
              id: `txn_${crypto.randomUUID()}`,
              type: 'credit',
              amount: providerEarnings,
              description: `Earnings from booking ${booking.bookingNumber}`,
              reference: bookingId,
              referenceType: 'commission',
              status: 'completed',
              balanceAfter: providerEarnings,
              createdAt: new Date(),
            }],
            totalEarned: providerEarnings,
            version: 1,
          });
          await newWallet.save({ session });
        } else {
          // Update existing wallet atomically within transaction
          await Wallet.findOneAndUpdate(
            { userId: booking.providerId },
            {
              $inc: {
                pendingBalance: providerEarnings,
                totalEarned: providerEarnings,
              },
              $push: {
                transactions: {
                  id: `txn_${crypto.randomUUID()}`,
                  type: 'credit',
                  amount: providerEarnings,
                  description: `Earnings from booking ${booking.bookingNumber}`,
                  reference: bookingId,
                  referenceType: 'commission',
                  status: 'completed',
                  balanceAfter: (providerWallet.pendingBalance || 0) + providerEarnings,
                  createdAt: new Date(),
                },
              },
            },
            { session }
          );
        }

        logger.info('Booking completion settlement processed within transaction', {
          bookingId,
          providerEarnings,
          commission,
          platformFee,
          action: 'SETTLEMENT_PROCESSED_IN_TXN',
        });
      } catch (settlementError) {
        // CRITICAL: Abort transaction if settlement processing fails
        await session.abortTransaction();
        logger.error('Failed to process booking settlement - transaction aborted', {
          bookingId,
          error: settlementError instanceof Error ? settlementError.message : String(settlementError),
          action: 'SETTLEMENT_ERROR_ABORTED',
        });
        throw new ApiError(500, 'Failed to process booking settlement');
      }

      // Commit transaction only after successful settlement processing
      await session.commitTransaction();

      eventBus.publish(EVENT_TYPES.BOOKING_COMPLETED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
        totalAmount: booking.pricing?.totalAmount,
        tenantId: booking.tenantId,
      });

      // Trigger automated review request scheduling after booking completion
      this.scheduleReviewRequest(booking._id);

      void this.syncProviderAnalytics(providerId);

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
    const booking = await Booking.findOne({ bookingNumber, deletedAt: { $exists: false } })
      .populate('serviceId', 'name category subcategory images')
      .populate('providerId', 'firstName lastName businessInfo phone');

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    const guest = booking.guestInfo;
    const customerSnapshot = booking.customerInfo as
      | { firstName?: string; lastName?: string; email?: string; phone?: string }
      | undefined;

    const providerDoc = booking.providerId as
      | { _id?: mongoose.Types.ObjectId; firstName?: string; lastName?: string; businessInfo?: { businessName?: string }; phone?: string }
      | mongoose.Types.ObjectId
      | undefined;

    return {
      _id: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId?.toString(),
      providerId: providerDoc && typeof providerDoc === 'object' && '_id' in providerDoc
        ? providerDoc._id?.toString()
        : booking.providerId?.toString(),
      status: booking.status,
      statusHistory: booking.statusHistory || [],
      service: booking.serviceId
        ? {
            name: (booking.serviceId as any).name,
            category: (booking.serviceId as any).category,
            subcategory: (booking.serviceId as any).subcategory,
            image: (booking.serviceId as any).images?.[0],
          }
        : undefined,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration,
      location: booking.location,
      pricing: booking.pricing,
      isGuestBooking: Boolean(booking.isGuestBooking),
      createdAt: booking.createdAt,
      provider: providerDoc && typeof providerDoc === 'object' && 'firstName' in providerDoc
        ? {
            _id: providerDoc._id?.toString(),
            name: `${providerDoc.firstName || ''} ${providerDoc.lastName || ''}`.trim(),
            businessName: providerDoc.businessInfo?.businessName,
            phone: providerDoc.phone,
          }
        : undefined,
      customerInfo: booking.isGuestBooking && guest
        ? {
            firstName: guest.name?.split(' ')[0],
            lastName: guest.name?.split(' ').slice(1).join(' '),
            email: guest.email,
            phone: guest.phone,
          }
        : customerSnapshot,
      guestEmail: guest?.email,
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
  private calculatePricing(
    service: any,
    addOns?: any[],
    selectedDuration?: number,
    scheduledDate?: Date,
    metadata?: { variantDuration?: number; variantPrice?: number }
  ): any {
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

    // Subcategory / marketplace variant (metadata from booking wizard)
    if (
      selectedDuration &&
      typeof metadata?.variantPrice === 'number' &&
      metadata.variantPrice > 0 &&
      (metadata.variantDuration === undefined || metadata.variantDuration === selectedDuration)
    ) {
      const maxAllowedPrice = basePrice * 10;
      if (metadata.variantPrice > maxAllowedPrice) {
        throw new ApiError(400, 'Invalid variant price');
      }
      bookingDuration = metadata.variantDuration ?? selectedDuration;
      basePrice = Math.round(metadata.variantPrice * 100) / 100;
    } else if (selectedDuration && service.durationOptions && service.durationOptions.length > 0) {
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

    const policy = getPlatformPolicySync();
    let subtotal = Math.round((basePrice + addOnTotal) * 100) / 100;

    if (scheduledDate) {
      const surchargePct = getScheduleSurchargePercent(scheduledDate, policy);
      if (surchargePct > 0) {
        subtotal = Math.round(subtotal * (1 + surchargePct / 100) * 100) / 100;
      }
    }

    const tax = calculateTaxAmount(subtotal, policy);
    const totalAmount = Math.round((subtotal + tax) * 100) / 100;
    const currency = service.price?.currency || policy.currency || 'AED';

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
        notificationsToCreate.map((data) =>
          notificationService.createInAppNotification({
            bookingId: data!.bookingId?.toString(),
            recipientId: data!.recipientId?.toString(),
            type: data!.type,
            title: data!.title,
            message: data!.message,
            metadata: data!.metadata,
            tenantId: booking.tenantId?.toString(),
          })
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
      await notificationService.createInAppNotification({
        bookingId: booking._id.toString(),
        recipientId: recipientId.toString(),
        type: 'message_received',
        title: 'New Message',
        message: `You have a new message about booking ${booking.bookingNumber}`,
        actionText: 'View Message',
        actionUrl: `/bookings/${booking._id}`,
        metadata: {
          bookingNumber: booking.bookingNumber,
          serviceName: booking.service?.name,
        },
        tenantId: booking.tenantId?.toString(),
      });
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

  private async syncProviderAnalytics(providerId: string | mongoose.Types.ObjectId): Promise<void> {
    try {
      await ProviderProfile.recalculateAllAnalytics(providerId.toString());
    } catch (error) {
      logger.warn('Failed to sync provider analytics', {
        context: 'BookingService',
        action: 'SYNC_ANALYTICS_ERROR',
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

  // ========================================
  // Get Booking Count (Interface Implementation)
  // ========================================

  /**
   * Get booking count for a customer with optional status filter
   * Supports counting all bookings or filtering by status
   * Used for dashboard badges and quick stats
   *
   * @param customerId - The customer ID to count bookings for
   * @param options - Optional filter options (status, etc.)
   * @returns Object with total count and optionally counts by status
   */
  async getCustomerBookingCount(
    customerId: string,
    options?: { status?: string; activeOnly?: boolean; tenantId?: string }
  ): Promise<{ count: number; statusCounts?: Record<string, number> }> {
    // SECURITY FIX: Input validation for customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new ApiError(400, 'Invalid customer ID');
    }

    const query: Record<string, unknown> = {
      customerId: new mongoose.Types.ObjectId(customerId),
      deletedAt: { $exists: false }
    };

    if (options?.tenantId) {
      applyTenantToBookingQuery(query, options.tenantId);
    }

    // Handle status filtering
    if (options?.status) {
      if (options.status === 'active') {
        // Active bookings = not in terminal states
        query.status = { $nin: ['cancelled', 'completed', 'no_show'] };
      } else {
        query.status = options.status;
      }
    }

    // Count with the filter
    const count = await Booking.countDocuments(query);

    // If activeOnly is true, also return breakdown by status
    if (options?.activeOnly || options?.status === 'active') {
      const breakdownMatch: Record<string, unknown> = {
        customerId: new mongoose.Types.ObjectId(customerId),
        deletedAt: { $exists: false },
        status: { $nin: ['cancelled', 'completed', 'no_show'] },
      };
      if (options?.tenantId) {
        applyTenantToBookingQuery(breakdownMatch, options.tenantId);
      }
      const statusBreakdown = await Booking.aggregate([
        {
          $match: breakdownMatch,
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusCounts: Record<string, number> = {};
      statusBreakdown.forEach(item => {
        statusCounts[item._id] = item.count;
      });

      return { count, statusCounts };
    }

    return { count };
  }

  /**
   * Get booking count for a provider with optional status filter
   * Used for provider dashboard badges and quick stats
   *
   * @param providerId - The provider ID to count bookings for
   * @param options - Optional filter options
   * @returns Object with total count and optionally counts by status
   */
  async getProviderBookingCount(
    providerId: string,
    options?: { status?: string; activeOnly?: boolean }
  ): Promise<{ count: number; statusCounts?: Record<string, number> }> {
    // SECURITY FIX: Input validation for provider ID
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const query: Record<string, unknown> = {
      providerId: new mongoose.Types.ObjectId(providerId),
      deletedAt: { $exists: false }
    };

    // Handle status filtering
    if (options?.status) {
      if (options.status === 'active') {
        query.status = { $nin: ['cancelled', 'completed', 'no_show'] };
      } else {
        query.status = options.status;
      }
    }

    const count = await Booking.countDocuments(query);

    // If activeOnly is true, also return breakdown by status
    if (options?.activeOnly || options?.status === 'active') {
      const statusBreakdown = await Booking.aggregate([
        {
          $match: {
            providerId: new mongoose.Types.ObjectId(providerId),
            deletedAt: { $exists: false },
            status: { $nin: ['cancelled', 'completed', 'no_show'] }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusCounts: Record<string, number> = {};
      statusBreakdown.forEach(item => {
        statusCounts[item._id] = item.count;
      });

      return { count, statusCounts };
    }

    return { count };
  }

  // ========================================
  // Automated Review Request Scheduling
  // ========================================

  /**
   * Schedule automated review request after booking completion
   * This triggers the review request automation system to send review requests
   */
  private async scheduleReviewRequest(bookingId: mongoose.Types.ObjectId): Promise<void> {
    try {
      // Import dynamically to avoid circular dependency
      const { scheduleReviewRequests } = await import('../automation/reviewRequestTiming');

      // Schedule review requests with optimal timing
      await scheduleReviewRequests(bookingId);

      logger.info('Review request scheduled for booking', {
        context: 'BookingService',
        action: 'REVIEW_REQUEST_SCHEDULED',
        bookingId: bookingId.toString(),
      });
    } catch (error) {
      // Log but don't fail - review scheduling is not critical
      logger.warn('Failed to schedule review request', {
        context: 'BookingService',
        action: 'REVIEW_REQUEST_SCHEDULE_FAILED',
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ========================================
  // Review Analytics & Trends
  // ========================================

  /**
   * Get review analytics for a provider
   * Returns rating trends, response rates, and other metrics
   */
  async getProviderReviewAnalytics(providerId: string): Promise<{
    summary: {
      totalReviews: number;
      averageRating: number;
      responseRate: number;
      thisMonth: number;
      lastMonth: number;
    };
    trends: Array<{
      month: string;
      averageRating: number;
      count: number;
    }>;
    ratingDistribution: Record<number, number>;
  }> {
    const Review = mongoose.model('Review');

    // Get all approved reviews for this provider
    const reviews = await Review.find({
      revieweeId: new mongoose.Types.ObjectId(providerId),
      reviewerType: 'customer',
      isHidden: false,
      moderationStatus: 'approved',
    }).sort({ createdAt: -1 });

    // Calculate summary stats
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    // Calculate response rate (reviews with provider responses)
    const respondedReviews = reviews.filter(r => r.response).length;
    const responseRate = totalReviews > 0 ? (respondedReviews / totalReviews) * 100 : 0;

    // This month vs last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthReviews = reviews.filter(r => new Date(r.createdAt) >= thisMonthStart);
    const lastMonthReviews = reviews.filter(r =>
      new Date(r.createdAt) >= lastMonthStart && new Date(r.createdAt) <= lastMonthEnd
    );

    // Calculate rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    });

    // Calculate monthly trends (last 12 months)
    const trends: Array<{ month: string; averageRating: number; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthReviews = reviews.filter(r => {
        const d = new Date(r.createdAt);
        return d >= monthDate && d <= monthEnd;
      });

      if (monthReviews.length > 0) {
        const monthAvg = monthReviews.reduce((sum, r) => sum + r.rating, 0) / monthReviews.length;
        trends.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          averageRating: Math.round(monthAvg * 10) / 10,
          count: monthReviews.length,
        });
      }
    }

    return {
      summary: {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        responseRate: Math.round(responseRate),
        thisMonth: thisMonthReviews.length,
        lastMonth: lastMonthReviews.length,
      },
      trends,
      ratingDistribution,
    };
  }
}

// Export singleton instance
export const bookingService = new BookingService();
