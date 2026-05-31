/**
 * Chargeback Prediction Service
 * Predicts and prevents chargebacks based on historical patterns
 */

import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import CustomerMetrics from '../models/customerMetrics.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface ChargebackRiskProfile {
  userId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: ChargebackRiskFactor[];
  historicalChargebacks: ChargebackRecord[];
  recentIndicators: string[];
  recommendations: string[];
  predictedAt: Date;
  expiresAt: Date;
}

export interface ChargebackRiskFactor {
  category: 'payment' | 'behavioral' | 'account' | 'transaction' | 'history' | 'velocity';
  name: string;
  contribution: number;
  description: string;
  isPositive: boolean;
}

export interface ChargebackRecord {
  id: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'won' | 'lost';
  date: Date;
  daysSinceTransaction: number;
}

export interface PredictionResult {
  willChargeback: boolean;
  confidence: number;
  riskScore: number;
  factors: string[];
  recommendedAction: 'allow' | 'review' | 'block';
  alertLevel: 'none' | 'warning' | 'critical';
}

export interface PreventionTrigger {
  type: 'velocity' | 'amount' | 'pattern' | 'history';
  threshold: number;
  current: number;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ChargebackStats {
  totalChargebacks: number;
  totalAmount: number;
  winRate: number;
  averageDaysToDispute: number;
  byReason: Record<string, number>;
}

// ============================================
// Thresholds
// ============================================

const CHARGEBACK_THRESHOLDS = {
  // Risk score thresholds
  riskScores: {
    low: 20,
    medium: 40,
    high: 60,
    critical: 80,
  },

  // Historical chargebacks
  maxHistoricalChargebacks: 1,
  chargebackAmountLimit: 100, // AED

  // Transaction patterns
  transactionVelocity: {
    maxTransactionsPerDay: 5,
    maxAmountPerDay: 500, // AED
    maxAmountPerTransaction: 300, // AED
  },

  // Behavioral indicators
  behavioral: {
    newAccountMaxTransactions: 3,
    firstTransactionAmountLimit: 150, // AED
    avgSessionDuration: 60, // seconds
  },

  // Alert thresholds
  alerts: {
    warningScore: 30,
    criticalScore: 50,
  },
};

// ============================================
// ChargebackPredictionService Class
// ============================================

export class ChargebackPredictionService {
  // ========================================
  // Risk Profile Generation
  // ========================================

  /**
   * Generate chargeback risk profile for a user
   */
  async getRiskProfile(userId: string): Promise<ChargebackRiskProfile> {
    const factors: ChargebackRiskFactor[] = [];
    let totalRiskScore = 0;

    // 1. Check historical chargebacks
    const historicalChargebacks = await this.getHistoricalChargebacks(userId);
    const historicalRisk = this.calculateHistoricalRisk(historicalChargebacks);
    factors.push(...historicalRisk.factors);
    totalRiskScore += historicalRisk.score;

    // 2. Check customer metrics
    const metricsRisk = await this.calculateMetricsRisk(userId);
    factors.push(...metricsRisk.factors);
    totalRiskScore += metricsRisk.score;

    // 3. Check account age
    const accountRisk = await this.calculateAccountRisk(userId);
    factors.push(accountRisk);
    totalRiskScore += accountRisk.contribution;

    // 4. Check behavioral patterns
    const behaviorRisk = await this.calculateBehavioralRisk(userId);
    factors.push(...behaviorRisk.factors);
    totalRiskScore += behaviorRisk.score;

    // 5. Check transaction velocity
    const velocityRisk = await this.calculateVelocityRisk(userId);
    factors.push(...velocityRisk.factors);
    totalRiskScore += velocityRisk.score;

    // Determine overall risk level
    let overallRisk: ChargebackRiskProfile['overallRisk'] = 'low';
    if (totalRiskScore >= CHARGEBACK_THRESHOLDS.riskScores.critical) {
      overallRisk = 'critical';
    } else if (totalRiskScore >= CHARGEBACK_THRESHOLDS.riskScores.high) {
      overallRisk = 'high';
    } else if (totalRiskScore >= CHARGEBACK_THRESHOLDS.riskScores.medium) {
      overallRisk = 'medium';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, overallRisk);

    // Calculate expiry (profiles valid for 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      userId,
      overallRisk,
      riskScore: Math.min(100, totalRiskScore),
      factors,
      historicalChargebacks,
      recentIndicators: factors.filter((f) => !f.isPositive).map((f) => f.description),
      recommendations,
      predictedAt: new Date(),
      expiresAt,
    };
  }

