import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { validateProviderRole } from '../middleware/validation.middleware';
import rateLimit from 'express-rate-limit';
import providerInsightsController from '../controllers/providerInsights.controller';
import providerPLController from '../controllers/providerPL.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Rate limiting for insights endpoints
const insightsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: { error: 'Too many insights requests, please try again later' }
});

// Provider role validation for all insights routes
router.use(validateProviderRole);

// Apply rate limiting
router.use(insightsRateLimit);

// ============================================
// PROVIDER INSIGHTS ROUTES
// ============================================

// FIX #4: P&L endpoint
router.get('/profit-loss', providerPLController.getProfitLoss);

// Get comprehensive provider insights
router.get('/insights', providerInsightsController.getInsights);

// Get performance metrics
router.get('/insights/performance', providerInsightsController.getPerformance);

// Get revenue metrics
router.get('/insights/revenue', providerInsightsController.getRevenue);

// Get customer satisfaction metrics
router.get('/insights/satisfaction', providerInsightsController.getSatisfaction);

// Get booking trends
router.get('/insights/trends', providerInsightsController.getTrends);

// Generate insights (AI-powered)
router.get('/insights/generate', providerInsightsController.generateInsights);

// Get revenue optimization tips
router.get('/insights/optimization-tips', providerInsightsController.getOptimizationTips);

// ============================================
// SCHEDULE OPTIMIZATION ROUTES
// ============================================

// Get optimal schedule recommendations
router.get('/schedule/optimal', providerInsightsController.getScheduleOptimal);

// Analyze booking patterns
router.get('/schedule/patterns', providerInsightsController.getSchedulePatterns);

// Get availability gaps
router.get('/schedule/gaps', providerInsightsController.getScheduleGaps);

// Get peak demand analysis
router.get('/schedule/peak-demand', providerInsightsController.getSchedulePeakDemand);

// Detect schedule conflicts
router.get('/schedule/conflicts', providerInsightsController.getScheduleConflicts);

// Get schedule efficiency score
router.get('/schedule/efficiency', providerInsightsController.getScheduleEfficiency);

// ============================================
// CANCELLATION PREDICTION ROUTES
// ============================================

// Get customer cancellation profile
router.get('/cancellations/customer/:customerId', providerInsightsController.getCancellationProfile);

// Predict booking cancellation
router.get('/cancellations/predict/:bookingId', providerInsightsController.predictCancellation);

// Get provider cancellation statistics
router.get('/cancellations/stats', providerInsightsController.getCancellationStats);

// Predict upcoming cancellations
router.get('/cancellations/upcoming', providerInsightsController.getUpcomingCancellations);

// Predict no-shows
router.get('/cancellations/no-shows', providerInsightsController.getNoShows);

// Get cancellation prevention recommendations
router.get('/cancellations/prevention', providerInsightsController.getPreventionRecommendations);

// ============================================
// CACHE MANAGEMENT
// ============================================

// Clear insights cache
router.post('/insights/cache/clear', providerInsightsController.clearCache);

export default router;
