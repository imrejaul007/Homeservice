/**
 * Admin Widget Routes
 *
 * Routes for P1 and P2 admin widget APIs
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getFakeBookingDetection,
  getProviderAbuseMonitor,
  getCustomerAbuseMonitor,
  getProviderRiskScore,
  getRevenueByCity,
  getSuspensionCenter,
  getAppealCenter,
  getBackgroundCheckDashboard,
  getReconciliationEngine,
  getCommissionReports,
  getTaxReports,
  getRefundAnalytics,
  getVerificationQueue,
  // P2 Widgets - Growth & Operations
  getOnboardingFunnel,
  getSupplyDemandRatio,
  getProviderUtilization,
  getCityPerformance,
  getSafeSearchControls,
  // P2 Widgets - Platform Operations
  getIncidents,
  createIncident,
  updateIncident,
  getReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  getChurnPredictions,
  getWinBackDashboard,
  // P2 Widgets - VIP, Forecasting, P&L, UnitEcon, Journey, Funnel
  getVIPSegment,
  getForecasting,
  getProviderPLReport,
  getUnitEconomics,
  getCustomerJourney,
  getFunnelDropOff,
  // P3 Widgets - WeatherImpact, TrainingAcademy, MagicNumber
  getWeatherImpact,
  getTrainingAcademy,
  getMagicNumber
} from '../controllers/adminWidget.controller';

const router = Router();

// All admin widget routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ============================================
// P1 FRAUD DETECTION WIDGETS
// ============================================
router.get('/fake-booking-detection', getFakeBookingDetection);
router.get('/provider-abuse', getProviderAbuseMonitor);
router.get('/customer-abuse', getCustomerAbuseMonitor);
router.get('/providers/risk', getProviderRiskScore);

// Revenue Analytics
router.get('/revenue-by-city', getRevenueByCity);

// Account Management
router.get('/suspensions', getSuspensionCenter);
router.get('/appeals', getAppealCenter);

// Compliance & Verification
router.get('/background-checks', getBackgroundCheckDashboard);
router.get('/verification-queue', getVerificationQueue);

// Financial
router.get('/reconciliation', getReconciliationEngine);
router.get('/commissions/reports', getCommissionReports);
router.get('/tax-reports', getTaxReports);
router.get('/refunds/analytics', getRefundAnalytics);

// ============================================
// P2 GROWTH & OPERATIONS WIDGETS
// ============================================

// Onboarding Funnel - Provider/customer onboarding completion rates
router.get('/onboarding-funnel', getOnboardingFunnel);

// Supply & Demand - Provider availability vs booking demand
router.get('/supply-demand', getSupplyDemandRatio);

// Provider Utilization - Capacity utilization metrics
router.get('/provider-utilization', getProviderUtilization);

// Geographic Performance - Heatmap data by city/area
router.get('/geographic/performance', getCityPerformance);

// Safe Search Controls - Content moderation / blocked terms
router.get('/safe-search', getSafeSearchControls);

// ============================================
// P2 PLATFORM OPERATIONS WIDGETS
// ============================================

// Incident Management - Platform incident tracking
router.get('/incidents', getIncidents);
router.post('/incidents', createIncident);
router.patch('/incidents/:id', updateIncident);

// Report Templates - Custom report template CRUD
router.get('/reports/templates', getReportTemplates);
router.post('/reports/templates', createReportTemplate);
router.put('/reports/templates/:id', updateReportTemplate);
router.delete('/reports/templates/:id', deleteReportTemplate);

// Churn Predictions - ML/heuristic churn predictions
router.get('/churn/predictions', getChurnPredictions);

// Win-Back Campaign Dashboard
router.get('/automation/winback', getWinBackDashboard);

// ============================================
// P2 WIDGETS - VIP, Forecasting, P&L, UnitEcon, Journey, Funnel
// ============================================

// VIP Segment - Customer LTV segmentation
router.get('/vip/segment', getVIPSegment);

// Forecasting - Trend forecasting from historical data
router.get('/forecasting', getForecasting);

// Provider P&L - Provider profit & loss report
router.get('/provider-pl', getProviderPLReport);

// Unit Economics - CAC, LTV, contribution margin
router.get('/unit-economics', getUnitEconomics);

// Customer Journey - Funnel stage counts and conversion rates
router.get('/customer-journey', getCustomerJourney);

// Funnel Drop-off - Where users abandon the booking process
router.get('/funnel-dropoff', getFunnelDropOff);

// ============================================
// P3 WIDGETS - WeatherImpact, TrainingAcademy, MagicNumber
// ============================================

// Weather Impact - Weather correlation with booking volume
router.get('/weather-impact', getWeatherImpact);

// Training Academy - Provider training progress and certifications
router.get('/training-academy', getTrainingAcademy);

// SaaS Magic Number - LTV/CAC metrics for investor reporting
router.get('/saas/magic-number', getMagicNumber);

export default router;
