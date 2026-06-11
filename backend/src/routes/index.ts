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
import customerAnalyticsRoutes from './analytics/customer.routes';
import providerAnalyticsRoutes from './analytics/provider.routes';
import adminAnalyticsRoutes from './analytics/admin.routes';
import biRoutes from './bi.routes';
import churnRoutes from './churn.routes';
import fraudRoutes from './fraud.routes';
import slaRoutes from './sla.routes';
import offerRoutes from './offer.routes';
import notificationRoutes from './notification.routes';
import notificationAdminRoutes from './notificationAdmin.routes';
import couponRoutes from './coupon.routes';
import couponPublicRoutes from './coupon.public.routes';
import apiKeyAdminRoutes from './apiKeyAdmin.routes';
import integrationRoutes from './integration.routes';
import referralRoutes from './referral.routes';
import favoritesRoutes from './favorites.routes';
import wishlistRoutes from './wishlist.routes';
import loyaltyRoutes from './loyalty.routes';
import customerRoutes from './customer.routes';
import customerDashboardRoutes from './customerDashboard.routes';
import packagesPublicRoutes from './packages.public.routes';
import dashboardCustomerRoutes from './dashboard.customer.routes';
import reviewRoutes from './review.routes';
import experienceRoutes from './experience.routes';
import experienceAdminRoutes from './experience.admin.routes';
import anomalyAdminRoutes from './anomaly.admin.routes';
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
import liveChatRoutes from './liveChat.routes';
import contactRoutes from './contact.routes';
import marketplaceRoutes from './marketplace.routes';
import addressRoutes from './address.routes';
import streakRoutes from './streak.routes';
import habitRoutes from './habit.routes';
import featureFlagsRoutes from './featureFlags.routes';
import twilioWebhookRoutes from './webhooks/twilio.routes';
import stripeWebhookRoutes from './webhooks/stripe.routes';
import notificationWebhookRoutes from './webhooks/notificationWebhooks.routes';
import inboundEmailRoutes from './webhooks/inboundEmail.routes';
import offerAnalyticsRoutes from './offerAnalytics.routes';
import apiKeyRoutes from './apiKey.routes';
import auditRoutes from './audit.routes';
import providerAdRoutes from './providerAd.routes';
import managedContractRoutes from './managedContract.routes';
import reportRoutes from './report.routes';
import chatRoutes from './chat.routes';
import bundleRoutes from './bundle.routes';
import invoiceRoutes from './invoice.routes';
import trendingRoutes from './trending.routes';
import homeRoutes from './home.routes';
import curatedTrendAdminRoutes from './curatedTrend.admin.routes';
import geolocationRoutes from './geolocation.routes';
import leadRoutes from './lead.routes';
import corporateRoutes from './corporate.routes';
import fingerprintRoutes from './fingerprint.routes';
import sessionRoutes from './session.routes';
import automationRoutes from './automation.routes';
import onboardingRoutes from './onboarding.routes';
import winbackRoutes from './winback.routes';
import automationAdminRoutes from './automationAdmin.routes';
import healthRoutes from './health.routes';
import platformRoutes from './platform.routes';
import iaAgentRoutes from './iaAgent.routes';
import bundleAdminRoutes from './bundleAdmin.routes';
import bundleCustomerRoutes from './bundleCustomer.routes';
import batchRoutes from './batch.routes';
import newsletterRoutes from './newsletter.routes';

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
      invoices: '/api/invoices',
      trending: '/api/trending',
      nearby: '/api/nearby',
      leads: '/api/leads',
      corporate: '/api/corporate',
      fingerprint: '/api/fingerprint',
      sessions: '/api/sessions',
      automation: '/api/automation',
      documentation: '/api-docs'
    }
  });
});

// Public platform status (maintenance mode)
router.use('/platform', platformRoutes);

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

// Customer Analytics routes
router.use('/analytics/customer', customerAnalyticsRoutes);

// Provider Analytics routes
router.use('/analytics/provider', providerAnalyticsRoutes);

// Admin Analytics routes
router.use('/analytics/admin', adminAnalyticsRoutes);

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

// Admin notification broadcast routes
router.use('/admin/notifications', notificationAdminRoutes);

// Admin coupon management routes
router.use('/admin/coupons', couponRoutes);

// Customer-facing coupon routes (auth required)
router.use('/coupons', couponPublicRoutes);

// Admin API key management routes
router.use('/admin/api-keys', apiKeyAdminRoutes);

// External integrations (admin API keys)
router.use('/integrations/v1', integrationRoutes);

// Referral routes
router.use('/referrals', referralRoutes);

// Favorites routes (providers)
router.use('/favorites', favoritesRoutes);

