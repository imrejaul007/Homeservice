import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { contactService } from '../services/contact.service';
import { ContactSubject } from '../models/contactSubmission.model';
import { UserType } from '../models/supportTicket.model';
import logger from '../utils/logger';

// Use 'any' to avoid conflict with auth middleware's user type
type AuthRequest = Request & { user?: { _id: { toString(): string }; firstName?: string; lastName?: string; email?: string; role?: string } };

export const getContactConfig = asyncHandler(async (req: Request, res: Response) => {
  const region = (req.query.region as string) || req.headers['x-user-region'] as string | undefined;
  const config = await contactService.getPublicConfig(region);

  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json({ success: true, data: config });
});

export const submitContactForm = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, email, subject, message, website } = req.body;

  if (website?.trim()) {
    logger.warn('Honeypot triggered on contact form', {
      ip: req.ip,
      action: 'CONTACT_HONEYPOT_TRIGGERED',
    });
    res.json({
      success: true,
      data: {
        submissionId: 'PENDING',
        estimatedResponseHours: 24,
      },
      message: 'Thank you for your message. We will get back to you soon.',
    });
    return;
  }

  try {
    const userId = req.user?._id;
    const userType = (req.user?.role as UserType) || undefined;
    const userName = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
      : undefined;

    const result = await contactService.submitContactForm({
      name,
      email,
      subject: subject as ContactSubject,
      message,
      website,
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      userType,
      userName,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      source: 'contact_page',
    });

    res.status(201).json({
      success: true,
      data: {
        submissionId: result.submissionId,
        ticketNumber: result.ticketNumber,
        department: result.department,
        estimatedResponseHours: result.estimatedResponseHours,
        isDuplicate: result.isDuplicate,
      },
      message: result.isDuplicate
        ? 'We already received your message and are working on it.'
        : 'Thank you for contacting us. A confirmation has been sent to your email.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Submission failed';
    throw new ApiError(400, message);
  }
});
