import mongoose, { Document, Schema, Model } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus/index';
import { v4 as uuidv4 } from 'uuid';

// Try to import Payment model if it exists (optional)
let Payment: Model<any> | null = null;
try {
  Payment = require('../models/payment.model').default;
} catch {
  // Payment model doesn't exist - will use optional chaining
}

// ============================================
// Type Definitions
// ============================================

export type AnomalyType = 'fraud' | 'booking' | 'payment' | 'behavior';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type EntityType = 'user' | 'provider' | 'booking' | 'payment';
export type AnomalyStatus = 'pending' | 'investigating' | 'resolved' | 'false_positive';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  entityType: EntityType;
  entityId: string;
  description: string;
  evidence: string[];
  confidence: number; // 0-1
  detectedAt: Date;
  status: AnomalyStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  metadata?: Record<string, any>;
}

export interface BehavioralScore {
  entityId: string;
  entityType: EntityType;
  overallScore: number; // 0-100
  factors: {
    name: string;
    score: number;
    weight: number;
  }[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
}

export interface AnomalyPattern {
  id: string;
  name: string;
  type: AnomalyType;
  description: string;
  severity: AnomalySeverity;
  conditions: AnomalyCondition[];
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
}

export interface AnomalyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'contains';
  value: any;
  threshold?: number;
}

export interface AnomalyFilters {
  type?: AnomalyType;
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  entityType?: EntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AnomalyStats {
  total: number;
  byType: Record<AnomalyType, number>;
  bySeverity: Record<AnomalySeverity, number>;
  byStatus: Record<AnomalyStatus, number>;
  recentCount: number;
  criticalCount: number;
  resolvedToday: number;
}

// ============================================
// Anomaly Model (MongoDB)
// ============================================

interface IAnomalyDocument extends Document {
  type: AnomalyType;
  severity: AnomalySeverity;
  entityType: EntityType;
  entityId: string;
  description: string;
  evidence: string[];
  confidence: number;
  detectedAt: Date;
  status: AnomalyStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  metadata?: Record<string, any>;
  relatedEntities?: {
    userId?: string;
    providerId?: string;
    bookingId?: string;
    paymentId?: string;
  };
}

const AnomalySchema = new Schema<IAnomalyDocument>(
  {
    type: {
      type: String,
      enum: ['fraud', 'booking', 'payment', 'behavior'],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['user', 'provider', 'booking', 'payment'],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    evidence: [{
      type: String,
    }],
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'false_positive'],
      default: 'pending',
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
    },
    resolution: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    relatedEntities: {
      userId: String,
      providerId: String,
      bookingId: String,
      paymentId: String,
    },
  },
  {
    timestamps: { createdAt: 'detectedAt', updatedAt: true },
  }
);

// Compound indexes for common queries
AnomalySchema.index({ entityId: 1, entityType: 1 });
AnomalySchema.index({ type: 1, severity: 1, status: 1 });
AnomalySchema.index({ detectedAt: -1, status: 1 });

export const AnomalyModel: Model<IAnomalyDocument> = mongoose.models.Anomaly || mongoose.model<IAnomalyDocument>('Anomaly', AnomalySchema);

// ============================================
// Anomaly Detection Service
// ============================================

export class AnomalyDetectionService {
  // Configuration constants
  private readonly BOOKING_VELOCITY_THRESHOLD = 10; // Max bookings per day
  private readonly SUSPICIOUS_BOOKING_VELOCITY = 5; // Suspicious threshold
  private readonly PAYMENT_FAILURE_THRESHOLD = 3; // Max failures before flag
  private readonly CANCELLATION_RATE_THRESHOLD = 0.5; // 50% cancellation rate
  private readonly RAPID_BOOKING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes between bookings

