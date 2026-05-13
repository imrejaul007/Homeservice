import { Router } from 'express';
import experienceController from '../controllers/experience.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * ============================================
 * PUBLIC ROUTES (No Authentication Required)
 * ============================================
 */

/**
 * GET /api/experiences
 * Get paginated list of approved experiences
 * Query params: page, limit, serviceId, providerId, minRating
 */
router.get('/', experienceController.getPublicExperiences);

/**
 * GET /api/experiences/featured
 * Get featured experiences for homepage
 * Query params: limit (max 20)
 */
router.get('/featured', experienceController.getFeaturedExperiences);

/**
 * GET /api/experiences/check/:bookingId
 * Check if user has submitted an experience for a booking
 * Requires authentication
 */
router.get(
  '/check/:bookingId',
  authenticate,
  experienceController.checkExperienceExists
);

/**
 * GET /api/experiences/:id
 * Get single experience by ID (public)
 */
router.get('/:id', experienceController.getExperienceById);

/**
 * ============================================
 * PROTECTED ROUTES (Customer Authentication Required)
 * ============================================
 */

/**
 * GET /api/experiences/my
 * Get experiences submitted by current user
 * Query params: page, limit
 */
router.get(
  '/my',
  authenticate,
  experienceController.getMyExperiences
);

/**
 * POST /api/experiences
 * Submit a new experience for a completed booking
 * Body: bookingId, serviceId, providerId, title, description, rating, images?, videoUrl?
 */
router.post(
  '/',
  authenticate,
  experienceController.submitExperience
);

/**
 * PUT /api/experiences/:id
 * Update an existing experience (within 30 days)
 * Body: title?, description?, rating?, images?, videoUrl?
 */
router.put(
  '/:id',
  authenticate,
  experienceController.updateExperience
);

/**
 * DELETE /api/experiences/:id
 * Soft delete an experience
 */
router.delete(
  '/:id',
  authenticate,
  experienceController.deleteExperience
);

export default router;
