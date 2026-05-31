import mongoose from 'mongoose';
import Address, { IAddress } from '../models/address.model';
import logger from '../utils/logger';

// Helper to get a session, optionally with a provided session for nested transactions
async function getSession(): Promise<mongoose.ClientSession | null> {
  try {
    // Check if replica set is available (required for transactions)
    const db = mongoose.connection.db;
    if (!db) return null;

    // MongoDB transactions require replica set - check admin command
    const result = await db.admin().command({ ismaster: 1 });
    // If we get here, we have a connection
    const session = await mongoose.startSession();
    return session;
  } catch (error) {
    // Transactions not available (standalone MongoDB or error)
    logger.debug('MongoDB transactions not available, using non-atomic operations');
    return null;
  }
}

export const getAddresses = async (userId: string): Promise<IAddress[]> => {
  return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};

export const getAddressById = async (addressId: string, userId: string): Promise<IAddress | null> => {
  return Address.findOne({ _id: addressId, userId });
};

/**
 * Create address with transaction support for atomic default handling
 * SECURITY FIX: Wraps multiple operations in a transaction to prevent race conditions
 */
export const createAddress = async (data: Omit<IAddress, 'createdAt' | 'updatedAt'>): Promise<IAddress> => {
  const session = await getSession();

  if (!session) {
    // Fallback to non-atomic operation if transactions not available
    return createAddressNonAtomic(data);
  }

  try {
    session.startTransaction();

    // If this is the first address or marked as default, handle defaults
    const existingAddresses = await Address.countDocuments({ userId: data.userId }, { session });

    if (existingAddresses === 0) {
      data.isDefault = true;
    } else if (data.isDefault) {
      // Unset other defaults atomically
      await Address.updateMany(
        { userId: data.userId },
        { isDefault: false },
        { session }
      );
    }

    const address = new Address(data);
    await address.save({ session });

    await session.commitTransaction();

    logger.info('Address created (transactional)', {
      addressId: address._id,
      userId: data.userId,
      action: 'ADDRESS_CREATED'
    });

    return address;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Non-atomic fallback for createAddress (standalone MongoDB)
 */
async function createAddressNonAtomic(data: Omit<IAddress, 'createdAt' | 'updatedAt'>): Promise<IAddress> {
  const existingAddresses = await Address.countDocuments({ userId: data.userId });

  if (existingAddresses === 0) {
    data.isDefault = true;
  } else if (data.isDefault) {
    await Address.updateMany({ userId: data.userId }, { isDefault: false });
  }

  const address = new Address(data);
  await address.save();

  logger.info('Address created (non-atomic fallback)', {
    addressId: address._id,
    userId: data.userId,
    action: 'ADDRESS_CREATED'
  });

  return address;
}

/**
 * Update address with transaction support for atomic default handling
 * SECURITY FIX: Wraps multiple operations in a transaction to prevent race conditions
 */
export const updateAddress = async (
  addressId: string,
  userId: string,
  data: Partial<IAddress>
): Promise<IAddress | null> => {
  const session = await getSession();

  if (!session) {
    return updateAddressNonAtomic(addressId, userId, data);
  }

  try {
    session.startTransaction();

    const address = await Address.findOne({ _id: addressId, userId }).session(session);
    if (!address) {
      await session.abortTransaction();
      return null;
    }

    // If setting as default, unset others first atomically
    if (data.isDefault === true) {
      await Address.updateMany(
        { userId, _id: { $ne: addressId } },
        { isDefault: false },
        { session }
      );
    }

    Object.assign(address, data);
    await address.save({ session });

    await session.commitTransaction();

    logger.info('Address updated (transactional)', { addressId, userId, action: 'ADDRESS_UPDATED' });
    return address;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Non-atomic fallback for updateAddress
 */
async function updateAddressNonAtomic(
  addressId: string,
  userId: string,
  data: Partial<IAddress>
): Promise<IAddress | null> {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) return null;

  if (data.isDefault === true) {
    await Address.updateMany({ userId, _id: { $ne: addressId } }, { isDefault: false });
  }

  Object.assign(address, data);
  await address.save();

  logger.info('Address updated (non-atomic fallback)', { addressId, userId, action: 'ADDRESS_UPDATED' });
  return address;
}

/**
 * Delete address with transaction support for atomic default reassignment
 * SECURITY FIX: Wraps multiple operations in a transaction to prevent race conditions
 */
export const deleteAddress = async (addressId: string, userId: string): Promise<boolean> => {
  const session = await getSession();

  if (!session) {
    return deleteAddressNonAtomic(addressId, userId);
  }

  try {
    session.startTransaction();

    const address = await Address.findOneAndDelete(
      { _id: addressId, userId },
      { session }
    );

    if (!address) {
      await session.abortTransaction();
      return false;
    }

    // If deleted was default, set another as default atomically
    if (address.isDefault) {
      const another = await Address.findOne({ userId })
        .sort({ createdAt: -1 })
        .session(session);

      if (another) {
        another.isDefault = true;
        await another.save({ session });
      }
    }

    await session.commitTransaction();

    logger.info('Address deleted (transactional)', { addressId, userId, action: 'ADDRESS_DELETED' });
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Non-atomic fallback for deleteAddress
 */
async function deleteAddressNonAtomic(addressId: string, userId: string): Promise<boolean> {
  const address = await Address.findOneAndDelete({ _id: addressId, userId });

  if (!address) return false;

  if (address.isDefault) {
    const another = await Address.findOne({ userId }).sort({ createdAt: -1 });
    if (another) {
      another.isDefault = true;
      await another.save();
    }
  }

  logger.info('Address deleted (non-atomic fallback)', { addressId, userId, action: 'ADDRESS_DELETED' });
  return true;
}

/**
 * Set default address with transaction support
 * SECURITY FIX: Ensures the unset and set operations are atomic
 */
export const setDefaultAddress = async (
  addressId: string,
  userId: string
): Promise<IAddress | null> => {
  const session = await getSession();

  if (!session) {
    return setDefaultAddressNonAtomic(addressId, userId);
  }

  try {
    session.startTransaction();

    // Unset all defaults atomically
    await Address.updateMany(
      { userId },
      { isDefault: false },
      { session }
    );

    // Set new default
    const address = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { isDefault: true },
      { new: true, session }
    );

    await session.commitTransaction();

    logger.info('Default address set (transactional)', { addressId, userId, action: 'DEFAULT_ADDRESS_SET' });
    return address;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Non-atomic fallback for setDefaultAddress
 */
async function setDefaultAddressNonAtomic(
  addressId: string,
  userId: string
): Promise<IAddress | null> {
  await Address.updateMany({ userId }, { isDefault: false });

  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    { isDefault: true },
    { new: true }
  );

  logger.info('Default address set (non-atomic fallback)', { addressId, userId, action: 'DEFAULT_ADDRESS_SET' });
  return address;
}

export default {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
