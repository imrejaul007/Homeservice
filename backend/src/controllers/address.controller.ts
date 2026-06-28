import { Request, Response } from 'express';
import { getAddresses, getAddressById, createAddress, updateAddress, deleteAddress, setDefaultAddress } from '../services/address.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

// Enhanced Joi validation schema for address input
const addressSchema = Joi.object({
  label: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Label is required',
    'string.max': 'Label cannot exceed 50 characters',
  }),
  street: Joi.string().min(1).max(200).required().messages({
    'string.min': 'Street address is required',
    'string.max': 'Street address cannot exceed 200 characters',
  }),
  city: Joi.string().min(1).max(100).required().messages({
    'string.min': 'City is required',
    'string.max': 'City cannot exceed 100 characters',
  }),
  state: Joi.string().min(1).max(100).required().messages({
    'string.min': 'State is required',
    'string.max': 'State cannot exceed 100 characters',
  }),
  country: Joi.string().min(1).max(100).default('India').messages({
    'string.min': 'Country is required',
  }),
  zipCode: Joi.string().min(1).max(20).required().messages({
    'string.min': 'Postal/ZIP code is required',
    'string.max': 'Postal/ZIP code cannot exceed 20 characters',
  }),
  isDefault: Joi.boolean().default(false),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required().messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
    }),
    lng: Joi.number().min(-180).max(180).required().messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
    }),
  }).optional(),
  instructions: Joi.string().max(500).allow('').optional().messages({
    'string.max': 'Delivery instructions cannot exceed 500 characters',
  }),
});

export const getAllAddresses = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const addresses = await getAddresses(user._id.toString());

  res.json({
    success: true,
    data: addresses,
  });
});

export const getSingleAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const address = await getAddressById(req.params.id, user._id.toString());

  if (!address) {
    throw new ApiError(404, 'Address not found');
  }

  res.json({
    success: true,
    data: address,
  });
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = addressSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const address = await createAddress({
    ...value,
    userId: user._id.toString(),
  });

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: address,
  });
});

export const editAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = addressSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const address = await updateAddress(req.params.id, user._id.toString(), value);

  if (!address) {
    throw new ApiError(404, 'Address not found');
  }

  res.json({
    success: true,
    message: 'Address updated successfully',
    data: address,
  });
});

export const removeAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const deleted = await deleteAddress(req.params.id, user._id.toString());

  if (!deleted) {
    throw new ApiError(404, 'Address not found');
  }

  res.json({
    success: true,
    message: 'Address deleted successfully',
  });
});

export const setDefault = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const address = await setDefaultAddress(req.params.id, user._id.toString());

  if (!address) {
    throw new ApiError(404, 'Address not found');
  }

  res.json({
    success: true,
    message: 'Default address set successfully',
    data: address,
  });
});

export default {
  getAllAddresses,
  getSingleAddress,
  addAddress,
  editAddress,
  removeAddress,
  setDefault,
};
