/**
 * Bundle Booking Service
 *
 * Handles service bundle booking, tracking, and partial fulfillment
 */

import mongoose, { ClientSession } from 'mongoose';
import Bundle, { IBundle } from '../models/bundle.model';
import BundleBooking, { IBundleBooking } from '../models/bundleBooking.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import User, { IUser } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface BundleBookingInput {
  bundleId: string;
  customerId: string;
  addressId?: string;
  scheduledDate: string;
  notes?: string;
  services?: Array<{
    serviceId: string;
    scheduledDate?: string;
    scheduledTime?: string;
  }>;
}

export interface BundleBookingResult {
  bookingId: string;
  bookingNumber: string;
  bundleId: string;
  bundleName: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    bookingId: string;
    bookingNumber: string;
    status: string;
    scheduledDate: string;
    scheduledTime?: string;
  }>;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: Date;
}

export interface BundleUsageRecord {
  bundleId: string;
  bundleName: string;
  totalServices: number;
  usedServices: number;
  remainingServices: number;
  bookings: Array<{
    bookingId: string;
    serviceName: string;
    scheduledDate: string;
    status: string;
  }>;
  expiredServices: string[];
  totalValue: number;
  remainingValue: number;
}

export interface PartialFulfillmentResult {
  canFulfill: boolean;
  missingServices: Array<{
    serviceId: string;
    serviceName: string;
    reason: string;
  }>;
  alternativeDates?: Array<{
    date: string;
    available: boolean;
  }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate bundle exists and is active
 */
async function validateBundle(bundleId: string): Promise<IBundle> {
  const bundle = await Bundle.findById(bundleId);

  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  if (!bundle.isActive) {
    throw ApiError.badRequest('This bundle is no longer available');
  }

  const now = new Date();
  if (new Date(bundle.validFrom) > now) {
    throw ApiError.badRequest('This bundle is not yet available');
  }

  if (new Date(bundle.validUntil) < now) {
    throw ApiError.badRequest('This bundle has expired');
  }

  if (bundle.maxRedemptions && bundle.redemptionsUsed >= bundle.maxRedemptions) {
    throw ApiError.badRequest('This bundle has reached its maximum redemptions');
  }

  return bundle;
}

/**
 * Validate customer exists
 */
async function validateCustomer(customerId: string): Promise<IUser> {
  const user = await User.findById(customerId);

  if (!user) {
    throw ApiError.notFound('Customer not found');
  }

  if (user.role !== 'customer') {
    throw ApiError.badRequest('Only customers can book bundles');
  }

  return user;
}

/**
 * Calculate bundle usage for a customer
 */
async function calculateBundleUsage(
  customerId: string,
  bundleId: string
): Promise<{
  usedServices: number;
  totalValueUsed: number;
  bookings: IBundleBooking[];
}> {
  const bookings = await BundleBooking.find({
    customerId: new mongoose.Types.ObjectId(customerId),
    bundleId: new mongoose.Types.ObjectId(bundleId),
    status: { $in: ['completed', 'confirmed', 'in_progress'] },
  });

  let usedServices = 0;
  let totalValueUsed = 0;

  for (const booking of bookings) {
    for (const service of booking.services) {
      if (['completed', 'confirmed', 'in_progress'].includes(service.status)) {
        usedServices++;
        totalValueUsed += service.originalPrice;
      }
    }
  }

  return { usedServices, totalValueUsed, bookings };
}

/**
 * Generate unique booking number
 */
async function generateBundleBookingNumber(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await BundleBooking.countDocuments({
    createdAt: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999)),
    },
  });

  return `BB${dateStr}${(count + 1).toString().padStart(4, '0')}`;
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Book a service bundle as a single unit
 * Creates individual bookings for each service in the bundle
 */
