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
  trackBooking
} from '../controllers/booking.controller';

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
  getAvailabilityAnalytics
} from '../controllers/availability.controller';

import {
  getBookingAnalyticsHandler
} from '../controllers/analytics.controller';

import { authenticate } from '../middleware/auth.middleware';
import {
  validateBookingInput,
  validateAvailabilityInput,
  validateDateOverride,
  validateBlockPeriod
} from '../middleware/validation';

const router = Router();

// ===================================
// PUBLIC BOOKING ROUTES (no auth required)
// ===================================
router.post('/bookings/guest', createGuestBooking);
router.get('/bookings/track/:bookingNumber', trackBooking);

// ===================================
// BOOKING ROUTES
// ===================================

// Customer Booking Operations
router.post('/bookings', authenticate, validateBookingInput, createBooking);
router.get('/bookings/customer', authenticate, getCustomerBookings);

// Provider Booking Operations
router.get('/bookings/provider', authenticate, getProviderBookings);

// Specific booking operations (MUST come after /customer and /provider routes)
router.get('/bookings/:id', authenticate, getBookingDetails);
router.patch('/bookings/:id/cancel', authenticate, cancelBooking);
router.patch('/bookings/:id/reschedule', authenticate, rescheduleBooking);
router.patch('/bookings/:id/accept', authenticate, acceptBooking);
router.patch('/bookings/:id/reject', authenticate, rejectBooking);
router.patch('/bookings/:id/start', authenticate, startBooking);
router.patch('/bookings/:id/complete', authenticate, completeBooking);

// Booking Communication
router.post('/bookings/:id/messages', authenticate, addBookingMessage);
router.patch('/bookings/:id/messages/read', authenticate, markMessagesAsRead);

// ===================================
// AVAILABILITY ROUTES
// ===================================

// Provider Availability Management
router.get('/availability', authenticate, getProviderAvailability);
router.put('/availability/schedule', authenticate, validateAvailabilityInput, updateWeeklySchedule);
router.patch('/availability/settings', authenticate, updateAvailabilitySettings);
router.post('/availability/override', authenticate, validateDateOverride, addDateOverride);
router.delete('/availability/override/:date', authenticate, removeDateOverride);
router.post('/availability/block', authenticate, validateBlockPeriod, blockTimePeriod);
router.delete('/availability/block/:blockId', authenticate, removeBlockedPeriod);

// Public Availability Queries
router.get('/availability/provider/:providerId/slots', getProviderAvailableSlots);
router.get('/availability/provider/:providerId/check', checkTimeSlotAvailability);

// ===================================
// ANALYTICS ROUTES
// ===================================

// Booking Analytics (admin/provider)
router.get('/bookings/analytics', authenticate, getBookingAnalyticsHandler);

// Availability Analytics (provider)
router.get('/availability/analytics', authenticate, getAvailabilityAnalytics);

export default router;