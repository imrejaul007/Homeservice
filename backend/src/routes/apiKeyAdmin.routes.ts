import { Router, Request, Response } from 'express';
import AdminApiKey, { IAdminApiKeyModel } from '../models/adminApiKey.model';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const createApiKeySchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().max(500).optional(),
  permissions: Joi.array()
    .items(
      Joi.string().valid(
        'read',
        'write',
        'delete',
        'admin',
        'analytics',
        'webhooks',
        'broadcast',
        'coupons'
      )
    )
    .min(1)
    .required(),
  expiresAt: Joi.date().iso().greater('now').optional(),
  rateLimit: Joi.number().integer().min(1).max(10000).default(100),
});

const updateApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  permissions: Joi.array()
    .items(
      Joi.string().valid(
        'read',
        'write',
        'delete',
        'admin',
        'analytics',
        'webhooks',
        'broadcast',
        'coupons'
      )
    )
    .min(1)
    .optional(),
  expiresAt: Joi.date().iso().allow(null).optional(),
  rateLimit: Joi.number().integer().min(1).max(10000).optional(),
  isActive: Joi.boolean().optional(),
});

// ============================================
// Controllers
// ============================================

/**
 * POST /api/admin/api-keys
 * Create a new admin API key
 */
export const createApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createApiKeySchema.validate(req.body);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Generate the API key
  const { plainKey, keyHash, keyPrefix } = (AdminApiKey as unknown as IAdminApiKeyModel).generateKey();

  const apiKey = new AdminApiKey({
    name: value.name,
    description: value.description,
    keyPrefix,
    keyHash,
    permissions: value.permissions,
    expiresAt: value.expiresAt,
    rateLimit: value.rateLimit,
    isActive: true,
    createdBy: (req as any).user._id,
  });

  await apiKey.save();

  logger.info('Admin API key created', {
    action: 'ADMIN_API_KEY_CREATED',
    apiKeyId: apiKey._id,
    name: apiKey.name,
    permissions: apiKey.permissions,
    createdBy: (req as any).user._id,
  });

  res.status(201).json({
    success: true,
    message: 'API key created successfully. Store this key securely - it will not be shown again.',
    data: {
      id: apiKey._id,
      name: apiKey.name,
      description: apiKey.description,
      key: plainKey,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    },
  });
});

/**
 * GET /api/admin/api-keys
 * List all admin API keys
 */
export const getAllApiKeys = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build filter
  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === 'asc' ? 1 : -1,
  };

  const [apiKeys, total] = await Promise.all([
    AdminApiKey.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'firstName lastName email'),
    AdminApiKey.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      apiKeys,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * GET /api/admin/api-keys/:id
 * Get a specific API key by ID
 */
export const getApiKeyById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid API key ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const apiKey = await AdminApiKey.findById(id)
    .select('-keyHash')
    .populate('createdBy', 'firstName lastName email');

  if (!apiKey) {
    throw ApiError.notFound('API key not found', ERROR_CODES.NOT_FOUND);
  }

  res.json({
    success: true,
    data: { apiKey },
  });
});

/**
 * PATCH /api/admin/api-keys/:id
 * Update an API key
 */
export const updateApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid API key ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const { error, value } = updateApiKeySchema.validate(req.body);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const apiKey = await AdminApiKey.findByIdAndUpdate(
    id,
    { $set: value },
    { new: true, runValidators: true }
  ).select('-keyHash').populate('createdBy', 'firstName lastName email');

  if (!apiKey) {
    throw ApiError.notFound('API key not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Admin API key updated', {
    action: 'ADMIN_API_KEY_UPDATED',
    apiKeyId: apiKey._id,
    name: apiKey.name,
    updatedBy: (req as any).user._id,
    fields: Object.keys(value),
  });

  res.json({
    success: true,
    message: 'API key updated successfully',
    data: { apiKey },
  });
});

/**
 * DELETE /api/admin/api-keys/:id
 * Delete an API key
 */
