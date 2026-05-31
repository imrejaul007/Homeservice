/**
 * Behavioral Analysis Service
 * ML-based behavioral analysis for fraud detection
 */

import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

export interface BehavioralMetrics {
  typingSpeed: number; // characters per minute
  mouseMovementsPerMinute: number;
  averageSessionDuration: number; // minutes
  pageViewsPerSession: number;
  navigationPattern: string[]; // sequence of pages visited
  timeOfDayPreferences: string[]; // preferred hours
  dayPreferences: string[]; // preferred days
  deviceSwitches: number;
  locationChanges: number;
  failedLoginAttempts: number;
  passwordChangeFrequency: number;
  lastUpdated: Date;
}

export interface SessionBehavior {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  events: BehavioralEvent[];
  metrics: {
    totalEvents: number;
    mouseMovements: number;
    keystrokes: number;
    idleTime: number; // seconds of no activity
    activeTime: number;
  };
  riskScore: number;
}

export interface BehavioralEvent {
  type: 'keystroke' | 'mouse_move' | 'click' | 'scroll' | 'page_view' | 'focus' | 'blur';
  timestamp: Date;
  data?: Record<string, unknown>;
  duration?: number; // for focus/blur events
}

export interface AnomalyScore {
  overallScore: number; // 0-100
  categoryScores: {
    typingPattern: number;
    navigationPattern: number;
    timingPattern: number;
    transactionPattern: number;
  };
  anomalies: AnomalyDetail[];
  recommendation: 'allow' | 'review' | 'block';
}

export interface AnomalyDetail {
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  deviation: number; // how far from normal (0-1)
  expectedValue?: string;
  actualValue?: string;
}

export interface RiskAssessment {
  userId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  behavioralScore: number; // 0-100 based on behavior patterns
  factors: RiskFactor[];
  confidence: number;
  assessedAt: Date;
}

export interface RiskFactor {
  type: string;
  contribution: number;
  description: string;
  isPositive: boolean;
}

// ============================================
// Constants
// ============================================

const BEHAVIORAL_THRESHOLDS = {
  typingSpeed: {
    min: 100, // characters per minute
    max: 800,
    humanRange: { min: 150, max: 600 },
  },
  sessionDuration: {
    min: 30, // seconds
    max: 3600, // 1 hour
  },
  mouseMovementsPerMinute: {
    min: 5,
    max: 500,
  },
  failedLoginThreshold: 3,
  impossibleTravelSpeed: 1000, // km/h (faster than commercial flight)
};

// ============================================
// BehavioralAnalysisService Class
// ============================================

export class BehavioralAnalysisService {
  // ========================================
  // Behavioral Event Collection
  // ========================================

  private activeSessions: Map<string, SessionBehavior> = new Map();

  /**
   * Start tracking a new session
   */
  startSession(userId: string, sessionId: string): void {
    const session: SessionBehavior = {
      sessionId,
      userId,
      startTime: new Date(),
      events: [],
      metrics: {
        totalEvents: 0,
        mouseMovements: 0,
        keystrokes: 0,
        idleTime: 0,
        activeTime: 0,
      },
      riskScore: 0,
    };

    this.activeSessions.set(`${userId}:${sessionId}`, session);
  }

  /**
   * Record a behavioral event
   */
  recordEvent(
    userId: string,
    sessionId: string,
    event: Omit<BehavioralEvent, 'timestamp'>
  ): void {
    const key = `${userId}:${sessionId}`;
    const session = this.activeSessions.get(key);

    if (!session) {
      logger.warn('Behavioral event recorded for non-existent session', { userId, sessionId });
      return;
    }

    const fullEvent: BehavioralEvent = {
      ...event,
      timestamp: new Date(),
    };

    session.events.push(fullEvent);
    session.metrics.totalEvents++;

    // Update metrics based on event type
    switch (event.type) {
      case 'mouse_move':
        session.metrics.mouseMovements++;
        break;
      case 'keystroke':
        session.metrics.keystrokes++;
        break;
      case 'focus':
      case 'blur':
        if (event.duration) {
          if (event.type === 'blur') {
            session.metrics.idleTime += event.duration;
          } else {
            session.metrics.activeTime += event.duration;
          }
        }
        break;
    }

    // Calculate running risk score
    session.riskScore = this.calculateSessionRiskScore(session);
  }

  /**
   * End a session and store final metrics
   */
  async endSession(userId: string, sessionId: string): Promise<void> {
    const key = `${userId}:${sessionId}`;
    const session = this.activeSessions.get(key);

    if (!session) {
      logger.warn('Attempted to end non-existent session', { userId, sessionId });
      return;
    }

    session.endTime = new Date();

    // Store session in user profile
    await this.storeSessionMetrics(userId, session);

    // Remove from active sessions
    this.activeSessions.delete(key);

    logger.info('Session ended', {
      userId,
      sessionId,
      duration: session.endTime.getTime() - session.startTime.getTime(),
      riskScore: session.riskScore,
    });
  }

