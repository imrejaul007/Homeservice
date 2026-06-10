import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { inboundEmailService } from '../services/inboundEmail.service';
import logger from '../utils/logger';

/**
 * Generic inbound email webhook (Resend, SendGrid, Mailgun compatible shape).
 * POST /api/webhooks/inbound-email
 */
export const handleInboundEmail = asyncHandler(async (req: Request, res: Response) => {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    throw new ApiError(401, 'Invalid webhook secret');
  }

  const {
    from,
    fromName,
    to,
    subject,
    text,
    html,
    textBody,
    htmlBody,
    messageId,
    inReplyTo,
    references,
  } = req.body;

  const sender = from || req.body.sender;
  const recipient = to || req.body.recipient;

  if (!sender || !recipient) {
    throw new ApiError(400, 'Missing from/to fields');
  }

  const result = await inboundEmailService.processInboundEmail({
    from: sender,
    fromName: fromName || req.body.from_name,
    to: recipient,
    subject: subject || '(No subject)',
    textBody: text || textBody || html || htmlBody || '',
    htmlBody: html || htmlBody,
    messageId,
    inReplyTo,
    references,
  });

  res.status(201).json({
    success: true,
    data: result,
    message: 'Inbound email processed',
  });
});

export const verifyInboundWebhook = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Inbound email webhook active' });
});
