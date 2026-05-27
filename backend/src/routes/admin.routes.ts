import express, { Request, Response } from 'express';
import {
  getPendingProviders,
  getProviderForVerification,
  approveProvider,
  rejectProvider,
  getVerificationStats,
  createTestProvider,
  getAllServices,
  getPendingServices,
  updateServiceStatus,
  adminDeleteService,
  getServiceStats,
  getAllUsers,
  updateUserStatus,
  adminDeleteUser,
  getUserStats,
  getProvidersWithServices,
  batchServiceAction,
  getProviderServices,
  // Bookings Management
  getAllBookings,
  getBookingDetails,
  updateBookingStatus,
  getBookingStats,
  cancelBooking,
  // Categories Management
  getAllCategories,
  getCategoryDetails,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryFeatured,
  addSubcategory,
  getCategoryStats
} from '../controllers/admin.controller';
import { asyncHandler } from '../utils/asyncHandler';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const approveProviderSchema = Joi.object({
  notes: Joi.string().max(500).optional()
});

const rejectProviderSchema = Joi.object({
  reason: Joi.string().required().valid(
    'incomplete-documentation',
    'invalid-credentials',
    'business-verification-failed',
    'background-check-failed',
    'non-compliance',
    'other'
  ),
  notes: Joi.string().max(500).optional()
});

// Validation middleware
const validateApproval = (req: any, res: any, next: any) => {
  const { error } = approveProviderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

const validateRejection = (req: any, res: any, next: any) => {
  const { error } = rejectProviderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

// All admin routes require authentication and rate limiting
router.use(authenticate);
router.use(requireRole('admin'));
router.use(adminLimiter); // Apply rate limiting to all admin routes

// Dashboard Stats
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalUsers,
    activeProviders,
    todayBookings,
    pendingVerifications,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: 'admin' } }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'approved' }),
    Booking.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' }),
  ]);

  // Calculate revenue from completed bookings this month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const completedBookings = await Booking.find({
    status: 'completed',
    completedAt: { $gte: monthStart }
  });
  const revenue = completedBookings.reduce((sum, booking) => sum + (booking.pricing?.totalAmount || 0), 0);

  res.json({
    totalUsers,
    activeProviders,
    todayBookings,
    revenue,
    pendingVerifications,
    activeIncidents: 0,
  });
}));

// Provider verification routes
router.get('/providers/pending', getPendingProviders);
router.get('/providers/stats', getVerificationStats);
router.get('/providers/:id', getProviderForVerification);
router.post('/providers/:id/approve', validateApproval, approveProvider);
router.post('/providers/:id/reject', validateRejection, rejectProvider);

// Test routes
router.post('/test/create-provider', createTestProvider);

// ========================================
// Service Management Routes
// ========================================

router.get('/services', getAllServices);
router.get('/services/pending', getPendingServices);
router.get('/services/stats', getServiceStats);
router.patch('/services/:id/status', updateServiceStatus);
router.delete('/services/:id', adminDeleteService);

// ========================================
// User Management Routes
// ========================================

router.get('/users', getAllUsers);
router.get('/users/stats', getUserStats);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', adminDeleteUser);

// ========================================
// Enhanced Provider-Service Management Routes
// ========================================

router.get('/providers-with-services', getProvidersWithServices);
router.get('/providers/:id/services', getProviderServices);
router.post('/services/batch-action', batchServiceAction);

// ========================================
// Bookings Management Routes
// ========================================

router.get('/bookings', getAllBookings);
router.get('/bookings/stats', getBookingStats);
router.get('/bookings/:id', getBookingDetails);
router.patch('/bookings/:id/status', updateBookingStatus);
router.post('/bookings/:id/cancel', cancelBooking);

// ========================================
// Categories Management Routes
// ========================================

router.get('/categories', getAllCategories);
router.get('/categories/stats', getCategoryStats);
router.get('/categories/:id', getCategoryDetails);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/categories/:id/featured', toggleCategoryFeatured);
router.post('/categories/:id/subcategories', addSubcategory);

export default router;