export async function bookBundle(
  input: BundleBookingInput,
  session?: ClientSession
): Promise<BundleBookingResult> {
  const { bundleId, customerId, addressId, scheduledDate, notes, services } = input;

  // Validate inputs
  if (!bundleId || !customerId || !scheduledDate) {
    throw ApiError.badRequest('Bundle ID, customer ID, and scheduled date are required');
  }

  // Validate bundle and customer in parallel
  const [bundle, customer] = await Promise.all([
    validateBundle(bundleId),
    validateCustomer(customerId),
  ]);

  // Calculate existing usage
  const usage = await calculateBundleUsage(customerId, bundleId);

  // Check if all services can be redeemed
  const availableServices = bundle.services.length - usage.usedServices;
  if (availableServices <= 0) {
    throw ApiError.badRequest('All services in this bundle have already been redeemed');
  }

  // Start a session for transaction
  const mongoSession = session || await mongoose.startSession();
  const shouldReleaseSession = !session;

  try {
    if (shouldReleaseSession) {
      mongoSession.startTransaction();
    }

    // Create bundle booking record
    const bookingNumber = await generateBundleBookingNumber();

    const bundleBooking = new BundleBooking({
      bundleId: bundle._id,
      bundleName: bundle.name,
      customerId: new mongoose.Types.ObjectId(customerId),
      bookingNumber,
      addressId: addressId ? new mongoose.Types.ObjectId(addressId) : undefined,
      notes,
      status: 'confirmed',
      payment: {
        totalAmount: bundle.bundlePrice,
        paidAmount: 0,
        remainingAmount: bundle.bundlePrice,
        paymentStatus: 'pending',
      },
      services: [],
      createdAt: new Date(),
    });

    // Create individual bookings for each service
    const serviceBookings: BundleBookingResult['services'] = [];
    let totalValue = 0;
    let usedCount = 0;

    for (const bundleService of bundle.services) {
      // Skip if already used (partial fulfillment)
      const existingBooking = usage.bookings.find(
        (b) => b.services.some(
          (s) => s.serviceId.toString() === bundleService.serviceId.toString() &&
                 ['completed', 'confirmed', 'in_progress'].includes(s.status)
        )
      );

      if (existingBooking) {
        continue; // Service already redeemed
      }

      // Find the actual service to get provider info
      const service = await Service.findById(bundleService.serviceId).session(mongoSession);

      if (!service || !service.isActive) {
        logger.warn(`Service ${bundleService.serviceId} not found or inactive in bundle ${bundleId}`);
        continue;
      }

      // Calculate scheduled date for this service (offset from start date)
      const serviceStartDate = services?.find(
        (s) => s.serviceId === bundleService.serviceId.toString()
      )?.scheduledDate || scheduledDate;

      const serviceStartTime = services?.find(
        (s) => s.serviceId === bundleService.serviceId.toString()
      )?.scheduledTime || '10:00';

      // Create individual booking
      const booking = new Booking({
        customerId: new mongoose.Types.ObjectId(customerId),
        providerId: service.providerId,
        serviceId: service._id,
        scheduledDate: serviceStartDate,
        scheduledTime: serviceStartTime,
        estimatedDuration: service.duration || 60,
        status: 'confirmed',
        pricing: {
          basePrice: bundleService.originalPrice,
          addOns: [],
          subtotal: bundleService.originalPrice,
          taxes: 0,
          total: bundleService.originalPrice,
          totalAmount: bundleService.originalPrice,
          currency: 'AED',
        },
        location: addressId ? { type: 'customer_address' } : undefined,
        customerInfo: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
        },
        notes: `Bundle: ${bundle.name}${notes ? `. Note: ${notes}` : ''}`,
        bundleBookingId: bundleBooking._id,
      });

      await booking.save({ session: mongoSession });

      // Add to bundle booking services
      bundleBooking.services.push({
        bookingId: booking._id,
        serviceId: service._id,
        serviceName: service.name,
        quantity: bundleService.quantity,
        originalPrice: bundleService.originalPrice,
        scheduledDate: serviceStartDate,
        scheduledTime: serviceStartTime,
        status: 'confirmed',
        usedAt: null,
      });

      serviceBookings.push({
        serviceId: service._id.toString(),
        serviceName: service.name,
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        status: 'confirmed',
        scheduledDate: serviceStartDate,
        scheduledTime: serviceStartTime,
      });

      totalValue += bundleService.originalPrice;
      usedCount++;
    }

    // Update bundle redemption count
    await Bundle.findByIdAndUpdate(
      bundleId,
      {
        $inc: { redemptionsUsed: 1 },
      },
      { session: mongoSession }
    );

    // Save bundle booking
    bundleBooking.payment.totalAmount = bundle.bundlePrice;
    bundleBooking.payment.remainingAmount = bundle.bundlePrice;
    await bundleBooking.save({ session: mongoSession });

    if (shouldReleaseSession) {
      await mongoSession.commitTransaction();
    }

    logger.info('Bundle booked successfully', {
      bundleBookingId: bundleBooking._id,
      bundleId,
      customerId,
      serviceCount: serviceBookings.length,
    });

    return {
      bookingId: bundleBooking._id.toString(),
      bookingNumber: bundleBooking.bookingNumber,
      bundleId: bundle._id.toString(),
      bundleName: bundle.name,
      services: serviceBookings,
      totalAmount: bundle.bundlePrice,
      paidAmount: 0,
      remainingAmount: bundle.bundlePrice,
      createdAt: bundleBooking.createdAt,
    };
  } catch (error) {
    if (shouldReleaseSession) {
      await mongoSession.abortTransaction();
    }
    throw error;
  } finally {
    if (shouldReleaseSession) {
      mongoSession.endSession();
    }
  }
}

