import { Request, Response } from 'express';
import mongoose from 'mongoose';
import CustomerProfile from '../models/customerProfile.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getStripe } from '../services/payment.service';
import { ensureStripeCustomerId } from '../utils/stripeCustomer';

const isStripePaymentMethodId = (id: string): boolean => id.startsWith('pm_');

// ============================================
// Addresses (with pagination)
// ============================================

const MAX_ADDRESSES_PAGE_SIZE = 100; // Consistent with other endpoints
const DEFAULT_ADDRESSES_PAGE_SIZE = 20;

export const getAddresses = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;

  // Role validation
  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  // Parse pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    MAX_ADDRESSES_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_ADDRESSES_PAGE_SIZE)
  );

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    return res.json({
      success: true,
      data: {
        addresses: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
  }

  const allAddresses = customerProfile.addresses || [];
  const total = allAddresses.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedAddresses = allAddresses.slice(startIndex, endIndex);

  return res.json({
    success: true,
    data: {
      addresses: paginatedAddresses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  // Role validation
  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  const { label, street, city, state, country, zipCode, coordinates, isDefault } = req.body;

  if (!label || !street || !city) {
    throw new ApiError(400, 'Label, street, and city are required');
  }

  let customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    customerProfile = new CustomerProfile({
      userId: user._id,
      addresses: [],
    });
  }

  const newAddress = {
    _id: new (require('mongoose').Types.ObjectId)(),
    label,
    type: 'home' as const,
    street,
    city,
    state: state || '',
    country: country || 'UAE',
    zipCode: zipCode || '',
    coordinates,
    isDefault: isDefault || customerProfile.addresses.length === 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // If this is default, unset other defaults
  if (isDefault) {
    customerProfile.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }

  customerProfile.addresses.push(newAddress);
  await customerProfile.save();

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: { address: newAddress },
  });
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  // Role validation
  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  const { addressId } = req.params;

  // Validate addressId is a valid ObjectId format
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(400, 'Invalid address ID format');
  }

  const updates = req.body;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const addressIndex = customerProfile.addresses.findIndex(
    (addr: any) => addr._id.toString() === addressId
  );

  if (addressIndex === -1) {
    throw new ApiError(404, 'Address not found');
  }

  // SECURITY FIX: Ownership is implicitly verified by finding the address within
  // the customer's own profile (queried by userId above). The address exists
  // only within this profile, so if we found it, it belongs to this user.

  // If setting as default, unset other defaults
  if (updates.isDefault) {
    customerProfile.addresses.forEach((addr: any, idx: number) => {
      if (idx !== addressIndex) {
        addr.isDefault = false;
      }
    });
  }

  // Update address fields
  Object.assign(customerProfile.addresses[addressIndex], {
    ...updates,
    updatedAt: new Date(),
  });

  await customerProfile.save();

  res.json({
    success: true,
    message: 'Address updated successfully',
    data: { address: customerProfile.addresses[addressIndex] },
  });
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  // Role validation
  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  const { addressId } = req.params;

  // Validate addressId is a valid ObjectId format
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(400, 'Invalid address ID format');
  }

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const addressIndex = customerProfile.addresses.findIndex(
    (addr: any) => addr._id.toString() === addressId
  );

  if (addressIndex === -1) {
    throw new ApiError(404, 'Address not found');
  }

  // SECURITY FIX: Ownership is implicitly verified by finding the address within
  // the customer's own profile (queried by userId above). The address exists
  // only within this profile, so if we found it, it belongs to this user.

  const wasDefault = customerProfile.addresses[addressIndex].isDefault;
  customerProfile.addresses.splice(addressIndex, 1);

  // If deleted was default, set first as default
  if (wasDefault && customerProfile.addresses.length > 0) {
    customerProfile.addresses[0].isDefault = true;
  }

  await customerProfile.save();

  res.json({
    success: true,
    message: 'Address deleted successfully',
  });
});

// ============================================
// Payment Methods (with pagination)
// ============================================

const MAX_PAYMENT_METHODS_PAGE_SIZE = 20;
const DEFAULT_PAYMENT_METHODS_PAGE_SIZE = 10;

