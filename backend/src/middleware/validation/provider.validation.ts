import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import ServiceCategory from '../../models/serviceCategory.model';
import type { IServiceCategory } from '../../models/serviceCategory.model';

// Service creation validation schema
const serviceCreationSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Service name must be at least 3 characters',
      'string.max': 'Service name cannot exceed 100 characters',
      'any.required': 'Service name is required'
    }),
  
  category: Joi.alternatives()
    .try(
      Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
        'string.pattern.base': 'Category ID must be a valid ObjectId (24 hex characters)'
      }),
      Joi.string().min(1).max(100).messages({
        'string.min': 'Category name is required',
        'string.max': 'Category name cannot exceed 100 characters'
      })
    )
    .required()
    .messages({
      'any.required': 'Service category is required',
    }),
  
  subcategory: Joi.string().max(50).optional(),
  
  description: Joi.string()
    .min(50)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Description must be at least 50 characters',
      'string.max': 'Description cannot exceed 1000 characters',
      'any.required': 'Service description is required'
    }),
  
  shortDescription: Joi.string().max(150).optional(),
  
  // Pricing validation
  price: Joi.object({
    amount: Joi.when('type', {
      is: 'custom',
      then: Joi.number().min(0).max(10000).default(0),
      otherwise: Joi.number()
        .positive()
        .max(10000)
        .required()
        .messages({
          'number.positive': 'Price must be a positive number',
          'number.max': 'Price cannot exceed $10,000',
          'any.required': 'Price amount is required',
        }),
    }),
    currency: Joi.string().valid('AED', 'INR', 'USD', 'EUR', 'GBP').default('AED'),
    type: Joi.string()
      .valid('fixed', 'hourly', 'custom')
      .required()
      .messages({
        'any.only': 'Price type must be fixed, hourly, or custom',
        'any.required': 'Price type is required'
      }),
    discounts: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('bulk', 'seasonal', 'loyalty', 'first_time'),
        percentage: Joi.number().min(1).max(50),
        minQuantity: Joi.number().positive().optional(),
        validFrom: Joi.date().optional(),
        validTo: Joi.date().optional().custom((value, helpers) => {
          const validFrom = helpers.state.ancestors[0].validFrom;
          if (validFrom && value && new Date(value) <= new Date(validFrom)) {
            return helpers.error('date.lessThanValidFrom');
          }
          return value;
        }).messages({
          'date.lessThanValidFrom': 'validTo date must be after validFrom date'
        })
      })
    ).optional()
  }).required(),
  
  duration: Joi.number()
    .positive()
    .max(480) // 8 hours max
    .required()
    .messages({
      'number.positive': 'Duration must be a positive number',
      'number.max': 'Duration cannot exceed 480 minutes (8 hours)',
      'any.required': 'Service duration is required'
    }),
  
  tags: Joi.array().items(Joi.string().max(30)).max(10).optional(),
  requirements: Joi.array().items(Joi.string().max(200)).max(10).optional(),
  includedItems: Joi.array().items(Joi.string().max(200)).max(15).optional(),
  
  addOns: Joi.array().items(
    Joi.object({
      name: Joi.string().max(100).required(),
      price: Joi.number().positive().required(),
      description: Joi.string().max(300).optional()
    })
  ).max(10).optional(),
  
  // Location validation (optional - inherited from provider profile)
  location: Joi.object({
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required(),
      country: Joi.string().default('AE')
    }).required(),
    coordinates: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).required()
        .custom((value, helpers) => {
          const [longitude, latitude] = value;
          if (longitude < -180 || longitude > 180) {
            return helpers.error('any.custom', { message: 'Longitude must be between -180 and 180' });
          }
          if (latitude < -90 || latitude > 90) {
            return helpers.error('any.custom', { message: 'Latitude must be between -90 and 90' });
          }
          return value;
        })
        .messages({
          'any.custom': 'Invalid coordinates: {{#message}}'
        })
    }).required(),
    serviceArea: Joi.object({
      type: Joi.string().valid('radius', 'city', 'state').default('radius'),
      value: Joi.number().positive().default(25),
      maxDistance: Joi.number().positive().max(100).default(25)
    }).optional()
  }).optional(), // Made optional since we inherit from provider profile
  
  // Availability validation
  availability: Joi.object({
    schedule: Joi.object().pattern(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
      Joi.object({
        isAvailable: Joi.boolean().default(true),
        timeSlots: Joi.array().items(Joi.string()).optional()
      })
    ).optional(),
    instantBooking: Joi.boolean().default(false),
    advanceBookingDays: Joi.number().min(1).max(365).default(30)
  }).optional(),
  
  status: Joi.string().valid('draft', 'active', 'inactive').default('active')
});

// Service update validation schema (all fields optional except some restrictions)
const serviceUpdateSchema = serviceCreationSchema
  .fork(['name', 'category', 'description', 'price', 'duration', 'location'], (schema) => schema.optional())
  .fork(['status'], () =>
    Joi.string().valid('draft', 'active', 'inactive', 'pending_review').optional()
  );

// Service ID validation
const serviceIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid service ID format',
      'any.required': 'Service ID is required'
    })
});

// Validation middleware functions
export const validateServiceCreation = async (req: Request, _res: Response, next: NextFunction) => {
  const { error, value } = serviceCreationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({ field: detail.path.join('.'), message: detail.message }));
    throw new ApiError(400, 'Service creation validation failed', errorDetails);
  }

  // Validate that the category exists in the database
  if (value.category) {
    const categoryExists = await ServiceCategory.findById(value.category);
    if (!categoryExists) {
      throw new ApiError(400, `Category with ID ${value.category} does not exist`);
    }
  }

  req.body = value;
  next();
};

export const validateServiceUpdate = (req: Request, _res: Response, next: NextFunction) => {
  const { error, value } = serviceUpdateSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorDetails = error.details.map(detail => ({ field: detail.path.join('.'), message: detail.message }));
    throw new ApiError(400, 'Service update validation failed', errorDetails);
  }
  
  req.body = value;
  next();
};

export const validateServiceId = (req: Request, _res: Response, next: NextFunction) => {
  const { error } = serviceIdSchema.validate({ id: req.params.id });
  
  if (error) {
    throw new ApiError(400, 'Invalid service ID');
  }
  
  next();
};