/**
 * Track bundle usage and remaining services
 */
export async function trackBundleUsage(
  customerId: string,
  bundleId?: string
): Promise<BundleUsageRecord[] | BundleUsageRecord> {
  if (bundleId) {
    // Track single bundle
    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      throw ApiError.notFound('Bundle not found');
    }

    const usage = await calculateBundleUsage(customerId, bundleId);

    const bookings = await BundleBooking.find({
      customerId: new mongoose.Types.ObjectId(customerId),
      bundleId: new mongoose.Types.ObjectId(bundleId),
    }).populate('services.bookingId');

    const bookingRecords: BundleUsageRecord['bookings'] = [];

    for (const booking of bookings) {
      for (const service of booking.services) {
        if (service.bookingId) {
          bookingRecords.push({
            bookingId: service.bookingId.toString(),
            serviceName: service.serviceName,
            scheduledDate: service.scheduledDate,
            status: service.status,
          });
        }
      }
    }

    return {
      bundleId: bundle._id.toString(),
      bundleName: bundle.name,
      totalServices: bundle.services.length,
      usedServices: usage.usedServices,
      remainingServices: bundle.services.length - usage.usedServices,
      bookings: bookingRecords,
      expiredServices: [], // Services that have passed their validity
      totalValue: bundle.bundlePrice,
      remainingValue: (bundle.services.length - usage.usedServices) *
        (bundle.bundlePrice / bundle.services.length),
    };
  } else {
    // Track all bundles for customer
    const customerBundles = await BundleBooking.find({
      customerId: new mongoose.Types.ObjectId(customerId),
    }).sort({ createdAt: -1 });

    const bundleIds = [...new Set(customerBundles.map((b) => b.bundleId.toString()))];
    const results: BundleUsageRecord[] = [];

    for (const id of bundleIds) {
      const result = await trackBundleUsage(customerId, id) as BundleUsageRecord;
      results.push(result);
    }

    return results;
  }
}

/**
 * Handle partial fulfillment of a bundle
 * When some services have been used but not all
 */
export async function handlePartialFulfillment(
  customerId: string,
  bundleId: string
): Promise<PartialFulfillmentResult> {
  const bundle = await validateBundle(bundleId);
  const usage = await calculateBundleUsage(customerId, bundleId);

  const missingServices: PartialFulfillmentResult['missingServices'] = [];
  const existingServiceIds = new Set(
    usage.bookings.flatMap((b) =>
      b.services
        .filter((s) => ['completed', 'confirmed', 'in_progress'].includes(s.status))
        .map((s) => s.serviceId.toString())
    )
  );

  for (const service of bundle.services) {
    if (!existingServiceIds.has(service.serviceId.toString())) {
      missingServices.push({
        serviceId: service.serviceId.toString(),
        serviceName: service.serviceName,
        reason: 'Service not yet redeemed',
      });
    }
  }

  return {
    canFulfill: missingServices.length > 0,
    missingServices,
  };
}

/**
 * Redeem remaining services in a bundle
 */