  /**
   * Get historical chargebacks for a user
   */
  private async getHistoricalChargebacks(userId: string): Promise<ChargebackRecord[]> {
    // In production, query payment/chargeback models
    const user = await User.findById(userId).select('chargebackHistory');

    if (!user?.chargebackHistory) {
      return [];
    }

    return user.chargebackHistory.map((cb: any) => ({
      id: cb._id?.toString() || '',
      bookingId: cb.bookingId?.toString() || '',
      amount: cb.amount || 0,
      reason: cb.reason || 'Unknown',
      status: cb.status || 'pending',
      date: cb.date || new Date(),
      daysSinceTransaction: cb.daysSinceTransaction || 0,
    }));
  }

  /**
   * Calculate risk from historical chargebacks
   */
  private calculateHistoricalRisk(chargebacks: ChargebackRecord[]): {
    score: number;
    factors: ChargebackRiskFactor[];
  } {
    const factors: ChargebackRiskFactor[] = [];
    let score = 0;

    if (chargebacks.length === 0) {
      factors.push({
        category: 'history',
        name: 'no_chargebacks',
        contribution: 0,
        description: 'No previous chargebacks',
        isPositive: true,
      });
      return { score, factors };
    }

    // Add risk for each chargeback
    const count = chargebacks.length;
    const amount = chargebacks.reduce((sum, cb) => sum + cb.amount, 0);
    const lostCount = chargebacks.filter((cb) => cb.status === 'lost').length;

    if (count > 0) {
      factors.push({
        category: 'history',
        name: 'previous_chargebacks',
        contribution: Math.min(40, count * 15),
        description: `${count} previous chargeback(s), total ${amount} AED`,
        isPositive: false,
      });
      score += Math.min(40, count * 15);
    }

    if (lostCount > 0) {
      factors.push({
        category: 'history',
        name: 'lost_chargebacks',
        contribution: Math.min(30, lostCount * 15),
        description: `${lostCount} chargeback(s) lost (dispute failed)`,
        isPositive: false,
      });
      score += Math.min(30, lostCount * 15);
    }

    return { score, factors };
  }

  /**
   * Calculate risk from customer metrics
   */
  private async calculateMetricsRisk(userId: string): Promise<{
    score: number;
    factors: ChargebackRiskFactor[];
  }> {
    const factors: ChargebackRiskFactor[] = [];
    let score = 0;

    const metrics = await CustomerMetrics.findOne({ userId });

    if (!metrics) {
      // New user - moderate risk
      factors.push({
        category: 'account',
        name: 'new_account',
        contribution: 10,
        description: 'New account with no transaction history',
        isPositive: false,
      });
      score += 10;
      return { score, factors };
    }

    // Check refund rate
    if (metrics.refundRate > 15) {
      factors.push({
        category: 'behavioral',
        name: 'high_refund_rate',
        contribution: 15,
        description: `High refund rate: ${metrics.refundRate}%`,
        isPositive: false,
      });
      score += 15;
    }

    // Check dispute rate
    if ((metrics as any).disputeRate > 10) {
      factors.push({
        category: 'behavioral',
        name: 'high_dispute_rate',
        contribution: 20,
        description: `High dispute rate: ${(metrics as any).disputeRate}%`,
        isPositive: false,
      });
      score += 20;
    }

    // Check trust score
    if (metrics.trustScore < 50) {
      factors.push({
        category: 'account',
        name: 'low_trust_score',
        contribution: 15,
        description: `Low trust score: ${metrics.trustScore}`,
        isPositive: false,
      });
      score += 15;
    }

    return { score, factors };
  }