  /**
   * Store session metrics to user profile
   */
  private async storeSessionMetrics(userId: string, session: SessionBehavior): Promise<void> {
    const duration = session.endTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const mouseMovementsPerMinute = duration > 0
      ? (session.metrics.mouseMovements / duration) * 60000
      : 0;

    await User.updateOne(
      { _id: userId },
      {
        $push: {
          behavioralMetrics: {
            $each: [{
              sessionId: session.sessionId,
              date: new Date(),
              duration: duration / 1000, // Convert to seconds
              mouseMovementsPerMinute,
              keystrokes: session.metrics.keystrokes,
              idleTime: session.metrics.idleTime,
              activeTime: session.metrics.activeTime,
              riskScore: session.riskScore,
            }],
            $slice: -50, // Keep last 50 sessions
          },
        },
      }
    );
  }

  // ========================================
  // Anomaly Detection
  // ========================================

  /**
   * Calculate risk score for a session
   */
  private calculateSessionRiskScore(session: SessionBehavior): number {
    let score = 0;

    // Check typing speed (if available)
    const keystrokeData = session.events.filter((e) => e.type === 'keystroke');
    if (keystrokeData.length > 10) {
      const typingAnomaly = this.checkTypingAnomaly(session);
      score += typingAnomaly * 30;
    }

    // Check mouse movement patterns
    const mouseAnomaly = this.checkMouseAnomaly(session);
    score += mouseAnomaly * 20;

    // Check for impossible travel (if location data available)
    const travelAnomaly = this.checkImpossibleTravel(session);
    score += travelAnomaly * 40;

    // Check session duration anomaly
    const durationAnomaly = this.checkSessionDurationAnomaly(session);
    score += durationAnomaly * 10;

    return Math.min(100, score);
  }

  /**
   * Check for typing pattern anomalies (bots type too fast)
   */
  private checkTypingAnomaly(session: SessionBehavior): number {
    const keystrokeData = session.events.filter((e) => e.type === 'keystroke');
    if (keystrokeData.length < 5) return 0;

    // Check time between keystrokes
    const intervals: number[] = [];
    for (let i = 1; i < keystrokeData.length; i++) {
      const diff = keystrokeData[i].timestamp.getTime() - keystrokeData[i - 1].timestamp.getTime();
      intervals.push(diff);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Human typing: minimum 30-50ms between keystrokes
    if (avgInterval < 20) return 1.0; // Very likely bot
    if (avgInterval < 40) return 0.5; // Possibly bot
    if (avgInterval < 60) return 0.2; // Suspicious

    return 0;
  }

  /**
   * Check for mouse movement anomalies
   */
  private checkMouseAnomaly(session: SessionBehavior): number {
    const mouseMoves = session.events.filter((e) => e.type === 'mouse_move');
    if (mouseMoves.length < 10) return 0;

    // Calculate smoothness of movements
    const intervals: number[] = [];
    for (let i = 1; i < mouseMoves.length; i++) {
      const diff = mouseMoves[i].timestamp.getTime() - mouseMoves[i - 1].timestamp.getTime();
      intervals.push(diff);
    }

    // Perfectly uniform intervals suggest automation
    const variance = this.calculateVariance(intervals);
    if (variance < 10) return 0.8; // Very uniform, likely bot
    if (variance < 100) return 0.3; // Somewhat uniform

    return 0;
  }

  /**
   * Check for impossible travel (location changes too fast)
   */
  private checkImpossibleTravel(session: SessionBehavior): number {
    // This would need location data from events
    // For now, return 0 as we don't have location in basic events
    return 0;
  }

  /**
   * Check for session duration anomalies
   */
  private checkSessionDurationAnomaly(session: SessionBehavior): number {
    const duration = session.endTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const durationMinutes = duration / 60000;

    // Suspiciously short sessions
    if (durationMinutes < 0.5) return 0.5; // Less than 30 seconds
    if (durationMinutes < 2) return 0.2; // Less than 2 minutes

    // Suspiciously long sessions
    if (durationMinutes > 480) return 0.3; // More than 8 hours

    return 0;
  }

  /**
   * Calculate variance of an array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // ========================================
  // Risk Assessment
  // ========================================

  /**
   * Perform comprehensive risk assessment for a user
   */
  async assessRisk(userId: string): Promise<RiskAssessment> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const factors: RiskFactor[] = [];
    let totalRiskScore = 0;

    // 1. Check behavioral metrics
    const behavioralScore = await this.calculateBehavioralScore(userId);
    factors.push({
      type: 'behavioral',
      contribution: 30,
      description: `Behavioral analysis score: ${behavioralScore}/100`,
      isPositive: behavioralScore >= 70,
    });
    totalRiskScore += (100 - behavioralScore) * 0.3;

    // 2. Check account age
    const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < 7) {
      factors.push({
        type: 'account_age',
        contribution: 20,
        description: 'Account is less than 7 days old',
        isPositive: false,
      });
      totalRiskScore += 20;
    } else {
      factors.push({
        type: 'account_age',
        contribution: 0,
        description: `Account age: ${Math.floor(accountAgeDays)} days`,
        isPositive: true,
      });
    }