export async function redeemRemainingServices(
  customerId: string,
  bundleId: string,
  scheduledDates: Array<{ serviceId: string; date: string; time?: string }>
): Promise<BundleBookingResult> {
  const bundle = await validateBundle(bundleId);
  const usage = await calculateBundleUsage(customerId, bundleId);

  const remainingServices = bundle.services.filter(
    (s) => !usage.bookings.some((b) =>
      b.services.some(
        (svc) => svc.serviceId.toString() === s.serviceId.toString() &&
               ['completed', 'confirmed', 'in_progress'].includes(svc.status)
      )
    )
  );

  if (remainingServices.length === 0) {
    throw ApiError.badRequest('No remaining services to redeem');
  }

  // Find the existing bundle booking or create new one
  let bundleBooking = await BundleBooking.findOne({
    customerId: new mongoose.Types.ObjectId(customerId),
    bundleId: new mongoose.Types.ObjectId(bundleId),
    status: { $in: ['confirmed', 'partially_redeemed'] },
  });

  if (!bundleBooking) {
    throw ApiError.badRequest('No active bundle booking found');
  }

  const newServices: Array<{
    bookingId: mongoose.Types.ObjectId;
    serviceId: mongoose.Types.ObjectId;
    serviceName: string;
    quantity: number;
    originalPrice: number;
    scheduledDate: string;
    scheduledTime?: string;
    status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    usedAt: Date | null;
  }> = [];

  const serviceBookings: BundleBookingResult['services'] = [];

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    for (const service of remainingServices) {
      const scheduleInfo = scheduledDates.find(
        (s) => s.serviceId === service.serviceId.toString()
      );

      const serviceDoc = await Service.findById(service.serviceId).session(mongoSession);

      if (!serviceDoc || !serviceDoc.isActive) {
        continue;
      }

      const booking = new Booking({
        customerId: new mongoose.Types.ObjectId(customerId),
        providerId: serviceDoc.providerId,
        serviceId: serviceDoc._id,
        scheduledDate: scheduleInfo?.date || new Date().toISOString().split('T')[0],
        scheduledTime: scheduleInfo?.time || '10:00',
        estimatedDuration: serviceDoc.duration || 60,
        status: 'confirmed',
        pricing: {
          basePrice: service.originalPrice,
          addOns: [],
          subtotal: service.originalPrice,
          taxes: 0,
          total: service.originalPrice,
          totalAmount: service.originalPrice,
          currency: 'AED',
        },
        customerInfo: {},
        notes: `Bundle Redemption: ${bundle.name}`,
        bundleBookingId: bundleBooking!._id,
      });

      await booking.save({ session: mongoSession });

      newServices.push({
        bookingId: booking._id,
        serviceId: serviceDoc._id,
        serviceName: serviceDoc.name,
        quantity: service.quantity,
        originalPrice: service.originalPrice,
        scheduledDate: scheduleInfo?.date || new Date().toISOString().split('T')[0],
        scheduledTime: scheduleInfo?.time,
        status: 'confirmed' as const,
        usedAt: null,
      });

      serviceBookings.push({
        serviceId: serviceDoc._id.toString(),
        serviceName: serviceDoc.name,
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        status: 'confirmed',
        scheduledDate: scheduleInfo?.date || new Date().toISOString().split('T')[0],
        scheduledTime: scheduleInfo?.time,
      });
    }

    // Update bundle booking
    bundleBooking.services.push(...newServices);
    bundleBooking.status = remainingServices.length - newServices.length === 0
      ? 'fully_redeemed'
      : 'partially_redeemed';

    await bundleBooking.save({ session: mongoSession });

    await mongoSession.commitTransaction();

    logger.info('Remaining services redeemed', {
      bundleBookingId: bundleBooking._id,
      servicesAdded: newServices.length,
    });

    return {
      bookingId: bundleBooking._id.toString(),
      bookingNumber: bundleBooking.bookingNumber,
      bundleId: bundle._id.toString(),
      bundleName: bundle.name,
      services: serviceBookings,
      totalAmount: bundle.bundlePrice,
      paidAmount: bundleBooking.payment.paidAmount,
      remainingAmount: bundleBooking.payment.remainingAmount,
      createdAt: bundleBooking.createdAt,
    };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
}

/**
 * Cancel a bundle booking
 */
export async function cancelBundleBooking(
  customerId: string,
  bundleBookingId: string,
  reason?: string
): Promise<{ success: boolean; refundAmount: number }> {
  const bundleBooking = await BundleBooking.findOne({
    _id: new mongoose.Types.ObjectId(bundleBookingId),
    customerId: new mongoose.Types.ObjectId(customerId),
  });

  if (!bundleBooking) {
    throw ApiError.notFound('Bundle booking not found');
  }

  if (['completed', 'cancelled', 'fully_redeemed'].includes(bundleBooking.status)) {
    throw ApiError.badRequest('This bundle booking cannot be cancelled');
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    // Cancel all pending bookings in the bundle
    const pendingBookings = await Booking.find({
      bundleBookingId: bundleBooking._id,
      status: 'pending',
    }).session(mongoSession);

    for (const booking of pendingBookings) {
      booking.status = 'cancelled';
      booking.cancellationDetails = {
        reason: `Bundle cancelled: ${reason || 'Customer request'}`,
        cancelledBy: 'customer',
        cancelledAt: new Date(),
        refundAmount: 0,
        refundStatus: 'pending',
      };
      await booking.save({ session: mongoSession });
    }

    // Update bundle booking status
    bundleBooking.status = 'cancelled';
    bundleBooking.cancellationReason = reason;
    bundleBooking.cancelledAt = new Date();
    await bundleBooking.save({ session: mongoSession });

    // Calculate refund (full refund if no services used)
    const usedServices = bundleBooking.services.filter(
      (s) => s.status === 'completed'
    ).length;

    const refundAmount = usedServices === 0
      ? bundleBooking.payment.totalAmount
      : bundleBooking.payment.remainingAmount;

    await mongoSession.commitTransaction();

    logger.info('Bundle booking cancelled', {
      bundleBookingId,
      reason,
      refundAmount,
    });

    return { success: true, refundAmount };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
}

// =============================================================================
// Exports
// =============================================================================

export default {
  bookBundle,
  trackBundleUsage,
  handlePartialFulfillment,
  redeemRemainingServices,
  cancelBundleBooking,
};
