import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import Bundle from '../models/bundle.model';
import Service from '../models/service.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';
import { getSocketServer } from '../socket';
import { TAX_CONFIG } from '../config/constants';

/**
 * Interface for package booking input
 */
export interface PackageBookingInput {
  bundleId: string;
  providerId: string;
  scheduledDate: string;
  scheduledTime: string;
  location: {
    type: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    notes?: string;
  };
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    specialRequests?: string;
    accessInstructions?: string;
  };
  addOns?: Array<{
    id?: string;
    name: string;
    price: number;
    quantity?: number;
    description?: string;
  }>;
  specialRequests?: string;
  locationType?: string;
  selectedDuration?: number;
  professionalPreference?: string;
  paymentMethod?: string;
  metadata?: {
    bookingSource?: string;
    deviceType?: string;
    sessionId?: string;
    idempotencyKey?: string;
    packageName?: string;
    packageCategory?: string;
  };
  couponCode?: string;
}

/**
 * Interface for booking result
 */
export interface PackageBookingResult {
  booking: any;
  individualBookings: any[];
  pricing: {
    subtotal: number;
    addOnsTotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}

/**
 * Generate a unique booking number
 */
function generateBookingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PKG-${timestamp}-${random}`;
}

/**
 * Generate idempotency key for duplicate prevention
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Acquire slot lock using Redis
 */
async function acquireSlotLock(
  providerId: string,
  date: string,
  time: string,
  customerId: string
): Promise<boolean> {
  const lockKey = `slot_lock:${providerId}:${date}:${time}`;
  const lockValue = JSON.stringify({ customerId, lockedAt: Date.now() });
  const redisClient = cache.client;

  try {
    if (!redisClient) {
      logger.warn('Redis not available, skipping slot lock');
      return true;
    }
    // Use setNX for atomic "set if not exists" with setex for TTL
    const result = await redisClient.setnx(lockKey, lockValue);
    if (result === 1) {
      await redisClient.expire(lockKey, 120);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to acquire slot lock', { error });
    return false;
  }
}

/**
 * Release slot lock
 */
async function releaseSlotLock(
  providerId: string,
  date: string,
  time: string
): Promise<void> {
  const lockKey = `slot_lock:${providerId}:${date}:${time}`;
  const redisClient = cache.client;

  try {
    if (redisClient) {
      await redisClient.del(lockKey);
    }
  } catch (error) {
    logger.error('Failed to release slot lock', { error });
  }
}

/**
 * Package Booking Service
 * Handles booking packages with individual service bookings
 */
class PackageBookingService {
  /**
   * Book a package - creates individual bookings for each service in the package
   */
  async bookPackage(
    customerId: string,
    bookingInput: PackageBookingInput,
    tenantId: string
  ): Promise<PackageBookingResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        bundleId,
        providerId,
        scheduledDate,
        scheduledTime,
        location,
        customerInfo,
        addOns,
        specialRequests,
        locationType,
        selectedDuration,
        professionalPreference,
        paymentMethod,
        metadata,
        couponCode,
      } = bookingInput;

      // Load the package from Bundle collection
      const bundle = await Bundle.findById(bundleId).session(session);
      if (!bundle) {
        throw new Error('Package not found');
      }

      // Try to acquire slot lock
      const lockAcquired = await acquireSlotLock(providerId, scheduledDate, scheduledTime, customerId);
      if (!lockAcquired) {
        throw new Error('This time slot is currently being booked by another customer. Please select a different time.');
      }

      try {
        // Calculate pricing
        const bundleAny = bundle as any;
        const basePrice = bundleAny.bundlePrice || bundleAny.discountedPrice || bundleAny.basePrice || 0;
        const addOnsTotal = (addOns || []).reduce((sum, addon) => {
          return sum + (addon.price * (addon.quantity || 1));
        }, 0);
        const subtotal = basePrice + addOnsTotal;

        // Calculate coupon discount if provided
        let discount = 0;
        let appliedCoupon: { code: string; amount: number; description: string } | undefined;
        if (couponCode) {
          try {
            const Coupon = (await import('../models/coupon.model')).default;
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isDeleted: false });
            if (coupon) {
              const couponAny = coupon as any;
              const validityCheck = couponAny.isValid();
              if (validityCheck.valid && subtotal >= coupon.minOrderValue) {
                discount = couponAny.calculateDiscount(subtotal);
                appliedCoupon = {
                  code: coupon.code,
                  amount: discount,
                  description: `Coupon: ${coupon.title || coupon.code}`,
                };
              }
            }
          } catch (couponError) {
            // Log but don't fail the booking if coupon validation fails
            console.error('Coupon validation error:', couponError);
          }
        }

        const taxRate = TAX_CONFIG.RATE;
        const tax = (subtotal - discount) * taxRate;
        const total = subtotal - discount + tax;

        // Generate booking number
        const bookingNumber = generateBookingNumber();
        const idempotencyKey = metadata?.idempotencyKey || generateIdempotencyKey();

        // Create the main package booking
        const booking = new Booking({
          customerId: new mongoose.Types.ObjectId(customerId),
          providerId: new mongoose.Types.ObjectId(providerId),
          serviceId: new mongoose.Types.ObjectId(bundleId),
          bookingNumber,
          scheduledDate: new Date(scheduledDate),
          scheduledTime,
          duration: selectedDuration || bundleAny.duration || 60,
          status: 'pending',
          pricing: {
            basePrice,
            addOns: addOns?.map(a => ({
              name: a.name,
              price: a.price,
              quantity: a.quantity || 1,
            })) || [],
            discounts: appliedCoupon ? [{
              type: 'coupon' as const,
              amount: appliedCoupon.amount,
              description: appliedCoupon.description,
            }] : [],
            couponDiscount: discount,
            subtotal,
            tax,
            totalAmount: total,
            currency: bundleAny.currency || 'AED',
          },
          location: {
            type: locationType || location?.type || 'customer_address',
            address: location?.address || {},
            coordinates: undefined,
            notes: location?.notes || '',
          },
          customerInfo: customerInfo ? {
            firstName: customerInfo.firstName || '',
            lastName: customerInfo.lastName || '',
            email: customerInfo.email || '',
            phone: customerInfo.phone || '',
            specialRequests: specialRequests || '',
            accessInstructions: customerInfo.accessInstructions || '',
          } : {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            specialRequests: specialRequests || '',
            accessInstructions: '',
          },
          professionalPreference: professionalPreference || 'no_preference',
          paymentMethod: paymentMethod || 'credit_card',
          paymentStatus: 'pending',
          metadata: {
            bookingSource: metadata?.bookingSource || 'package_booking',
            deviceType: metadata?.deviceType || 'web',
            sessionId: metadata?.sessionId || '',
            idempotencyKey,
            packageName: metadata?.packageName || bundleAny.name || bundleAny.bundleName,
            packageCategory: metadata?.packageCategory || '',
          },
          tenantId: new mongoose.Types.ObjectId(tenantId),
        });

        await booking.save({ session });

        // For packages with multiple services, create individual bookings
        const individualBookings: any[] = [];

        // Check if this is a package with multiple services (from Bundle's services array)
        const packageServices = bundleAny.services || bundleAny.includedItems || [];

        if (packageServices.length > 0) {
          // Create individual booking for each included service
          for (const pkgService of packageServices) {
            const individualBookingNumber = generateBookingNumber();

            const individualBooking = new Booking({
              customerId: new mongoose.Types.ObjectId(customerId),
              providerId: new mongoose.Types.ObjectId(providerId),
              serviceId: typeof pkgService.serviceId === 'string'
                ? new mongoose.Types.ObjectId(pkgService.serviceId)
                : pkgService.serviceId,
              bookingNumber: individualBookingNumber,
              scheduledDate: new Date(scheduledDate),
              scheduledTime,
              duration: pkgService.duration || 60,
              status: 'pending',
              pricing: {
                basePrice: pkgService.price || 0,
                addOns: [],
                discounts: [],
                couponDiscount: 0,
                subtotal: pkgService.price || 0,
                tax: (pkgService.price || 0) * taxRate,
                totalAmount: (pkgService.price || 0) * (1 + taxRate),
                currency: bundleAny.currency || 'AED',
              },
              location: {
                type: locationType || location?.type || 'customer_address',
                address: location?.address || {},
                coordinates: undefined,
                notes: location?.notes || '',
              },
              customerInfo: booking.customerInfo,
              professionalPreference: professionalPreference || 'no_preference',
              paymentMethod: paymentMethod || 'credit_card',
              paymentStatus: 'pending',
              metadata: {
                bookingSource: metadata?.bookingSource || 'package_booking',
                deviceType: metadata?.deviceType || 'web',
                sessionId: metadata?.sessionId || '',
                idempotencyKey: `${idempotencyKey}-${pkgService.serviceId}`,
                packageBookingId: booking._id,
                packageName: metadata?.packageName || bundleAny.name || bundleAny.bundleName,
                packageCategory: metadata?.packageCategory || '',
              },
              tenantId: new mongoose.Types.ObjectId(tenantId),
            });

            await individualBooking.save({ session });
            individualBookings.push(individualBooking);
          }

          // Update the main booking metadata with individual booking references
          (booking.metadata as any).packageServices = individualBookings.map(ib => ib._id.toString());
          await booking.save({ session });
        }

        await session.commitTransaction();

        // Emit socket event for real-time update
        try {
          const socketServer = getSocketServer();
          if (socketServer) {
            const io = socketServer.getIO();
            if (io) {
              io.to(`provider:${providerId}`).emit('booking:created', {
                bookingId: booking._id,
                bookingNumber: booking.bookingNumber,
                status: booking.status,
              });
              io.to(`customer:${customerId}`).emit('booking:confirmed', {
                bookingId: booking._id,
                bookingNumber: booking.bookingNumber,
              });
            }
          }
        } catch (socketError) {
          logger.error('Failed to emit socket event', { error: socketError });
        }

        logger.info('Package booking created successfully', {
          context: 'PackageBookingService',
          action: 'PACKAGE_BOOKING_CREATED',
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          customerId,
          packageId: bundleId,
          individualBookingsCount: individualBookings.length,
        });

        return {
          booking,
          individualBookings,
          pricing: {
            subtotal,
            addOnsTotal,
            discount,
            tax,
            total,
          },
        };
      } finally {
        // Always release the lock
        await releaseSlotLock(providerId, scheduledDate, scheduledTime);
      }
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check availability for a package booking
   */
  async checkAvailability(
    providerId: string,
    date: string,
    time: string
  ): Promise<{ available: boolean; reason?: string; suggestedSlots?: string[] }> {
    try {
      const redisClient = cache.client;

      // Check if slot is locked (being booked by another customer)
      if (redisClient) {
        const lockKey = `slot_lock:${providerId}:${date}:${time}`;
        const lockExists = await redisClient.exists(lockKey);

        if (lockExists) {
          return {
            available: false,
            reason: 'This time slot is currently being booked by another customer',
          };
        }
      }

      // Check for existing bookings at this slot
      const existingBooking = await Booking.findOne({
        providerId: new mongoose.Types.ObjectId(providerId),
        scheduledDate: new Date(date),
        scheduledTime: time,
        status: { $nin: ['cancelled', 'no_show'] },
      });

      if (existingBooking) {
        return {
          available: false,
          reason: 'This time slot is already booked',
        };
      }

      return { available: true };
    } catch (error) {
      logger.error('Error checking availability', { error, providerId, date, time });
      return {
        available: false,
        reason: 'Unable to check availability. Please try again.',
      };
    }
  }

  /**
   * Get package booking details
   */
  async getPackageBooking(
    bookingId: string,
    customerId: string
  ): Promise<any> {
    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(bookingId),
      customerId: new mongoose.Types.ObjectId(customerId),
      isPackageBooking: true,
    }).populate('packageServices');

    if (!booking) {
      throw new Error('Package booking not found');
    }

    return booking;
  }
}

export const packageBookingService = new PackageBookingService();