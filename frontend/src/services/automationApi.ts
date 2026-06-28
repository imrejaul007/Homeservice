import { api } from './api';
import { AxiosError } from 'axios';

export class FeatureUnavailableError extends Error {
  constructor(message = 'This feature is not available yet.') {
    super(message);
    this.name = 'FeatureUnavailableError';
  }
}

function unwrapAutomationResponse<T>(response: { data?: { success?: boolean; data?: T; message?: string } }): T {
  if (response.data?.success && response.data.data !== undefined) {
    return response.data.data;
  }
  throw new Error(response.data?.message || 'Unexpected automation API response');
}

async function callAutomationApi<T>(request: () => Promise<{ data?: { success?: boolean; data?: T; message?: string } }>): Promise<T> {
  try {
    const response = await request();
    return unwrapAutomationResponse(response);
  } catch (error) {
    const axiosError = error as AxiosError<{ code?: string; message?: string }>;
    const status = axiosError.response?.status;
    const code = axiosError.response?.data?.code;
    if (status === 503 || status === 501 || code === 'FEATURE_NOT_AVAILABLE') {
      throw new FeatureUnavailableError(
        axiosError.response?.data?.message || 'Automation feature is not available yet.'
      );
    }
    throw error;
  }
}

// ============================================
// Automation Types
// ============================================

export interface OnboardingTask {
  id: string;
  key: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  category: 'profile' | 'verification' | 'services' | 'payments' | 'preferences' | 'marketing';
  order: number;
  estimatedTime?: number;
  isRequired: boolean;
  completedAt?: string;
  completedData?: Record<string, unknown>;
}

export interface OnboardingStatus {
  isCompleted: boolean;
  completionPercent: number;
  completedTasks: number;
  totalTasks: number;
  estimatedTimeRemaining: number;
  startedAt: string;
  completedAt?: string;
  tasks: OnboardingTask[];
  currentTask?: OnboardingTask;
  recommendations: Array<{
    taskId: string;
    priority: 'low' | 'medium' | 'high';
    reason: string;
  }>;
}

export interface AutomationStatus {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  reminderEmails: boolean;
  reviewRequests: boolean;
  promotionalOffers: boolean;
  newsletter: boolean;
  lastEmailAt?: string;
  lastSmsAt?: string;
  lastPushAt?: string;
}

export interface AutomationPreferences {
  email: {
    marketing: boolean;
    transactional: boolean;
    reminders: boolean;
    newsletters: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'none';
  };
  sms: {
    marketing: boolean;
    transactional: boolean;
    reminders: boolean;
    optIn: boolean;
  };
  push: {
    enabled: boolean;
    promotions: boolean;
    reminders: boolean;
    updates: boolean;
  };
  privacy: {
    dataProcessing: boolean;
    analytics: boolean;
    personalization: boolean;
  };
}

export interface TriggerResult {
  success: boolean;
  triggered: boolean;
  message: string;
  actionId?: string;
  scheduledFor?: string;
}

export interface AutomationLog {
  id: string;
  automationType: string;
  trigger: string;
  recipient: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WelcomeEmailData {
  customerName: string;
  referralCode?: string;
  firstServiceDiscount?: number;
}

export interface WinbackData {
  customerId: string;
  customerName: string;
  lastBookingDate: string;
  daysSinceLastBooking: number;
  totalBookings: number;
  lifetimeValue: number;
  recommendedOffer?: {
    type: 'discount' | 'free_service' | 'loyalty_points' | 'credit';
    value: number;
    code?: string;
  };
}

// ============================================
// Automation API Service
// ============================================

export interface AutomationApi {
  /**
   * Get onboarding status
   */
  getOnboardingStatus: () => Promise<OnboardingStatus>;

  /**
   * Get onboarding tasks
   */
  getOnboardingTasks: (category?: OnboardingTask['category']) => Promise<OnboardingTask[]>;

  /**
   * Get a specific onboarding task
   */
  getOnboardingTask: (taskId: string) => Promise<OnboardingTask>;

  /**
   * Complete an onboarding task
   */
  completeOnboardingTask: (
    taskId: string,
    data?: Record<string, unknown>
  ) => Promise<{
    success: boolean;
    task: OnboardingTask;
    nextTask?: OnboardingTask;
  }>;

  /**
   * Skip an onboarding task
   */
  skipOnboardingTask: (taskId: string, reason?: string) => Promise<{
    success: boolean;
    task: OnboardingTask;
    nextTask?: OnboardingTask;
  }>;

  /**
   * Reset onboarding
   */
  resetOnboarding: () => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Get automation status
   */
  getAutomationStatus: () => Promise<AutomationStatus>;

  /**
   * Get automation preferences
   */
  getAutomationPreferences: () => Promise<AutomationPreferences>;

  /**
   * Update automation preferences
   */
  updateAutomationPreferences: (
    preferences: Partial<AutomationPreferences>
  ) => Promise<AutomationPreferences>;

