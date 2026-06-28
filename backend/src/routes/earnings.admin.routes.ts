import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import {
  enforceAdminIpAllowlist,
  enforcePlatformRequire2FA,
} from '../middleware/platformSettings.middleware';
import earningsController from '../controllers/earnings.controller';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));
router.use(enforceAdminIpAllowlist);
router.use(enforcePlatformRequire2FA);
router.use(adminLimiter);

// ============================================
// COMMISSION RULE MANAGEMENT (ADMIN)
// ============================================

/**
 * @route   GET /api/admin/commission-rules
 * @desc    Get all commission rules
 * @access  Private (Admin)
 */
router.get('/commission-rules', earningsController.getCommissionRules);

/**
 * @route   POST /api/admin/commission-rules
 * @desc    Create a new commission rule
 * @access  Private (Admin)
 */
router.post('/commission-rules', earningsController.createCommissionRule);

/**
 * @route   PATCH /api/admin/commission-rules/:id
 * @desc    Update a commission rule
 * @access  Private (Admin)
 */
router.patch('/commission-rules/:id', earningsController.updateCommissionRule);

/**
 * @route   DELETE /api/admin/commission-rules/:id
 * @desc    Delete a commission rule
 * @access  Private (Admin)
 */
router.delete('/commission-rules/:id', earningsController.deleteCommissionRule);

// ============================================
// TAX CONFIGURATION MANAGEMENT (ADMIN)
// ============================================

/**
 * @route   GET /api/admin/tax-configs
 * @desc    Get all tax configurations
 * @access  Private (Admin)
 */
router.get('/tax-configs', earningsController.getTaxConfigs);

/**
 * @route   PATCH /api/admin/tax-configs/:region
 * @desc    Update tax configuration for a region
 * @access  Private (Admin)
 */
router.patch('/tax-configs/:region', earningsController.updateTaxConfig);

// ============================================
// BATCH OPERATIONS (ADMIN)
// ============================================

/**
 * @route   POST /api/admin/commissions/batch-calculate
 * @desc    Batch calculate commissions for bookings
 * @access  Private (Admin)
 */
router.post('/commissions/batch-calculate', earningsController.batchCalculateCommissions);

export default router;