  // Anomaly patterns
  private readonly anomalyPatterns: AnomalyPattern[] = [
    {
      id: 'booking_velocity_high',
      name: 'High Booking Velocity',
      type: 'booking',
      description: 'Unusually high number of bookings in a short time period',
      severity: 'high',
      conditions: [
        { field: 'velocity', operator: 'greater_than', value: 10 },
      ],
      enabled: true,
      cooldownMinutes: 60,
    },
    {
      id: 'rapid_booking_sequence',
      name: 'Rapid Booking Sequence',
      type: 'booking',
      description: 'Multiple bookings created within minutes of each other',
      severity: 'medium',
      conditions: [
        { field: 'timeBetweenBookings', operator: 'less_than', value: 300000 }, // 5 minutes
      ],
      enabled: true,
      cooldownMinutes: 30,
    },
    {
      id: 'high_cancellation_rate',
      name: 'High Cancellation Rate',
      type: 'booking',
      description: 'User has unusually high booking cancellation rate',
      severity: 'medium',
      conditions: [
        { field: 'cancellationRate', operator: 'greater_than', value: 0.5 },
      ],
      enabled: true,
      cooldownMinutes: 1440, // 24 hours
    },
    {
      id: 'payment_failure_spike',
      name: 'Payment Failure Spike',
      type: 'payment',
      description: 'Multiple payment failures in succession',
      severity: 'high',
      conditions: [
        { field: 'paymentFailures', operator: 'greater_than', value: 3 },
      ],
      enabled: true,
      cooldownMinutes: 60,
    },
    {
      id: 'suspicious_payment_pattern',
      name: 'Suspicious Payment Pattern',
      type: 'payment',
      description: 'Unusual payment patterns detected',
      severity: 'high',
      conditions: [
        { field: 'amountAnomaly', operator: 'greater_than', value: 0.8 },
      ],
      enabled: true,
      cooldownMinutes: 120,
    },
    {
      id: 'account_takeover',
      name: 'Potential Account Takeover',
      type: 'behavior',
      description: 'Behavioral changes suggesting account compromise',
      severity: 'critical',
      conditions: [
        { field: 'locationChange', operator: 'greater_than', value: 500 }, // km
      ],
      enabled: true,
      cooldownMinutes: 15,
    },
    {
      id: 'automated_activity',
      name: 'Automated/Bot Activity',
      type: 'behavior',
      description: 'Patterns consistent with automated scripts or bots',
      severity: 'high',
      conditions: [
        { field: 'actionVelocity', operator: 'greater_than', value: 100 },
      ],
      enabled: true,
      cooldownMinutes: 30,
    },
    {
      id: 'new_account_fraud',
      name: 'New Account Fraud Pattern',
      type: 'fraud',
      description: 'High-risk activity from newly created accounts',
      severity: 'critical',
      conditions: [
        { field: 'accountAge', operator: 'less_than', value: 86400000 }, // 24 hours
      ],
      enabled: true,
      cooldownMinutes: 60,
    },
  ];

  // ========================================
  // Core Detection Methods
  // ========================================

  /**
   * Detect booking velocity anomalies for a user
   * Normal users: < 5 bookings per day
   * Suspicious: 5-10 bookings per day
   * Highly suspicious: > 10 bookings per day
   */
  async detectBookingVelocityAnomaly(userId: string): Promise<Anomaly | null> {
    try {
      // Get bookings from last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentBookings = await Booking.find({
        customerId: userId,
        createdAt: { $gte: twentyFourHoursAgo },
      });

      const velocity = recentBookings.length;

      if (velocity > this.BOOKING_VELOCITY_THRESHOLD) {
        const severity: AnomalySeverity = velocity > 20 ? 'critical' : 'high';
        const confidence = Math.min(0.95, 0.7 + (velocity - 10) * 0.025);

        const anomaly: Anomaly = {
          id: uuidv4(),
          type: 'booking',
          severity,
          entityType: 'user',
          entityId: userId,
          description: `Unusual booking velocity: ${velocity} bookings in 24 hours (threshold: ${this.BOOKING_VELOCITY_THRESHOLD})`,
          evidence: recentBookings.slice(0, 10).map(b => b.bookingNumber),
          confidence,
          detectedAt: new Date(),
          status: 'pending',
          metadata: {
            velocity,
            threshold: this.BOOKING_VELOCITY_THRESHOLD,
            bookingIds: recentBookings.map(b => b._id.toString()),
          },
        };

        return await this.createAnomaly(anomaly);
      }