  /**
   * Trigger welcome email
   */
  triggerWelcomeEmail: (data?: WelcomeEmailData) => Promise<TriggerResult>;

  /**
   * Trigger winback campaign
   */
  triggerWinback: (customerId: string, options?: {
    force?: boolean;
    offerType?: WinbackData['recommendedOffer']['type'];
    offerValue?: number;
  }) => Promise<TriggerResult>;

  /**
   * Trigger batch winback
   */
  triggerBatchWinback: (options?: {
    minDaysInactive?: number;
    maxDaysInactive?: number;
    minLifetimeValue?: number;
    limit?: number;
  }) => Promise<{
    success: boolean;
    triggered: number;
    failed: number;
    customers: Array<{
      customerId: string;
      success: boolean;
      error?: string;
    }>;
  }>;

  /**
   * Get automation logs
   */
  getAutomationLogs: (options?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: AutomationLog['status'];
    startDate?: string;
    endDate?: string;
  }) => Promise<{
    logs: AutomationLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get available automation templates
   */
  getAutomationTemplates: () => Promise<Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    variables: string[];
    isActive: boolean;
  }>>;

  /**
   * Trigger custom automation
   */
  triggerCustomAutomation: (
    templateId: string,
    recipientId: string,
    variables?: Record<string, unknown>
  ) => Promise<TriggerResult>;

  /**
   * Test automation
   */
  testAutomation: (
    templateId: string,
    testRecipientId?: string
  ) => Promise<{
    success: boolean;
    preview?: {
      subject: string;
      body: string;
    };
    error?: string;
  }>;

  /**
   * Get automation statistics
   */
  getAutomationStats: (options?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }) => Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    byType: Array<{
      type: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    }>;
    byDay: Array<{
      date: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    }>;
  }>;

  /**
   * Subscribe to newsletter
   */
  subscribeNewsletter: (email: string) => Promise<{
    success: boolean;
    subscribed: boolean;
    message: string;
  }>;

  /**
   * Unsubscribe from newsletter
   */
  unsubscribeNewsletter: (email: string, reason?: string) => Promise<{
    success: boolean;
    unsubscribed: boolean;
    message: string;
  }>;
}

export const automationApi: AutomationApi = {
  getOnboardingStatus: () => callAutomationApi(() => api.get('/automation/onboarding')),

  getOnboardingTasks: (category?: OnboardingTask['category']) =>
    callAutomationApi(() => api.get('/automation/onboarding/tasks', { params: { category } })),

  getOnboardingTask: (taskId: string) =>
    callAutomationApi(() => api.get(`/automation/onboarding/tasks/${taskId}`)),

  completeOnboardingTask: (taskId: string, data?: Record<string, unknown>) =>
    callAutomationApi(() => api.post(`/automation/onboarding/tasks/${taskId}/complete`, data)),

  skipOnboardingTask: (taskId: string, reason?: string) =>
    callAutomationApi(() => api.post(`/automation/onboarding/tasks/${taskId}/skip`, { reason })),

  resetOnboarding: () => callAutomationApi(() => api.post('/automation/onboarding/reset')),

  getAutomationStatus: () => callAutomationApi(() => api.get('/automation/status')),

  getAutomationPreferences: () => callAutomationApi(() => api.get('/automation/preferences')),

  updateAutomationPreferences: (preferences: Partial<AutomationPreferences>) =>
    callAutomationApi(() => api.patch('/automation/preferences', preferences)),

  triggerWelcomeEmail: (data?: WelcomeEmailData) =>
    callAutomationApi(() => api.post('/automation/trigger/welcome', data || {})),

  triggerWinback: (customerId: string, options = {}) =>
    callAutomationApi(() => api.post(`/automation/trigger/winback/${customerId}`, options)),

  triggerBatchWinback: (options = {}) =>
    callAutomationApi(() => api.post('/automation/trigger/batch-winback', options)),

  getAutomationLogs: (options = {}) =>
    callAutomationApi(() => api.get('/automation/logs', { params: options })),

  getAutomationTemplates: () => callAutomationApi(() => api.get('/automation/templates')),

  triggerCustomAutomation: (
    templateId: string,
    recipientId: string,
    variables?: Record<string, unknown>
  ) =>
    callAutomationApi(() =>
      api.post(`/automation/trigger/${templateId}`, { recipientId, variables })
    ),

  testAutomation: (templateId: string, testRecipientId?: string) =>
    callAutomationApi(() =>
      api.post(`/automation/templates/${templateId}/test`, { testRecipientId })
    ),

  getAutomationStats: (options = {}) =>
    callAutomationApi(() => api.get('/automation/stats', { params: options })),

  subscribeNewsletter: (email: string) =>
    callAutomationApi(() => api.post('/automation/newsletter/subscribe', { email })),

  unsubscribeNewsletter: (email: string, reason?: string) =>
    callAutomationApi(() => api.post('/automation/newsletter/unsubscribe', { email, reason })),
};

export default automationApi;
