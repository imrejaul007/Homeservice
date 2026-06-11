import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import CallbackRequest from '../models/callbackRequest.model';
import { crmWebhookService } from '../services/crmWebhook.service';
import logger from '../utils/logger';

// Use 'any' to avoid conflict with auth middleware's user type
type AuthRequest = Request & { user?: { _id: { toString(): string }; firstName?: string; lastName?: string; email?: string } };

export const createCallbackRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?._id) throw new ApiError(401, 'Authentication required');

  const { phoneNumber, preferredTime, alternateTime, reason, category } = req.body;
  const requestId = await CallbackRequest.generateRequestId();
  const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

  const callback = await CallbackRequest.create({
    requestId,
    userId: req.user._id,
    userName,
    userEmail: req.user.email,
    phoneNumber,
    preferredTime: new Date(preferredTime),
    alternateTime: alternateTime ? new Date(alternateTime) : undefined,
    reason,
    category: category || 'general',
    status: 'pending',
  });

  await crmWebhookService.callbackRequested({
    requestId,
    userId: req.user._id.toString(),
    phoneNumber,
    category: category || 'general',
    preferredTime,
  });

  logger.info('Callback request created', {
    requestId,
    userId: req.user._id,
    action: 'CALLBACK_REQUEST_CREATED',
  });

  res.status(201).json({
    success: true,
    data: { requestId: callback.requestId },
    message: 'Callback request submitted. We will call you at your preferred time.',
  });
});

export const getMyCallbackRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?._id) throw new ApiError(401, 'Authentication required');

  const requests = await CallbackRequest.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({ success: true, data: { requests } });
});

export const getAdminCallbackRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_answer'];
  if (status && validStatuses.includes(status)) {
    query.status = status;
  }

  const [requests, total] = await Promise.all([
    CallbackRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CallbackRequest.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    },
  });
});

export const updateCallbackStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { requestId } = req.params;
  const { status, notes, assignedAgentName } = req.body;

  const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_answer'];
  if (!status || !validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const callback = await CallbackRequest.findOne({ requestId });
  if (!callback) {
    throw new ApiError(404, 'Callback request not found');
  }

  callback.status = status;
  if (notes) callback.notes = notes;
  if (assignedAgentName) callback.assignedAgentName = assignedAgentName;
  if (req.user?._id) callback.assignedAgentId = req.user._id as unknown as typeof callback.assignedAgentId;
  if (status === 'completed') callback.completedAt = new Date();
  if (status === 'scheduled' && !callback.scheduledAt) {
    callback.scheduledAt = callback.preferredTime;
  }

  await callback.save();

  logger.info('Callback status updated', {
    requestId,
    status,
    action: 'CALLBACK_STATUS_UPDATED',
  });

  res.json({ success: true, data: callback });
});
