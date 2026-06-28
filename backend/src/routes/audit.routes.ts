import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import AuditLog from '../models/auditLog.model';
import Joi from 'joi';

const router = Router();

// Validation schemas
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.string().optional(),
  action: Joi.string().optional(),
  resource: Joi.string().optional(),
  resourceId: Joi.string().optional(),
  status: Joi.string().valid('success', 'failure').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

// Create audit log schema
const createSchema = Joi.object({
  action: Joi.string().required(),
  resource: Joi.string().required(),
  resourceId: Joi.string().optional(),
  description: Joi.string().optional(),
  oldValue: Joi.object().optional(),
  newValue: Joi.object().optional(),
  status: Joi.string().valid('success', 'failure').default('success'),
  metadata: Joi.object().optional(),
});

// All audit routes require admin authentication
router.use(authenticate);
router.use(requireRole('admin'));

// POST /audit - Create a new audit log entry
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createSchema.validate(req.body);
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

  const {
    action,
    resource,
    resourceId,
    description,
    oldValue,
    newValue,
    status,
    metadata,
  } = value;

  // Get user from auth middleware
  const userId = (req as any).user?.id;

  // Get IP address
  const ipAddress = req.ip || req.socket.remoteAddress;

  const auditLog = new AuditLog({
    userId,
    action,
    resource,
    resourceId,
    description,
    oldValue,
    newValue,
    status: status || 'success',
    ipAddress,
    userAgent: req.get('User-Agent'),
    metadata,
  });

  await auditLog.save();

  res.status(201).json({
    success: true,
    data: auditLog,
  });
}));

// GET /audit - List audit logs with filtering and pagination
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = querySchema.validate(req.query);
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

  const {
    page,
    limit,
    userId,
    action,
    resource,
    resourceId,
    status,
    startDate,
    endDate,
  } = value;

  // Build query filter
  const filter: Record<string, any> = {};

  if (userId) filter.userId = userId;
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (resource) filter.resource = { $regex: resource, $options: 'i' };
  if (resourceId) filter.resourceId = resourceId;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
  });
}));

// GET /audit/stats - Get audit log statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);

  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);

  // Get counts for different time periods
  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    AuditLog.countDocuments({ createdAt: { $gte: today } }),
    AuditLog.countDocuments({ createdAt: { $gte: last7Days } }),
    AuditLog.countDocuments({ createdAt: { $gte: last30Days } }),
    AuditLog.countDocuments({}),
  ]);

  // Get status breakdown
  const statusBreakdown = await AuditLog.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get top actions
  const topActions = await AuditLog.aggregate([
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Get top resources
  const topResources = await AuditLog.aggregate([
    {
      $group: {
        _id: '$resource',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.json({
    success: true,
    data: {
      counts: {
        today: todayCount,
        week: weekCount,
        month: monthCount,
        total: totalCount,
      },
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      topActions: topActions.map(item => ({
        action: item._id,
        count: item.count,
      })),
      topResources: topResources.map(item => ({
        resource: item._id,
        count: item.count,
      })),
    },
  });
}));

// GET /audit/export - Export audit logs (CSV format)
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = querySchema.validate(req.query);
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

  const { userId, action, resource, resourceId, status, startDate, endDate } = value;

  // Build filter (without pagination for export)
  const filter: Record<string, any> = {};
  if (userId) filter.userId = userId;
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (resource) filter.resource = { $regex: resource, $options: 'i' };
  if (resourceId) filter.resourceId = resourceId;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const logs = await AuditLog.find(filter)
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(10000)
    .lean();

  // Generate CSV
  const headers = ['ID', 'User', 'Action', 'Resource', 'Resource ID', 'Status', 'IP Address', 'Created At'];
  const rows = logs.map(log => [
    log._id.toString(),
    (log.userId as any)?.email || 'Unknown',
    log.action,
    log.resource,
    log.resourceId || '',
    log.status,
    log.ipAddress || '',
    log.createdAt.toISOString(),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
}));

// GET /audit/user/:userId - Get audit logs for a specific user
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    AuditLog.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments({ userId: req.params.userId }),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    },
  });
}));

// GET /audit/resource/:resource/:resourceId - Get audit logs for a specific resource
router.get('/resource/:resource/:resourceId', asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    AuditLog.find({
      resource: req.params.resource,
      resourceId: req.params.resourceId,
    })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments({
      resource: req.params.resource,
      resourceId: req.params.resourceId,
    }),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    },
  });
}));

export default router;
