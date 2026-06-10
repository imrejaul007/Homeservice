import { Router } from 'express';
import experienceAdminController from '../controllers/experience.admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * ============================================
 * ADMIN EXPERIENCE MANAGEMENT ROUTES
 * ============================================
 */

/**
 * GET /api/admin/experiences
 * Get all experiences with filtering and pagination
 * Query params: page, limit, search, status, isFeatured, sortBy, order
 */
router.get('/', experienceAdminController.getAllExperiences);

/**
 * GET /api/admin/experiences/stats
 * Get experience statistics
 */
router.get('/stats', experienceAdminController.getExperienceStats);

/**
 * GET /api/admin/experiences/user/:userId
 * Get experiences by user
 * Query params: page, limit
 */
router.get('/user/:userId', experienceAdminController.getExperiencesByUser);

/**
 * GET /api/admin/experiences/provider/:providerId
 * Get experiences by provider
 * Query params: page, limit
 */
router.get('/provider/:providerId', experienceAdminController.getExperiencesByProvider);

// ============================================
// ROUTES WITH :id - Specific routes BEFORE parameterized /:id
// ============================================

/**
 * POST /api/admin/experiences/:id/approve
 * Approve an experience
 * Body: notes? (optional admin notes)
 */
router.post('/:id/approve', experienceAdminController.approveExperience);

/**
 * POST /api/admin/experiences/:id/reject
 * Reject an experience
 * Body: reason (required), notes? (optional)
 */
router.post('/:id/reject', experienceAdminController.rejectExperience);

/**
 * PATCH /api/admin/experiences/:id/featured
 * Toggle featured status of an experience
 */
router.patch('/:id/featured', experienceAdminController.toggleFeatured);

/**
 * PUT /api/admin/experiences/:id
 * Update an experience (admin edit)
 * Body: title?, description?, rating?, images?, videoUrl?, status?, isFeatured?, adminNotes?
 */
router.put('/:id', experienceAdminController.updateExperience);

/**
 * DELETE /api/admin/experiences/:id
 * Permanently delete an experience (hard delete)
 */
router.delete('/:id', experienceAdminController.deleteExperience);

/**
 * GET /api/admin/experiences/:id
 * Get single experience by ID (must be last for /:id routes)
 */
router.get('/:id', experienceAdminController.getExperienceById);

/**
 * POST /api/admin/experiences/batch-action
 * Bulk action on multiple experiences
 * Body: experienceIds (array), action ('approve' | 'reject' | 'delete' | 'feature' | 'unfeature'), reason? (required for reject)
 */
router.post('/batch-action', experienceAdminController.bulkAction);

export default router;
