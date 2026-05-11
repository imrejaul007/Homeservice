import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { SERVICE_CATEGORIES, CATEGORY_SLUG_MAP, normalizeCategoryName } from '../../constants/categories';

const searchQuerySchema = Joi.object({
  q: Joi.string().min(1).max(100).trim().allow('').optional(),
  category: Joi.string().allow('').optional().custom((value, helpers) => {
    if (!value || value === '') return value;

    // First check if it's a slug and convert to category name
    const fromSlug = CATEGORY_SLUG_MAP[value.toLowerCase()];
    if (fromSlug) {
      return fromSlug; // Return the proper category name
    }

    // Then check if it's a valid category name (case-insensitive)
    const found = SERVICE_CATEGORIES.find(
      cat => cat.toLowerCase() === value.toLowerCase()
    );

    if (found) {
      return found; // Return properly cased category
    }

    return helpers.error('any.invalid', {
      message: `"${value}" is not a valid category. Valid categories include: ${SERVICE_CATEGORIES.slice(0, 5).join(', ')}... (and more)`
    });
  }),
  subcategory: Joi.string().max(50).trim().optional(),
  minPrice: Joi.number().min(0).max(100000).optional(),
  maxPrice: Joi.number().min(0).max(100000).optional(),
  minRating: Joi.number().min(0).max(5).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).default(25),
  city: Joi.string().max(50).trim().allow('').optional(),
  state: Joi.string().max(50).trim().allow('').optional(),
  zipCode: Joi.string().pattern(/^\d{5,6}(-\d{4})?$/).optional().messages({
    'string.pattern.base': 'Invalid zip code format'
  }),
  sortBy: Joi.string().valid(
    'popularity',
    'price',
    'price_desc',
    'rating',
    'distance',
    'newest'
  ).default('popularity'),
  page: Joi.number().integer().min(1).max(100).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  isActive: Joi.boolean().default(true),
  isFeatured: Joi.boolean().optional(),
  instantBooking: Joi.boolean().optional(),
  availableToday: Joi.boolean().optional()
}).custom((value, helpers) => {
  if (value.minPrice && value.maxPrice && value.minPrice > value.maxPrice) {
    return helpers.error('custom.minMaxPrice', {
      message: 'minPrice cannot be greater than maxPrice'
    });
  }

  if ((value.lat && !value.lng) || (!value.lat && value.lng)) {
    return helpers.error('custom.coordinates', {
      message: 'Both latitude and longitude are required for location search'
    });
  }

  if (value.q && value.q.trim() && value.q.trim().length < 2) {
    return helpers.error('custom.searchQuery', {
      message: 'Search query must be at least 2 characters long'
    });
  }

  return value;
}).messages({
  'custom.minMaxPrice': 'minPrice cannot be greater than maxPrice',
  'custom.coordinates': 'Both latitude and longitude are required for location search',
  'custom.searchQuery': 'Search query must be at least 2 characters long'
});

const suggestionQuerySchema = Joi.object({
  q: Joi.string().min(1).max(50).trim().required(),
  category: Joi.string().optional().custom((value, helpers) => {
    if (!value) return value;
    const normalized = normalizeCategoryName(value);
    if (normalized) return normalized;
    return helpers.error('any.invalid');
  }),
  limit: Joi.number().integer().min(1).max(10).default(5)
});

const categoryParamSchema = Joi.object({
  category: Joi.string().required().custom((value, helpers) => {
    // Accept both slugs and names
    const fromSlug = CATEGORY_SLUG_MAP[value.toLowerCase()];
    if (fromSlug) return fromSlug;

    const found = SERVICE_CATEGORIES.find(
      cat => cat.toLowerCase() === value.toLowerCase()
    );
    if (found) return found;

    return helpers.error('any.invalid');
  })
});

export const validateSearchQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = searchQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errorMessages,
      timestamp: new Date().toISOString()
    });
    return;
  }

  req.query = value;
  next();
};

export const validateSuggestionQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = suggestionQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errorMessages,
      timestamp: new Date().toISOString()
    });
    return;
  }

  req.query = value;
  next();
};

export const validateCategoryParam = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = categoryParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errorMessages,
      timestamp: new Date().toISOString()
    });
    return;
  }

  req.params = value;
  next();
};

export const validateServiceId = (req: Request, res: Response, next: NextFunction): void => {
  const serviceIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();

  const { error } = serviceIdSchema.validate(req.params.id);

  if (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid service ID format',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};
