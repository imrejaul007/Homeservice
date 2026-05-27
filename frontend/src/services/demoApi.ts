import { api } from './api';

// ============================================
// Types & Interfaces
// ============================================

export interface DemoConfig {
  enabled: boolean;
  maxDemoUsers: number;
  demoUserPrefix: string;
  sandboxMode: boolean;
  demoDataRetentionDays: number;
  allowRealPayments: boolean;
  simulateDelays: boolean;
  delayRangeMs: { min: number; max: number };
}

export interface DemoAccount {
  email: string;
  password: string;
  role: 'customer' | 'provider' | 'admin';
  businessName?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface DemoMetrics {
  totalDemoUsers: number;
  activeDemoSessions: number;
  totalBookingsCreated: number;
  totalRevenueSimulated: number;
  conversionRate: number;
  avgSessionDuration: number;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  steps: DemoStep[];
  estimatedDuration: number;
  targetAudience: 'investor' | 'enterprise' | 'press' | 'partner';
}

export interface DemoStep {
  order: number;
  title: string;
  description: string;
  action?: string;
  highlight?: string;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
}

export interface LaunchReadiness {
  score: number;
  categories: {
    technical: { score: number; items: ReadinessItem[] };
    business: { score: number; items: ReadinessItem[] };
    marketing: { score: number; items: ReadinessItem[] };
    operations: { score: number; items: ReadinessItem[] };
  };
  blockers: string[];
  recommendations: string[];
  estimatedLaunchDate?: string;
}

export interface ReadinessItem {
  id: string;
  name: string;
  status: 'complete' | 'in_progress' | 'pending' | 'blocked';
  description?: string;
  assignee?: string;
  dueDate?: string;
}

export interface UserOnboardingFunnel {
  date: string;
  visitors: number;
  signups: number;
  bookings: number;
  conversions: number;
}

export interface ConversionData {
  metric: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

// ============================================
// Demo API
// ============================================

export const demoApi = {
  // ========================================
  // Configuration
  // ========================================

  /**
   * Get demo configuration
   */
  getConfig: async (): Promise<DemoConfig> => {
    const response = await api.get('/demo/config');
    return response.data.data;
  },

  /**
   * Update demo configuration (admin only)
   */
  updateConfig: async (updates: Partial<DemoConfig>): Promise<DemoConfig> => {
    const response = await api.patch('/demo/config', updates);
    return response.data.data;
  },

  // ========================================
  // Demo Account Generation
  // ========================================

  /**
   * Generate a demo account
   */
  generateAccount: async (role: 'customer' | 'provider' | 'admin'): Promise<DemoAccount> => {
    const response = await api.post('/demo/account/generate', { role });
    return response.data.data;
  },

  /**
   * Create demo data for existing account
   */
  createDemoData: async (role: string): Promise<{ bookings?: any[]; services?: any[] }> => {
    const response = await api.post('/demo/data/create', { role });
    return response.data.data;
  },

  /**
   * Clean up a demo session
   */
  cleanupSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/demo/session/${sessionId}`);
  },

  // ========================================
  // Metrics
  // ========================================

  /**
   * Get demo metrics
   */
  getMetrics: async (): Promise<DemoMetrics> => {
    const response = await api.get('/demo/metrics');
    return response.data.data;
  },

  /**
   * Get demo scenarios
   */
  getScenarios: async (): Promise<DemoScenario[]> => {
    const response = await api.get('/demo/scenarios');
    return response.data.data;
  },

  // ========================================
  // Launch Readiness
  // ========================================

  /**
   * Get launch readiness assessment
   */
  getLaunchReadiness: async (): Promise<LaunchReadiness> => {
    const response = await api.get('/demo/launch-readiness');
    return response.data.data;
  },

  // ========================================
  // Launch Dashboard
  // ========================================

  /**
   * Get user onboarding funnel data
   */
  getOnboardingFunnel: async (
    startDate: string,
    endDate: string
  ): Promise<UserOnboardingFunnel[]> => {
    const response = await api.get('/demo/launch/funnel', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  /**
   * Get conversion tracking data
   */
  getConversionData: async (): Promise<ConversionData[]> => {
    const response = await api.get('/demo/launch/conversions');
    return response.data.data;
  },

  /**
   * Get launch KPIs
   */
  getLaunchKPIs: async (): Promise<Record<string, number | string>> => {
    const response = await api.get('/demo/launch/kpis');
    return response.data.data;
  },

  // ========================================
  // Demo Mode Actions
  // ========================================

  /**
   * Start a demo scenario
   */
  startScenario: async (scenarioId: string): Promise<{ sessionId: string; steps: DemoStep[] }> => {
    const response = await api.post('/demo/scenario/start', { scenarioId });
    return response.data.data;
  },

  /**
   * Complete a demo step
   */
  completeStep: async (sessionId: string, stepOrder: number): Promise<void> => {
    await api.post('/demo/scenario/step', { sessionId, stepOrder });
  },

  /**
   * End demo session
   */
  endSession: async (sessionId: string): Promise<{ summary: any }> => {
    const response = await api.post('/demo/session/end', { sessionId });
    return response.data.data;
  },

  /**
   * Record demo interaction
   */
  recordInteraction: async (
    sessionId: string,
    interaction: { type: string; data: Record<string, any> }
  ): Promise<void> => {
    await api.post('/demo/interaction', { sessionId, interaction });
  },
};

// ============================================
// Export default
// ============================================

export default demoApi;
