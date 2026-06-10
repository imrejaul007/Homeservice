import { Router } from 'express';
import wishlistController from '../controllers/wishlist.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const addToWishlistSchema = Joi.object({
  notes: Joi.string().max(500),
});

const updateNotesSchema = Joi.object({
  notes: Joi.string().max(500).allow(''),
  category: Joi.string(),
});

const toggleWishlistSchema = Joi.object({
  notes: Joi.string().max(500).allow(''),
});

// ============================================
// Routes (All Protected)
// ============================================

// Get all wishlist items
router.get('/',
  authMiddleware.authenticate,
  wishlistController.getWishlist
);

// Check if package is in wishlist
router.get('/check/:packageId',
  authMiddleware.authenticate,
  wishlistController.checkWishlist
);

// ============================================
// ROUTES WITH :packageId - Specific routes BEFORE parameterized /:packageId
// ============================================

// Toggle wishlist status (add if not in wishlist, remove if in wishlist)
router.post('/:packageId/toggle',
  authMiddleware.authenticate,
  validate(toggleWishlistSchema),
  wishlistController.toggleWishlist
);

// Update wishlist item notes
router.patch('/:packageId',
  authMiddleware.authenticate,
  validate(updateNotesSchema),
  wishlistController.updateWishlistNotes
);

// Remove from wishlist
router.delete('/:packageId',
  authMiddleware.authenticate,
  wishlistController.removeFromWishlist
);

// Add to wishlist (must be last for /:packageId routes)
router.post('/:packageId',
  authMiddleware.authenticate,
  validate(addToWishlistSchema),
  wishlistController.addToWishlist
);

export default router;
