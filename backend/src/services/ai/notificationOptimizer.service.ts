// AI Notification Optimizer Service - Smart Notification Timing and Content
import { Types } from 'mongoose';
import Booking from '../../models/booking.model';
import BookingNotification from '../../models/bookingNotification.model';
import User from '../../models/user.model';
import { ApiError, ERROR_CODES } from '../../utils/ApiError';
import logger from '../../utils/logger';
import { circuitBreaker, CIRCUIT_NAMES } from '../../services/circuitBreaker.service';
import { withRetry } from '../../utils/retry.util';

// Types
export interface NotificationOptimization {
  userId: string;
  optimalTimes: OptimalTime[];
  channelPreferences: ChannelPreferences;
  contentSuggestions: ContentSuggestion[];
  suppressRules: SuppressRule[];
  metadata: OptimizationMetadata;
}

export interface OptimizationMetadata {
  modelVersion: string;
  calculatedAt: Date;
}

export interface OptimalTime {
  dayOfWeek: number; // 0-6
  hour: number;
  engagementScore: number; // 0-100
  openRate: number;
  clickRate: number;
  sampleSize: number;
}

export interface ChannelPreferences {
  preferredChannel: 'push' | 'email' | 'sms' | 'whatsapp';
  channelScores: Record<string, number>;
  optOutChannels: string[];
  quietHours: QuietHours;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // HH:MM
  end: string;
  timezone: string;
}

export interface ContentSuggestion {
  type: string;
  template: string;
  personalizationTokens: string[];
  expectedEngagement: number;
  variantScore: number;
}

export interface SuppressRule {
  condition: string;
  reason: string;
  active: boolean;
}

