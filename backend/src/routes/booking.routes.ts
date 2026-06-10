import { Router } from 'express';
import {
  createBooking,
  getCustomerBookings,
  getBookingDetails,
  cancelBooking,
  rescheduleBooking,
  getProviderBookings,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  addBookingMessage,
  markMessagesAsRead,
  createGuestBooking,
  trackBooking,
  rateBooking,
  reportProviderNoShow,
  applyCouponToBooking,
  removeCouponFromBooking,
  getCustomerBookingCount,
} from '../controllers/booking.controller';

import {
  batchAccept,
  batchDecline,
  batchComplete,
  batchCancel,
  getBatchPreview
} from '../controllers/batchBooking.controller';

import {
  getProviderAvailability,
  updateWeeklySchedule,
  updateAvailabilitySettings,
  addDateOverride,
  removeDateOverride,
  blockTimePeriod,
  removeBlockedPeriod,
  getProviderAvailableSlots,
  checkTimeSlotAvailability,
  getAvailabilityAnalytics,
  getServiceSchedule,
  updateServiceSchedule,
  getAllServiceSchedules,
  copyGlobalToService
} from '../controllers/availability.controller';

import {
  getBookingAnalyticsHandler
} from '../controllers/analytics.controller';

import { authenticate } from '../middleware/auth.middleware';
import { messageLimiter, perUserRateLimiter } from '../middleware/rateLimiter';
import {
  validateBookingInput,
  validateGuestBooking,
  validateBookingCancellation,
  validateBookingAcceptance,
  validateBookingRejection,
  validateBookingCompletion,
  validateAvailabilityInput,
  validateDateOverride,
  validateBlockPeriod
} from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ===================================
// PUBLIC BOOKING ROUTES (no auth required)
// ===================================
router.post('/bookings/guest', validateGuestBooking, createGuestBooking);
router.get('/bookings/track/:bookingNumber', trackBooking);

// ===================================
// BOOKING ROUTES
// ===================================

// Customer Booking Operations
router.post('/bookings', authenticate, validateBookingInput, createBooking);
router.get('/bookings/customer', authenticate, getCustomerBookings);
router.get('/bookings/count', authenticate, getCustomerBookingCount);

// Provider Booking Operations
router.get('/bookings/provider', authenticate, getProviderBookings);

// Specific booking operations (MUST come after /customer and /provider routes)
router.get('/bookings/:id', authenticate, getBookingDetails);
router.patch('/bookings/:id/cancel', perUserRateLimiter, authenticate, validateBookingCancellation, cancelBooking);
router.patch('/bookings/:id/reschedule', authenticate, rescheduleBooking);
router.patch('/bookings/:id/accept', authenticate, validateBookingAcceptance, acceptBooking);
router.patch('/bookings/:id/reject', authenticate, validateBookingRejection, rejectBooking);
router.patch('/bookings/:id/start', authenticate, validateBookingCompletion, startBooking);
router.patch('/bookings/:id/complete', authenticate, validateBookingCompletion, completeBooking);

// Booking Communication - Rate limited to prevent message spam
router.post('/bookings/:id/messages', messageLimiter, authenticate, addBookingMessage);
router.patch('/bookings/:id/messages/read', authenticate, markMessagesAsRead);

// Customer Actions - Rate limited
router.patch('/bookings/:id/report-no-show', perUserRateLimiter, authenticate, reportProviderNoShow);
router.post('/bookings/:id/rate', perUserRateLimiter, authenticate, rateBooking);

// Coupon Operations
router.post('/bookings/:id/coupon', authenticate, applyCouponToBooking);
router.delete('/bookings/:id/coupon', authenticate, removeCouponFromBooking);

// ===================================
// AVAILABILITY ROUTES
// ===================================

// Provider Availability Management
router.get('/availability', authenticate, getProviderAvailability);
router.put('/availability/schedule', authenticate, validateAvailabilityInput, updateWeeklySchedule);
router.patch('/availability/settings', authenticate, updateAvailabilitySettings);
router.post('/availability/override', authenticate, validateDateOverride, addDateOverride);
// FIX: Issue #5 - Support both overrideId (preferred) and date (legacy) for removal
router.delete('/availability/override', authenticate, removeDateOverride);
router.post('/availability/block', authenticate, validateBlockPeriod, blockTimePeriod);
router.delete('/availability/block/:blockId', authenticate, removeBlockedPeriod);

// Per-Service / Bundle Availability Management
router.get('/availability/service/schedules', authenticate, getAllServiceSchedules);
router.get('/availability/service/:serviceId/schedule', authenticate, getServiceSchedule);
router.put('/availability/service/:serviceId/schedule', authenticate, updateServiceSchedule);
router.post('/availability/service/:serviceId/copy-global', authenticate, copyGlobalToService);

// Public Availability Queries
// FIX: Issue #2 - Support serviceId parameter for per-service availability
router.get('/availability/provider/:providerId/slots', asyncHandler(getProviderAvailableSlots));
router.get('/availability/provider/:providerId/check', asyncHandler(checkTimeSlotAvailability));

// ===================================
// ANALYTICS ROUTES
// ===================================

// Booking Analytics (admin/provider)
router.get('/bookings/analytics', authenticate, getBookingAnalyticsHandler);

// Availability Analytics (provider)
router.get('/availability/analytics', authenticate, getAvailabilityAnalytics);

// ===================================
// BATCH BOOKING OPERATIONS
// ===================================

// Batch operations for providers
router.post('/bookings/batch/accept', authenticate, batchAccept);
router.post('/bookings/batch/decline', authenticate, batchDecline);
router.post('/bookings/batch/complete', authenticate, batchComplete);
router.post('/bookings/batch/cancel', authenticate, batchCancel);
router.post('/bookings/batch/preview', authenticate, getBatchPreview);

export default router;