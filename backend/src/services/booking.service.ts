import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import BookingNotification from '../models/bookingNotification.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import { validateProviderSlotAvailability } from '../utils/availabilityHelper';
import {
  BookingInputDTO,
  GuestBookingInputDTO,
  BookingFiltersDTO,
  BookingResult,
  CancellationResult,
  GuestBookingResult,
  PaginatedBookingsResult,
  PublicBookingTrackingDTO,
} from '../dto/booking.dto';

// ============================================
// BookingService Class
// ============================================

export class BookingService {
  // ========================================
  // Create Customer Booking
  // ========================================

  async createCustomerBooking(customerId: string, data: BookingInputDTO): Promise<BookingResult> {
    // Validate service exists and is active
    const service = await Service.findById(data.serviceId).populate('providerId');
    if (!service || !service.isActive) {
      throw new ApiError(404, 'Service not found or inactive');
    }

    // Validate provider
    const provider = await User.findById(data.providerId);
    if (!provider || provider.role !== 'provider') {
      throw new ApiError(404, 'Provider not found');
    }

    // Validate availability
    const availabilityResult = await validateProviderSlotAvailability({
      providerId: data.providerId,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      serviceDurationMinutes: service.duration,
    });

    if (!availabilityResult.isValid) {
      const error: any = new ApiError(
        availabilityResult.errorCode === 'CONFLICT' ? 409 : 400,
        availabilityResult.errorMessage!
      );
      error.availableSlots = availabilityResult.availableSlots;
      throw error;
    }

    // Calculate pricing
    const pricing = this.calculatePricing(service, data.addOns, data.selectedDuration);

    // Calculate times
    const requestedDate = new Date(data.scheduledDate);
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(requestedDate);
    serviceStart.setHours(hours, minutes, 0, 0);
    const estimatedEndTime = new Date(serviceStart.getTime() + (pricing.bookingDuration * 60 * 1000));
    const cancellationDeadline = new Date(serviceStart.getTime() - 24 * 60 * 60 * 1000);

    // Process location
    const processedLocation = this.processLocation(data.location);

    // Generate booking number
    const bookingNumber = this.generateBookingNumber();

    // Create booking
    const booking = new Booking({
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
        discounts: [],
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
      },
      customerInfo: {
        firstName: data.customerInfo?.firstName || '',
        lastName: data.customerInfo?.lastName || '',
        email: data.customerInfo?.email || '',
        phone: data.customerInfo?.phone || '',
        specialRequests: data.customerInfo?.specialRequests || data.specialRequests || '',
        accessInstructions: data.customerInfo?.accessInstructions || '',
      },
      cancellationPolicy: {
        allowedUntil: cancellationDeadline,
        refundPercentage: 100,
        cancellationFee: 0,
      },
      metadata: {
        bookingSource: data.metadata?.bookingSource || 'search',
        deviceType: data.metadata?.deviceType || 'desktop',
        sessionId: data.metadata?.sessionId,
      },
      status: 'pending',
    });

    await booking.save();

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