    // 3. Check failed login attempts
    const failedLogins = user.loginAttempts || 0;
    if (failedLogins > BEHAVIORAL_THRESHOLDS.failedLoginThreshold) {
      factors.push({
        type: 'failed_logins',
        contribution: 15,
        description: `${failedLogins} failed login attempts`,
        isPositive: false,
      });
      totalRiskScore += 15;
    } else {
      factors.push({
        type: 'failed_logins',
        contribution: 0,
        description: 'No failed login issues',
        isPositive: true,
      });
    }

    // 4. Check device fingerprint diversity
    const deviceCount = user.deviceFingerprints?.length || 0;
    if (deviceCount > 10) {
      factors.push({
        type: 'device_diversity',
        contribution: 10,
        description: `Unusually high device count: ${deviceCount}`,
        isPositive: false,
      });
      totalRiskScore += 10;
    } else {
      factors.push({
        type: 'device_diversity',
        contribution: 0,
        description: `Normal device count: ${deviceCount}`,
        isPositive: true,
      });
    }

    // 5. Check password change frequency
    const passwordHistory = user.passwordHistory?.length || 0;
    if (passwordHistory > 5) {
      factors.push({
        type: 'password_changes',
        contribution: 10,
        description: 'Frequent password changes',
        isPositive: false,
      });
      totalRiskScore += 10;
    }

    // 6. Check for suspicious devices
    const suspiciousDevices = user.deviceFingerprints?.filter((d: any) => d.isSuspicious).length || 0;
    if (suspiciousDevices > 0) {
      factors.push({
        type: 'suspicious_devices',
        contribution: 15,
        description: `${suspiciousDevices} suspicious device(s) detected`,
        isPositive: false,
      });
      totalRiskScore += 15;
    }

    // Determine overall risk level
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (totalRiskScore >= 70) overallRisk = 'critical';
    else if (totalRiskScore >= 50) overallRisk = 'high';
    else if (totalRiskScore >= 30) overallRisk = 'medium';

    // Calculate confidence (based on data availability)
    const confidence = Math.min(95, 50 + (factors.length * 5));

