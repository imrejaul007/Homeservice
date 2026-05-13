import { Router } from 'express';
import verifyRoutes from './verify.routes';
import authRoutes from './auth.routes';
import searchRoutes from './search.routes';
import adminRoutes from './admin.routes';
import providerRoutes from './provider.routes';
import providerPublicRoutes from './provider.public.routes';
import bookingRoutes from './booking.routes';
import categoryRoutes from './category.routes';
import paymentRoutes from './payment.routes';
import analyticsRoutes from './analytics.routes';
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

const router = Router();

// API Welcome route
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Home Service Marketplace API',
    version: process.env.API_VERSION || 'v1',
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
      bookings: '/api/bookings',
      availability: '/api/availability',
      payments: '/api/payments',
      ai: '/api/ai',
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

// Provider routes (protected)
router.use('/provider', providerRoutes);

// Booking and Availability routes
router.use('/', bookingRoutes);

// Payment routes
router.use('/payments', paymentRoutes);

// Offer routes
router.use('/offers', offerRoutes);

// Analytics routes
router.use('/analytics', analyticsRoutes);

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

export default router;