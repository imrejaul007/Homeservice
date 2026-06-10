import { Router } from 'express';
import Joi from 'joi';
import { optionalAuth } from '../middleware/auth.middleware';
import { contactFormLimiter } from '../middleware/rateLimiter';
import { getContactConfig, submitContactForm } from '../controllers/contact.controller';

const router = Router();

const submitContactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().max(254).required(),
  subject: Joi.string()
    .valid('booking', 'payment', 'refund', 'provider', 'suggestion', 'other')
    .required(),
  message: Joi.string().trim().min(20).max(5000).required(),
  website: Joi.string().max(0).allow('').optional(),
});

const validateSubmit = (req: any, res: any, next: any) => {
  const { error, value } = submitContactSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }
  req.body = value;
  next();
};

router.get('/config', getContactConfig);
router.post('/submit', contactFormLimiter, optionalAuth, validateSubmit, submitContactForm);

export default router;
