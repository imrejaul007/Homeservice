import { Request, Response } from 'express';
import { demoService } from '../services/demoService';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Demo Configuration
// ============================================

/**
 * Get demo configuration
 * GET /api/demo/config
 */
export const getDemoConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = demoService.getConfig();
  res.json({
    success: true,
    data: config,
  });
});

/**
 * Update demo configuration (admin only)
 * PATCH /api/demo/config
 */
export const updateDemoConfig = asyncHandler(async (req: Request, res: Response) => {
  // In production, add admin role check here
  const config = demoService.updateConfig(req.body);
  res.json({
    success: true,
    data: config,
  });
});

// ============================================
// Demo Account Generation
// ============================================

/**
 * Generate a demo account
 * POST /api/demo/account/generate
 */
export const generateDemoAccount = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body;

  if (!['customer', 'provider', 'admin'].includes(role)) {
    throw new ApiError(400, 'Invalid role. Must be customer, provider, or admin');
  }

  const account = await demoService.generateDemoAccount(role);

  res.status(201).json({
    success: true,
    data: account,
    message: 'Demo account generated successfully. This account will expire in 7 days.',
  });
});

/**
 * Create demo data for existing account
 * POST /api/demo/data/create
 */
export const createDemoData = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body;
  const userId = (req as any).user?.id;

  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await demoService.createDemoData(userId, role);

  res.status(201).json({
    success: true,
    data,
  });
});

/**
 * Clean up a demo session
 * DELETE /api/demo/session/:sessionId
 */
export const cleanupSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  await demoService.cleanupSession(sessionId);

  res.json({
    success: true,
    message: 'Demo session cleaned up successfully',
  });
});

// ============================================
// Metrics
// ============================================

/**
 * Get demo metrics
 * GET /api/demo/metrics
 */
export const getDemoMetrics = asyncHandler(async (req: Request, res: Response) => {
  const metrics = await demoService.getDemoMetrics();

  res.json({
    success: true,
    data: metrics,
  });
});

/**
 * Get demo scenarios
 * GET /api/demo/scenarios
 */
export const getDemoScenarios = asyncHandler(async (req: Request, res: Response) => {
  const scenarios = demoService.getDemoScenarios();

  res.json({
    success: true,
    data: scenarios,
  });
});

// ============================================
// Launch Readiness
// ============================================

/**
 * Get launch readiness assessment
 * GET /api/demo/launch-readiness
 */
export const getLaunchReadiness = asyncHandler(async (req: Request, res: Response) => {
  const readiness = await demoService.getLaunchReadiness();

  res.json({
    success: true,
    data: readiness,
  });
});

/**
 * Get user onboarding funnel data
 * GET /api/demo/launch/funnel
 */
export const getOnboardingFunnel = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Generate mock funnel data for demo
  const funnelData = generateMockFunnelData(
    startDate as string,
    endDate as string
  );

  res.json({
    success: true,
    data: funnelData,
  });
});

/**
 * Get conversion tracking data
 * GET /api/demo/launch/conversions
 */
export const getConversionData = asyncHandler(async (req: Request, res: Response) => {
  const conversionData = [
    { metric: 'Visitor to Signup', value: 12.5, change: 2.3, trend: 'up' as const },
    { metric: 'Signup to Booking', value: 25.8, change: 5.1, trend: 'up' as const },
    { metric: 'Booking Completion', value: 89.2, change: -1.2, trend: 'down' as const },
    { metric: 'Repeat Booking Rate', value: 34.5, change: 8.7, trend: 'up' as const },
    { metric: 'Provider Verification Rate', value: 78.3, change: 12.4, trend: 'up' as const },
  ];

  res.json({
    success: true,
    data: conversionData,
  });
});

/**
 * Get launch KPIs
 * GET /api/demo/launch/kpis
 */
export const getLaunchKPIs = asyncHandler(async (req: Request, res: Response) => {
  const kpis = {
    totalUsers: 312,
    activeProviders: 48,
    totalBookings: 1247,
    monthlyRevenue: 186500,
    conversionRate: 3.2,
    avgBookingValue: 149,
    providerGrowthRate: 15.4,
    customerGrowthRate: 22.8,
    pendingVerifications: 12,
    activeDisputes: 3,
    systemHealth: 99.9,
  };

  res.json({
    success: true,
    data: kpis,
  });
});

// ============================================
// Demo Mode Actions
// ============================================

/**
 * Start a demo scenario
 * POST /api/demo/scenario/start
 */
export const startScenario = asyncHandler(async (req: Request, res: Response) => {
  const { scenarioId } = req.body;

  const scenarios = demoService.getDemoScenarios();
  const scenario = scenarios.find((s) => s.id === scenarioId);

  if (!scenario) {
    throw new ApiError(404, 'Scenario not found');
  }

  res.json({
    success: true,
    data: {
      sessionId: `session_${Date.now()}`,
      steps: scenario.steps,
    },
  });
});

/**
 * Complete a demo step
 * POST /api/demo/scenario/step
 */
export const completeStep = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, stepOrder } = req.body;

  // Log step completion
  logger.info('Demo step completed', {
    context: 'DemoController',
    action: 'DEMO_STEP_COMPLETED',
    sessionId,
    stepOrder,
  });

  res.json({
    success: true,
    message: 'Step completed',
  });
});

/**
 * End demo session
 * POST /api/demo/session/end
 */
export const endSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  // Generate session summary
  const summary = {
    duration: Math.floor(Math.random() * 10) + 5, // 5-15 minutes
    stepsCompleted: Math.floor(Math.random() * 8) + 2,
    pagesVisited: Math.floor(Math.random() * 15) + 5,
    feedbackScore: Math.random() * 2 + 3, // 3-5 rating
  };

  res.json({
    success: true,
    data: { summary },
  });
});

/**
 * Record demo interaction
 * POST /api/demo/interaction
 */
export const recordInteraction = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, interaction } = req.body;

  // Log interaction
  logger.debug('Demo interaction recorded', {
    context: 'DemoController',
    action: 'DEMO_INTERACTION_RECORDED',
    sessionId,
    interactionType: interaction?.type,
    interactionData: interaction,
  });

  res.json({
    success: true,
    message: 'Interaction recorded',
  });
});

// ============================================
// Helper Functions
// ============================================

function generateMockFunnelData(startDate?: string, endDate?: string): Array<{
  date: string;
  visitors: number;
  signups: number;
  bookings: number;
  conversions: number;
}> {
  const data = [];
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  let current = new Date(start);
  while (current <= end) {
    const visitors = Math.floor(Math.random() * 200) + 100;
    const signups = Math.floor(visitors * (0.08 + Math.random() * 0.08));
    const bookings = Math.floor(signups * (0.2 + Math.random() * 0.3));
    const conversions = Math.floor(bookings * (0.15 + Math.random() * 0.15));

    data.push({
      date: current.toISOString().split('T')[0],
      visitors,
      signups,
      bookings,
      conversions,
    });

    current.setDate(current.getDate() + 1);
  }

  return data;
}
