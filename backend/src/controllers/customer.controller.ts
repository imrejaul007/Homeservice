import { Request, Response } from 'express';
import CustomerProfile from '../models/customerProfile.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ============================================
// Addresses (with pagination)
// ============================================

const MAX_ADDRESSES_PAGE_SIZE = 50;
const DEFAULT_ADDRESSES_PAGE_SIZE = 20;

export const getAddresses = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;

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
  const { addressId } = req.params;
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
  const { addressId } = req.params;

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
  const { type, token, isDefault } = req.body;

  if (!type || !token) {
    throw new ApiError(400, 'Type and token are required');
  }

  let customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    customerProfile = new CustomerProfile({
      userId: user._id,
      paymentMethods: [],
    });
  }

  // In a real implementation, you would verify the token with the payment provider
  // For now, we'll create a mock payment method
  const newPaymentMethod = {
    _id: new (require('mongoose').Types.ObjectId)(),
    type,
    last4: '4242', // Mock last 4 digits
    brand: type === 'card' ? 'Visa' : type.replace('_', ' '),
    expiryMonth: 12,
    expiryYear: 2027,
    isDefault: isDefault || customerProfile.paymentMethods.length === 0,
    isActive: true,
    createdAt: new Date(),
  };

  // If this is default, unset other defaults
  if (isDefault) {
    customerProfile.paymentMethods.forEach(pm => {
      pm.isDefault = false;
    });
  }

  customerProfile.paymentMethods.push(newPaymentMethod);
  await customerProfile.save();

  res.status(201).json({
    success: true,
    message: 'Payment method added successfully',
    data: { paymentMethod: newPaymentMethod },
  });
});

export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { paymentMethodId } = req.params;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const paymentMethodIndex = customerProfile.paymentMethods.findIndex(
    (pm: any) => pm._id.toString() === paymentMethodId
  );

  if (paymentMethodIndex === -1) {
    throw new ApiError(404, 'Payment method not found');
  }

  const wasDefault = customerProfile.paymentMethods[paymentMethodIndex].isDefault;
  customerProfile.paymentMethods.splice(paymentMethodIndex, 1);

  // If deleted was default, set first as default
  if (wasDefault && customerProfile.paymentMethods.length > 0) {
    customerProfile.paymentMethods[0].isDefault = true;
  }

  await customerProfile.save();

  res.json({
    success: true,
    message: 'Payment method deleted successfully',
  });
});

export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { paymentMethodId } = req.params;
  const updates = req.body;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const paymentMethodIndex = customerProfile.paymentMethods.findIndex(
    (pm: any) => pm._id.toString() === paymentMethodId
  );

  if (paymentMethodIndex === -1) {
    throw new ApiError(404, 'Payment method not found');
  }

  // If setting as default, unset other defaults
  if (updates.isDefault) {
    customerProfile.paymentMethods.forEach((pm: any, idx: number) => {
      if (idx !== paymentMethodIndex) {
        pm.isDefault = false;
      }
    });
  }

  // Update payment method fields (prevent updating sensitive fields)
  const allowedFields = ['isDefault', 'nickname'];
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      (customerProfile.paymentMethods[paymentMethodIndex] as any)[key] = updates[key];
    }
  });

  await customerProfile.save();

  res.json({
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