  /**
   * Calculate risk from account characteristics
   */
  private async calculateAccountRisk(userId: string): Promise<ChargebackRiskFactor> {
    const user = await User.findById(userId).select('createdAt accountStatus isEmailVerified isPhoneVerified');

    if (!user) {
      return {
        category: 'account',
        name: 'unknown_account',
        contribution: 50,
        description: 'Account not found',
        isPositive: false,
      };
    }

    const accountAge = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24); // days

    // Very new accounts
    if (accountAge < 7) {
      return {
        category: 'account',
        name: 'new_account',
        contribution: 15,
        description: `Account is ${Math.floor(accountAge)} days old`,
        isPositive: false,
      };
    }

    // Unverified accounts
    if (!user.isEmailVerified || !user.isPhoneVerified) {
      return {
        category: 'account',
        name: 'unverified',
        contribution: 10,
        description: 'Account has unverified contact information',
        isPositive: false,
      };
    }

    return {
      category: 'account',
      name: 'established',
      contribution: 0,
      description: `Account is ${Math.floor(accountAge)} days old with verified contact`,
      isPositive: true,
    };
  }

  /**
   * Calculate risk from behavioral patterns
   */
  private async calculateBehavioralRisk(userId: string): Promise<{
    score: number;
    factors: ChargebackRiskFactor[];
  }> {
    const factors: ChargebackRiskFactor[] = [];
    let score = 0;

    // Check for unusual transaction times
    // (simplified - would analyze actual behavior)

    // Check for rapid checkout (cart abandonment pattern)
    const recentBookings = await Booking.find({
      customerId: userId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('createdAt');

    if (recentBookings.length >= 3) {
      // Check time between bookings
      const avgTimeBetween = this.calculateAvgTimeBetweenBookings(recentBookings);
      if (avgTimeBetween < 300000) { // Less than 5 minutes
        factors.push({
          category: 'behavioral',
          name: 'rapid_checkout',
          contribution: 15,
          description: 'Unusually rapid booking pattern detected',
          isPositive: false,
        });
        score += 15;
      }
    }

    return { score, factors };
  }

  /**
   * Calculate velocity-based risk
   */
  private async calculateVelocityRisk(userId: string): Promise<{
    score: number;
    factors: ChargebackRiskFactor[];
  }> {
    const factors: ChargebackRiskFactor[] = [];
    let score = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check transactions today
    const todayBookings = await Booking.find({
      customerId: userId,
      createdAt: { $gte: today },
    });

    if (todayBookings.length > CHARGEBACK_THRESHOLDS.transactionVelocity.maxTransactionsPerDay) {
      factors.push({
        category: 'velocity',
        name: 'high_transaction_velocity',
        contribution: 20,
        description: `${todayBookings.length} transactions today`,
        isPositive: false,
      });
      score += 20;
    }

    // Check amount today
    const totalAmountToday = todayBookings.reduce(
      (sum, b) => sum + (b.pricing?.totalAmount || 0),
      0
    );

    if (totalAmountToday > CHARGEBACK_THRESHOLDS.transactionVelocity.maxAmountPerDay) {
      factors.push({
        category: 'velocity',
        name: 'high_amount_velocity',
        contribution: 25,
        description: `${totalAmountToday} AED spent today`,
        isPositive: false,
      });
      score += 25;
    }

    return { score, factors };
  }

  /**
   * Calculate average time between bookings
   */
  private calculateAvgTimeBetweenBookings(bookings: any[]): number {
    if (bookings.length < 2) return Infinity;

    let totalTime = 0;
    for (let i = 1; i < bookings.length; i++) {
      totalTime += bookings[i - 1].createdAt.getTime() - bookings[i].createdAt.getTime();
    }

    return totalTime / (bookings.length - 1);
  }

  /**
   * Generate recommendations based on risk profile
   */
  private generateRecommendations(factors: ChargebackRiskFactor[], risk: string): string[] {
    const recommendations: string[] = [];

    if (risk === 'critical' || risk === 'high') {
      recommendations.push('Require additional verification for transactions');
      recommendations.push('Consider manual review of high-value bookings');
    }

    // Check for specific risk factors
    const hasChargebackHistory = factors.some((f) => f.name === 'previous_chargebacks');
    if (hasChargebackHistory) {
      recommendations.push('Pre-authorization may be required');
      recommendations.push('Consider requiring upfront payment');
    }

    const hasHighVelocity = factors.some((f) => f.category === 'velocity');
    if (hasHighVelocity) {
      recommendations.push('Implement rate limiting for transactions');
    }

    const hasNewAccount = factors.some((f) => f.name === 'new_account');
    if (hasNewAccount) {
      recommendations.push('First-time transaction limits recommended');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue standard transaction processing');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  // ========================================
  // Prediction
  // ========================================

  /**
   * Predict chargeback likelihood for a transaction
   */
  async predictChargeback(
    userId: string,
    bookingId: string,
    amount: number
  ): Promise<PredictionResult> {
    const riskProfile = await this.getRiskProfile(userId);

    const factors: string[] = [];
    let riskScore = riskProfile.riskScore;

    // Adjust for transaction-specific factors
    if (amount > 200) {
      riskScore += 10;
      factors.push('High transaction amount');
    }

    if (amount > 500) {
      riskScore += 15;
      factors.push('Very high transaction amount');
    }

    // Cap at 100
    riskScore = Math.min(100, riskScore);

    // Determine prediction
    const willChargeback = riskScore >= 50;
    const confidence = riskScore >= 50 ? 75 : 60;

    // Determine recommended action
    let recommendedAction: 'allow' | 'review' | 'block' = 'allow';
    if (riskScore >= 80) recommendedAction = 'block';
    else if (riskScore >= 50) recommendedAction = 'review';

    // Determine alert level
    let alertLevel: 'none' | 'warning' | 'critical' = 'none';
    if (riskScore >= CHARGEBACK_THRESHOLDS.alerts.criticalScore) {
      alertLevel = 'critical';
    } else if (riskScore >= CHARGEBACK_THRESHOLDS.alerts.warningScore) {
      alertLevel = 'warning';
    }

    return {
      willChargeback,
      confidence,
      riskScore,
      factors: [...riskProfile.recentIndicators, ...factors],
      recommendedAction,
      alertLevel,
    };
  }

  // ========================================
  // Prevention Triggers
  // ========================================

  /**
   * Check for prevention triggers
   */
  async checkPreventionTriggers(userId: string): Promise<{
    triggers: PreventionTrigger[];
    shouldBlock: boolean;
    shouldReview: boolean;
  }> {
    const triggers: PreventionTrigger[] = [];

    // Check velocity triggers
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayBookings = await Booking.find({
      customerId: userId,
      createdAt: { $gte: today },
    });

    if (todayBookings.length >= CHARGEBACK_THRESHOLDS.transactionVelocity.maxTransactionsPerDay) {
      triggers.push({
        type: 'velocity',
        threshold: CHARGEBACK_THRESHOLDS.transactionVelocity.maxTransactionsPerDay,
        current: todayBookings.length,
        message: `High transaction velocity: ${todayBookings.length} transactions today`,
        severity: 'high',
      });
    }

    // Check amount triggers
    const totalAmount = todayBookings.reduce(
      (sum, b) => sum + (b.pricing?.totalAmount || 0),
      0
    );

    if (totalAmount >= CHARGEBACK_THRESHOLDS.transactionVelocity.maxAmountPerDay) {
      triggers.push({
        type: 'amount',
        threshold: CHARGEBACK_THRESHOLDS.transactionVelocity.maxAmountPerDay,
        current: totalAmount,
        message: `High daily amount: ${totalAmount} AED`,
        severity: 'medium',
      });
    }

    // Check pattern triggers
    const riskProfile = await this.getRiskProfile(userId);
    if (riskProfile.overallRisk === 'critical' || riskProfile.overallRisk === 'high') {
      triggers.push({
        type: 'pattern',
        threshold: CHARGEBACK_THRESHOLDS.riskScores.high,
        current: riskProfile.riskScore,
        message: `High risk profile: ${riskProfile.overallRisk}`,
        severity: riskProfile.overallRisk === 'critical' ? 'high' : 'medium',
      });
    }

    // Check history triggers
    const historicalChargebacks = riskProfile.historicalChargebacks;
    if (historicalChargebacks.length >= CHARGEBACK_THRESHOLDS.maxHistoricalChargebacks) {
      triggers.push({
        type: 'history',
        threshold: CHARGEBACK_THRESHOLDS.maxHistoricalChargebacks,
        current: historicalChargebacks.length,
        message: `Previous chargebacks: ${historicalChargebacks.length}`,
        severity: 'high',
      });
    }

    const shouldBlock = triggers.some((t) => t.severity === 'high');
    const shouldReview = triggers.length > 0 && !shouldBlock;

    return { triggers, shouldBlock, shouldReview };
  }

  // ========================================
  // Chargeback Recording
  // ========================================

  /**
   * Record a new chargeback
   */
  async recordChargeback(
    userId: string,
    bookingId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    const daysSinceTransaction = await this.getDaysSinceTransaction(bookingId);

    // Update user
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          chargebackHistory: {
            $each: [{
              bookingId: new Types.ObjectId(bookingId),
              amount,
              reason,
              status: 'pending',
              date: new Date(),
              daysSinceTransaction,
            }],
            $slice: -20, // Keep last 20
          },
        },
      }
    );

    // Update metrics
    await CustomerMetrics.updateOne(
      { userId },
      {
        $inc: {
          chargebackCount: 1,
          chargebackAmount: amount,
        },
      }
    );

    // Audit log
    await createAuditLog({
      userId,
      action: 'CHARGEBACK_RECORDED',
      resource: 'chargeback',
      resourceId: bookingId,
      details: { amount, reason, daysSinceTransaction },
      status: 'success',
    });

    logger.warn('Chargeback recorded', {
      userId,
      bookingId,
      amount,
      reason,
    });
  }

  /**
   * Update chargeback status
   */
  async updateChargebackStatus(
    chargebackId: string,
    status: 'pending' | 'won' | 'lost'
  ): Promise<void> {
    await User.updateOne(
      { 'chargebackHistory._id': new Types.ObjectId(chargebackId) },
      {
        $set: {
          'chargebackHistory.$.status': status,
          'chargebackHistory.$.resolvedAt': new Date(),
        },
      }
    );

    logger.info('Chargeback status updated', { chargebackId, status });
  }

  /**
   * Get days since transaction
   */
  private async getDaysSinceTransaction(bookingId: string): Promise<number> {
    const booking = await Booking.findById(bookingId).select('createdAt');

    if (!booking) return 0;

    const diff = Date.now() - booking.createdAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get chargeback statistics
   */
  async getStats(userId: string): Promise<ChargebackStats> {
    const chargebacks = await this.getHistoricalChargebacks(userId);

    const totalChargebacks = chargebacks.length;
    const totalAmount = chargebacks.reduce((sum, cb) => sum + cb.amount, 0);
    const won = chargebacks.filter((cb) => cb.status === 'won').length;
    const winRate = totalChargebacks > 0 ? (won / totalChargebacks) * 100 : 0;

    const avgDaysToDispute = totalChargebacks > 0
      ? chargebacks.reduce((sum, cb) => sum + cb.daysSinceTransaction, 0) / totalChargebacks
      : 0;

    const byReason: Record<string, number> = {};
    for (const cb of chargebacks) {
      byReason[cb.reason] = (byReason[cb.reason] || 0) + 1;
    }

    return {
      totalChargebacks,
      totalAmount,
      winRate,
      averageDaysToDispute: Math.round(avgDaysToDispute),
      byReason,
    };
  }
}

// Export singleton instance
export const chargebackPredictionService = new ChargebackPredictionService();
export default chargebackPredictionService;