    return { booking };
  }

  // ========================================
  // Create Guest Booking
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

    // Validate service exists and is active
    const service = await Service.findById(data.serviceId);
    if (!service || !service.isActive) {
      throw new ApiError(404, 'Service not found or inactive');
    }

    // Validate provider
    const provider = await User.findById(data.providerId);
    if (!provider || provider.role !== 'provider') {
      throw new ApiError(404, 'Provider not found');
    }

    // Validate availability
    const availabilityResult = await validateProviderSlotAvailability({
      providerId: data.providerId,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      serviceDurationMinutes: service.duration,
    });

    if (!availabilityResult.isValid) {
      const error: any = new ApiError(
        availabilityResult.errorCode === 'CONFLICT' ? 409 : 400,
        availabilityResult.errorMessage!
      );
      error.availableSlots = availabilityResult.availableSlots;
      throw error;
    }

    // Calculate pricing
    const pricing = this.calculatePricing(service, data.addOns, data.selectedDuration);

    // Calculate times
    const requestedDate = new Date(data.scheduledDate);
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(requestedDate);
    serviceStart.setHours(hours, minutes, 0, 0);
    const estimatedEndTime = new Date(serviceStart.getTime() + (pricing.bookingDuration * 60 * 1000));
    const cancellationDeadline = new Date(serviceStart.getTime() - 24 * 60 * 60 * 1000);

    // Process location
    const processedLocation = this.processLocation(data.location);

    // Generate booking number
    const bookingNumber = this.generateBookingNumber();

    // Create guest booking
    const booking = new Booking({
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
        discounts: [],
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
      },
      customerInfo: {
        firstName: data.guestInfo.name.split(' ')[0] || data.guestInfo.name,
        lastName: data.guestInfo.name.split(' ').slice(1).join(' ') || '',
        email: data.guestInfo.email,
        phone: data.guestInfo.phone,
        specialRequests: data.specialRequests || '',
      },
      cancellationPolicy: {
        allowedUntil: cancellationDeadline,
        refundPercentage: 100,
        cancellationFee: 0,
      },
      metadata: {
        bookingSource: 'search',
        deviceType: 'desktop',
      },
      status: 'pending',
    });

    await booking.save();

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
  // Get Customer Bookings
  // ========================================

  async getCustomerBookings(customerId: string, filters: BookingFiltersDTO): Promise<PaginatedBookingsResult> {
    const query: any = { customerId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('provider', 'firstName lastName businessInfo rating')
        .populate('service', 'name category price duration images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return {
      bookings: bookings as any,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ========================================
  // Get Provider Bookings
  // ========================================

  async getProviderBookings(providerId: string, filters: BookingFiltersDTO): Promise<PaginatedBookingsResult> {
    const query: any = { providerId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('customer', 'firstName lastName email avatar loyaltySystem')
        .populate('service', 'name category price duration')
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return {
      bookings: bookings as any,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
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
      .populate('service', 'name category subcategory description price duration images tags');

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
      .populate('serviceId', 'name category subcategory price duration images');

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
          }
        : undefined,
      provider: booking.providerId
        ? {
            name: `${(booking.providerId as any).firstName} ${(booking.providerId as any).lastName}`,
          }
        : undefined,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration,
      pricing: {
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
      },
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

    // Update booking status
    await booking.updateStatus('in_progress', 'provider', 'Service started by provider', data?.notes);

    booking.providerResponse.arrivalTime = new Date();
    if (data?.notes) {
      booking.providerResponse.notes = data.notes;
    }

    await booking.save();

    // Send notification
    await this.createBookingNotifications(booking, 'booking_started');

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

    return booking;
  }

  // ========================================
  // Cancel Booking (Customer)
  // ========================================

  async cancelBooking(bookingId: string, customerId: string, data?: { reason?: string }): Promise<CancellationResult> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    if (!booking.customerId || booking.customerId.toString() !== customerId) {
      throw new ApiError(403, 'Only the customer who made the booking can cancel it');
    }

    // Check if booking can be cancelled
    if (!booking.canCustomerCancel()) {
      const error: any = new ApiError(400, 'Booking cannot be cancelled');
      error.currentStatus = booking.status;
      error.cancellationDeadline = booking.cancellationPolicy.allowedUntil;
      throw error;
    }

    // Calculate refund
    const refundAmount = booking.calculateRefund();

    // Update booking
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationDetails = {
      cancelledBy: 'customer',
      cancelledAt: new Date(),
      reason: data?.reason || 'Cancelled by customer',
      refundAmount,
      refundStatus: 'pending',
    };

    await booking.save();

    // Send notifications
    await this.createBookingNotifications(booking, 'booking_cancelled');

    return {
      booking: booking as any,
      refundAmount,
      refundProcessingTime: '3-5 business days',
    };
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
    const tax = subtotal * 0.18; // 18% GST
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
      console.error('Error creating booking notifications:', error);
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
      console.error('Error creating message notification:', error);
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
          },
        }
      );
    } catch (error) {
      console.warn('Failed to update provider analytics:', error);
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
      console.error('Failed to send booking email:', error);
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
      console.error('Failed to send guest booking email:', error);
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
      console.error('Failed to send confirmation email:', error);
    }
  }
}

// Export singleton instance
export const bookingService = new BookingService();
