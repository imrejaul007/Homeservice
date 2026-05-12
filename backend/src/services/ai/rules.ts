import { Types } from 'mongoose';
import Booking from '../../models/booking.model';
import User from '../../models/user.model';

export interface FraudSignal {
  type: string;
  weight: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  data?: any;
}

export interface FraudPrediction {
  riskScore: number;
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';
  signals?: FraudSignal[];
  factors?: FraudFactors;
}

export interface BookingPattern {
  bookingsLast24h: number;
  bookingsLast7d: number;
  totalBookings: number;
  uniqueProviders: number;
  avgBookingValue: number;
  cancellationRate: number;
}

export interface FraudFactors {
  bookingVelocity: number;
  deviceFingerprintScore: number;
  locationAnomaly: boolean;
  paymentRisk: boolean;
  accountAge: number;
  cancellationPattern: number;
}

export interface FraudDetectionConfig {
  VELOCITY_THRESHOLD_24H: number;
  VELOCITY_THRESHOLD_7D: number;
  UNUSUAL_VALUE_MULTIPLIER: number;
  NEW_ACCOUNT_DAYS: number;
  CANCELLATION_RATE_THRESHOLD: number;
  MAX_BOOKINGS_PER_PROVIDER: number;
  PAYMENT_FAILURE_THRESHOLD: number;
}

export const DEFAULT_CONFIG: FraudDetectionConfig = {
  VELOCITY_THRESHOLD_24H: 5,
  VELOCITY_THRESHOLD_7D: 20,
  UNUSUAL_VALUE_MULTIPLIER: 2.5,
  NEW_ACCOUNT_DAYS: 7,
  CANCELLATION_RATE_THRESHOLD: 0.4,
  MAX_BOOKINGS_PER_PROVIDER: 10,
  PAYMENT_FAILURE_THRESHOLD: 2,
};

export async function getBookingPattern(userId: string | Types.ObjectId): Promise<BookingPattern> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    bookingsLast24h,
    bookingsLast7d,
    totalBookings,
    cancellations,
    completedBookings
  ] = await Promise.all([
    Booking.countDocuments({
      customerId: userObjectId,
      createdAt: { $gte: twentyFourHoursAgo }
    }),
    Booking.countDocuments({
      customerId: userObjectId,
      createdAt: { $gte: sevenDaysAgo }
    }),
    Booking.countDocuments({ customerId: userObjectId }),
    Booking.countDocuments({
      customerId: userObjectId,
      status: 'cancelled'
    }),
    Booking.countDocuments({
      customerId: userObjectId,
      status: 'completed'
    })
  ]);

  const aggregation = await Booking.aggregate([
    { $match: { customerId: userObjectId } },
    {
      $group: {
        _id: null,
        avgValue: { $avg: '$pricing.totalAmount' },
        uniqueProviders: { $addToSet: '$providerId' }
      }
    }
  ]);

  const avgBookingValue = aggregation[0]?.avgValue || 0;
  const uniqueProviders = aggregation[0]?.uniqueProviders?.length || 0;
  const totalAttempted = cancellations + completedBookings;
  const cancellationRate = totalAttempted > 0 ? cancellations / totalAttempted : 0;

  return {
    bookingsLast24h,
    bookingsLast7d,
    totalBookings,
    uniqueProviders,
    avgBookingValue,
    cancellationRate
  };
}

export async function checkHighVelocity(
  userId: string | Types.ObjectId,
  config: FraudDetectionConfig = DEFAULT_CONFIG
): Promise<FraudSignal | null> {
  const pattern = await getBookingPattern(userId);

  if (pattern.bookingsLast24h > config.VELOCITY_THRESHOLD_24H) {
    return {
      type: 'HIGH_VELOCITY_24H',
      weight: 0.30,
      severity: 'high',
      description: `${pattern.bookingsLast24h} bookings in 24 hours (threshold: ${config.VELOCITY_THRESHOLD_24H})`,
      data: { count: pattern.bookingsLast24h, threshold: config.VELOCITY_THRESHOLD_24H }
    };
  }

  if (pattern.bookingsLast7d > config.VELOCITY_THRESHOLD_7D) {
    return {
      type: 'HIGH_VELOCITY_7D',
      weight: 0.20,
      severity: 'medium',
      description: `${pattern.bookingsLast7d} bookings in 7 days (threshold: ${config.VELOCITY_THRESHOLD_7D})`,
      data: { count: pattern.bookingsLast7d, threshold: config.VELOCITY_THRESHOLD_7D }
    };
  }

  return null;
}

