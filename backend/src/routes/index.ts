import { Router } from 'express';
import verifyRoutes from './verify.routes';
import authRoutes from './auth.routes';
import searchRoutes from './search.routes';
import adminRoutes from './admin.routes';
import providerRoutes from './provider.routes';
import providerPublicRoutes from './provider.public.routes';
import bookingRoutes from './booking.routes';
import categoryRoutes from './category.routes';

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

// Future route imports will go here
// router.use('/users', userRoutes);
// router.use('/payments', paymentRoutes);

export default router;