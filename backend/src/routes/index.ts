import { Router } from 'express';
import verifyRoutes from './verify.routes';
import authRoutes from './auth.routes';
import searchRoutes from './search.routes';
import adminRoutes from './admin.routes';
import rbacRoutes from './rbac.routes';
import providerRoutes from './provider.routes';
import providerPublicRoutes from './provider.public.routes';
import providerOpsRoutes from './providerOps.routes';
import customerOpsRoutes from './customerOps.routes';
import bookingRoutes from './booking.routes';
import categoryRoutes from './category.routes';
import paymentRoutes from './payment.routes';
import analyticsRoutes from './analytics.routes';
import dashboardRoutes from './analytics/dashboard.routes';
import biRoutes from './bi.routes';
import churnRoutes from './churn.routes';
import fraudRoutes from './fraud.routes';
import slaRoutes from './sla.routes';
import offerRoutes from './offer.routes';
import notificationRoutes from './notification.routes';
import referralRoutes from './referral.routes';
import favoritesRoutes from './favorites.routes';
import loyaltyRoutes from './loyalty.routes';
import customerRoutes from './customer.routes';
import reviewRoutes from './review.routes';
import experienceRoutes from './experience.routes';
import experienceAdminRoutes from './experience.admin.routes';
import walletRoutes from './wallet.routes';
import aiRoutes from './ai.routes';
import settingsRoutes from './settings.routes';
import locationRoutes from './location.routes';
import deviceRoutes from './device.routes';
import appRoutes from './app.routes';
import syncRoutes from './sync.routes';
import disputeRoutes from './dispute.routes';
import providerInsightsRoutes from './providerInsights.routes';
import payoutRoutes from './payout.routes';
import earningsRoutes from './earnings.routes';
import providerBookingRoutes from './providerBooking.routes';
import earningsAdminRoutes from './earnings.admin.routes';
import gdprRoutes from './gdpr.routes';
import demoRoutes from './demo.routes';
import supportRoutes from './support.routes';
import marketplaceRoutes from './marketplace.routes';
import addressRoutes from './address.routes';
import streakRoutes from './streak.routes';
import habitRoutes from './habit.routes';
import featureFlagsRoutes from './featureFlags.routes';
import twilioWebhookRoutes from './webhooks/twilio.routes';
import stripeWebhookRoutes from './webhooks/stripe.routes';
import offerAnalyticsRoutes from './offerAnalytics.routes';
import apiKeyRoutes from './apiKey.routes';
import auditRoutes from './audit.routes';
import providerAdRoutes from './providerAd.routes';
import managedContractRoutes from './managedContract.routes';

const router = Router();

// API Welcome route
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Home Service Marketplace API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      test: '/api/test',
      auth: '/api/auth',
      verify: '/api/verify',
      search: '/api/search',
      categories: '/api/categories',
      providers: '/api/providers',
      admin: '/api/admin',
      provider: '/api/provider',
      providerOps: '/api/provider-ops',
      bookings: '/api/bookings',
      availability: '/api/availability',
      payments: '/api/payments',
      subscriptions: '/api/subscriptions',
      bundles: '/api/bundles',
      offers: '/api/offers',
      offersAnalytics: '/api/offers-analytics',
      analytics: '/api/analytics',
      bi: '/api/bi',
      churn: '/api/churn',
      fraud: '/api/fraud',
      sla: '/api/sla',
      ai: '/api/ai',
      apiKeys: '/api/api-keys',
      audit: '/api/audit',
      documentation: '/api-docs'
    }
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// Verification routes
router.use('/verify', verifyRoutes);

// Search routes
router.use('/search', searchRoutes);

// Category routes
router.use('/categories', categoryRoutes);

