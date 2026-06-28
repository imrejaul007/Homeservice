import express, { Request, Response } from 'express';
import Joi from 'joi';
import HeroSlide from '../models/heroSlide.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import {
  enforceAdminIpAllowlist,
  enforcePlatformRequire2FA,
} from '../middleware/platformSettings.middleware';
import { cache } from '../config/redis';

// Cache invalidation helper - invalidates all hero slide cache keys
const invalidateHeroSlidesCache = async (): Promise<void> => {
  try {
    // Delete all hero slides cache keys (vary by limit 1-20)
    for (let limit = 1; limit <= 20; limit++) {
      await cache.del(`home:hero-slides:${limit}`);
    }
    logger.debug('Hero slides cache invalidated');
  } catch (error) {
    logger.error('Failed to invalidate hero slides cache', { error });
  }
};

// Apply auth middleware and rate limiting to all routes
const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));
router.use(enforceAdminIpAllowlist);
router.use(enforcePlatformRequire2FA);
router.use(adminLimiter);

// Validation schema for hero slide
const heroSlideSchema = Joi.object({
  image: Joi.string().uri().required().messages({
    'string.uri': 'Image must be a valid URL',
    'any.required': 'Image URL is required'
  }),
  badge: Joi.string().max(80).required().messages({
    'string.max': 'Badge cannot exceed 80 characters',
    'any.required': 'Badge text is required'
  }),
  title: Joi.string().max(120).required().messages({
    'string.max': 'Title cannot exceed 120 characters',
    'any.required': 'Title is required'
  }),
  subtitle: Joi.string().max(200).required().messages({
    'string.max': 'Subtitle cannot exceed 200 characters',
    'any.required': 'Subtitle is required'
  }),
  cta: Joi.string().max(60).required().messages({
    'string.max': 'CTA text cannot exceed 60 characters',
    'any.required': 'CTA text is required'
  }),
  ctaLink: Joi.string().uri().required().messages({
    'string.uri': 'CTA link must be a valid URL',
    'any.required': 'CTA link is required'
  }),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  startsAt: Joi.date().iso().optional().allow(null),
  endsAt: Joi.date().iso().optional().allow(null)
});

// Validation schema for update
const updateHeroSlideSchema = Joi.object({
  image: Joi.string().uri().optional(),
  badge: Joi.string().max(80).optional(),
  title: Joi.string().max(120).optional(),
  subtitle: Joi.string().max(200).optional(),
  cta: Joi.string().max(60).optional(),
  ctaLink: Joi.string().uri().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  startsAt: Joi.date().iso().optional().allow(null),
  endsAt: Joi.date().iso().optional().allow(null)
});

// Validation schema for reorder
const reorderSchema = Joi.object({
  sortOrder: Joi.number().integer().min(0).required().messages({
    'any.required': 'Sort order is required'
  })
});

// Validation middleware
const validateCreate = (req: any, res: any, next: any) => {
  const { error, value } = heroSlideSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      'Validation failed',
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  req.validatedBody = value;
  next();
};

const validateUpdate = (req: any, res: any, next: any) => {
  const { error, value } = updateHeroSlideSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      'Validation failed',
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  req.validatedBody = value;
  next();
};

const validateReorder = (req: any, res: any, next: any) => {
  const { error, value } = reorderSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      'Validation failed',
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  req.validatedBody = value;
  next();
};

/**
 * GET /api/admin/hero-slides
 * List all hero slides (admin view with all fields)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const { isActive, search } = req.query;

  // Build query
  const query: any = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (search && typeof search === 'string') {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { badge: { $regex: search, $options: 'i' } },
      { subtitle: { $regex: search, $options: 'i' } }
    ];
  }

  const [slides, total] = await Promise.all([
    HeroSlide.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HeroSlide.countDocuments(query)
  ]);

  // Get stats
  const stats = await HeroSlide.aggregate([
    {
      $group: {
        _id: null,
        totalSlides: { $sum: 1 },
        activeSlides: { $sum: { $cond: ['$isActive', 1, 0] } },
        maxSortOrder: { $max: '$sortOrder' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      slides,
      stats: stats[0] || { totalSlides: 0, activeSlides: 0, maxSortOrder: 0 },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
}));

/**
 * GET /api/admin/hero-slides/:id
 * Get a single hero slide by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw ApiError.badRequest('Valid slide ID is required', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const slide = await HeroSlide.findById(id).lean();

  if (!slide) {
    throw ApiError.notFound('Hero slide not found', ERROR_CODES.NOT_FOUND);
  }

  res.json({
    success: true,
    data: slide
  });
}));

/**
 * POST /api/admin/hero-slides
 * Create a new hero slide
 */
router.post('/', validateCreate, asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;
  const data = (req as any).validatedBody;

  // Check if this is the first slide (set sortOrder to 0)
  const count = await HeroSlide.countDocuments();
  if (count === 0) {
    data.sortOrder = 0;
  }

  const slide = new HeroSlide(data);
  await slide.save();

  // Invalidate hero slides cache on create
  await invalidateHeroSlidesCache();

  logger.info('Hero slide created', {
    context: 'HeroAdminRoutes',
    action: 'CREATE_HERO_SLIDE',
    slideId: slide._id.toString(),
    createdBy: adminUser._id?.toString()
  });

  res.status(201).json({
    success: true,
    message: 'Hero slide created successfully',
    data: slide
  });
}));