// Wishlist routes (packages)
router.use('/wishlist', wishlistRoutes);

// Loyalty routes
router.use('/loyalty', loyaltyRoutes);

// Customer routes (addresses, payment methods)
router.use('/customers', customerRoutes);

// Customer Dashboard routes
router.use('/customer', customerDashboardRoutes);

// Customer wallet routes (same handlers as provider wallet; role-agnostic by user id)
router.use('/customer', walletRoutes);

// Customer dashboard routes (activity, recommended-pros)
router.use('/dashboard', dashboardCustomerRoutes);

// Package comparison routes
import packageComparisonRoutes from './packageComparison.routes';
router.use('/packages/compare', packageComparisonRoutes);

// Package Price Calculator routes
import packagePriceCalculatorRoutes from './packagePriceCalculator.routes';
router.use('/packages', packagePriceCalculatorRoutes);

// Packages routes (public listing)
router.use('/packages', packagesPublicRoutes);

// Reviews routes
router.use('/reviews', reviewRoutes);

// Experience routes
router.use('/experiences', experienceRoutes);

// Admin Experience routes
router.use('/admin/experiences', experienceAdminRoutes);

// Admin Anomaly Detection routes
router.use('/admin/anomalies', anomalyAdminRoutes);

// Wallet/Earnings routes (for providers)
router.use('/provider', walletRoutes);

// AI routes (insights, provider scoring, churn prediction)
router.use('/ai', aiRoutes);

// IA Agent routes (chatbot builder)
router.use('/ia-agents', iaAgentRoutes);

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

// Public contact form routes
router.use('/contact', contactRoutes);

// Live Chat routes
router.use('/support/chat', liveChatRoutes);

// Marketplace routes (booking, payments, subscriptions, analytics)
router.use('/', marketplaceRoutes);

// Feature flags routes
router.use('/feature-flags', featureFlagsRoutes);

// Twilio webhook routes (SMS delivery receipts, STOP keywords)
router.use('/webhooks/twilio', twilioWebhookRoutes);

// Stripe webhook routes (payment events with IP allowlist)
router.use('/webhooks/stripe', stripeWebhookRoutes);

router.use('/webhooks/inbound-email', inboundEmailRoutes);

// WhatsApp & Telegram notification webhooks
router.use('/webhooks', notificationWebhookRoutes);

// Bundle routes (implemented below)
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

// Scheduled Report routes (admin)
router.use('/admin', reportRoutes);

// Chat routes
router.use('/chat', chatRoutes);

// Bundle sales routes
router.use('/bundles', bundleRoutes);

// Admin Bundle management routes
router.use('/admin/bundles', bundleAdminRoutes);

// Customer Bundle routes (my/bundles)
router.use('/', bundleCustomerRoutes);

// Invoice routes
router.use('/invoices', invoiceRoutes);

// Homepage discovery feed
router.use('/home', homeRoutes);

// Trending analytics routes
router.use('/trending', trendingRoutes);

// Admin curated homepage trending
router.use('/admin/curated-trends', curatedTrendAdminRoutes);

// Geolocation/nearby providers routes
router.use('/nearby', geolocationRoutes);

// Lead generation routes
router.use('/leads', leadRoutes);

// Corporate B2B account routes
router.use('/corporate', corporateRoutes);

// ============================================
// Customer Wallet Features Routes
// ============================================
import cashbackRoutes from './cashback.routes';
import voucherRoutes from './voucher.routes';
import autoTopupRoutes from './autoTopup.routes';
import corporateWalletRoutes from './corporateWallet.routes';

// Cashback routes
router.use('/cashback', cashbackRoutes);

// Voucher routes
router.use('/vouchers', voucherRoutes);

// Auto-topup routes
router.use('/auto-topup', autoTopupRoutes);

// Corporate wallet routes
router.use('/corporate-wallet', corporateWalletRoutes);

// Device fingerprinting routes
router.use('/fingerprint', fingerprintRoutes);

// Session management routes
router.use('/sessions', sessionRoutes);

// Automation management routes
router.use('/automation', automationRoutes);

// Customer onboarding routes
router.use('/customer/onboarding', onboardingRoutes);

// Win-back campaign routes
router.use('/winback', winbackRoutes);

// Health check routes (public)
router.use('/', healthRoutes);

// Batch operations routes (efficient batch fetching)
router.use('/batch', batchRoutes);

// Admin automation management routes
router.use('/admin/automation', automationAdminRoutes);
router.use('/admin/automation/winback', winbackRoutes);

// Share analytics routes
import shareRoutes from './share.routes';
router.use('/share', shareRoutes);

// Newsletter subscription routes
router.use('/newsletter', newsletterRoutes);

export default router;