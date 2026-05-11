/**
 * Beauty Platform Metrics & Analytics
 */

import Booking from '../models/booking.model';
import BeautyPlan from '../models/beautyPlan.model';

export interface BeautyMetrics {
  avgBookingValue: number;
  commissionRate: number;
  netPerBooking: number;
  bookingsPerSalon: number;
  repeatRate: number;
  totalBookings: number;
  totalRevenue: number;
  topServices: string[];
}

export const getBeautyMetrics = async (): Promise<BeautyMetrics> => {
  const bookings = await Booking.find({ status: 'completed' }).lean();
  const plans = await BeautyPlan.find().lean();

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
  const totalBookings = bookings.length;

  // Average booking value
  const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // Commission rates by plan
  const freePlans = plans.filter(p => p.plan === 'beauty_free').length;
  const proPlans = plans.filter(p => p.plan === 'beauty_pro').length;
  const premiumPlans = plans.filter(p => p.plan === 'beauty_premium').length;
  const totalPlans = plans.length;

  const avgCommission =
    totalPlans > 0
      ? (freePlans * 20 + proPlans * 15 + premiumPlans * 12) / totalPlans
      : 20;

  // Net per booking (after payment processing ~2%)
  const paymentProcessing = 0.02;
  const netPerBooking = avgBookingValue * (1 - paymentProcessing);

  // Bookings per salon (assuming totalPlans providers)
  const activeProviders = plans.filter(p => p.status === 'active').length;
  const bookingsPerSalon = activeProviders > 0 ? totalBookings / activeProviders : 0;

  // Repeat rate (users with 2+ bookings / total users)
  const userBookingCounts = bookings.reduce((acc, b) => {
    const userId = b.customerId?.toString() || 'unknown';
    acc[userId] = (acc[userId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const repeatUsers = Object.values(userBookingCounts).filter(c => c >= 2).length;
  const totalUsers = Object.keys(userBookingCounts).length;
  const repeatRate = totalUsers > 0 ? (repeatUsers / totalUsers) * 100 : 0;

  // Top services
  const serviceCounts = bookings.reduce((acc, b) => {
    const serviceId = b.serviceId?.toString() || 'unknown';
    acc[serviceId] = (acc[serviceId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  return {
    avgBookingValue: Math.round(avgBookingValue),
    commissionRate: Math.round(avgCommission * 10) / 10,
    netPerBooking: Math.round(netPerBooking),
    bookingsPerSalon: Math.round(bookingsPerSalon),
    repeatRate: Math.round(repeatRate),
    totalBookings,
    totalRevenue: Math.round(totalRevenue),
    topServices,
  };
};

export const getProviderMetrics = async (providerId: string) => {
  const bookings = await Booking.find({ providerId }).lean();
  const plan = await BeautyPlan.findOne({ providerId });

  const completed = bookings.filter(b => b.status === 'completed').length;
  const cancelled = bookings.filter(b => b.status === 'cancelled').length;
  const revenue = completed * (180 * (1 - (plan?.commissionRate || 20) / 100));

  return {
    totalBookings: bookings.length,
    completed,
    cancelled,
    revenue: Math.round(revenue),
    plan: plan?.plan || 'beauty_free',
    commissionRate: plan?.commissionRate || 20,
  };
};

export default { getBeautyMetrics, getProviderMetrics };
