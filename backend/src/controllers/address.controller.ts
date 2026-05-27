import { Request, Response } from 'express';
import { getAddresses, getAddressById, createAddress, updateAddress, deleteAddress, setDefaultAddress } from '../services/address.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

const addressSchema = Joi.object({
  label: Joi.string().required(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().default('India'),
  zipCode: Joi.string().required(),
  isDefault: Joi.boolean().default(false),
  coordinates: Joi.object({
    lat: Joi.number(),
    lng: Joi.number(),
  }),
  instructions: Joi.string(),
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