    return {
      userId,
      overallRisk,
      riskScore: Math.round(totalRiskScore),
      behavioralScore,
      factors,
      confidence,
      assessedAt: new Date(),
    };
  }

  /**
   * Calculate behavioral score from historical data
   */
  private async calculateBehavioralScore(userId: string): Promise<number> {
    const user = await User.findById(userId).select('behavioralMetrics');

    if (!user?.behavioralMetrics || user.behavioralMetrics.length < 3) {
      // Not enough data
      return 50;
    }

    const recentSessions = user.behavioralMetrics.slice(-10);
    const riskScores = recentSessions.map((m: any) => m.riskScore || 0);

    // Calculate average risk score from recent sessions
    const avgRiskScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

    // Convert risk to behavioral score (inverted)
    return Math.round(100 - avgRiskScore);
  }

  // ========================================
  // Anomaly Scoring
  // ========================================

  /**
   * Score a specific action for anomalies
   */
  async scoreAction(
    userId: string,
    action: 'login' | 'booking' | 'payment' | 'review' | 'password_change',
    context: {
      ip?: string;
      deviceFingerprint?: string;
      location?: string;
      timestamp?: Date;
      amount?: number;
    }
  ): Promise<AnomalyScore> {
    const anomalies: AnomalyDetail[] = [];
    const categoryScores = {
      typingPattern: 0,
      navigationPattern: 0,
      timingPattern: 0,
      transactionPattern: 0,
    };

    // 1. Check timing anomalies
    const timingAnomaly = await this.checkTimingAnomaly(userId, action, context.timestamp);
    if (timingAnomaly) {
      anomalies.push(timingAnomaly);
      categoryScores.timingPattern = timingAnomaly.deviation * 100;
    }

    // 2. Check transaction patterns (for payments/bookings)
    if ((action === 'payment' || action === 'booking') && context.amount) {
      const transactionAnomaly = await this.checkTransactionAnomaly(userId, context.amount);
      if (transactionAnomaly) {
        anomalies.push(transactionAnomaly);
        categoryScores.transactionPattern = transactionAnomaly.deviation * 100;
      }
    }

    // 3. Check for new device/IP
    if (context.deviceFingerprint || context.ip) {
      const deviceAnomaly = await this.checkNewDeviceAnomaly(userId, context);
      if (deviceAnomaly) {
        anomalies.push(deviceAnomaly);
        categoryScores.navigationPattern = deviceAnomaly.deviation * 100;
      }
    }

    // Calculate overall score
    const anomalyCount = anomalies.length;
    let overallScore = 0;

    if (anomalyCount === 0) {
      overallScore = 0;
    } else if (anomalyCount === 1) {
      overallScore = 25;
    } else if (anomalyCount === 2) {
      overallScore = 50;
    } else if (anomalyCount >= 3) {
      overallScore = 75;
    }

    // Add severity weights
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high') overallScore += 15;
      else if (anomaly.severity === 'medium') overallScore += 8;
    }

    // Determine recommendation
    let recommendation: 'allow' | 'review' | 'block' = 'allow';
    if (overallScore >= 70) recommendation = 'block';
    else if (overallScore >= 40) recommendation = 'review';

    return {
      overallScore: Math.min(100, overallScore),
      categoryScores,
      anomalies,
      recommendation,
    };
  }

  /**
   * Check for timing anomalies
   */
  private async checkTimingAnomaly(
    userId: string,
    action: string,
    timestamp?: Date
  ): Promise<AnomalyDetail | null> {
    const now = timestamp || new Date();
    const hour = now.getHours();

    // Check if action is at unusual time for this user
    // This is a simplified check - real implementation would use historical data
    if (hour >= 2 && hour <= 5) {
      return {
        category: 'timing',
        severity: 'low',
        description: 'Action performed during unusual hours (2AM-5AM local time)',
        deviation: 0.3,
      };
    }

    return null;
  }

  /**
   * Check for transaction anomalies
   */
  private async checkTransactionAnomaly(
    userId: string,
    amount: number
  ): Promise<AnomalyDetail | null> {
    // Get user's average booking value
    const bookings = await Booking.find({
      customerId: userId,
      status: 'completed',
    })
      .select('pricing.totalAmount')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (bookings.length < 3) {
      return null; // Not enough history
    }

    const amounts = bookings.map((b) => b.pricing?.totalAmount || 0);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const stdDev = Math.sqrt(
      amounts.map((a) => Math.pow(a - avgAmount, 2)).reduce((a, b) => a + b, 0) / amounts.length
    );

    // Check if new amount is significantly higher
    if (amount > maxAmount * 2) {
      return {
        category: 'transaction',
        severity: 'high',
        description: `Transaction amount ${amount} is significantly higher than usual (avg: ${avgAmount.toFixed(2)})`,
        deviation: Math.min(1, (amount - avgAmount) / (avgAmount * 3)),
        expectedValue: avgAmount.toFixed(2),
        actualValue: amount.toString(),
      };
    }

    if (amount > avgAmount + (stdDev * 3)) {
      return {
        category: 'transaction',
        severity: 'medium',
        description: `Transaction amount is above normal range`,
        deviation: 0.5,
        expectedValue: `${(avgAmount - stdDev * 2).toFixed(2)} - ${(avgAmount + stdDev * 2).toFixed(2)}`,
        actualValue: amount.toString(),
      };
    }

    return null;
  }

  /**
   * Check for new device/IP anomalies
   */
  private async checkNewDeviceAnomaly(
    userId: string,
    context: { ip?: string; deviceFingerprint?: string }
  ): Promise<AnomalyDetail | null> {
    const user = await User.findById(userId).select('deviceFingerprints knownIPs');

    if (!user) return null;

    // Check if IP is new
    if (context.ip && user.knownIPs && !user.knownIPs.includes(context.ip)) {
      const previousIPCount = user.knownIPs.length;
      return {
        category: 'navigation',
        severity: previousIPCount > 5 ? 'low' : 'medium',
        description: `Login from new IP address (${context.ip})`,
        deviation: previousIPCount > 5 ? 0.2 : 0.4,
      };
    }

    return null;
  }

  // ========================================
  // Pattern Learning
  // ========================================

  /**
   * Update learned patterns for a user
   */
  async updatePatterns(userId: string, behavior: Partial<BehavioralMetrics>): Promise<void> {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'behavioralProfile.learnedPatterns': behavior,
          'behavioralProfile.lastUpdated': new Date(),
        },
      }
    );
  }

  /**
   * Get learned patterns for a user
   */
  async getPatterns(userId: string): Promise<BehavioralMetrics | null> {
    const user = await User.findById(userId).select('behavioralProfile');

    if (!user?.behavioralProfile?.learnedPatterns) {
      return null;
    }

    return user.behavioralProfile.learnedPatterns as unknown as BehavioralMetrics;
  }
}

// Export singleton instance
export const behavioralAnalysisService = new BehavioralAnalysisService();
export default behavioralAnalysisService;
