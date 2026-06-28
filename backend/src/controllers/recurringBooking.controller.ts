import { Request, Response } from 'express';
import RecurringBooking from '../models/recurringBooking.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';

// ============================================
// Frequency discount mapping
// ============================================
const FREQUENCY_DISCOUNTS: Record<string, number> = {
  daily: 0,
  weekly: 5,
  biweekly: 10,
  monthly: 15,
  quarterly: 20,
};

// ============================================
// Get Customer Subscriptions (Recurring Bookings)
// ============================================

export const getSubscriptions = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;
  const { status } = req.query;

  // Build query
  const query: any = { customerId: user._id };
  if (status && status !== 'all') {
    query.status = status;
  }

  // Get subscriptions
  const subscriptions = await RecurringBooking.find(query)
    .sort({ createdAt: -1 })
    .populate('serviceId', 'name price duration category')
    .populate('providerId', 'firstName lastName avatar');

  // Format response
  const formattedSubscriptions = subscriptions.map(sub => ({
    id: sub._id,
    serviceId: sub.serviceId?._id,
    providerId: sub.providerId?._id,
    serviceName: (sub.serviceId as any)?.name || 'Unknown Service',
    providerName: sub.providerId
      ? `${(sub.providerId as any)?.firstName || ''} ${(sub.providerId as any)?.lastName || ''}`.trim()
      : 'Unknown Provider',
    frequency: sub.frequency,
    interval: sub.interval,
    startDate: sub.startDate,
    nextRun: sub.nextRun,
    endDate: sub.endDate,
    status: sub.status,
    price: sub.price,
    discount: sub.discount,
    paymentMethod: {
      type: 'card',
      last4: '****',
    },
    address: sub.address,
    notes: sub.notes,
    createdAt: sub.createdAt,
  }));

  return res.json({
    success: true,
    data: {
      subscriptions: formattedSubscriptions,
    },
  });
});

// ============================================
// Create Subscription (Recurring Booking)
// ============================================

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { serviceId, providerId, frequency, interval, startDate, preferredTime, notes, addressId } = req.body;

  // Validate required fields
  if (!serviceId || !providerId || !frequency || !startDate) {
    throw new ApiError(400, 'Missing required fields: serviceId, providerId, frequency, startDate');
  }

  // Validate service exists
  const service = await Service.findById(serviceId);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  // Validate provider exists
  const provider = await User.findById(providerId);
  if (!provider || provider.role !== 'provider') {
    throw new ApiError(404, 'Provider not found');
  }

  // Calculate discount based on frequency
  const discount = FREQUENCY_DISCOUNTS[frequency] || 0;
  const price = service.price.amount * (1 - discount / 100);

  // Calculate next run date
  const startDateObj = new Date(startDate);
  const nextRun = calculateNextRun(startDateObj, frequency, interval || 1);

  // Create subscription
  const subscription = new RecurringBooking({
    customerId: user._id,
    providerId: new mongoose.Types.ObjectId(providerId),
    serviceId: new mongoose.Types.ObjectId(serviceId),
    frequency,
    interval: interval || 1,
    startDate: startDateObj,
    nextRun,
    status: 'active',
    price,
    discount,
    preferredTime: preferredTime || '09:00',
    notes,
  });

  await subscription.save();

  return res.status(201).json({
    success: true,
    message: 'Subscription created successfully',
    data: {
      subscription: {
        id: subscription._id,
        serviceId: subscription.serviceId,
        providerId: subscription.providerId,
        serviceName: service.name,
        providerName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
        frequency: subscription.frequency,
        interval: subscription.interval,
        startDate: subscription.startDate,
        nextRun: subscription.nextRun,
        status: subscription.status,
        price: subscription.price,
        discount: subscription.discount,
        notes: subscription.notes,
        createdAt: subscription.createdAt,
      },
    },
  });
});

// ============================================
// Update Subscription (Pause/Resume/Modify)
// ============================================

export const updateSubscription = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { subscriptionId } = req.params;
  const { status, frequency, interval, preferredTime, notes } = req.body;

  // Validate subscriptionId
  if (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId)) {
    throw new ApiError(400, 'Invalid subscription ID');
  }

  // Find subscription
  const subscription = await RecurringBooking.findOne({
    _id: subscriptionId,
    customerId: user._id,
  });

  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  // Update fields
  if (status) {
    if (status === 'paused' && subscription.status !== 'paused') {
      subscription.status = 'paused';
    } else if (status === 'active' && subscription.status === 'paused') {
      subscription.status = 'active';
      // Recalculate nextRun from today
      subscription.nextRun = calculateNextRun(new Date(), subscription.frequency, subscription.interval);
    } else if (status === 'cancelled') {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = 'Cancelled by customer';
    }
  }

  if (frequency && frequency !== subscription.frequency) {
    subscription.frequency = frequency;
    subscription.discount = FREQUENCY_DISCOUNTS[frequency] || 0;
    // Recalculate price if needed
    const service = await Service.findById(subscription.serviceId);
    if (service) {
      subscription.price = service.price.amount * (1 - subscription.discount / 100);
    }
    // Recalculate nextRun
    subscription.nextRun = calculateNextRun(new Date(), frequency, subscription.interval || 1);
  }

  if (interval !== undefined) {
    subscription.interval = interval;
  }

  if (preferredTime) {
    subscription.preferredTime = preferredTime;
  }

  if (notes !== undefined) {
    subscription.notes = notes;
  }

  await subscription.save();

  // Populate for response
  await subscription.populate('serviceId', 'name');
  await subscription.populate('providerId', 'firstName lastName');

  return res.json({
    success: true,
    message: 'Subscription updated successfully',
    data: {
      subscription: {
        id: subscription._id,
        serviceId: subscription.serviceId?._id,
        providerId: subscription.providerId?._id,
        serviceName: (subscription.serviceId as any)?.name || 'Unknown Service',
        providerName: `${((subscription.providerId as any)?.firstName || '')} ${((subscription.providerId as any)?.lastName || '')}`.trim(),
        frequency: subscription.frequency,
        interval: subscription.interval,
        startDate: subscription.startDate,
        nextRun: subscription.nextRun,
        endDate: subscription.endDate,
        status: subscription.status,
        price: subscription.price,
        discount: subscription.discount,
        notes: subscription.notes,
        createdAt: subscription.createdAt,
      },
    },
  });
});

// ============================================
// Delete/Cancel Subscription
// ============================================

export const deleteSubscription = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { subscriptionId } = req.params;

  // Validate subscriptionId
  if (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId)) {
    throw new ApiError(400, 'Invalid subscription ID');
  }

  // Find and update subscription
  const subscription = await RecurringBooking.findOneAndUpdate(
    { _id: subscriptionId, customerId: user._id },
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: 'Cancelled by customer',
    },
    { new: true }
  );

  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  return res.json({
    success: true,
    message: 'Subscription cancelled successfully',
  });
});

// ============================================
// Helper: Calculate Next Run Date
// ============================================

function calculateNextRun(fromDate: Date, frequency: string, interval: number = 1): Date {
  const nextRun = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      nextRun.setDate(nextRun.getDate() + interval);
      break;
    case 'weekly':
      nextRun.setDate(nextRun.getDate() + (7 * interval));
      break;
    case 'biweekly':
      nextRun.setDate(nextRun.getDate() + (14 * interval));
      break;
    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + interval);
      break;
    case 'quarterly':
      nextRun.setMonth(nextRun.getMonth() + (3 * interval));
      break;
    default:
      nextRun.setMonth(nextRun.getMonth() + interval);
  }

  return nextRun;
}

// ============================================
// Export
// ============================================

export default {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
};