      return null;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to detect booking velocity anomaly', {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Detect rapid booking sequence anomalies
   */
  async detectRapidBookingSequence(userId: string): Promise<Anomaly | null> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentBookings = await Booking.find({
        customerId: userId,
        createdAt: { $gte: oneHourAgo },
      }).sort({ createdAt: 1 });

      if (recentBookings.length < 3) return null;

      // Check time between consecutive bookings
      for (let i = 1; i < recentBookings.length; i++) {
        const timeDiff = recentBookings[i].createdAt.getTime() - recentBookings[i - 1].createdAt.getTime();

        if (timeDiff < this.RAPID_BOOKING_WINDOW_MS) {
          const severity: AnomalySeverity = timeDiff < 60000 ? 'critical' : 'high';

          const anomaly: Anomaly = {
            id: uuidv4(),
            type: 'behavior',
            severity,
            entityType: 'user',
            entityId: userId,
            description: `Rapid booking sequence detected: ${recentBookings.length} bookings in less than an hour, with ${Math.round(timeDiff / 1000)}s between bookings`,
            evidence: recentBookings.map(b => b.bookingNumber),
            confidence: 0.85,
            detectedAt: new Date(),
            status: 'pending',
            metadata: {
              timeBetweenBookings: timeDiff,
              totalBookings: recentBookings.length,
              windowMs: this.RAPID_BOOKING_WINDOW_MS,
            },
          };

          return await this.createAnomaly(anomaly);
        }
      }

      return null;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to detect rapid booking sequence', {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Detect high cancellation rate anomalies
   */
  async detectHighCancellationRate(userId: string, days: number = 30): Promise<Anomaly | null> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [allBookings, cancelledBookings] = await Promise.all([
        Booking.find({
          customerId: userId,
          createdAt: { $gte: startDate },
        }),
        Booking.find({
          customerId: userId,
          status: 'cancelled',
          createdAt: { $gte: startDate },
        }),
      ]);

      if (allBookings.length < 5) return null; // Need minimum bookings for reliable rate

      const cancellationRate = cancelledBookings.length / allBookings.length;

      if (cancellationRate > this.CANCELLATION_RATE_THRESHOLD) {
        const anomaly: Anomaly = {
          id: uuidv4(),
          type: 'booking',
          severity: cancellationRate > 0.8 ? 'high' : 'medium',
          entityType: 'user',
          entityId: userId,
          description: `High cancellation rate: ${(cancellationRate * 100).toFixed(1)}% (${cancelledBookings.length}/${allBookings.length} bookings cancelled in ${days} days)`,
          evidence: cancelledBookings.slice(0, 10).map(b => b.bookingNumber),
          confidence: 0.8,
          detectedAt: new Date(),
          status: 'pending',
          metadata: {
            cancellationRate,
            totalBookings: allBookings.length,
            cancelledBookings: cancelledBookings.length,
            periodDays: days,
          },
        };

        return await this.createAnomaly(anomaly);
      }

      return null;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to detect cancellation rate anomaly', {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Detect payment failure patterns
   */
  async detectPaymentFailureAnomaly(userId: string): Promise<Anomaly | null> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Check for failed payments
      const failedPayments = await Payment?.find?.({
        userId,
        status: 'failed',
        createdAt: { $gte: twentyFourHoursAgo },
      }) || [];

      const failureCount = failedPayments.length;

      if (failureCount >= this.PAYMENT_FAILURE_THRESHOLD) {
        const severity: AnomalySeverity = failureCount > 5 ? 'critical' : 'high';

        const anomaly: Anomaly = {
          id: uuidv4(),
          type: 'payment',
          severity,
          entityType: 'user',
          entityId: userId,
          description: `Payment failure spike: ${failureCount} failed payment attempts in 24 hours`,
          evidence: failedPayments.slice(0, 10).map((p: any) => p.paymentId || p._id?.toString() || 'unknown'),
          confidence: 0.9,
          detectedAt: new Date(),
          status: 'pending',
          metadata: {
            failureCount,
            threshold: this.PAYMENT_FAILURE_THRESHOLD,
            paymentIds: failedPayments.map((p: any) => p._id?.toString()),
          },
        };

        return await this.createAnomaly(anomaly);
      }

