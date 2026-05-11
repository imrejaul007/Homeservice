import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import BookingNotification from '../models/bookingNotification.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import { asyncHandler } from '../utils/asyncHandler';
import { validateProviderSlotAvailability } from '../utils/availabilityHelper';
// validateBookingInput is used in routes, not in controller

// ===================================
// CUSTOMER BOOKING OPERATIONS
// ===================================

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (Customer)
const createBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const {
    serviceId,
    providerId,
    scheduledDate,
    scheduledTime,
    location,
    customerInfo,
    addOns = [],
    specialRequests,
    metadata = {},
    // New booking flow fields
    locationType = 'at_home',
    selectedDuration,
    professionalPreference = 'no_preference',
    paymentMethod = 'credit_card'
  } = req.body;

  // Validate customer authorization
  if (req.user?.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Only customers can create bookings'
    });
  }

  // Validate service exists and is active
  const service = await Service.findById(serviceId).populate('providerId');
  if (!service || !service.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Service not found or inactive'
    });
  }

  // Validate provider
  const provider = await User.findById(providerId);
  if (!provider || provider.role !== 'provider') {
    return res.status(404).json({
      success: false,
      message: 'Provider not found'
    });
  }

  // Validate provider availability using ProviderProfile (single source of truth)
  const availabilityCheck = await validateProviderSlotAvailability({
    providerId,
    scheduledDate,
    scheduledTime,
    serviceDurationMinutes: service.duration
  });

  if (!availabilityCheck.isValid) {
    const statusCode = availabilityCheck.errorCode === 'CONFLICT' ? 409 : 400;
    return res.status(statusCode).json({
      success: false,
      message: availabilityCheck.errorMessage,
      data: {
        requestedTime: scheduledTime,
        availableSlots: availabilityCheck.availableSlots || []
      }
    });
  }

  const requestedDate = new Date(scheduledDate);

  // Determine duration and price based on selectedDuration or default
  let bookingDuration = service.duration;
  let basePrice = service.price.amount;

  // If selectedDuration is provided and service has durationOptions, use that
  if (selectedDuration && service.durationOptions && service.durationOptions.length > 0) {
    const selectedOption = service.durationOptions.find(
      (opt: any) => opt.duration === selectedDuration
    );
    if (selectedOption) {
      bookingDuration = selectedOption.duration;
      basePrice = selectedOption.price;
    }
  } else if (selectedDuration) {
    // If selectedDuration is provided but no durationOptions, just use selectedDuration
    bookingDuration = selectedDuration;
  }

  // Calculate pricing
  let addOnTotal = 0;

  if (addOns && addOns.length > 0) {
    addOnTotal = addOns.reduce((total: number, addOn: any) => total + addOn.price, 0);
  }

  const subtotal = basePrice + addOnTotal;
  const tax = subtotal * 0.18; // 18% GST for India, can be configurable
  const totalAmount = subtotal + tax;

  // Determine currency based on provider location or service currency
  const currency = service.price.currency || 'AED';

  // Calculate estimated end time
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const serviceStart = new Date(requestedDate);
  serviceStart.setHours(hours, minutes, 0, 0);
  const estimatedEndTime = new Date(serviceStart.getTime() + (bookingDuration * 60 * 1000));

  // Set cancellation policy (24 hours before service)
  const cancellationDeadline = new Date(serviceStart.getTime() - (24 * 60 * 60 * 1000));

  // Process location data - only include address/coordinates for customer_address
  const processedLocation: any = {
    type: location.type,
    notes: location.notes
  };

  // Only include address for customer_address location type
  if (location.type === 'customer_address' && location.address) {
    processedLocation.address = {
      street: location.address.street,
      city: location.address.city,
      state: location.address.state,
      zipCode: location.address.zipCode,
      country: location.address.country || 'AE'
      // Coordinates can be added later when needed
    };
  }

  // Generate unique booking number
  const bookingNumber = `RZ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;

  // Create booking
  const booking = new Booking({
    bookingNumber,
    customerId: (req.user as any)._id as string,
    providerId,
    serviceId,
    scheduledDate: requestedDate,
    scheduledTime,
    duration: bookingDuration,
    estimatedEndTime,
    // New booking flow fields
    locationType,
    selectedDuration: bookingDuration,
    professionalPreference,
    paymentMethod,
    location: processedLocation,
    pricing: {
      basePrice,
      addOns: addOns || [],
      discounts: [], // Can be enhanced with discount logic
      subtotal,
      tax,
      totalAmount,
      currency
    },
    customerInfo: {
      firstName: customerInfo?.firstName || req.user.firstName || '',
      lastName: customerInfo?.lastName || req.user.lastName || '',
      email: customerInfo?.email || req.user.email || '',
      phone: customerInfo?.phone || req.user.phone || '',
      specialRequests: customerInfo?.specialRequests || specialRequests || '',
      accessInstructions: customerInfo?.accessInstructions || ''
    },
    cancellationPolicy: {
      allowedUntil: cancellationDeadline,
      refundPercentage: 100,
      cancellationFee: 0
    },
    metadata: {
      bookingSource: metadata.bookingSource || 'search',
      deviceType: metadata.deviceType || 'desktop',
      userAgent: req.get('User-Agent'),
      sessionId: metadata.sessionId
    },
    status: 'pending' // TEMPORARY: Default to pending for testing
  });

  await booking.save();

  // Send notifications
  await createBookingNotifications(booking, 'booking_request');

  // Populate booking details for response
  await booking.populate([
    { path: 'customer', select: 'firstName lastName email avatar' },
    { path: 'provider', select: 'firstName lastName email businessInfo' },
    { path: 'service', select: 'name category price duration images' }
  ]);

  // Send booking request email to customer
  try {
    const { sendBookingRequestEmail } = await import('../services/email.service');
    const customerUser = await User.findById((req.user as any)._id);
    if (customerUser?.email) {
      await sendBookingRequestEmail(customerUser.email, customerUser.firstName || 'Customer', {
        bookingNumber,
        serviceName: service.name,
        providerName: provider.firstName || 'Provider',
        scheduledDate: new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        scheduledTime,
        duration: bookingDuration,
        location: processedLocation.address?.street || (locationType === 'at_home' ? 'At Home' : 'Hotel'),
        currency,
        totalAmount: totalAmount.toFixed(2)
      });
      console.log('📧 Booking request email sent to customer');
    }
  } catch (emailError) {
    console.error('📧 Failed to send booking email (non-blocking):', emailError);
  }

  return res.status(201).json({
    success: true,
    message: 'Booking request submitted, awaiting provider confirmation',
    data: { booking }
  });
});

// @desc    Get customer's bookings
// @route   GET /api/bookings/customer
// @access  Private (Customer)
const getCustomerBookings = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { status, page = 1, limit = 20, startDate, endDate } = req.query;

  if (req.user?.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Build query - use the user's ID from the authenticated user
  const user = req.user as any;
  const userId = user._id || user.id;
  const query: any = { customerId: userId };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.scheduledDate = {};
    if (startDate) query.scheduledDate.$gte = new Date(startDate as string);
    if (endDate) query.scheduledDate.$lte = new Date(endDate as string);
  }

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('provider', 'firstName lastName businessInfo rating')
      .populate('service', 'name category price duration images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(query)
  ]);

  return res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Get specific booking details
// @route   GET /api/bookings/:id
// @access  Private (Customer/Provider/Admin)
const getBookingDetails = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID'
    });
  }

  const booking = await Booking.findById(id)
    .populate('customer', 'firstName lastName email avatar loyaltySystem')
    .populate('provider', 'firstName lastName email businessInfo rating')
    .populate('service', 'name category subcategory description price duration images tags');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check
  const user = req.user as any;
  const userId = user._id || user.id;
  const isAuthorized =
    (booking.customerId && userId.toString() === booking.customerId.toString()) ||
    userId.toString() === booking.providerId.toString() ||
    user?.role === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  return res.json({
    success: true,
    data: { booking }
  });
});

// @desc    Cancel booking (Customer)
// @route   PATCH /api/bookings/:id/cancel
// @access  Private (Customer)
const cancelBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check
  const user = req.user as any;
  const userId = user._id || user.id;
  if (!booking.customerId || userId.toString() !== booking.customerId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only the customer who made the booking can cancel it'
    });
  }

  // Check if booking can be cancelled
  if (!booking.canCustomerCancel()) {
    return res.status(400).json({
      success: false,
      message: 'Booking cannot be cancelled',
      data: {
        currentStatus: booking.status,
        cancellationDeadline: booking.cancellationPolicy.allowedUntil
      }
    });
  }

  // Calculate refund
  const refundAmount = booking.calculateRefund();

  // Update booking
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationDetails = {
    cancelledBy: 'customer',
    cancelledAt: new Date(),
    reason: reason || 'Cancelled by customer',
    refundAmount,
    refundStatus: 'pending'
  };

  await booking.save();

  // Send notifications
  await createBookingNotifications(booking, 'booking_cancelled');

  return res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking,
      refundAmount,
      refundProcessingTime: '3-5 business days'
    }
  });
});

// ===================================
// PROVIDER BOOKING OPERATIONS
// ===================================

// @desc    Get provider's bookings
// @route   GET /api/bookings/provider
// @access  Private (Provider)
const getProviderBookings = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { status, page = 1, limit = 20, startDate, endDate } = req.query;

  // Check if user is authenticated and is a provider
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only providers can access this endpoint'
    });
  }

  // Build query - use the user's ID from the authenticated user
  const user = req.user as any;
  const userId = user._id || user.id;
  const query: any = { providerId: userId };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.scheduledDate = {};
    if (startDate) query.scheduledDate.$gte = new Date(startDate as string);
    if (endDate) query.scheduledDate.$lte = new Date(endDate as string);
  }

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('customer', 'firstName lastName email avatar loyaltySystem')
      .populate('service', 'name category price duration')
      .sort({ scheduledDate: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(query)
  ]);

  return res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Accept booking request (Provider)
// @route   PATCH /api/bookings/:id/accept
// @access  Private (Provider)
const acceptBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { notes, estimatedArrival } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check - properly compare ObjectIds
  const user = req.user as any; // Type assertion to fix TypeScript compilation
  const currentUserId = user._id.toString();
  const bookingProviderId = booking.providerId.toString();
  
  console.log('Authorization check:', {
    currentUserId,
    bookingProviderId,
    userRole: user.role,
    match: currentUserId === bookingProviderId
  });
  
  if (currentUserId !== bookingProviderId) {
    return res.status(403).json({
      success: false,
      message: 'Only the assigned provider can accept this booking',
      debug: {
        currentUserId,
        bookingProviderId,
        userRole: user.role
      }
    });
  }

  // Check if booking can be accepted
  if (booking.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Booking cannot be accepted',
      data: { currentStatus: booking.status }
    });
  }

  // Update booking
  await booking.updateStatus('confirmed', 'provider', 'Booking accepted by provider', notes);

  if (estimatedArrival) {
    booking.providerResponse.estimatedArrival = new Date(estimatedArrival);
  }

  booking.providerResponse.acceptedAt = new Date();
  booking.providerResponse.notes = notes;

  await booking.save();

  // Send confirmation notification
  await createBookingNotifications(booking, 'booking_confirmed');

  // Send booking confirmation email to customer
  try {
    const { sendBookingConfirmationEmail } = await import('../services/email.service');
    const service = await Service.findById(booking.serviceId);
    const provider = await User.findById(booking.providerId);

    if (booking.isGuestBooking && booking.guestInfo?.email) {
      // Guest booking
      await sendBookingConfirmationEmail(booking.guestInfo.email, booking.guestInfo.name || 'Guest', {
        bookingNumber: booking.bookingNumber,
        serviceName: service?.name || 'Service',
        providerName: provider?.firstName || 'Provider',
        providerEmail: provider?.email || '',
        scheduledDate: new Date(booking.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        scheduledTime: booking.scheduledTime,
        duration: booking.duration,
        location: booking.location?.address?.street || 'At location',
        currency: booking.pricing?.currency || 'AED',
        totalAmount: (booking.pricing?.totalAmount || 0).toFixed(2)
      });
    } else {
      // Authenticated booking
      const customer = await User.findById(booking.customerId);
      if (customer?.email) {
        await sendBookingConfirmationEmail(customer.email, customer.firstName || 'Customer', {
          bookingNumber: booking.bookingNumber,
          serviceName: service?.name || 'Service',
          providerName: provider?.firstName || 'Provider',
          providerEmail: provider?.email || '',
          scheduledDate: new Date(booking.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          scheduledTime: booking.scheduledTime,
          duration: booking.duration,
          location: booking.location?.address?.street || 'At location',
          currency: booking.pricing?.currency || 'AED',
          totalAmount: (booking.pricing?.totalAmount || 0).toFixed(2)
        });
      }
    }
    console.log('📧 Booking confirmation email sent');
  } catch (emailError) {
    console.error('📧 Failed to send confirmation email (non-blocking):', emailError);
  }

  return res.json({
    success: true,
    message: 'Booking accepted successfully',
    data: { booking }
  });
});

// @desc    Reject booking request (Provider)
// @route   PATCH /api/bookings/:id/reject
// @access  Private (Provider)
const rejectBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check - properly compare ObjectIds
  const user = req.user as any; // Type assertion to fix TypeScript compilation
  const currentUserId = user._id.toString();
  const bookingProviderId = booking.providerId.toString();
  
  if (currentUserId !== bookingProviderId) {
    return res.status(403).json({
      success: false,
      message: 'Only the assigned provider can reject this booking'
    });
  }

  // Check if booking can be rejected
  if (booking.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Booking cannot be rejected',
      data: { currentStatus: booking.status }
    });
  }

  // Update booking
  await booking.updateStatus('cancelled', 'provider', reason || 'Rejected by provider');

  booking.providerResponse.rejectedAt = new Date();
  booking.providerResponse.rejectionReason = reason;

  booking.cancellationDetails = {
    cancelledBy: 'provider',
    cancelledAt: new Date(),
    reason: reason || 'Rejected by provider',
    refundAmount: booking.pricing.totalAmount, // Full refund for provider rejection
    refundStatus: 'pending'
  };

  await booking.save();

  // Send notification
  await createBookingNotifications(booking, 'booking_rejected');

  return res.json({
    success: true,
    message: 'Booking rejected successfully',
    data: { booking }
  });
});

// @desc    Start booking (Provider)
// @route   PATCH /api/bookings/:id/start
// @access  Private (Provider)
const startBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { notes } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check - properly compare ObjectIds
  const user = req.user as any; // Type assertion to fix TypeScript compilation
  const currentUserId = user._id.toString();
  const bookingProviderId = booking.providerId.toString();
  
  if (currentUserId !== bookingProviderId) {
    return res.status(403).json({
      success: false,
      message: 'Only the assigned provider can start this booking'
    });
  }

  // Check if booking can be started
  if (booking.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: 'Booking cannot be started',
      data: { currentStatus: booking.status }
    });
  }

  // Update booking status to in_progress
  await booking.updateStatus('in_progress', 'provider', 'Service started by provider', notes);

  booking.providerResponse.arrivalTime = new Date();
  if (notes) {
    booking.providerResponse.notes = notes;
  }

  await booking.save();

  // Send notification
  await createBookingNotifications(booking, 'booking_started');

  return res.json({
    success: true,
    message: 'Booking started successfully',
    data: { booking }
  });
});

// @desc    Mark booking as completed (Provider)
// @route   PATCH /api/bookings/:id/complete
// @access  Private (Provider)
const completeBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { notes, actualDuration } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check - properly compare ObjectIds
  const user = req.user as any; // Type assertion to fix TypeScript compilation
  const currentUserId = user._id.toString();
  const bookingProviderId = booking.providerId.toString();
  
  if (currentUserId !== bookingProviderId) {
    return res.status(403).json({
      success: false,
      message: 'Only the assigned provider can complete this booking'
    });
  }

  // Check if booking can be completed
  if (!['confirmed', 'in_progress'].includes(booking.status)) {
    return res.status(400).json({
      success: false,
      message: 'Booking cannot be completed',
      data: { currentStatus: booking.status }
    });
  }

  // Update booking
  await booking.markAsCompleted();

  booking.providerResponse.completedAt = new Date();
  booking.providerResponse.notes = notes;

  if (actualDuration) {
    booking.duration = actualDuration;
  }

  await booking.save();

  // Update provider analytics
  try {
    const providerBookings = await Booking.find({ providerId: booking.providerId });
    const totalBookings = providerBookings.length;
    const completedBookings = providerBookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = providerBookings.filter(b => b.status === 'cancelled').length;
    const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

    // Calculate repeat customers
    const customerIds = providerBookings
      .filter(b => b.customerId)
      .map(b => b.customerId?.toString());
    const uniqueCustomers = new Set(customerIds).size;
    const repeatCustomers = customerIds.length - uniqueCustomers;
    const repeatCustomerRate = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;

    // Average booking value
    const completedWithPrice = providerBookings.filter(b => b.status === 'completed' && b.pricing?.totalAmount);
    const averageBookingValue = completedWithPrice.length > 0
      ? completedWithPrice.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0) / completedWithPrice.length
      : 0;

    await ProviderProfile.findOneAndUpdate(
      { userId: booking.providerId },
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
        }
      }
    );
    console.log(`📊 Updated provider analytics for ${booking.providerId}: ${completedBookings}/${totalBookings} completed (${completionRate}%)`);
  } catch (analyticsError) {
    console.warn('Failed to update provider analytics:', analyticsError);
  }

  // Send completion notification
  await createBookingNotifications(booking, 'booking_completed');

  return res.json({
    success: true,
    message: 'Booking marked as completed successfully',
    data: { booking }
  });
});

// ===================================
// BOOKING COMMUNICATION
// ===================================

// @desc    Add message to booking
// @route   POST /api/bookings/:id/messages
// @access  Private (Customer/Provider)
const addBookingMessage = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }

  const booking = await Booking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Authorization check
  const user = req.user as any;
  const isAuthorized =
    (booking.customerId && (user._id as string) === booking.customerId.toString()) ||
    (user._id as string) === booking.providerId.toString();

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Add message
  await booking.addMessage(new mongoose.Types.ObjectId(user._id as string), message.trim());

  // Send notification to the other party
  const recipientId = (booking.customerId && (user._id as string) === booking.customerId.toString()) ?
    booking.providerId : booking.customerId;

  await createMessageNotification(booking, recipientId);

  return res.json({
    success: true,
    message: 'Message added successfully',
    data: {
      messageCount: booking.messages.length
    }
  });
});

// ===================================
// UTILITY FUNCTIONS
// ===================================

// Create booking notifications
async function createBookingNotifications(booking: any, type: string) {
  try {
    // Notification for customer
    const customerNotification = new BookingNotification({
      bookingId: booking._id,
      recipientId: booking.customerId,
      type,
      title: getNotificationTitle(type, 'customer'),
      message: getNotificationMessage(type, 'customer'),
      metadata: {
        bookingNumber: booking.bookingNumber,
        serviceName: booking.service?.name,
        providerName: booking.provider?.businessInfo?.businessName,
        scheduledDate: booking.scheduledDate,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency
      }
    });

    // Notification for provider
    const providerNotification = new BookingNotification({
      bookingId: booking._id,
      recipientId: booking.providerId,
      type,
      title: getNotificationTitle(type, 'provider'),
      message: getNotificationMessage(type, 'provider'),
      metadata: {
        bookingNumber: booking.bookingNumber,
        serviceName: booking.service?.name,
        customerName: `${booking.customerInfo.firstName} ${booking.customerInfo.lastName}`,
        scheduledDate: booking.scheduledDate,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency
      }
    });

    await Promise.all([
      customerNotification.save(),
      providerNotification.save()
    ]);

  } catch (error) {
    console.error('Error creating booking notifications:', error);
  }
}

// Create message notification
async function createMessageNotification(booking: any, recipientId: any) {
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
        serviceName: booking.service?.name
      }
    });

    await notification.save();
  } catch (error) {
    console.error('Error creating message notification:', error);
  }
}

// Get notification titles
function getNotificationTitle(type: string, recipient: string): string {
  const titles: { [key: string]: { [key: string]: string } } = {
    booking_request: {
      customer: 'Booking Request Submitted',
      provider: 'New Booking Request'
    },
    booking_confirmed: {
      customer: 'Booking Confirmed',
      provider: 'Booking Accepted'
    },
    booking_cancelled: {
      customer: 'Booking Cancelled',
      provider: 'Booking Cancelled'
    },
    booking_rejected: {
      customer: 'Booking Request Declined',
      provider: 'Booking Rejected'
    },
    booking_started: {
      customer: 'Service Started',
      provider: 'Service Started'
    },
    booking_completed: {
      customer: 'Service Completed',
      provider: 'Service Completed'
    }
  };

  return titles[type]?.[recipient] || 'Booking Update';
}

// Get notification messages
function getNotificationMessage(type: string, recipient: string): string {
  const messages: { [key: string]: { [key: string]: string } } = {
    booking_request: {
      customer: `Your booking request for {{serviceName}} on {{scheduledDate}} has been submitted. You'll be notified once the provider responds.`,
      provider: `You have a new booking request for {{serviceName}} on {{scheduledDate}} from {{customerName}}.`
    },
    booking_confirmed: {
      customer: `Great! Your booking for {{serviceName}} on {{scheduledDate}} has been confirmed by {{providerName}}.`,
      provider: `You have successfully accepted the booking request for {{serviceName}} on {{scheduledDate}}.`
    },
    booking_cancelled: {
      customer: `Your booking {{bookingNumber}} for {{serviceName}} has been cancelled. Refund will be processed if applicable.`,
      provider: `Booking {{bookingNumber}} for {{serviceName}} on {{scheduledDate}} has been cancelled by the customer.`
    },
    booking_rejected: {
      customer: `Unfortunately, your booking request for {{serviceName}} on {{scheduledDate}} has been declined by the provider.`,
      provider: `You have declined the booking request for {{serviceName}} on {{scheduledDate}}.`
    },
    booking_started: {
      customer: `Your service {{serviceName}} has been started by {{providerName}}. They should arrive shortly.`,
      provider: `You have started the service {{serviceName}} for {{customerName}}.`
    },
    booking_completed: {
      customer: `Your service {{serviceName}} has been completed. Please consider leaving a review for {{providerName}}.`,
      provider: `You have successfully completed the service {{serviceName}} for {{customerName}}.`
    }
  };

  return messages[type]?.[recipient] || 'Your booking has been updated.';
}