export const getPaymentMethods = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;

  // Role validation
  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  // Parse pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    MAX_PAYMENT_METHODS_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAYMENT_METHODS_PAGE_SIZE)
  );

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    return res.json({
      success: true,
      data: {
        paymentMethods: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
  }

  const allPaymentMethods = customerProfile.paymentMethods || [];
  const total = allPaymentMethods.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedPaymentMethods = allPaymentMethods.slice(startIndex, endIndex);

  return res.json({
    success: true,
    data: {
      paymentMethods: paginatedPaymentMethods,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
});

export const addPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  const { type, token, isDefault } = req.body;

  if (!type || !token) {
    throw new ApiError(400, 'Type and token are required');
  }

  if (!isStripePaymentMethodId(token)) {
    throw new ApiError(400, 'Invalid payment method token');
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'Payment service is not configured');
  }

  const stripe = getStripe();
  const stripeCustomerId = await ensureStripeCustomerId(user._id);
  if (!stripeCustomerId) {
    throw new ApiError(503, 'Unable to create Stripe customer');
  }

  try {
    await stripe.paymentMethods.attach(token, { customer: stripeCustomerId });
  } catch (error: any) {
    if (error?.code !== 'resource_already_attached') {
      throw new ApiError(400, error?.message || 'Failed to attach payment method');
    }
  }

  const stripeMethod = await stripe.paymentMethods.retrieve(token);
  const shouldBeDefault = Boolean(isDefault);

  if (shouldBeDefault) {
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: token },
    });
  }

  let customerProfile = await CustomerProfile.findOne({ userId: user._id });
  if (!customerProfile) {
    customerProfile = new CustomerProfile({
      userId: user._id,
      stripeCustomerId,
      paymentMethods: [],
    });
  } else if (!customerProfile.stripeCustomerId) {
    customerProfile.stripeCustomerId = stripeCustomerId;
  }

  const existingIndex = customerProfile.paymentMethods.findIndex(
    (pm: any) => pm.stripePaymentMethodId === token || pm._id?.toString() === token
  );

  const card = stripeMethod.card;
  const paymentMethodPayload = {
    stripePaymentMethodId: token,
    type,
    last4: card?.last4 || '****',
    brand: card?.brand || (type === 'card' ? 'card' : type.replace('_', ' ')),
    expiryMonth: card?.exp_month,
    expiryYear: card?.exp_year,
    isDefault: shouldBeDefault || customerProfile.paymentMethods.length === 0,
    isActive: true,
    createdAt: new Date(),
  };

  if (shouldBeDefault) {
    customerProfile.paymentMethods.forEach((pm: any) => {
      pm.isDefault = false;
    });
  }

  if (existingIndex >= 0) {
    Object.assign(customerProfile.paymentMethods[existingIndex], paymentMethodPayload);
  } else {
    customerProfile.paymentMethods.push({
      _id: new mongoose.Types.ObjectId(),
      ...paymentMethodPayload,
    } as any);
  }

  await customerProfile.save();

  const savedMethod = existingIndex >= 0
    ? customerProfile.paymentMethods[existingIndex]
    : customerProfile.paymentMethods[customerProfile.paymentMethods.length - 1];

  res.status(201).json({
    success: true,
    message: 'Payment method added successfully',
    data: { paymentMethod: savedMethod },
  });
});

export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  const { paymentMethodId } = req.params;

  if (!paymentMethodId) {
    throw new ApiError(400, 'Payment method ID is required');
  }

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (isStripePaymentMethodId(paymentMethodId) && process.env.STRIPE_SECRET_KEY) {
    const stripe = getStripe();
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
    } catch (error: any) {
      if (error?.code !== 'resource_missing') {
        throw new ApiError(400, error?.message || 'Failed to remove payment method');
      }
    }
  }

  if (customerProfile) {
    const paymentMethodIndex = customerProfile.paymentMethods.findIndex(
      (pm: any) =>
        pm._id?.toString() === paymentMethodId ||
        pm.stripePaymentMethodId === paymentMethodId
    );

    if (paymentMethodIndex !== -1) {
      const wasDefault = customerProfile.paymentMethods[paymentMethodIndex].isDefault;
      customerProfile.paymentMethods.splice(paymentMethodIndex, 1);

      if (wasDefault && customerProfile.paymentMethods.length > 0) {
        customerProfile.paymentMethods[0].isDefault = true;
      }

      await customerProfile.save();
    } else if (!isStripePaymentMethodId(paymentMethodId)) {
      throw new ApiError(404, 'Payment method not found');
    }
  } else if (!isStripePaymentMethodId(paymentMethodId)) {
    throw new ApiError(404, 'Customer profile not found');
  }

  res.json({
    success: true,
    message: 'Payment method deleted successfully',
  });
});

export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (req.user?.role !== 'customer') throw new ApiError(403, 'Only customers can access this endpoint');

  const { paymentMethodId } = req.params;
  const updates = req.body;

  if (!paymentMethodId) {
    throw new ApiError(400, 'Payment method ID is required');
  }

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (updates.isDefault && isStripePaymentMethodId(paymentMethodId) && process.env.STRIPE_SECRET_KEY) {
    const stripeCustomerId = await ensureStripeCustomerId(user._id);
    if (stripeCustomerId) {
      const stripe = getStripe();
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }
  }

  if (!customerProfile) {
    if (isStripePaymentMethodId(paymentMethodId) && updates.isDefault) {
      return res.json({
        success: true,
        message: 'Payment method updated successfully',
        data: { paymentMethod: { id: paymentMethodId, isDefault: true } },
      });
    }
    throw new ApiError(404, 'Customer profile not found');
  }

  const paymentMethodIndex = customerProfile.paymentMethods.findIndex(
    (pm: any) =>
      pm._id?.toString() === paymentMethodId ||
      pm.stripePaymentMethodId === paymentMethodId
  );

  if (paymentMethodIndex === -1) {
    if (isStripePaymentMethodId(paymentMethodId) && updates.isDefault) {
      return res.json({
        success: true,
        message: 'Payment method updated successfully',
        data: { paymentMethod: { id: paymentMethodId, isDefault: true } },
      });
    }
    throw new ApiError(404, 'Payment method not found');
  }

  if (updates.isDefault) {
    customerProfile.paymentMethods.forEach((pm: any, idx: number) => {
      pm.isDefault = idx === paymentMethodIndex;
    });
  }

  const allowedFields = ['isDefault', 'nickname'];
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      (customerProfile.paymentMethods[paymentMethodIndex] as any)[key] = updates[key];
    }
  });

  await customerProfile.save();

  return res.json({
    success: true,
    message: 'Payment method updated successfully',
    data: { paymentMethod: customerProfile.paymentMethods[paymentMethodIndex] },
  });
});

export default {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod,
};
