import express from 'express';
import mongoose from 'mongoose';
import Service from '../models/service.model';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';

const router = express.Router();

/**
 * POST /api/batch/services
 * Batch fetch services by IDs (for efficient loading of service lists)
 */
router.post(
  '/services',
  authenticate,
  asyncHandler(async (req, res) => {
    const schema = Joi.object({
      ids: Joi.array().items(Joi.string()).min(1).max(100).required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
      return;
    }

    const { ids } = value;

    // Validate all IDs are valid ObjectIds
    const invalidIds = ids.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        details: invalidIds,
      });
      return;
    }

    // Fetch all services in one query
    const services = await Service.find({
      _id: { $in: ids },
      isActive: true,
    })
      .select(
        'name shortDescription price duration category providerId images rating featured serviceOptions'
      )
      .populate('category', 'name')
      .populate('providerId', 'firstName lastName avatar')
      .lean();

    // Return in the same order as requested
    const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));
    const orderedServices = ids
      .map((id: string) => serviceMap.get(id))
      .filter(Boolean);

    res.json({
      success: true,
      data: orderedServices,
      count: orderedServices.length,
    });
  })
);

/**
 * POST /api/batch/providers
 * Batch fetch providers by IDs
 */
router.post(
  '/providers',
  authenticate,
  asyncHandler(async (req, res) => {
    const schema = Joi.object({
      ids: Joi.array().items(Joi.string()).min(1).max(100).required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
      return;
    }

    const { ids } = value;

    // Validate all IDs
    const invalidIds = ids.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        details: invalidIds,
      });
      return;
    }

    // Fetch all providers
    const User = mongoose.model('User');
    const providers = await User.find({
      _id: { $in: ids },
    })
      .select('firstName lastName avatar email phone')
      .lean();

    // Return in order
    const providerMap = new Map(providers.map((p: any) => [p._id.toString(), p]));
    const orderedProviders = ids
      .map((id: string) => providerMap.get(id))
      .filter(Boolean);

    res.json({
      success: true,
      data: orderedProviders,
      count: orderedProviders.length,
    });
  })
);

export default router;