// ===================================
// GUEST BOOKING OPERATIONS
// ===================================

// @desc    Create guest booking (no auth required)
// @route   POST /api/bookings/guest
// @access  Public
const createGuestBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const {
    serviceId,
    providerId,
    scheduledDate,
    scheduledTime,
    location,
    guestInfo,
    addOns = [],
    specialRequests,
    locationType = 'at_home',
    selectedDuration,
    professionalPreference = 'no_preference',
    paymentMethod = 'credit_card'
  } = req.body;

  // Validate guest info
  if (!guestInfo?.name || !guestInfo?.email || !guestInfo?.phone) {
    return res.status(400).json({
      success: false,
      message: 'Guest name, email, and phone are required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(guestInfo.email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }

  // Validate service exists and is active
  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Service not found or inactive'
    });
  }

  // Validate provider
  const provider = await User.findById(providerId);
  if (!provider || provider.role !== 'provider') {
    return res.status(404).json({
      success: false,
      message: 'Provider not found'
    });
  }

  // Validate provider availability using ProviderProfile (single source of truth)
  const guestAvailabilityCheck = await validateProviderSlotAvailability({
    providerId,
    scheduledDate,
    scheduledTime,
    serviceDurationMinutes: service.duration
  });

  if (!guestAvailabilityCheck.isValid) {
    const statusCode = guestAvailabilityCheck.errorCode === 'CONFLICT' ? 409 : 400;
    return res.status(statusCode).json({
      success: false,
      message: guestAvailabilityCheck.errorMessage,
      data: {
        requestedTime: scheduledTime,
        availableSlots: guestAvailabilityCheck.availableSlots || []
      }
    });
  }

  const requestedDate = new Date(scheduledDate);

  // Calculate pricing
  let bookingDuration = service.duration;
  let basePrice = service.price.amount;

  if (selectedDuration && service.durationOptions && service.durationOptions.length > 0) {
    const selectedOption = service.durationOptions.find((opt: any) => opt.duration === selectedDuration);
    if (selectedOption) {
      bookingDuration = selectedOption.duration;
      basePrice = selectedOption.price;
    }
  } else if (selectedDuration) {
    bookingDuration = selectedDuration;
  }

  let addOnTotal = 0;
  if (addOns && addOns.length > 0) {
    addOnTotal = addOns.reduce((total: number, addOn: any) => total + addOn.price, 0);
  }

  const subtotal = basePrice + addOnTotal;
  const tax = subtotal * 0.05; // 5% VAT for UAE
  const totalAmount = subtotal + tax;
  const currency = service.price.currency || 'AED';

  // Calculate times
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const serviceStart = new Date(requestedDate);
  serviceStart.setHours(hours, minutes, 0, 0);
  const estimatedEndTime = new Date(serviceStart.getTime() + (bookingDuration * 60 * 1000));
  const cancellationDeadline = new Date(serviceStart.getTime() - (24 * 60 * 60 * 1000));

  // Process location
  const processedLocation: any = {
    type: location?.type || 'customer_address',
    notes: location?.notes
  };

  if (location?.type === 'customer_address' && location?.address) {
    processedLocation.address = {
      street: location.address.street,
      city: location.address.city,
      state: location.address.state,
      zipCode: location.address.zipCode,
      country: location.address.country || 'AE'
    };
  }

  // Generate booking number
  const bookingNumber = `RZ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;

  // Create guest booking
  const booking = new Booking({
    bookingNumber,
    customerId: null,
    isGuestBooking: true,
    guestInfo: {
      name: guestInfo.name,
      email: guestInfo.email,
      phone: guestInfo.phone
    },
    providerId,
    serviceId,
    scheduledDate: requestedDate,
    scheduledTime,
    duration: bookingDuration,
    estimatedEndTime,
    locationType,
    selectedDuration: bookingDuration,
    professionalPreference,
    paymentMethod,
    location: processedLocation,
    pricing: {
      basePrice,
      addOns: addOns || [],
      discounts: [],
      subtotal,
      tax,
      totalAmount,
      currency
    },
    customerInfo: {
      firstName: guestInfo.name.split(' ')[0] || guestInfo.name,
      lastName: guestInfo.name.split(' ').slice(1).join(' ') || '',
      email: guestInfo.email,
      phone: guestInfo.phone,
      specialRequests: specialRequests || ''
    },
    cancellationPolicy: {
      allowedUntil: cancellationDeadline,
      refundPercentage: 100,
      cancellationFee: 0
    },
    metadata: {
      bookingSource: 'search',
      deviceType: 'desktop',
      userAgent: req.get('User-Agent')
    },
    status: 'pending'
  });

  await booking.save();

  // Send email notification to guest
  try {
    const { sendBookingRequestEmail } = await import('../services/email.service');
    await sendBookingRequestEmail(guestInfo.email, guestInfo.name, {
      bookingNumber: booking.bookingNumber,
      serviceName: service.name,
      providerName: provider.firstName + ' ' + provider.lastName,
      scheduledDate: requestedDate.toLocaleDateString('en-AE'),
      scheduledTime,
      duration: bookingDuration,
      location: processedLocation.address?.city || 'Dubai',
      currency,
      totalAmount: totalAmount.toFixed(2),
      trackingUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/track/${booking.bookingNumber}`
    });
  } catch (emailError) {
    console.error('Failed to send guest booking email:', emailError);
    // Don't fail the booking if email fails
  }

  // Send notification to provider
  await createBookingNotifications(booking, 'booking_request');

  return res.status(201).json({
    success: true,
    message: 'Guest booking submitted successfully',
    data: {
      booking: {
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        duration: booking.duration,
        pricing: booking.pricing,
        guestInfo: {
          name: guestInfo.name,
          email: guestInfo.email
        }
      },
      trackingUrl: `/track/${booking.bookingNumber}`
    }
  });
});

// @desc    Track booking by booking number (public)
// @route   GET /api/bookings/track/:bookingNumber
// @access  Public
const trackBooking = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { bookingNumber } = req.params;

  if (!bookingNumber) {
    return res.status(400).json({
      success: false,
      message: 'Booking number is required'
    });
  }

  const booking = await Booking.findOne({ bookingNumber })
    .populate('providerId', 'firstName lastName')
    .populate('serviceId', 'name category subcategory price duration images');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found. Please check your booking number.'
    });
  }

  // Return limited public info for tracking
  return res.json({
    success: true,
    data: {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      statusHistory: booking.statusHistory.map(s => ({
        status: s.status,
        timestamp: s.timestamp,
        reason: s.reason
      })),
      service: booking.serviceId ? {
        name: (booking.serviceId as any).name,
        category: (booking.serviceId as any).category,
        subcategory: (booking.serviceId as any).subcategory
      } : null,
      provider: booking.providerId ? {
        name: `${(booking.providerId as any).firstName} ${(booking.providerId as any).lastName}`
      } : null,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration,
      pricing: {
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency
      },
      isGuestBooking: booking.isGuestBooking,
      createdAt: booking.createdAt
    }
  });
});

export {
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
  trackBooking
};