export interface NotificationSchedule {
  userId: string;
  notificationId: string;
  scheduledFor: Date;
  channel: 'push' | 'email' | 'sms' | 'whatsapp';
  content: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

export interface PersonalizedContent {
  title: string;
  body: string;
  actionText?: string;
  imageUrl?: string;
  deeplink?: string;
  variables: Record<string, string>;
}

// Engagement Metrics
interface UserEngagementMetrics {
  totalNotifications: number;
  openedNotifications: number;
  clickedNotifications: number;
  openRate: number;
  clickRate: number;
  byChannel: Record<string, { sent: number; opened: number; clicked: number }>;
  byHour: Record<number, { sent: number; opened: number }>;
  byDayOfWeek: Record<number, { sent: number; opened: number }>;
}

// Constants
const CHANNEL_PREFERENCES = {
  push: { weight: 0.4, baseEngagement: 0.6 },
  email: { weight: 0.3, baseEngagement: 0.25 },
  sms: { weight: 0.2, baseEngagement: 0.15 },
  whatsapp: { weight: 0.35, baseEngagement: 0.75 },
};

// Extract Engagement Metrics
async function extractEngagementMetrics(userId: string): Promise<UserEngagementMetrics> {
  const userObjectId = new Types.ObjectId(userId);

  const notifications = await BookingNotification.find({
    recipientId: userObjectId,
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  }).lean();

  const metrics: UserEngagementMetrics = {
    totalNotifications: notifications.length,
    openedNotifications: notifications.filter(n => (n.channels as any)?.inApp?.read).length,
    clickedNotifications: notifications.filter(n => (n.interactions as any)?.some((i: any) => i.type === 'clicked')).length,
    openRate: 0,
    clickRate: 0,
    byChannel: {},
    byHour: {},
    byDayOfWeek: {},
  };

  if (notifications.length > 0) {
    metrics.openRate = metrics.openedNotifications / notifications.length;
    metrics.clickRate = metrics.clickedNotifications / notifications.length;

    // By channel
    notifications.forEach(n => {
      const channel = (n.channels as any)?.inApp ? 'inApp' : 'push';
      if (!metrics.byChannel[channel]) {
        metrics.byChannel[channel] = { sent: 0, opened: 0, clicked: 0 };
      }
      metrics.byChannel[channel].sent++;
      if ((n.channels as any)?.inApp?.read) metrics.byChannel[channel].opened++;
      if ((n.interactions as any)?.some((i: any) => i.type === 'clicked')) metrics.byChannel[channel].clicked++;
    });

    // By hour
    notifications.forEach(n => {
      const hour = new Date(n.createdAt).getHours();
      if (!metrics.byHour[hour]) {
        metrics.byHour[hour] = { sent: 0, opened: 0 };
      }
      metrics.byHour[hour].sent++;
      if ((n.channels as any)?.inApp?.read) metrics.byHour[hour].opened++;
    });

    // By day of week
    notifications.forEach(n => {
      const dayOfWeek = new Date(n.createdAt).getDay();
      if (!metrics.byDayOfWeek[dayOfWeek]) {
        metrics.byDayOfWeek[dayOfWeek] = { sent: 0, opened: 0 };
      }
      metrics.byDayOfWeek[dayOfWeek].sent++;
      if ((n.channels as any)?.inApp?.read) metrics.byDayOfWeek[dayOfWeek].opened++;
    });
  }

  return metrics;
}

// Calculate Optimal Times
function calculateOptimalTimes(metrics: UserEngagementMetrics): OptimalTime[] {
  const optimalTimes: OptimalTime[] = [];

  // Calculate engagement by hour
  for (let hour = 0; hour < 24; hour++) {
    const hourData = metrics.byHour[hour];
    if (hourData && hourData.sent >= 3) { // Minimum sample size
      const engagementScore = (hourData.opened / hourData.sent) * 100;
      const openRate = hourData.opened / hourData.sent;

      optimalTimes.push({
        dayOfWeek: 0, // Aggregated across days
        hour,
        engagementScore,
        openRate,
        clickRate: 0,
        sampleSize: hourData.sent,
      });
    }
  }

  // Calculate engagement by day of week
  for (let day = 0; day < 7; day++) {
    const dayData = metrics.byDayOfWeek[day];
    if (dayData && dayData.sent >= 3) {
      const engagementScore = (dayData.opened / dayData.sent) * 100;
      const openRate = dayData.opened / dayData.sent;

      // Merge with hourly data for days
      const existingForDay = optimalTimes.filter(t => t.dayOfWeek === day);
      if (existingForDay.length > 0) {
        // Update existing times with day context
        existingForDay.forEach(t => {
          t.dayOfWeek = day;
          t.engagementScore = (t.engagementScore + engagementScore) / 2;
        });
      }
    }
  }

  return optimalTimes.sort((a, b) => b.engagementScore - a.engagementScore);
}

// Determine Channel Preferences
function determineChannelPreferences(
  metrics: UserEngagementMetrics,
  userProfile?: any
): ChannelPreferences {
  const channelScores: Record<string, number> = {};

  // Calculate score for each channel
  Object.entries(CHANNEL_PREFERENCES).forEach(([channel, config]) => {
    const channelData = metrics.byChannel[channel];
    let score = config.baseEngagement * config.weight * 100;

    if (channelData && channelData.sent >= 3) {
      const openRate = channelData.opened / channelData.sent;
      const clickRate = channelData.clicked / channelData.sent;
      score = (openRate * 0.6 + clickRate * 0.4) * 100;
    }

    // User preference override
    if (userProfile?.notificationPreferences?.channel === channel) {
      score *= 1.2;
    }

    channelScores[channel] = score;
  });

  // Find preferred channel
  const preferredChannel = Object.entries(channelScores)
    .sort((a, b) => b[1] - a[1])[0][0] as 'push' | 'email' | 'sms' | 'whatsapp';

  // Check opt-outs
  const optOutChannels: string[] = [];
  if (userProfile?.notificationPreferences?.optOut?.includes('email')) {
    optOutChannels.push('email');
  }
  if (userProfile?.notificationPreferences?.optOut?.includes('sms')) {
    optOutChannels.push('sms');
  }

  return {
    preferredChannel,
    channelScores,
    optOutChannels,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
      timezone: 'Asia/Dubai',
    },
  };
}

// Generate Content Suggestions
function generateContentSuggestions(
  notificationType: string,
  context: Record<string, any>
): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];

  // Templates based on notification type
  const templates: Record<string, { template: string; personalizationTokens: string[] }[]> = {
    booking_reminder: [
      {
        template: "Reminder: Your {{serviceName}} appointment is {{timeUntil}} at {{location}}",
        personalizationTokens: ['serviceName', 'timeUntil', 'location'],
      },
      {
        template: "Don't forget! {{providerName}} is expecting you in {{timeUntil}}",
        personalizationTokens: ['providerName', 'timeUntil'],
      },
    ],
    price_alert: [
      {
        template: "{{discount}}% off {{serviceName}}! Limited time offer.",
        personalizationTokens: ['discount', 'serviceName'],
      },
      {
        template: "Special deal: {{serviceName}} at {{price}} (was {{originalPrice}})",
        personalizationTokens: ['serviceName', 'price', 'originalPrice'],
      },
    ],
    re_engagement: [
      {
        template: "We miss you! {{offer}} on your next booking.",
        personalizationTokens: ['offer'],
      },
      {
        template: "It's been a while, {{firstName}}! Here's {{offer}} to welcome you back.",
        personalizationTokens: ['firstName', 'offer'],
      },
    ],
    review_request: [
      {
        template: "How was your {{serviceName}} with {{providerName}}?",
        personalizationTokens: ['serviceName', 'providerName'],
      },
      {
        template: "Rate your recent service and earn {{points}} loyalty points!",
        personalizationTokens: ['points'],
      },
    ],
  };

  const relevantTemplates = templates[notificationType] || templates.re_engagement;

  relevantTemplates.forEach((t, index) => {
    suggestions.push({
      type: notificationType,
      template: t.template,
      personalizationTokens: t.personalizationTokens,
      expectedEngagement: 0.7 - index * 0.1,
      variantScore: 100 - index * 15,
    });
  });

  return suggestions;
}

