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