export async function checkUnusualBookingValue(
  userId: string | Types.ObjectId,
  bookingAmount: number,
  config: FraudDetectionConfig = DEFAULT_CONFIG
): Promise<FraudSignal | null> {
  const pattern = await getBookingPattern(userId);

  if (pattern.avgBookingValue > 0) {
    const multiplier = bookingAmount / pattern.avgBookingValue;

    if (multiplier > config.UNUSUAL_VALUE_MULTIPLIER) {
      return {
        type: 'UNUSUAL_BOOKING_VALUE',
        weight: 0.20,
        severity: multiplier > 5 ? 'high' : 'medium',
        description: `Booking value ${multiplier.toFixed(1)}x higher than user's average (${pattern.avgBookingValue.toFixed(2)} AED)`,
        data: {
          currentValue: bookingAmount,
          avgValue: pattern.avgBookingValue,
          multiplier
        }
      };
    }
  }

  return null;
}

export async function checkNewAccountWithHighValue(
  userId: string | Types.ObjectId,
  bookingAmount: number,
  config: FraudDetectionConfig = DEFAULT_CONFIG
): Promise<FraudSignal | null> {
  const user = await User.findById(userId).select('createdAt').lean();

  if (!user) return null;

  const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (accountAgeDays < config.NEW_ACCOUNT_DAYS && bookingAmount > 500) {
    return {
      type: 'NEW_ACCOUNT_HIGH_VALUE',
      weight: 0.25,
      severity: accountAgeDays < 2 && bookingAmount > 1000 ? 'high' : 'medium',
      description: `New account (${Math.floor(accountAgeDays)} days) with high-value booking (${bookingAmount} AED)`,
      data: { accountAgeDays: Math.floor(accountAgeDays), bookingAmount }
    };
  }

  return null;
}

export async function checkCancellationPattern(
  userId: string | Types.ObjectId,
  config: FraudDetectionConfig = DEFAULT_CONFIG
): Promise<FraudSignal | null> {
  const pattern = await getBookingPattern(userId);

  if (pattern.cancellationRate > config.CANCELLATION_RATE_THRESHOLD && pattern.totalBookings >= 3) {
    return {
      type: 'RAPID_CANCELLATIONS',
      weight: 0.35,
      severity: pattern.cancellationRate > 0.6 ? 'high' : 'medium',
      description: `Cancellation rate ${(pattern.cancellationRate * 100).toFixed(0)}% (threshold: ${config.CANCELLATION_RATE_THRESHOLD * 100}%)`,
      data: { cancellationRate: pattern.cancellationRate, totalBookings: pattern.totalBookings }
    };
  }

  return null;
}

export async function checkProviderConcentration(
  userId: string | Types.ObjectId,
  providerId: string | Types.ObjectId,
  config: FraudDetectionConfig = DEFAULT_CONFIG
): Promise<FraudSignal | null> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const providerObjectId = typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

  const bookingsWithProvider = await Booking.countDocuments({
    customerId: userObjectId,
    providerId: providerObjectId,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  if (bookingsWithProvider > config.MAX_BOOKINGS_PER_PROVIDER) {
    return {
      type: 'EXCESSIVE_PROVIDER_BOOKINGS',
      weight: 0.15,
      severity: 'low',
      description: `${bookingsWithProvider} bookings with same provider in 30 days (threshold: ${config.MAX_BOOKINGS_PER_PROVIDER})`,
      data: { bookingsWithProvider, threshold: config.MAX_BOOKINGS_PER_PROVIDER }
    };
  }

  return null;
}

export async function checkPaymentFailurePattern(
  userId: string | Types.ObjectId
): Promise<FraudSignal | null> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const failedPayments = await Booking.countDocuments({
    customerId: userObjectId,
    'payment.status': 'failed'
  });

  if (failedPayments >= 2) {
    return {
      type: 'PAYMENT_FAILURE_HISTORY',
      weight: 0.25,
      severity: failedPayments >= 4 ? 'high' : 'medium',
      description: `${failedPayments} failed payment attempts on record`,
      data: { failedPayments }
    };
  }

  return null;
}