// Generate Suppress Rules
function generateSuppressRules(metrics: UserEngagementMetrics): SuppressRule[] {
  const rules: SuppressRule[] = [];

  // High volume suppression
  if (metrics.totalNotifications > 20) {
    rules.push({
      condition: 'more_than_3_notifications_in_24h',
      reason: 'User receives many notifications - risk of fatigue',
      active: true,
    });
  }

  // Low engagement suppression
  if (metrics.openRate < 0.2 && metrics.totalNotifications > 10) {
    rules.push({
      condition: 'user_engagement_below_20_percent',
      reason: 'Low engagement - reduce notification frequency',
      active: true,
    });
  }

  // Churned user suppression
  rules.push({
    condition: 'user_has_not_booked_in_60_days',
    reason: 'User may be churned - require re-activation before sending',
    active: true,
  });

  return rules;
}

// Generate Personalized Content
function generatePersonalizedContent(
  notificationType: string,
  context: {
    userName?: string;
    serviceName?: string;
    providerName?: string;
    bookingDate?: Date;
    price?: number;
    discount?: number;
  }
): PersonalizedContent {
  const content: PersonalizedContent = {
    title: '',
    body: '',
    variables: {},
  };

  switch (notificationType) {
    case 'booking_confirmation':
      content.title = 'Booking Confirmed!';
      content.body = `Your ${context.serviceName} appointment with ${context.providerName} has been confirmed for ${context.bookingDate?.toLocaleDateString()}.`;
      content.actionText = 'View Details';
      break;

    case 'booking_reminder':
      content.title = 'Upcoming Appointment';
      content.body = `Reminder: Your ${context.serviceName} with ${context.providerName} is tomorrow at ${context.bookingDate?.toLocaleTimeString()}.`;
      content.actionText = 'Reschedule if needed';
      break;

    case 'price_alert':
      content.title = 'Special Offer!';
      content.body = `Get ${context.discount}% off ${context.serviceName}! Offer ends soon.`;
      content.actionText = 'Book Now';
      break;

    case 're_engagement':
      content.title = `Welcome back, ${context.userName}!`;
      content.body = `We miss you! Here's an exclusive ${context.discount}% off your next booking.`;
      content.actionText = 'Claim Offer';
      break;

    case 'review_request':
      content.title = 'How was your service?';
      content.body = `Rate your experience with ${context.providerName} and earn loyalty points!`;
      content.actionText = 'Write Review';
      break;

    default:
      content.title = 'NILIN';
      content.body = 'You have a new notification from NILIN.';
  }

  // Fill in variables
  content.variables = {
    userName: context.userName || 'Customer',
    serviceName: context.serviceName || 'your service',
    providerName: context.providerName || 'your provider',
    price: context.price?.toString() || '',
    discount: context.discount?.toString() || '',
  };

  return content;
}

// Main Notification Optimizer Service
export class NotificationOptimizerService {
  private modelVersion = 'v1.0.0';

  async optimizeNotifications(userId: string): Promise<NotificationOptimization> {
    return circuitBreaker.execute(
      CIRCUIT_NAMES.NOTIFICATION,
      async () => {
        return withRetry(
          async () => {
            // Get user profile
            const user = await User.findById(userId).lean();

            // Extract engagement metrics
            const metrics = await extractEngagementMetrics(userId);

            // Calculate optimal times
            const optimalTimes = calculateOptimalTimes(metrics);

            // Determine channel preferences
            const channelPreferences = determineChannelPreferences(metrics, user);

            // Generate content suggestions (for common notification types)
            const contentSuggestions = [
              ...generateContentSuggestions('booking_reminder', {}),
              ...generateContentSuggestions('re_engagement', {}),
              ...generateContentSuggestions('review_request', {}),
            ];

            // Generate suppress rules
            const suppressRules = generateSuppressRules(metrics);

            logger.info('Notification optimization completed', {
              userId,
              optimalTimesCount: optimalTimes.length,
              preferredChannel: channelPreferences.preferredChannel,
            });

            return {
              userId,
              optimalTimes,
              channelPreferences,
              contentSuggestions,
              suppressRules,
              metadata: {
                modelVersion: this.modelVersion,
                calculatedAt: new Date(),
              },
            };
          },
          { maxAttempts: 2, initialDelayMs: 200 }
        ).then(result => {
          if (!result.success) {
            throw result.error || new Error('Notification optimization failed');
          }
          return result.result!;
        });
      },
      async () => {
        // Fallback
        return {
          userId,
          optimalTimes: [
            { dayOfWeek: 0, hour: 10, engagementScore: 60, openRate: 0.6, clickRate: 0.2, sampleSize: 0 },
          ],
          channelPreferences: {
            preferredChannel: 'push',
            channelScores: { push: 60, email: 30, sms: 25, whatsapp: 70 },
            optOutChannels: [],
            quietHours: { enabled: true, start: '22:00', end: '08:00', timezone: 'Asia/Dubai' },
          },
          contentSuggestions: [],
          suppressRules: [],
          metadata: {
            modelVersion: 'fallback',
            calculatedAt: new Date(),
          },
        };
      }
    );
  }

