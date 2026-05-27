import mongoose from 'mongoose';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

// Query handlers
type QueryHandler<T = any, R = any> = (
  query: T
) => Promise<R>;

const queryHandlers = new Map<string, QueryHandler>();

export const registerQuery = <T = any, R = any>(
  type: string,
  handler: QueryHandler<T, R>
): void => {
  queryHandlers.set(type, handler);
};

export const executeQuery = async <T = any, R = any>(
  type: string,
  query: T
): Promise<R> => {
  const handler = queryHandlers.get(type);
  if (!handler) {
    throw ApiError.notFound(`Query handler not found: ${type}`, ERROR_CODES.NOT_FOUND);
  }
  return handler(query);
};

// Pre-built queries
export const queries = {
  // Booking queries
  getBookingById: async (id: string) => {
    const Booking = mongoose.model('Booking');
    return Booking.findById(id)
      .populate('serviceId')
      .populate('providerId')
      .populate('customerId');
  },

  getBookingsByCustomer: async (customerId: string, options: { status?: string; limit?: number; offset?: number } = {}) => {
    const Booking = mongoose.model('Booking');
    const { status, limit = 20, offset = 0 } = options;
    const query: any = { customerId };
    if (status) query.status = status;

    return Booking.find(query)
      .populate('serviceId')
      .populate('providerId')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
  },

  getBookingsByProvider: async (providerId: string, options: { status?: string; date?: string } = {}) => {
    const Booking = mongoose.model('Booking');
    const { status, date } = options;
    const query: any = { providerId };
    if (status) query.status = status;
    if (date) {
      query.scheduledDate = new Date(date);
    }

    return Booking.find(query)
      .populate('serviceId')
      .populate('customerId')
      .sort({ scheduledDate: 1 });
  },

  // Provider queries
  getProviderById: async (id: string) => {
    const User = mongoose.model('User');
    return User.findOne({ _id: id, role: 'provider' })
      .select('-password');
  },

  getActiveProviders: async (serviceId?: string) => {
    const User = mongoose.model('User');
    const query: any = { role: 'provider', 'providerProfile.isActive': true };
    if (serviceId) {
      query['providerProfile.services'] = serviceId;
    }
    return User.find(query).select('-password');
  },

  // Dashboard queries
  getAdminDashboard: async () => {
    const User = mongoose.model('User');
    const Booking = mongoose.model('Booking');
    const Service = mongoose.model('Service');

    const [users, bookings, services] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      Booking.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Service.countDocuments({ isActive: true }),
    ]);

    return {
      totalCustomers: users,
      bookingsToday: bookings,
      activeServices: services,
    };
  },
};
