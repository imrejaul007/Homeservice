import { Request, Response } from 'express';
import { bookingService } from '../services/booking.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

// ============================================
// Validation Schemas
// ============================================

const locationSchema = Joi.object({
  type: Joi.string().valid('customer_address', 'provider_location', 'hotel').required(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zipCode: Joi.string(),
    country: Joi.string(),
  }),
  notes: Joi.string(),
});

const customerInfoSchema = Joi.object({
  firstName: Joi.string(),
  lastName: Joi.string(),
  email: Joi.string().email(),
  phone: Joi.string(),
  specialRequests: Joi.string(),
  accessInstructions: Joi.string(),
});

const addOnSchema = Joi.object({
  id: Joi.string(),
  name: Joi.string().required(),
  price: Joi.number().required(),
  description: Joi.string(),
});

const bookingInputSchema = Joi.object({
  serviceId: Joi.string().required(),
  providerId: Joi.string().required(),
  scheduledDate: Joi.string().required(),
  scheduledTime: Joi.string().required(),
  location: locationSchema.required(),
  customerInfo: customerInfoSchema,
  addOns: Joi.array().items(addOnSchema),
  specialRequests: Joi.string(),
  metadata: Joi.object({
    bookingSource: Joi.string(),
    deviceType: Joi.string(),
    sessionId: Joi.string(),
  }),
  locationType: Joi.string().valid('at_home', 'at_provider', 'at_hotel'),
  selectedDuration: Joi.number(),
  professionalPreference: Joi.string().valid('no_preference', 'specific', 'any_experience'),
  paymentMethod: Joi.string(),
});

const guestInfoSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
});

const guestBookingInputSchema = Joi.object({
  serviceId: Joi.string().required(),
  providerId: Joi.string().required(),
  scheduledDate: Joi.string().required(),
  scheduledTime: Joi.string().required(),
  location: locationSchema,
  guestInfo: guestInfoSchema.required(),
  addOns: Joi.array().items(addOnSchema),
  specialRequests: Joi.string(),
  metadata: Joi.object(),
  locationType: Joi.string().valid('at_home', 'at_provider', 'at_hotel'),
  selectedDuration: Joi.number(),
  professionalPreference: Joi.string().valid('no_preference', 'specific', 'any_experience'),
  paymentMethod: Joi.string(),
});

const bookingFiltersSchema = Joi.object({
  status: Joi.string(),
  page: Joi.number().min(1),
  limit: Joi.number().min(1).max(100),
  startDate: Joi.string(),
  endDate: Joi.string(),
});

const acceptBookingSchema = Joi.object({
  notes: Joi.string(),
  estimatedArrival: Joi.string(),
});

const rejectBookingSchema = Joi.object({
  reason: Joi.string(),
});

const cancelBookingSchema = Joi.object({
  reason: Joi.string(),
});

const completeBookingSchema = Joi.object({
  notes: Joi.string(),
  actualDuration: Joi.number(),
});

const addMessageSchema = Joi.object({
  message: Joi.string().required().min(1),
});

// ============================================
// Customer Booking Operations
// ============================================

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  // Validate customer authorization
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can create bookings');
  }

  const { error, value } = bookingInputSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as any)._id.toString();
  const result = await bookingService.createCustomerBooking(customerId, value);

  res.status(201).json({
    success: true,
    message: 'Booking request submitted, awaiting provider confirmation',
    data: { booking: result.booking },
  });
});

export const getCustomerBookings = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Access denied');
  }

  const { error, value } = bookingFiltersSchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as any)._id.toString();
  const result = await bookingService.getCustomerBookings(customerId, value);

  res.json({
    success: true,
    data: result,
  });
});

export const getBookingDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as any;

  const booking = await bookingService.getBookingById(id, user._id.toString(), user.role);

  res.json({
    success: true,
    data: { booking },
  });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can cancel bookings');
  }

  const { id } = req.params;
  const { error, value } = cancelBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as any)._id.toString();
  const result = await bookingService.cancelBooking(id, customerId, value);

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking: result.booking,
      refundAmount: result.refundAmount,
      refundProcessingTime: result.refundProcessingTime,
    },
  });
});

// ============================================
// Provider Booking Operations
// ============================================

export const getProviderBookings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (req.user.role !== 'provider') {
    throw new ApiError(403, 'Access denied. Only providers can access this endpoint');
  }

  const { error, value } = bookingFiltersSchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const result = await bookingService.getProviderBookings(providerId, value);

  res.json({
    success: true,
    data: result,
  });
});

export const acceptBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can accept bookings');
  }

  const { id } = req.params;
  const { error, value } = acceptBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.acceptBooking(id, providerId, value);

  res.json({
    success: true,
    message: 'Booking accepted successfully',
    data: { booking },
  });
});

export const rejectBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can reject bookings');
  }

  const { id } = req.params;
  const { error, value } = rejectBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.rejectBooking(id, providerId, value);

  res.json({
    success: true,
    message: 'Booking rejected successfully',
    data: { booking },
  });
});

export const startBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can start bookings');
  }

  const { id } = req.params;
  const { error, value } = Joi.object({ notes: Joi.string() }).validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.startBooking(id, providerId, value);

  res.json({
    success: true,
    message: 'Booking started successfully',
    data: { booking },
  });
});

export const completeBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can complete bookings');
  }

  const { id } = req.params;
  const { error, value } = completeBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.completeBooking(id, providerId, value);

  res.json({
    success: true,
    message: 'Booking marked as completed successfully',
    data: { booking },
  });
});

// ============================================
// Communication
// ============================================

export const addBookingMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error, value } = addMessageSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const user = req.user as any;
  const messageCount = await bookingService.addMessage(id, user._id.toString(), value);

  res.json({
    success: true,
    message: 'Message added successfully',
    data: { messageCount },
  });
});

// ============================================
// Guest Booking
// ============================================

export const createGuestBooking = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = guestBookingInputSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await bookingService.createGuestBooking(value);

  res.status(201).json({
    success: true,
    message: 'Guest booking submitted successfully',
    data: result,
  });
});

// ============================================
// Public Endpoints
// ============================================

export const trackBooking = asyncHandler(async (req: Request, res: Response) => {
  const { bookingNumber } = req.params;

  if (!bookingNumber) {
    throw new ApiError(400, 'Booking number is required');
  }

  const result = await bookingService.trackBooking(bookingNumber);

  res.json({
    success: true,
    data: result,
  });
});

// ============================================
// Export
// ============================================

export default {
  createBooking,
  getCustomerBookings,
  getBookingDetails,
  cancelBooking,
  getProviderBookings,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  addBookingMessage,
  createGuestBooking,
  trackBooking,
};
