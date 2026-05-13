import { Router } from 'express';
import favoritesController from '../controllers/favorites.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const addFavoriteSchema = Joi.object({
  category: Joi.string(),
  notes: Joi.string().max(500),
});

const updateNotesSchema = Joi.object({
  notes: Joi.string().max(500).allow(''),
  category: Joi.string(),
});

// ============================================
// Routes (All Protected)
// ============================================

// Get all favorites
router.get('/',
  authMiddleware.authenticate,
  favoritesController.getFavorites
);

// Check if provider is favorited
router.get('/check/:providerId',
  authMiddleware.authenticate,
  favoritesController.checkFavorite
);

// Add to favorites
router.post('/:providerId',
  authMiddleware.authenticate,
  validate(addFavoriteSchema),
  favoritesController.addFavorite
);

// Update favorite notes
router.patch('/:providerId',
  authMiddleware.authenticate,
  validate(updateNotesSchema),
  favoritesController.updateFavoriteNotes
);

// Remove from favorites
router.delete('/:providerId',
  authMiddleware.authenticate,
  favoritesController.removeFavorite
);

export default router;