// Public Provider routes (must be before protected provider routes)
router.use('/providers', providerPublicRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Admin RBAC routes
router.use('/admin/rbac', rbacRoutes);

// Provider Operations routes (admin)
router.use('/provider-ops', providerOpsRoutes);

// Customer Operations routes (admin)
router.use('/admin', customerOpsRoutes);

// Provider AI Insights routes (MUST be before providerRoutes to avoid validateProviderRole blocking)
router.use('/provider', providerInsightsRoutes);

// Provider routes (protected)
router.use('/provider', providerRoutes);

// Booking and Availability routes
router.use('/', bookingRoutes);

// Provider Booking Management routes (accept, reject, complete)
router.use('/provider-bookings', providerBookingRoutes);

// Payment routes
router.use('/payments', paymentRoutes);

// Offer routes
router.use('/offers', offerRoutes);

// Analytics routes
router.use('/analytics', analyticsRoutes);

// Analytics Dashboard routes (detailed metrics)
router.use('/analytics/dashboard', dashboardRoutes);

// Business Intelligence routes
router.use('/bi', biRoutes);

// Churn Prediction routes
router.use('/churn', churnRoutes);

// Fraud Detection routes
router.use('/fraud', fraudRoutes);

// SLA routes
router.use('/sla', slaRoutes);

// Notification preferences routes
router.use('/notifications', notificationRoutes);

// Referral routes
router.use('/referrals', referralRoutes);

// Favorites routes
router.use('/favorites', favoritesRoutes);

// Loyalty routes
router.use('/loyalty', loyaltyRoutes);

// Customer routes (addresses, payment methods)
router.use('/customers', customerRoutes);

// Reviews routes
router.use('/reviews', reviewRoutes);

// Experience routes
router.use('/experiences', experienceRoutes);

// Admin Experience routes
router.use('/admin/experiences', experienceAdminRoutes);

// Wallet/Earnings routes (for providers)
router.use('/provider', walletRoutes);

// AI routes (insights, provider scoring, churn prediction)
router.use('/ai', aiRoutes);

// Settings routes
router.use('/settings', settingsRoutes);

// Location routes (geocoding)
router.use('/location', locationRoutes);

// Mobile-specific routes
router.use('/devices', deviceRoutes);
router.use('/app', appRoutes);
router.use('/sync', syncRoutes);

// Streak and Habits routes
router.use('/streak', streakRoutes);
router.use('/habits', habitRoutes);

// Dispute and Refund routes
router.use('/disputes', disputeRoutes);

// Payout and Settlement routes
router.use('/payout', payoutRoutes);

// Earnings and Commission routes (providers)
router.use('/earnings', earningsRoutes);

// Admin Earnings routes (commission rules, tax configs)
router.use('/admin', earningsAdminRoutes);

// GDPR and Data Privacy routes
router.use('/gdpr', gdprRoutes);

// Demo routes
router.use('/demo', demoRoutes);

// Support routes
router.use('/support', supportRoutes);

// Marketplace routes (booking, payments, subscriptions, analytics)
router.use('/', marketplaceRoutes);

// Feature flags routes
router.use('/feature-flags', featureFlagsRoutes);

// Twilio webhook routes (SMS delivery receipts, STOP keywords)
router.use('/webhooks/twilio', twilioWebhookRoutes);

// Stripe webhook routes (payment events with IP allowlist)
router.use('/webhooks/stripe', stripeWebhookRoutes);

// Bundle routes - commented out until properly implemented
// router.use('/bundles', bundleRoutes);

// Subscription routes - commented out until properly implemented
// router.use('/subscriptions', subscriptionRoutes);
// router.use('/membership', subscriptionRoutes);

// Offer analytics routes
router.use('/offers-analytics', offerAnalyticsRoutes);

// API key management routes
router.use('/api-keys', apiKeyRoutes);

// Audit log routes (admin only)
router.use('/audit', auditRoutes);

// ============================================
// Public Ad Routes (no auth required) - MUST be before providerAdRoutes
// ============================================
import adPublicRoutes from './adPublic.routes';
router.use('/ads/public', adPublicRoutes);

// Provider Ad routes (mounted at /api/provider/ads/*)
router.use('/provider/ads', providerAdRoutes);

// Managed Contract routes
router.use('/provider/managed-contracts', managedContractRoutes);

export default router;