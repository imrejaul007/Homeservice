import Joi from 'joi';

const budgetSchema = Joi.object({
  total: Joi.number().min(1).required(),
  daily: Joi.number().min(1).optional(),
  monthly: Joi.number().min(1).optional(),
});

const contentSchema = Joi.object({
  title: Joi.string().trim().min(1).max(60).required(),
  description: Joi.string().trim().min(1).max(200).required(),
  imageUrl: Joi.string().uri().allow('').optional(),
  ctaText: Joi.string().trim().max(20).optional(),
  landingUrl: Joi.string().uri().optional(),
});

export const createProviderAdSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).allow('').optional(),
  budget: budgetSchema.required(),
  bidAmount: Joi.number().min(0).optional(),
  bidType: Joi.string().valid('cpc', 'cpm', 'fixed').optional(),
  content: contentSchema.required(),
  targeting: Joi.object().optional(),
  relatedServiceIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  limits: Joi.object().optional(),
  scheduling: Joi.object().optional(),
  priority: Joi.number().integer().min(0).max(100).optional(),
});

export const updateProviderAdSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).allow('').optional(),
  budget: budgetSchema.optional(),
  bidAmount: Joi.number().min(0).optional(),
  bidType: Joi.string().valid('cpc', 'cpm', 'fixed').optional(),
  content: contentSchema.optional(),
  targeting: Joi.object().optional(),
  relatedServiceIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  limits: Joi.object().optional(),
  scheduling: Joi.object().optional(),
  priority: Joi.number().integer().min(0).max(100).optional(),
}).min(1);

export const validateCreateProviderAd = (req: any, res: any, next: any) => {
  const { error, value } = createProviderAdSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join(', '),
    });
  }
  req.body = value;
  next();
};

export const validateUpdateProviderAd = (req: any, res: any, next: any) => {
  const { error, value } = updateProviderAdSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join(', '),
    });
  }
  req.body = value;
  next();
};