export const deleteApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid API key ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const apiKey = await AdminApiKey.findByIdAndDelete(id);

  if (!apiKey) {
    throw ApiError.notFound('API key not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Admin API key deleted', {
    action: 'ADMIN_API_KEY_DELETED',
    apiKeyId: id,
    name: apiKey.name,
    deletedBy: (req as any).user._id,
  });

  res.json({
    success: true,
    message: 'API key deleted successfully',
  });
});

/**
 * POST /api/admin/api-keys/:id/regenerate
 * Regenerate an API key (creates a new key value, keeps same metadata)
 */
export const regenerateApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid API key ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const apiKey = await AdminApiKey.findById(id);

  if (!apiKey) {
    throw ApiError.notFound('API key not found', ERROR_CODES.NOT_FOUND);
  }

  // Generate new key
  const { plainKey, keyHash, keyPrefix } = (AdminApiKey as unknown as IAdminApiKeyModel).generateKey();

  apiKey.keyPrefix = keyPrefix;
  apiKey.keyHash = keyHash;
  await apiKey.save();

  logger.info('Admin API key regenerated', {
    action: 'ADMIN_API_KEY_REGENERATED',
    apiKeyId: apiKey._id,
    name: apiKey.name,
    regeneratedBy: (req as any).user._id,
  });

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
});

/**
 * POST /api/admin/api-keys/:id/toggle
 * Toggle API key active status
 */
export const toggleApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid API key ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const apiKey = await AdminApiKey.findById(id);

  if (!apiKey) {
    throw ApiError.notFound('API key not found', ERROR_CODES.NOT_FOUND);
  }

  apiKey.isActive = !apiKey.isActive;
  await apiKey.save();

  logger.info('Admin API key toggled', {
    action: 'ADMIN_API_KEY_TOGGLED',
    apiKeyId: apiKey._id,
    name: apiKey.name,
    isActive: apiKey.isActive,
    toggledBy: (req as any).user._id,
  });

  res.json({
    success: true,
    message: `API key ${apiKey.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { apiKey },
  });
});

/**
 * GET /api/admin/api-keys/stats
 * Get API key statistics
 */
export const getApiKeyStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await AdminApiKey.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        expiringSoon: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$expiresAt', null] },
                  {
                    $lte: [
                      '$expiresAt',
                      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    ],
                  },
                  { $gt: ['$expiresAt', new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const result = stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    expiringSoon: 0,
  };

  res.json({
    success: true,
    data: {
      stats: {
        total: result.total,
        active: result.active,
        inactive: result.inactive,
        expiringSoon: result.expiringSoon,
      },
    },
  });
});

// ============================================
// Routes
// ============================================

// All admin API key routes require authentication, admin role, and rate limiting
router.use(authenticate);
router.use(requireRole('admin'));
router.use(adminLimiter);

/**
 * GET /api/admin/api-keys/stats
 * Get API key statistics
 */
router.get('/stats', getApiKeyStats);

/**
 * GET /api/admin/api-keys
 * List all API keys
 */
router.get('/', getAllApiKeys);

/**
 * POST /api/admin/api-keys
 * Create a new API key
 */
router.post('/', createApiKey);

/**
 * GET /api/admin/api-keys/:id
 * Get a specific API key
 */
router.get('/:id', getApiKeyById);

/**
 * PATCH /api/admin/api-keys/:id
 * Update an API key
 */
router.patch('/:id', updateApiKey);

/**
 * DELETE /api/admin/api-keys/:id
 * Delete an API key
 */
router.delete('/:id', deleteApiKey);

/**
 * POST /api/admin/api-keys/:id/regenerate
 * Regenerate an API key
 */
router.post('/:id/regenerate', regenerateApiKey);

/**
 * POST /api/admin/api-keys/:id/toggle
 * Toggle API key active status
 */
router.post('/:id/toggle', toggleApiKey);

export default router;