export async function checkGuestBookingRisk(
  guestEmail: string,
  guestPhone: string
): Promise<FraudSignal | null> {
  if (!guestEmail && !guestPhone) {
    return {
      type: 'INCOMPLETE_GUEST_INFO',
      weight: 0.10,
      severity: 'low',
      description: 'Guest booking without email or phone provided',
      data: { hasEmail: !!guestEmail, hasPhone: !!guestPhone }
    };
  }

  if (guestEmail && guestPhone) {
    const existingGuestBookings = await Booking.countDocuments({
      'guestInfo.email': guestEmail,
      'guestInfo.phone': guestPhone,
      isGuestBooking: true
    });

    if (existingGuestBookings > 5) {
      return {
        type: 'SUSPICIOUS_GUEST_BOOKING_PATTERN',
        weight: 0.20,
        severity: 'medium',
        description: `${existingGuestBookings} guest bookings from same email/phone combination`,
        data: { existingGuestBookings }
      };
    }
  }

  return null;
}

export async function checkGeolocationAnomaly(
  userId: string | Types.ObjectId,
  bookingCoords?: { lat: number; lng: number }
): Promise<FraudSignal | null> {
  if (!bookingCoords) return null;

  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const user = await User.findById(userObjectId)
    .select('address.coordinates')
    .lean();

  if (user?.address?.coordinates) {
    const userLat = user.address.coordinates.lat;
    const userLng = user.address.coordinates.lng;

    const latDiff = Math.abs(bookingCoords.lat - userLat);
    const lngDiff = Math.abs(bookingCoords.lng - userLng);
    const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;

    if (distanceKm > 500) {
      return {
        type: 'GEOLOCATION_ANOMALY',
        weight: 0.15,
        severity: 'medium',
        description: `Booking location ${distanceKm.toFixed(0)} km from user's registered address`,
        data: { distanceKm, userCoords: { lat: userLat, lng: userLng }, bookingCoords }
      };
    }
  }

  return null;
}

export async function checkDeviceFingerprint(
  userId: string | Types.ObjectId,
  deviceFingerprint?: string
): Promise<FraudSignal | null> {
  if (!deviceFingerprint) return null;

  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const bookingsWithDevice = await Booking.countDocuments({
    customerId: userObjectId,
    'metadata.sessionId': deviceFingerprint,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  if (bookingsWithDevice === 0) {
    return {
      type: 'NEW_DEVICE_FINGERPRINT',
      weight: 0.05,
      severity: 'low',
      description: 'First booking from this device in 30 days',
      data: { bookingsWithDevice }
    };
  }

  return null;
}

export function calculateRiskScore(
  signals: FraudSignal[],
  baseScore: number = 0
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const signal of signals) {
    weightedSum += signal.weight;
    totalWeight += signal.weight;
  }

  const maxPossibleScore = signals.reduce((sum, s) => sum + s.weight, 0);
  const normalizedScore = maxPossibleScore > 0 ? weightedSum / totalWeight : 0;

  return Math.min(1, baseScore + normalizedScore * (1 - baseScore));
}

export function determineRecommendation(
  riskScore: number,
  signals: FraudSignal[]
): 'ALLOW' | 'REVIEW' | 'BLOCK' {
  const highSeveritySignals = signals.filter(s => s.severity === 'high');

  if (riskScore >= 0.7 || highSeveritySignals.length >= 2) {
    return 'BLOCK';
  }

  if (riskScore >= 0.4 || highSeveritySignals.length >= 1) {
    return 'REVIEW';
  }

  return 'ALLOW';
}

export async function extractFraudFactors(
  userId: string | Types.ObjectId,
  _bookingAmount?: number,
  bookingCoords?: { lat: number; lng: number },
  deviceFingerprint?: string
): Promise<FraudFactors> {
  const pattern = await getBookingPattern(userId);
  const user = await User.findById(userId).select('createdAt').lean();

  const accountAge = user
    ? (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    : 365;

  const locationAnomaly = bookingCoords
    ? await checkGeolocationAnomaly(userId, bookingCoords) !== null
    : false;

  const paymentRisk = await checkPaymentFailurePattern(userId) !== null;

  return {
    bookingVelocity: pattern.bookingsLast24h / DEFAULT_CONFIG.VELOCITY_THRESHOLD_24H,
    deviceFingerprintScore: deviceFingerprint
      ? await checkDeviceFingerprint(userId, deviceFingerprint) !== null ? 1 : 0
      : 0,
    locationAnomaly,
    paymentRisk,
    accountAge: Math.min(1, accountAge / DEFAULT_CONFIG.NEW_ACCOUNT_DAYS),
    cancellationPattern: pattern.cancellationRate
  };
}
