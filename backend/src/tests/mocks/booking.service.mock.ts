/**
 * Booking Service Mock
 * Provides mocked booking service for tests
 */

import mongoose from 'mongoose';
import Booking from '../../models/booking.model';
import Service from '../../models/service.model';
// Valid address coordinates for Dubai
const DUBAI_COORDS = {
  type: 'Point' as const,
  coordinates: [55.2708, 25.2048] as [number, number],
};

/**
 * Generate booking number
 */
const generateBookingNumber = (): string => {
  const prefix = 'BKG';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Create a test booking
 */
export const createTestBooking = async (
  customerId: mongoose.Types.ObjectId,
  providerId: mongoose.Types.ObjectId,
  serviceId: mongoose.Types.ObjectId,
  overrides = {}
) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const bookingData = {
    customerId,
    providerId,
    serviceId,
    bookingNumber: generateBookingNumber(),
    status: 'pending' as const,
    scheduledDate: tomorrow.toISOString().split('T')[0],
    scheduledTime: '10:00',
    location: {
      type: 'customer_address' as const,
      address: {
        street: '123 Test Street',
        city: 'Dubai',
        state: 'Dubai',
        country: 'UAE',
        zipCode: '12345',
        coordinates: DUBAI_COORDS,
      },
    },
    pricing: {
      basePrice: 150,
      serviceFee: 15,
      tax: 16.5,
      discount: 0,
      totalAmount: 181.5,
      currency: 'AED',
    },
    payment: {
      status: 'pending',
      method: null,
      transactionId: null,
    },
    cancellation: null,
    rescheduleHistory: [],
    updateHistory: [],
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date(),
        updatedBy: customerId.toString(),
      },
    ],
    ...overrides,
  };

  const booking = new Booking(bookingData);
  await booking.save();

  return booking;
};

/**
 * Create a test service
 */
export const createTestService = async (
  providerId: mongoose.Types.ObjectId,
  overrides = {}
) => {
  const serviceData = {
    providerId,
    name: 'Professional Cleaning Service',
    description: 'Deep cleaning for homes and offices',
    category: 'cleaning',
    basePrice: 150,
    pricing: {
      basePrice: 150,
      currency: 'AED',
    },
    duration: 120,
    location: {
      type: 'fixed' as const,
      address: {
        street: '456 Provider Ave',
        city: 'Dubai',
        state: 'Dubai',
        country: 'UAE',
        zipCode: '54321',
        coordinates: DUBAI_COORDS,
      },
    },
    isActive: true,
    rating: {
      average: 0,
      count: 0,
    },
    searchMetadata: {
      searchKeywords: ['cleaning', 'deep clean', 'home cleaning'],
    },
    ...overrides,
  };

  const service = new Service(serviceData);
  await service.save();

  return service;
};

/**
 * Update booking status
 */
export const updateBookingStatus = async (
  bookingId: mongoose.Types.ObjectId,
  newStatus: string,
  userId?: string
) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error('Booking not found');
  }

  booking.status = newStatus as any;
  booking.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: (userId || 'system') as 'customer' | 'provider' | 'admin' | 'system',
  });

  if (newStatus === 'completed') {
    booking.completedAt = new Date();
  }

  await booking.save();

  return booking;
};

/**
 * Cancel booking
 */
export const cancelTestBooking = async (
  bookingId: mongoose.Types.ObjectId,
  reason: string,
  cancelledBy: 'customer' | 'provider' | 'admin'
) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error('Booking not found');
  }

  booking.status = 'cancelled' as any;
  (booking as any).cancellation = {
    reason,
    cancelledBy,
    cancelledAt: new Date(),
  };

  booking.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    updatedBy: cancelledBy as 'customer' | 'provider' | 'admin' | 'system',
  });

  await booking.save();

  return booking;
};

/**
 * Delete test booking
 */
export const deleteTestBooking = async (bookingId: mongoose.Types.ObjectId) => {
  await Booking.findByIdAndDelete(bookingId);
};

/**
 * Delete test service
 */
export const deleteTestService = async (serviceId: mongoose.Types.ObjectId) => {
  await Service.findByIdAndDelete(serviceId);
};

export default {
  createTestBooking,
  createTestService,
  updateBookingStatus,
  cancelTestBooking,
  deleteTestBooking,
  deleteTestService,
};