  async scheduleNotification(
    userId: string,
    notificationType: string,
    context: Record<string, any>,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<NotificationSchedule> {
    // Get optimization for user
    const optimization = await this.optimizeNotifications(userId);

    // Check suppress rules
    for (const rule of optimization.suppressRules) {
      if (rule.active && this.evaluateSuppressRule(rule, context)) {
        throw ApiError.badRequest(`Notification suppressed: ${rule.reason}`, [], ERROR_CODES.VALIDATION_ERROR);
      }
    }

    // Find optimal time
    const now = new Date();
    const optimalSlot = this.findOptimalSlot(
      optimization.optimalTimes,
      optimization.channelPreferences.quietHours,
      now
    );

    // Generate content
    const content = generatePersonalizedContent(notificationType, {
      userName: context.userName,
      serviceName: context.serviceName,
      providerName: context.providerName,
      bookingDate: context.bookingDate,
      price: context.price,
      discount: context.discount,
    });

    return {
      userId,
      notificationId: new Types.ObjectId().toString(),
      scheduledFor: optimalSlot.date,
      channel: optimization.channelPreferences.preferredChannel,
      content: content.body,
      priority,
      reason: `Scheduled for ${optimalSlot.hour}:00 based on engagement patterns`,
    };
  }

  private evaluateSuppressRule(rule: SuppressRule, context: Record<string, any>): boolean {
    switch (rule.condition) {
      case 'more_than_3_notifications_in_24h':
        return (context.notificationsLast24h || 0) > 3;
      case 'user_engagement_below_20_percent':
        return (context.engagementScore || 0) < 20;
      case 'user_has_not_booked_in_60_days':
        return (context.daysSinceLastBooking || 0) > 60;
      default:
        return false;
    }
  }

  private findOptimalSlot(
    optimalTimes: OptimalTime[],
    quietHours: QuietHours,
    afterDate: Date
  ): { date: Date; hour: number } {
    // If we have optimal times, use them
    if (optimalTimes.length > 0) {
      const bestTime = optimalTimes[0];

      // Find next occurrence of this time
      let candidate = new Date(afterDate);
      candidate.setHours(bestTime.hour, 0, 0, 0);

      // If it's in the past or in quiet hours, move to next day
      if (candidate <= afterDate || this.isInQuietHours(candidate, quietHours)) {
        candidate.setDate(candidate.getDate() + 1);
      }

      return { date: candidate, hour: bestTime.hour };
    }

    // Default: 10 AM next weekday
    let candidate = new Date(afterDate);
    candidate.setHours(10, 0, 0, 0);

    if (candidate <= afterDate) {
      candidate.setDate(candidate.getDate() + 1);
    }

    return { date: candidate, hour: 10 };
  }

  private isInQuietHours(date: Date, quietHours: QuietHours): boolean {
    if (!quietHours.enabled) return false;

    const [startHour] = quietHours.start.split(':').map(Number);
    const [endHour] = quietHours.end.split(':').map(Number);
    const hour = date.getHours();

    if (startHour > endHour) {
      // Quiet hours span midnight
      return hour >= startHour || hour < endHour;
    }

    return hour >= startHour && hour < endHour;
  }

  async getNextBestTime(userId: string): Promise<{ date: Date; hour: number } | null> {
    const optimization = await this.optimizeNotifications(userId);

    if (optimization.optimalTimes.length === 0) {
      return null;
    }

    const now = new Date();
    const bestTime = optimization.optimalTimes[0];

    let candidate = new Date(now);
    candidate.setHours(bestTime.hour, 0, 0, 0);

    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }

    return { date: candidate, hour: bestTime.hour };
  }
}

export const notificationOptimizerService = new NotificationOptimizerService();
export default notificationOptimizerService;
