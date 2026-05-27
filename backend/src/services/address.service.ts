import Address, { IAddress } from '../models/address.model';
import logger from '../utils/logger';

export const getAddresses = async (userId: string): Promise<IAddress[]> => {
  return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};

export const getAddressById = async (addressId: string, userId: string): Promise<IAddress | null> => {
  return Address.findOne({ _id: addressId, userId });
};

export const createAddress = async (data: Omit<IAddress, 'createdAt' | 'updatedAt'>): Promise<IAddress> => {
  // If this is the first address or marked as default, handle defaults
  const existingAddresses = await Address.countDocuments({ userId: data.userId });

  if (existingAddresses === 0) {
    data.isDefault = true;
  } else if (data.isDefault) {
    // Unset other defaults
    await Address.updateMany({ userId: data.userId }, { isDefault: false });
  }

  const address = new Address(data);
  await address.save();

  logger.info('Address created', { addressId: address._id, userId: data.userId, action: 'ADDRESS_CREATED' });
  return address;
};

export const updateAddress = async (
  addressId: string,
  userId: string,
  data: Partial<IAddress>
): Promise<IAddress | null> => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) return null;

  // If setting as default, unset others first
  if (data.isDefault === true) {
    await Address.updateMany({ userId, _id: { $ne: addressId } }, { isDefault: false });
  }

  Object.assign(address, data);
  await address.save();

  logger.info('Address updated', { addressId, userId, action: 'ADDRESS_UPDATED' });
  return address;
};

export const deleteAddress = async (addressId: string, userId: string): Promise<boolean> => {
  const address = await Address.findOneAndDelete({ _id: addressId, userId });

  if (!address) return false;

  // If deleted was default, set another as default
  if (address.isDefault) {
    const another = await Address.findOne({ userId }).sort({ createdAt: -1 });
    if (another) {
      another.isDefault = true;
      await another.save();
    }
  }

  logger.info('Address deleted', { addressId, userId, action: 'ADDRESS_DELETED' });
  return true;
};

export const setDefaultAddress = async (addressId: string, userId: string): Promise<IAddress | null> => {
  // Unset all defaults
  await Address.updateMany({ userId }, { isDefault: false });

  // Set new default
  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    { isDefault: true },
    { new: true }
  );

  logger.info('Default address set', { addressId, userId, action: 'DEFAULT_ADDRESS_SET' });
  return address;
};