      return null;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to detect payment failure anomaly', {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Detect suspicious booking amounts
   */
  async detectSuspiciousBookingAmount(bookingId: string): Promise<Anomaly | null> {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) return null;

      // Get user's average booking amount
      const userBookings = await Booking.find({
        customerId: booking.customerId?.toString(),
        status: 'completed',
      }).sort({ createdAt: -1 }).limit(20);

      if (userBookings.length < 3) return null;

      const avgAmount = userBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0) / userBookings.length;
      const currentAmount = booking.pricing?.totalAmount || 0;
      const amountRatio = currentAmount / avgAmount;

      // Flag if current booking is 3x+ the average
      if (amountRatio > 3) {
        const anomaly: Anomaly = {
          id: uuidv4(),
          type: 'payment',
          severity: amountRatio > 5 ? 'critical' : 'high',
          entityType: 'booking',
          entityId: bookingId,
          description: `Suspicious booking amount: ${currentAmount} is ${amountRatio.toFixed(1)}x the user's average (${avgAmount.toFixed(2)})`,
          evidence: [booking.bookingNumber],
          confidence: 0.75,
          detectedAt: new Date(),
          status: 'pending',
          metadata: {
            currentAmount,
            averageAmount: avgAmount,
            amountRatio,
          },
        };

        return await this.createAnomaly(anomaly);
      }

      return null;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to detect suspicious booking amount', {
        bookingId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Detect behavioral anomalies for a user
   */
  async detectBehavioralAnomalies(userId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const user = await User.findById(userId);
      if (!user) return anomalies;

      // Check for new account fraud patterns
      const accountAge = Date.now() - (user.createdAt?.getTime() || 0);
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (accountAge < oneDayMs) {
        // Check for high activity from new account
        const recentBookings = await Booking.find({
          customerId: userId,
          createdAt: { $gte: new Date(Date.now() - oneDayMs) },
        });

        if (recentBookings.length > 3) {
          const anomaly: Anomaly = {
            id: uuidv4(),
            type: 'fraud',
            severity: 'critical',
            entityType: 'user',
            entityId: userId,
            description: `New account with high activity: ${recentBookings.length} bookings within ${Math.round(accountAge / (60 * 60 * 1000))} hours of account creation`,
            evidence: recentBookings.slice(0, 10).map(b => b.bookingNumber),
            confidence: 0.85,
            detectedAt: new Date(),
            status: 'pending',
            metadata: {
              accountAgeHours: Math.round(accountAge / (60 * 60 * 1000)),
              bookingCount: recentBookings.length,
            },
          };

          const created = await this.createAnomaly(anomaly);
          if (created) anomalies.push(created);
        }
      }

      // Check for location anomalies (if we have IP/geolocation data)
      // This would require additional data sources like login history

      return anomalies;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to detect behavioral anomalies', {
        userId,
        error: (error as Error).message,
      });
      return anomalies;
    }
  }

  // ========================================
  // Behavioral Scoring
  // ========================================

  /**
   * Calculate behavioral risk score for an entity
   */
  async calculateBehavioralScore(
    entityId: string,
    entityType: EntityType
  ): Promise<BehavioralScore> {
    const factors: BehavioralScore['factors'] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    try {
      // Factor 1: Booking velocity score
      const velocityScore = await this.getBookingVelocityScore(entityId, entityType);
      factors.push({ name: 'Booking Velocity', score: velocityScore, weight: 0.25 });
      totalWeightedScore += velocityScore * 0.25;
      totalWeight += 0.25;

      // Factor 2: Cancellation rate score
      const cancellationScore = await this.getCancellationRateScore(entityId, entityType);
      factors.push({ name: 'Cancellation Rate', score: cancellationScore, weight: 0.2 });
      totalWeightedScore += cancellationScore * 0.2;
      totalWeight += 0.2;

      // Factor 3: Payment reliability score
      const paymentScore = await this.getPaymentReliabilityScore(entityId, entityType);
      factors.push({ name: 'Payment Reliability', score: paymentScore, weight: 0.25 });
      totalWeightedScore += paymentScore * 0.25;
      totalWeight += 0.25;

      // Factor 4: Account age score
      const ageScore = await this.getAccountAgeScore(entityId, entityType);
      factors.push({ name: 'Account Maturity', score: ageScore, weight: 0.15 });
      totalWeightedScore += ageScore * 0.15;
      totalWeight += 0.15;

      // Factor 5: Engagement score
      const engagementScore = await this.getEngagementScore(entityId, entityType);
      factors.push({ name: 'User Engagement', score: engagementScore, weight: 0.15 });
      totalWeightedScore += engagementScore * 0.15;
      totalWeight += 0.15;

      // Normalize overall score
      const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 50;

      // Determine risk level
      let riskLevel: BehavioralScore['riskLevel'] = 'low';
      if (overallScore < 20) riskLevel = 'critical';
      else if (overallScore < 40) riskLevel = 'high';
      else if (overallScore < 60) riskLevel = 'medium';

      return {
        entityId,
        entityType,
        overallScore,
        factors,
        riskLevel,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('AnomalyDetection: Failed to calculate behavioral score', {
        entityId,
        entityType,
        error: (error as Error).message,
      });

      return {
        entityId,
        entityType,
        overallScore: 50,
        factors: [],
        riskLevel: 'medium',
        lastUpdated: new Date(),
      };
    }
  }

  private async getBookingVelocityScore(entityId: string, entityType: EntityType): Promise<number> {
    // Lower velocity = higher score (0-100)
    const field = entityType === 'user' ? 'customerId' : 'providerId';
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await Booking.countDocuments({
      [field]: entityId,
      createdAt: { $gte: oneDayAgo },
    });

    // Score mapping: 0 bookings = 100, 10+ = 0
    return Math.max(0, 100 - count * 10);
  }

  private async getCancellationRateScore(entityId: string, entityType: EntityType): Promise<number> {
    const field = entityType === 'user' ? 'customerId' : 'providerId';
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, cancelled] = await Promise.all([
      Booking.countDocuments({ [field]: entityId, createdAt: { $gte: thirtyDaysAgo } }),
      Booking.countDocuments({ [field]: entityId, status: 'cancelled', createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    if (total === 0) return 100;
    const rate = cancelled / total;

    // Score mapping: 0% cancellation = 100, 50%+ = 0
    return Math.max(0, 100 - rate * 200);
  }

  private async getPaymentReliabilityScore(entityId: string, entityType: EntityType): Promise<number> {
    // Default score if no payment data available
    return 75;
  }

  private async getAccountAgeScore(entityId: string, entityType: EntityType): Promise<number> {
    if (entityType !== 'user') return 50;

    const user = await User.findById(entityId).select('createdAt');
    if (!user?.createdAt) return 50;

    const ageDays = (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000);

    // Score mapping: 30+ days = 100, new = 0
    return Math.min(100, ageDays * 3.33);
  }

  private async getEngagementScore(entityId: string, entityType: EntityType): Promise<number> {
    const field = entityType === 'user' ? 'customerId' : 'providerId';
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [completed, total] = await Promise.all([
      Booking.countDocuments({ [field]: entityId, status: 'completed', createdAt: { $gte: thirtyDaysAgo } }),
      Booking.countDocuments({ [field]: entityId, createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    if (total === 0) return 50;

    // Higher engagement = higher score
    return Math.min(100, completed * 10);
  }

  // ========================================
  // CRUD Operations
  // ========================================

  /**
   * Create a new anomaly record
   */
  async createAnomaly(anomaly: Anomaly): Promise<Anomaly | null> {
    try {
      // Check cooldown for this pattern
      const pattern = this.anomalyPatterns.find(p =>
        p.type === anomaly.type && anomaly.description.includes(p.name)
      );

      if (pattern?.lastTriggered) {
        const cooldownMs = pattern.cooldownMinutes * 60 * 1000;
        if (Date.now() - pattern.lastTriggered.getTime() < cooldownMs) {
          return null;
        }
      }

      // Check for duplicate recent anomaly
      const existing = await AnomalyModel.findOne({
        entityId: anomaly.entityId,
        type: anomaly.type,
        status: { $in: ['pending', 'investigating'] },
        detectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (existing) {
        return null;
      }

      const doc = await AnomalyModel.create({
        type: anomaly.type,
        severity: anomaly.severity,
        entityType: anomaly.entityType,
        entityId: anomaly.entityId,
        description: anomaly.description,
        evidence: anomaly.evidence,
        confidence: anomaly.confidence,
        detectedAt: anomaly.detectedAt,
        status: anomaly.status,
        metadata: anomaly.metadata,
      });

      // Update pattern cooldown
      if (pattern) {
        pattern.lastTriggered = new Date();
      }

      // Publish event for real-time notifications
      await eventBus.publish(EVENT_TYPES.ANOMALY_DETECTED || 'anomaly.detected', {
        anomalyId: doc._id.toString(),
        type: anomaly.type,
        severity: anomaly.severity,
        entityId: anomaly.entityId,
        confidence: anomaly.confidence,
      });

      logger.info('AnomalyDetection: Anomaly created', {
        anomalyId: doc._id,
        type: anomaly.type,
        severity: anomaly.severity,
        entityId: anomaly.entityId,
      });

      return {
        id: doc._id.toString(),
        ...doc.toObject(),
      } as Anomaly;
    } catch (error) {
      logger.error('AnomalyDetection: Failed to create anomaly', {
        anomaly,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get anomalies with filters
   */
  async getAnomalies(filters: AnomalyFilters): Promise<{
    data: Anomaly[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;
    if (filters.status) query.status = filters.status;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;

    if (filters.startDate || filters.endDate) {
      query.detectedAt = {};
      if (filters.startDate) query.detectedAt.$gte = filters.startDate;
      if (filters.endDate) query.detectedAt.$lte = filters.endDate;
    }

    const [anomalies, total] = await Promise.all([
      AnomalyModel.find(query)
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit),
      AnomalyModel.countDocuments(query),
    ]);

    return {
      data: anomalies.map(doc => ({
        id: doc._id.toString(),
        type: doc.type,
        severity: doc.severity,
        entityType: doc.entityType,
        entityId: doc.entityId,
        description: doc.description,
        evidence: doc.evidence,
        confidence: doc.confidence,
        detectedAt: doc.detectedAt,
        status: doc.status,
        resolvedAt: doc.resolvedAt,
        resolvedBy: doc.resolvedBy,
        resolution: doc.resolution,
        metadata: doc.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get anomaly by ID
   */
  async getAnomalyById(anomalyId: string): Promise<Anomaly | null> {
    const doc = await AnomalyModel.findById(anomalyId);
    if (!doc) return null;

    return {
      id: doc._id.toString(),
      type: doc.type,
      severity: doc.severity,
      entityType: doc.entityType,
      entityId: doc.entityId,
      description: doc.description,
      evidence: doc.evidence,
      confidence: doc.confidence,
      detectedAt: doc.detectedAt,
      status: doc.status,
      resolvedAt: doc.resolvedAt,
      resolvedBy: doc.resolvedBy,
      resolution: doc.resolution,
      metadata: doc.metadata,
    };
  }

  /**
   * Update anomaly status
   */
  async updateAnomalyStatus(
    anomalyId: string,
    status: AnomalyStatus,
    adminId: string,
    resolution?: string
  ): Promise<Anomaly | null> {
    const update: Record<string, any> = { status };

    if (status === 'resolved' || status === 'false_positive') {
      update.resolvedAt = new Date();
      update.resolvedBy = adminId;
      if (resolution) update.resolution = resolution;
    }

    const doc = await AnomalyModel.findByIdAndUpdate(
      anomalyId,
      update,
      { new: true }
    );

    if (!doc) return null;

    // Publish status change event
    await eventBus.publish(EVENT_TYPES.ANOMALY_STATUS_CHANGED || 'anomaly.status_changed', {
      anomalyId,
      status,
      resolvedBy: adminId,
    });

    logger.info('AnomalyDetection: Anomaly status updated', {
      anomalyId,
      status,
      adminId,
    });

    return {
      id: doc._id.toString(),
      type: doc.type,
      severity: doc.severity,
      entityType: doc.entityType,
      entityId: doc.entityId,
      description: doc.description,
      evidence: doc.evidence,
      confidence: doc.confidence,
      detectedAt: doc.detectedAt,
      status: doc.status,
      resolvedAt: doc.resolvedAt,
      resolvedBy: doc.resolvedBy,
      resolution: doc.resolution,
      metadata: doc.metadata,
    };
  }

  /**
   * Get anomaly statistics
   */
  async getAnomalyStats(): Promise<AnomalyStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [allAnomalies, recentAnomalies, todayResolved] = await Promise.all([
      AnomalyModel.find({}),
      AnomalyModel.find({ detectedAt: { $gte: sevenDaysAgo } }),
      AnomalyModel.find({
        resolvedAt: { $gte: todayStart },
        status: { $in: ['resolved', 'false_positive'] },
      }),
    ]);

    const stats: AnomalyStats = {
      total: allAnomalies.length,
      byType: { fraud: 0, booking: 0, payment: 0, behavior: 0 },
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byStatus: { pending: 0, investigating: 0, resolved: 0, false_positive: 0 },
      recentCount: recentAnomalies.length,
      criticalCount: recentAnomalies.filter(a => a.severity === 'critical').length,
      resolvedToday: todayResolved.length,
    };

    for (const anomaly of allAnomalies) {
      stats.byType[anomaly.type]++;
      stats.bySeverity[anomaly.severity]++;
      stats.byStatus[anomaly.status]++;
    }

    return stats;
  }

  /**
   * Batch detect anomalies for an entity
   */
  async runFullDetectionForEntity(
    entityId: string,
    entityType: EntityType
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Booking-related detections
    if (entityType === 'user' || entityType === 'booking') {
      const velocityAnomaly = await this.detectBookingVelocityAnomaly(entityId);
      if (velocityAnomaly) anomalies.push(velocityAnomaly);

      const rapidAnomaly = await this.detectRapidBookingSequence(entityId);
      if (rapidAnomaly) anomalies.push(rapidAnomaly);

      const cancellationAnomaly = await this.detectHighCancellationRate(entityId);
      if (cancellationAnomaly) anomalies.push(cancellationAnomaly);
    }

    // Payment-related detections
    const paymentAnomaly = await this.detectPaymentFailureAnomaly(entityId);
    if (paymentAnomaly) anomalies.push(paymentAnomaly);

    // Behavioral detection
    if (entityType === 'user') {
      const behavioralAnomalies = await this.detectBehavioralAnomalies(entityId);
      anomalies.push(...behavioralAnomalies);
    }

    return anomalies;
  }

  /**
   * Auto-resolve old pending anomalies (cleanup job)
   */
  async autoResolveOldAnomalies(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await AnomalyModel.updateMany(
      {
        status: 'pending',
        detectedAt: { $lt: cutoffDate },
        severity: 'low',
      },
      {
        $set: {
          status: 'false_positive',
          resolvedAt: new Date(),
          resolution: 'Auto-resolved: No activity after 30 days',
        },
      }
    );

    logger.info('AnomalyDetection: Auto-resolved old anomalies', {
      count: result.modifiedCount,
      cutoffDays: daysOld,
    });

    return result.modifiedCount;
  }
}

// ============================================
// Service Instance
// ============================================

export const anomalyDetectionService = new AnomalyDetectionService();
export default anomalyDetectionService;
