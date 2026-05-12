// AI Service - Platform Intelligence & Fraud Detection
import Booking from '../../models/booking.model';
import logger from '../../utils/logger';
import {
  FraudSignal,
  FraudPrediction,
  FraudFactors,
  BookingPattern,
  FraudDetectionConfig,
  DEFAULT_CONFIG,
  getBookingPattern,
  checkHighVelocity,
  checkUnusualBookingValue,
  checkNewAccountWithHighValue,
  checkCancellationPattern,
  checkProviderConcentration,
  checkPaymentFailurePattern,
  checkGuestBookingRisk,
  checkGeolocationAnomaly,
  checkDeviceFingerprint,
  calculateRiskScore,
  determineRecommendation,
  extractFraudFactors
} from './rules';

export {
  FraudSignal,
  FraudPrediction,
  FraudFactors,
  BookingPattern,
  FraudDetectionConfig,
  DEFAULT_CONFIG
};

export interface FraudCheckInput {
  userId?: string;
  providerId?: string;
  bookingAmount?: number;
  bookingId?: string;
  guestEmail?: string;
  guestPhone?: string;
  bookingCoords?: { lat: number; lng: number };
  deviceFingerprint?: string;
  config?: FraudDetectionConfig;
  isGuestBooking?: boolean;
}

export async function predictFraud(input: FraudCheckInput): Promise<FraudPrediction> {
  const config = input.config || DEFAULT_CONFIG;
  const signals: FraudSignal[] = [];
  const baseScore = 0;

  if (input.userId) {
    const userId = input.userId;

    const [
      velocitySignal,
      cancellationSignal,
      paymentSignal,
      deviceSignal,
      locationSignal
    ] = await Promise.all([
      checkHighVelocity(userId, config),
      checkCancellationPattern(userId, config),
      checkPaymentFailurePattern(userId),
      checkDeviceFingerprint(userId, input.deviceFingerprint),
      checkGeolocationAnomaly(userId, input.bookingCoords)
    ]);

    if (velocitySignal) signals.push(velocitySignal);
    if (cancellationSignal) signals.push(cancellationSignal);
    if (paymentSignal) signals.push(paymentSignal);
    if (deviceSignal) signals.push(deviceSignal);
    if (locationSignal) signals.push(locationSignal);

    if (input.bookingAmount) {
      const [
        valueSignal,
        newAccountSignal
      ] = await Promise.all([
        checkUnusualBookingValue(userId, input.bookingAmount, config),
        checkNewAccountWithHighValue(userId, input.bookingAmount, config)
      ]);

      if (valueSignal) signals.push(valueSignal);
      if (newAccountSignal) signals.push(newAccountSignal);
    }

    if (input.providerId) {
      const concentrationSignal = await checkProviderConcentration(
        userId,
        input.providerId,
        config
      );
      if (concentrationSignal) signals.push(concentrationSignal);
    }
  }

  if (input.isGuestBooking) {
    const guestSignal = await checkGuestBookingRisk(
      input.guestEmail || '',
      input.guestPhone || ''
    );
    if (guestSignal) signals.push(guestSignal);
  }

  if (input.bookingId) {
    const booking = await Booking.findById(input.bookingId).lean();
    if (booking && booking.customerId) {
      const velocitySignal = await checkHighVelocity(booking.customerId, config);
      if (velocitySignal) signals.push(velocitySignal);
    }
  }

  const riskScore = calculateRiskScore(signals, baseScore);
  const recommendation = determineRecommendation(riskScore, signals);

  const factors = input.userId
    ? await extractFraudFactors(
        input.userId,
        input.bookingAmount,
        input.bookingCoords,
        input.deviceFingerprint
      )
    : {
        bookingVelocity: 0,
        deviceFingerprintScore: 0,
        locationAnomaly: false,
        paymentRisk: false,
        accountAge: 365,
        cancellationPattern: 0
      };

  logger.info('Fraud prediction completed', {
    userId: input.userId,
    riskScore,
    recommendation,
    signalsCount: signals.length,
    highSeverityCount: signals.filter(s => s.severity === 'high').length
  });

  return {
    riskScore,
    recommendation,
    signals,
    factors
  };
}

export async function getUserBookingPattern(
  userId: string
): Promise<BookingPattern> {
  return getBookingPattern(userId);
}

export async function checkUserRiskLevel(
  userId: string
): Promise<{ level: 'low' | 'medium' | 'high'; score: number }> {
  const prediction = await predictFraud({ userId });

  if (prediction.riskScore >= 0.6) {
    return { level: 'high', score: prediction.riskScore };
  }
  if (prediction.riskScore >= 0.3) {
    return { level: 'medium', score: prediction.riskScore };
  }
  return { level: 'low', score: prediction.riskScore };
}

export async function preBookingRiskAssessment(
  customerId: string,
  providerId: string,
  bookingAmount: number,
  bookingCoords?: { lat: number; lng: number }
): Promise<FraudPrediction> {
  return predictFraud({
    userId: customerId,
    providerId,
    bookingAmount,
    bookingCoords
  });
}

export async function preGuestBookingRiskAssessment(
  guestEmail: string,
  guestPhone: string,
  bookingAmount: number
): Promise<FraudPrediction> {
  return predictFraud({
    bookingAmount,
    guestEmail,
    guestPhone,
    isGuestBooking: true
  });
}

export interface FraudStats {
  totalAssessments: number;
  allowedCount: number;
  reviewCount: number;
  blockedCount: number;
  avgRiskScore: number;
  topRiskFactors: Array<{ type: string; count: number }>;
}

export async function getFraudStats(
  startDate?: Date,
  endDate?: Date
): Promise<FraudStats> {
  const matchStage: any = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return {
    totalAssessments: 0,
    allowedCount: 0,
    reviewCount: 0,
    blockedCount: 0,
    avgRiskScore: 0,
    topRiskFactors: []
  };
}

export default {
  predictFraud,
  getUserBookingPattern,
  checkUserRiskLevel,
  preBookingRiskAssessment,
  preGuestBookingRiskAssessment,
  getFraudStats,
  ...require('./rules')
};
