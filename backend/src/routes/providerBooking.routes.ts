import { Router, Request, Response, NextFunction } from 'express';
import {
  getProviderBookings,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  addBookingMessage,
  markMessagesAsRead,
} from '../controllers/booking.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { ApiError } from '../utils/ApiError';
import Booking from '../models/booking.model';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================

/**
 * Middleware to verify the authenticated user is a provider
 * SECURITY: Ensures only users with 'provider' role can access these routes
 */
const verifyProviderRole = requireRole('provider');

/**
 * Middleware to verify booking ownership (IDOR protection)
 * SECURITY: Ensures the provider owns the booking they are trying to access
 * Must be used after :id param is available
 */
const verifyBookingOwnership = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookingId = req.params.id;
    const providerId = (req.user as any)?._id?.toString();

    if (!bookingId) {
      throw new ApiError(400, 'Booking ID is required');
    }

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    // Fetch the booking to verify ownership
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Verify this provider owns the booking
    if (booking.providerId.toString() !== providerId) {
      throw new ApiError(403, 'Not authorized to access this booking');
    }

    // Attach booking to request for use in controllers
    (req as any).booking = booking;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to verify provider has at least one booking with a customer
 * Used for endpoints that access customer data
 */
const verifyCustomerRelationship = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = req.params.customerId;
    const providerId = (req.user as any)?._id?.toString();

    if (!customerId) {
      throw new ApiError(400, 'Customer ID is required');
    }

    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    // Verify provider has at least one booking with this customer
    const booking = await Booking.findOne({
      customerId: customerId,
      providerId: providerId
    }).lean();

    if (!booking) {
      throw new ApiError(403, 'Access denied. You can only access data for your own customers.');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================
// PROVIDER BOOKING MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/provider-bookings
 * @desc    Get all bookings for the authenticated provider
 * @access  Private (Provider only)
 */
router.get('/', verifyProviderRole, getProviderBookings);

/**
 * @route   POST /api/v1/provider-bookings/:id/accept
 * @desc    Accept a booking request
 * @access  Private (Provider only)
 * @security IDOR protection - verifies booking belongs to this provider
 */
router.post('/:id/accept', verifyProviderRole, verifyBookingOwnership, acceptBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/reject
 * @desc    Reject a booking request
 * @access  Private (Provider only)
 * @security IDOR protection - verifies booking belongs to this provider
 */
router.post('/:id/reject', verifyProviderRole, verifyBookingOwnership, rejectBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/start
 * @desc    Start a confirmed booking (mark as in_progress)
 * @access  Private (Provider only)
 * @security IDOR protection - verifies booking belongs to this provider
 */
router.post('/:id/start', verifyProviderRole, verifyBookingOwnership, startBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/complete
 * @desc    Complete a booking
 * @access  Private (Provider only)
 * @security IDOR protection - verifies booking belongs to this provider
 */
router.post('/:id/complete', verifyProviderRole, verifyBookingOwnership, completeBooking);

/**
 * @route   POST /api/v1/provider-bookings/:id/messages
 * @desc    Add a message to a booking
 * @access  Private (Provider only)
 * @security IDOR protection - verifies booking belongs to this provider
 */
router.post('/:id/messages', verifyProviderRole, verifyBookingOwnership, addBookingMessage);

/**
 * @route   PATCH /api/v1/provider-bookings/:id/messages/read
 * @desc    Mark booking messages as read
 * @access  Private (Provider only)
 * @security IDOR protection - verifies booking belongs to this provider
 */
router.patch('/:id/messages/read', verifyProviderRole, verifyBookingOwnership, markMessagesAsRead);

export default router;