/**
 * PUT /api/admin/hero-slides/:id
 * Update an existing hero slide
 */
router.put('/:id', validateUpdate, asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;
  const { id } = req.params;
  const data = (req as any).validatedBody;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw ApiError.badRequest('Valid slide ID is required', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const slide = await HeroSlide.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!slide) {
    throw ApiError.notFound('Hero slide not found', ERROR_CODES.NOT_FOUND);
  }

  // Invalidate hero slides cache on update
  await invalidateHeroSlidesCache();

  logger.info('Hero slide updated', {
    context: 'HeroAdminRoutes',
    action: 'UPDATE_HERO_SLIDE',
    slideId: id,
    updatedBy: adminUser._id?.toString(),
    fields: Object.keys(data)
  });

  res.json({
    success: true,
    message: 'Hero slide updated successfully',
    data: slide
  });
}));

/**
 * DELETE /api/admin/hero-slides/:id
 * Delete a hero slide
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;
  const { id } = req.params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw ApiError.badRequest('Valid slide ID is required', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const slide = await HeroSlide.findByIdAndDelete(id);

  if (!slide) {
    throw ApiError.notFound('Hero slide not found', ERROR_CODES.NOT_FOUND);
  }

  // Invalidate hero slides cache on delete
  await invalidateHeroSlidesCache();

  logger.info('Hero slide deleted', {
    context: 'HeroAdminRoutes',
    action: 'DELETE_HERO_SLIDE',
    slideId: id,
    deletedBy: adminUser._id?.toString()
  });

  res.json({
    success: true,
    message: 'Hero slide deleted successfully'
  });
}));

/**
 * PATCH /api/admin/hero-slides/:id/reorder
 * Change the display order of a hero slide
 */
router.patch('/:id/reorder', validateReorder, asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;
  const { id } = req.params;
  const { sortOrder } = (req as any).validatedBody;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw ApiError.badRequest('Valid slide ID is required', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const slide = await HeroSlide.findByIdAndUpdate(
    id,
    { $set: { sortOrder } },
    { new: true, runValidators: true }
  ).lean();

  if (!slide) {
    throw ApiError.notFound('Hero slide not found', ERROR_CODES.NOT_FOUND);
  }

  // Invalidate hero slides cache on reorder
  await invalidateHeroSlidesCache();

  logger.info('Hero slide reordered', {
    context: 'HeroAdminRoutes',
    action: 'REORDER_HERO_SLIDE',
    slideId: id,
    newSortOrder: sortOrder,
    updatedBy: adminUser._id?.toString()
  });

  res.json({
    success: true,
    message: 'Hero slide reordered successfully',
    data: slide
  });
}));

/**
 * POST /api/admin/hero-slides/reorder-all
 * Reorder multiple slides at once
 */
const reorderAllSchema = Joi.object({
  slides: Joi.array().items(
    Joi.object({
      id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
      sortOrder: Joi.number().integer().min(0).required()
    })
  ).min(1).required()
});

router.post('/reorder-all', asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;

  const { error, value } = reorderAllSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      'Validation failed',
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Update all slides in parallel
  const updatePromises = value.slides.map((slide: { id: string; sortOrder: number }) =>
    HeroSlide.findByIdAndUpdate(
      slide.id,
      { $set: { sortOrder: slide.sortOrder } },
      { new: true }
    )
  );

  const updatedSlides = await Promise.all(updatePromises);

  // Invalidate hero slides cache on reorder-all
  await invalidateHeroSlidesCache();

  logger.info('Multiple hero slides reordered', {
    context: 'HeroAdminRoutes',
    action: 'REORDER_ALL_HERO_SLIDES',
    slideCount: value.slides.length,
    updatedBy: adminUser._id?.toString()
  });

  res.json({
    success: true,
    message: 'Hero slides reordered successfully',
    data: {
      slides: updatedSlides
    }
  });
}));

/**
 * PATCH /api/admin/hero-slides/:id/toggle
 * Toggle hero slide active status
 */
router.patch('/:id/toggle', asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;
  const { id } = req.params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw ApiError.badRequest('Valid slide ID is required', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const slide = await HeroSlide.findById(id);

  if (!slide) {
    throw ApiError.notFound('Hero slide not found', ERROR_CODES.NOT_FOUND);
  }

  slide.isActive = !slide.isActive;
  await slide.save();

  // Invalidate hero slides cache on toggle
  await invalidateHeroSlidesCache();

  logger.info('Hero slide toggled', {
    context: 'HeroAdminRoutes',
    action: 'TOGGLE_HERO_SLIDE',
    slideId: id,
    newStatus: slide.isActive,
    toggledBy: adminUser._id?.toString()
  });

  res.json({
    success: true,
    message: `Hero slide ${slide.isActive ? 'activated' : 'deactivated'} successfully`,
    data: slide
  });
}));

export default router;
