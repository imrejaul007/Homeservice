import { Router } from 'express';
import {
  getProviderBookings,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  addBookingMessage,
  markMessagesAsRead,
} from '../controllers/booking.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// PROVIDER BOOKING MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/provider-bookings
 * @desc    Get all bookings for the authenticated provider
 * @access  Private (Provider)
 */
router.get('/', getProviderBookings);

/**
 * @route   POST /api/v1/provider-bookings/:id/accept
 * @desc    Accept a booking request
 * @access  Private (Provider)
 */
router.post('/:id/accept', acceptBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/reject
 * @desc    Reject a booking request
 * @access  Private (Provider)
 */
router.post('/:id/reject', rejectBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/start
 * @desc    Start a confirmed booking (mark as in_progress)
 * @access  Private (Provider)
 */
router.post('/:id/start', startBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/complete
 * @desc    Complete a booking
 * @access  Private (Provider)
 */
router.post('/:id/complete', completeBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/messages
 * @desc    Add a message to a booking
 * @access  Private (Provider)
 */
router.post('/:id/messages', addBookingMessage);

/**
 * @route   PATCH /api/v1/provider-bookings/:id/messages/read
 * @desc    Mark booking messages as read
 * @access  Private (Provider)
 */
router.patch('/:id/messages/read', markMessagesAsRead);

export default router;
