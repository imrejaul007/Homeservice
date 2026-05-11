import express from 'express';
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
  getProviderServices
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
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

// All admin routes require authentication
router.use(authenticate);
router.use(requireRole('admin'));

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

export default router;