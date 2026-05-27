import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import ApiKey, { IApiKeyModel } from '../models/apiKey.model';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createApiKeySchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  permissions: Joi.array().items(
    Joi.string().valid('read', 'write', 'delete', 'admin', 'analytics', 'webhooks')
  ).min(1).required(),
  expiresAt: Joi.date().iso().greater('now').optional(),
  rateLimit: Joi.number().integer().min(1).max(10000).default(100),
});

const updateApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  permissions: Joi.array().items(
    Joi.string().valid('read', 'write', 'delete', 'admin', 'analytics', 'webhooks')
  ).min(1).optional(),
  expiresAt: Joi.date().iso().optional().allow(null),
  rateLimit: Joi.number().integer().min(1).max(10000).optional(),
  isActive: Joi.boolean().optional(),
});

// All API key routes require authentication
router.use(authenticate);

// GET /api-keys - List all API keys for current user
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const apiKeys = await ApiKey.find({ userId: (req as any).user.id })
    .select('-keyHash')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      apiKeys,
      total: apiKeys.length,
    },
  });
}));

// GET /api-keys/:id - Get specific API key details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const apiKey = await ApiKey.findOne({
    _id: req.params.id,
    userId: (req as any).user.id,
  }).select('-keyHash');

  if (!apiKey) {
    res.status(404).json({
      success: false,
      error: 'API key not found',
    });
    return;
  }

  res.json({
    success: true,
    data: apiKey,
  });
}));

// POST /api-keys - Create a new API key
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createApiKeySchema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
    return;
  }

  // Generate the API key
  const { plainKey, keyHash, keyPrefix } = (ApiKey as unknown as IApiKeyModel).generateKey();

  const apiKey = new ApiKey({
    name: value.name,
    keyPrefix,
    keyHash,
    userId: (req as any).user.id,
    permissions: value.permissions,
    expiresAt: value.expiresAt,
    rateLimit: value.rateLimit,
    createdBy: (req as any).user.id,
  });

  await apiKey.save();

  res.status(201).json({
    success: true,
    message: 'API key created successfully. Store this key securely - it will not be shown again.',
    data: {
      id: apiKey._id,
      name: apiKey.name,
      key: plainKey,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    },
  });
}));

// PATCH /api-keys/:id - Update an API key
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateApiKeySchema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
    return;
  }

  const apiKey = await ApiKey.findOne({
    _id: req.params.id,
    userId: (req as any).user.id,
  });

  if (!apiKey) {
    res.status(404).json({
      success: false,
      error: 'API key not found',
    });
    return;
  }

  // Update allowed fields
  if (value.name !== undefined) apiKey.name = value.name;
  if (value.permissions !== undefined) apiKey.permissions = value.permissions;
  if (value.expiresAt !== undefined) apiKey.expiresAt = value.expiresAt;
  if (value.rateLimit !== undefined) apiKey.rateLimit = value.rateLimit;
  if (value.isActive !== undefined) apiKey.isActive = value.isActive;

  await apiKey.save();

  res.json({
    success: true,
    message: 'API key updated successfully',
    data: apiKey,
  });
}));

// DELETE /api-keys/:id - Delete an API key
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const apiKey = await ApiKey.findOneAndDelete({
    _id: req.params.id,
    userId: (req as any).user.id,
  });

  if (!apiKey) {
    res.status(404).json({
      success: false,
      error: 'API key not found',
    });
    return;
  }

  res.json({
    success: true,
    message: 'API key deleted successfully',
  });
}));

// POST /api-keys/:id/regenerate - Regenerate an API key
router.post('/:id/regenerate', asyncHandler(async (req: Request, res: Response) => {
  const apiKey = await ApiKey.findOne({
    _id: req.params.id,
    userId: (req as any).user.id,
  });

  if (!apiKey) {
    res.status(404).json({
      success: false,
      error: 'API key not found',
    });
    return;
  }

  // Generate new key
  const { plainKey, keyHash, keyPrefix } = (ApiKey as unknown as IApiKeyModel).generateKey();

  apiKey.keyPrefix = keyPrefix;
  apiKey.keyHash = keyHash;
  await apiKey.save();

  res.json({
    success: true,
    message: 'API key regenerated successfully. Store this key securely - it will not be shown again.',
    data: {
      id: apiKey._id,
      name: apiKey.name,
      key: plainKey,
      keyPrefix: apiKey.keyPrefix,
    },
  });
}));

// POST /api-keys/:id/revoke - Revoke an API key (deactivate)
router.post('/:id/revoke', asyncHandler(async (req: Request, res: Response) => {
  const apiKey = await ApiKey.findOne({
    _id: req.params.id,
    userId: (req as any).user.id,
  });

  if (!apiKey) {
    res.status(404).json({
      success: false,
      error: 'API key not found',
    });
    return;
  }

  apiKey.isActive = false;
  await apiKey.save();

  res.json({
    success: true,
    message: 'API key revoked successfully',
  });
}));

export default router;
