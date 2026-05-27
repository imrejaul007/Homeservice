import Booking from '../../models/booking.model';
import User from '../../models/user.model';
import Wallet from '../../models/wallet.model';
import logger from '../../utils/logger';

export interface FraudRisk {
  score: number; // 0-1
  signals: FraudSignal[];
  action: 'allow' | 'review' | 'block';
  reason: string;
}

export interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value?: any;
}

class FraudDetectionService {
  private readonly HIGH_RISK_THRESHOLD = 0.7;
  private readonly MEDIUM_RISK_THRESHOLD = 0.4;

  /**
   * Analyze a booking for fraud risk
   */
  async analyzeBooking(bookingId: string): Promise<FraudRisk> {
    const signals: FraudSignal[] = [];

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'email phone providerProfile createdAt')
        .populate('providerId', 'email providerProfile');

      if (!booking) {
        return { score: 0, signals: [], action: 'allow', reason: 'Booking not found' };
      }

      const customer = booking.customerId as any;

      // Check for velocity (too many bookings in short time)
      const velocitySignals = await this.checkVelocity(customer._id.toString());
      signals.push(...velocitySignals);

      // Check for self-booking
      if (await this.isSelfBooking(customer._id.toString(), (booking.providerId as any)?._id?.toString())) {
        signals.push({
          type: 'SELF_BOOKING',
          severity: 'high',
          description: 'Customer booked own service',
        });
      }

      // Check for rapid cancellation pattern
      const cancellationSignals = await this.checkCancellationPattern(customer._id.toString());
      signals.push(...cancellationSignals);

      // Check for new account suspicious activity
      const newAccountSignals = await this.checkNewAccount(customer.createdAt);
      signals.push(...newAccountSignals);

      // Calculate score
      const score = this.calculateScore(signals);
      const action = this.determineAction(score);

      logger.info('Fraud analysis complete', { bookingId, score, action });

      return {
        score,
        signals,
        action,
        reason: this.generateReason(signals),
      };
    } catch (error) {
      logger.error('Fraud analysis error', { error, bookingId });
      return { score: 0.5, signals: [], action: 'review', reason: 'Analysis failed' };
    }
  }

  /**
   * Analyze wallet activity for fraud
   */
  async analyzeWalletActivity(userId: string): Promise<FraudRisk> {
    const signals: FraudSignal[] = [];

    try {
      // Check for unusual wallet balance changes
      const balanceSignals = await this.checkWalletAnomalies(userId);
      signals.push(...balanceSignals);

      // Check for rapid top-ups
      const topUpSignals = await this.checkRapidTopUps(userId);
      signals.push(...topUpSignals);

      // Check for unusual payout patterns
      const payoutSignals = await this.checkPayoutPatterns(userId);
      signals.push(...payoutSignals);

      const score = this.calculateScore(signals);
      const action = this.determineAction(score);

      return { score, signals, action, reason: this.generateReason(signals) };
    } catch (error) {
      logger.error('Wallet fraud analysis error', { error, userId });
      return { score: 0.5, signals: [], action: 'review', reason: 'Analysis failed' };
    }
  }

  private async checkVelocity(userId: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Check bookings in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentBookings = await Booking.countDocuments({
      customerId: userId,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentBookings > 3) {
      signals.push({
        type: 'HIGH_VELOCITY',
        severity: 'medium',
        description: `${recentBookings} bookings in 1 hour`,
        value: recentBookings,
      });
    }

    // Check bookings in last day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayBookings = await Booking.countDocuments({
      customerId: userId,
      createdAt: { $gte: oneDayAgo },
    });

    if (todayBookings > 10) {
      signals.push({
        type: 'VERY_HIGH_VELOCITY',
        severity: 'high',
        description: `${todayBookings} bookings in 24 hours`,
        value: todayBookings,
      });
    }

    return signals;
  }

  private async isSelfBooking(customerId: string, providerId: string): Promise<boolean> {
    if (!providerId) return false;
    return customerId === providerId;
  }

  private async checkCancellationPattern(userId: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Check recent cancellation rate
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentBookings = await Booking.find({
      customerId: userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    if (recentBookings.length > 5) {
      const cancelled = recentBookings.filter(b => b.status === 'cancelled').length;
      const cancelRate = cancelled / recentBookings.length;

      if (cancelRate > 0.5) {
        signals.push({
          type: 'HIGH_CANCEL_RATE',
          severity: 'medium',
          description: `${Math.round(cancelRate * 100)}% cancellation rate`,
          value: cancelRate,
        });
      }
    }

    return signals;
  }

  private async checkNewAccount(accountCreatedAt: Date): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];
    const hoursOld = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursOld < 24) {
      signals.push({
        type: 'NEW_ACCOUNT',
        severity: 'low',
        description: 'Account created in last 24 hours',
        value: hoursOld,
      });
    }

    return signals;
  }

  private async checkWalletAnomalies(userId: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return signals;

    // Check for sudden large balance
    if (wallet.balance > 10000) {
      signals.push({
        type: 'HIGH_BALANCE',
        severity: 'low',
        description: 'Unusually high wallet balance',
        value: wallet.balance,
      });
    }

    return signals;
  }

  private async checkRapidTopUps(userId: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Check for multiple top-ups in short time
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const wallet = await Wallet.findOne({ userId }).lean();
    if (!wallet) return signals;

    const recentTopUps = wallet.transactions.filter(
      tx => tx.referenceType === 'topup' && tx.createdAt >= oneHourAgo
    ).length;

    if (recentTopUps > 3) {
      signals.push({
        type: 'RAPID_TOPUPS',
        severity: 'medium',
        description: `${recentTopUps} top-ups in 1 hour`,
        value: recentTopUps,
      });
    }

    return signals;
  }

  private async checkPayoutPatterns(userId: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Check provider payout patterns
    const user = await User.findById(userId);
    if (user?.role !== 'provider') return signals;

    // Look for unusual payout requests
    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
      const recentPayouts = wallet.transactions.filter(
        t => t.referenceType === 'payout' &&
        t.createdAt &&
        t.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

      if (recentPayouts.length > 5) {
        signals.push({
          type: 'RAPID_PAYOUTS',
          severity: 'medium',
          description: `${recentPayouts.length} payout requests in 24 hours`,
          value: recentPayouts.length,
        });
      }
    }

    return signals;
  }

  private calculateScore(signals: FraudSignal[]): number {
    if (signals.length === 0) return 0;

    let score = 0;
    for (const signal of signals) {
      switch (signal.severity) {
        case 'high':
          score += 0.4;
          break;
        case 'medium':
          score += 0.2;
          break;
        case 'low':
          score += 0.1;
          break;
      }
    }

    return Math.min(score, 1);
  }

  private determineAction(score: number): 'allow' | 'review' | 'block' {
    if (score >= this.HIGH_RISK_THRESHOLD) return 'block';
    if (score >= this.MEDIUM_RISK_THRESHOLD) return 'review';
    return 'allow';
  }

  private generateReason(signals: FraudSignal[]): string {
    if (signals.length === 0) return 'No risk factors detected';

    const highSeverity = signals.filter(s => s.severity === 'high');
    if (highSeverity.length > 0) {
      return highSeverity[0].description;
    }

    return signals[0]?.description || 'Risk factors detected';
  }
}

export const fraudDetectionService = new FraudDetectionService();
