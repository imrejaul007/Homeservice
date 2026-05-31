import { api } from './api';

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
  /**
   * Get onboarding status and progress
   */
  getOnboardingStatus: async () => {
    const response = await api.get('/automation/onboarding');
    return response.data.data;
  },

  /**
   * Get onboarding tasks by category
   * @param category - Optional category filter
   */
  getOnboardingTasks: async (category?: OnboardingTask['category']) => {
    const response = await api.get('/automation/onboarding/tasks', {
      params: { category },
    });
    return response.data.data;
  },

  /**
   * Get a specific onboarding task
   * @param taskId - The task ID
   */
  getOnboardingTask: async (taskId: string) => {
    const response = await api.get(`/automation/onboarding/tasks/${taskId}`);
    return response.data.data;
  },

  /**
   * Complete an onboarding task
   * @param taskId - The task ID to complete
   * @param data - Optional completion data
   */
  completeOnboardingTask: async (taskId: string, data?: Record<string, unknown>) => {
    const response = await api.post(
      `/automation/onboarding/tasks/${taskId}/complete`,
      data
    );
    return response.data.data;
  },

  /**
   * Skip an onboarding task
   * @param taskId - The task ID to skip
   * @param reason - Optional skip reason
   */
  skipOnboardingTask: async (taskId: string, reason?: string) => {
    const response = await api.post(
      `/automation/onboarding/tasks/${taskId}/skip`,
      { reason }
    );
    return response.data.data;
  },

  /**
   * Reset onboarding to start fresh
   */
  resetOnboarding: async () => {
    const response = await api.post('/automation/onboarding/reset');
    return response.data.data;
  },

  /**
   * Get current automation preferences status
   */
  getAutomationStatus: async () => {
    const response = await api.get('/automation/status');
    return response.data.data;
  },

  /**
   * Get detailed automation preferences
   */
  getAutomationPreferences: async () => {
    const response = await api.get('/automation/preferences');
    return response.data.data;
  },

  /**
   * Update automation preferences
   * @param preferences - Preferences to update
   */
  updateAutomationPreferences: async (preferences: Partial<AutomationPreferences>) => {
    const response = await api.patch('/automation/preferences', preferences);
    return response.data.data;
  },

  /**
   * Trigger welcome email for new user
   * @param data - Optional welcome email customization data
   */
  triggerWelcomeEmail: async (data?: WelcomeEmailData) => {
    const response = await api.post('/automation/trigger/welcome', data || {});
    return response.data.data;
  },

  /**
   * Trigger winback campaign for inactive customer
   * @param customerId - Customer ID to trigger winback for
   * @param options - Optional trigger options
   */
  triggerWinback: async (customerId: string, options = {}) => {
    const response = await api.post(
      `/automation/trigger/winback/${customerId}`,
      options
    );
    return response.data.data;
  },

  /**
   * Trigger batch winback for multiple customers
   * @param options - Filter options for batch selection
   */
  triggerBatchWinback: async (options = {}) => {
    const response = await api.post('/automation/trigger/batch-winback', options);
    return response.data.data;
  },

  /**
   * Get automation logs with filtering
   * @param options - Filter and pagination options
   */
  getAutomationLogs: async (options = {}) => {
    const response = await api.get('/automation/logs', { params: options });
    return response.data.data;
  },

  /**
   * Get available automation templates
   */
  getAutomationTemplates: async () => {
    const response = await api.get('/automation/templates');
    return response.data.data;
  },

  /**
   * Trigger a custom automation template
   * @param templateId - Template ID to trigger
   * @param recipientId - Recipient ID
   * @param variables - Optional variable overrides
   */
  triggerCustomAutomation: async (
    templateId: string,
    recipientId: string,
    variables?: Record<string, unknown>
  ) => {
    const response = await api.post(
      `/automation/trigger/${templateId}`,
      { recipientId, variables }
    );
    return response.data.data;
  },

  /**
   * Test an automation template
   * @param templateId - Template ID to test
   * @param testRecipientId - Optional test recipient override
   */
  testAutomation: async (templateId: string, testRecipientId?: string) => {
    const response = await api.post(`/automation/templates/${templateId}/test`, {
      testRecipientId,
    });
    return response.data.data;
  },

  /**
   * Get automation statistics
   * @param options - Optional date range and filter
   */
  getAutomationStats: async (options = {}) => {
    const response = await api.get('/automation/stats', { params: options });
    return response.data.data;
  },

  /**
   * Subscribe to newsletter
   * @param email - Email address to subscribe
   */
  subscribeNewsletter: async (email: string) => {
    const response = await api.post('/automation/newsletter/subscribe', { email });
    return response.data.data;
  },

  /**
   * Unsubscribe from newsletter
   * @param email - Email address to unsubscribe
   * @param reason - Optional unsubscription reason
   */
  unsubscribeNewsletter: async (email: string, reason?: string) => {
    const response = await api.post('/automation/newsletter/unsubscribe', {
      email,
      reason,
    });
    return response.data.data;
  },
};

export default automationApi;
