import { Request, Response } from 'express';
import Newsletter from '../models/newsletter.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { sendNewsletterWelcomeEmail } from '../services/email.service';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

interface SubscribeBody {
  email: string;
  source?: string;
}

interface UnsubscribeBody {
  email: string;
  token?: string;
}

// ============================================
// Validation Helpers
// ============================================

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ============================================
// Subscribe to Newsletter
// ============================================

export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, source = 'footer' } = req.body as SubscribeBody;

    // Validate email
    if (!email) {
      throw ApiError.badRequest('Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      throw ApiError.badRequest('Please provide a valid email address');
    }

    // Check if already subscribed
    const existing = await Newsletter.findByEmail(normalizedEmail);

    if (existing) {
      if (existing.status === 'active') {
        res.status(200).json({
          success: true,
          message: 'You are already subscribed to our newsletter!',
          alreadySubscribed: true,
        });
        return;
      }

      if (existing.status === 'unsubscribed') {
        // Re-subscribe
        existing.status = 'active';
        existing.subscribedAt = new Date();
        existing.source = source;
        existing.ipAddress = req.ip || req.socket.remoteAddress;
        existing.userAgent = req.get('user-agent');
        await existing.save();

        res.status(200).json({
          success: true,
          message: 'Welcome back! You have been re-subscribed to our newsletter.',
          reactivated: true,
        });
        return;
      }

      if (existing.status === 'bounced' || existing.status === 'complained') {
        throw ApiError.badRequest(
          'This email address has issues. Please contact support if you believe this is an error.'
        );
      }
    }

    // Create new subscription
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const subscription = new Newsletter({
      email: normalizedEmail,
      status: 'active',
      source,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      emailVerified: false,
      verificationToken,
    });

    await subscription.save();

    // Send welcome email asynchronously (don't block the response)
    sendNewsletterWelcomeEmail(normalizedEmail, verificationToken).catch((err) => {
      logger.error('Failed to send newsletter welcome email:', err);
    });

    logger.info(`Newsletter subscription created for: ${normalizedEmail}`);

    res.status(201).json({
      success: true,
      message: 'Thank you for subscribing! Check your inbox for a confirmation email.',
      email: normalizedEmail,
    });
  } catch (error) {
    logger.error('Newsletter subscription error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    // Handle duplicate key error (race condition)
    if ((error as any).code === 11000) {
      res.status(200).json({
        success: true,
        message: 'You are already subscribed to our newsletter!',
        alreadySubscribed: true,
      });
      return;
    }

    throw ApiError.internal('Failed to process subscription. Please try again.');
  }
};

// ============================================
// Unsubscribe from Newsletter
// ============================================

export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, token } = req.body as UnsubscribeBody;

    if (!email) {
      throw ApiError.badRequest('Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      throw ApiError.badRequest('Please provide a valid email address');
    }

    const subscription = await Newsletter.findByEmail(normalizedEmail);

    if (!subscription) {
      // Don't reveal if email exists
      res.status(200).json({
        success: true,
        message: 'You have been unsubscribed from our newsletter.',
      });
      return;
    }

    if (subscription.status === 'unsubscribed') {
      res.status(200).json({
        success: true,
        message: 'You are already unsubscribed from our newsletter.',
      });
      return;
    }

    // Verify token if provided (security check)
    if (token && subscription.verificationToken !== token) {
      throw ApiError.unauthorized('Invalid unsubscribe token');
    }

    subscription.status = 'unsubscribed';
    subscription.unsubscribedAt = new Date();
    await subscription.save();

    logger.info(`Newsletter unsubscription for: ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'You have been unsubscribed from our newsletter. We\'ll miss you!',
    });
  } catch (error) {
    logger.error('Newsletter unsubscription error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.internal('Failed to process unsubscription. Please try again.');
  }
};

// ============================================
// Verify Email
// ============================================

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      throw ApiError.badRequest('Verification token is required');
    }

    const subscription = await Newsletter.findOne({ verificationToken: token });

    if (!subscription) {
      throw ApiError.notFound('Invalid or expired verification token');
    }

    if (subscription.emailVerified) {
      res.status(200).json({
        success: true,
        message: 'Your email has already been verified.',
      });
      return;
    }

    subscription.emailVerified = true;
    subscription.lastEngagementAt = new Date();
    await subscription.save();

    logger.info(`Newsletter email verified for: ${subscription.email}`);

    res.status(200).json({
      success: true,
      message: 'Your email has been successfully verified!',
    });
  } catch (error) {
    logger.error('Newsletter email verification error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.internal('Failed to verify email. Please try again.');
  }
};

// ============================================
// Check Subscription Status (Admin)
// ============================================

export const checkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      throw ApiError.badRequest('Email query parameter is required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const subscription = await Newsletter.findByEmail(normalizedEmail);

    if (!subscription) {
      res.status(200).json({
        subscribed: false,
        status: null,
      });
      return;
    }

    res.status(200).json({
      subscribed: subscription.status === 'active',
      status: subscription.status,
      subscribedAt: subscription.subscribedAt,
      emailVerified: subscription.emailVerified,
    });
  } catch (error) {
    logger.error('Newsletter status check error:', error);
    throw ApiError.internal('Failed to check subscription status');
  }
};

// ============================================
// Get Subscriber Stats (Admin)
// ============================================

export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const totalSubscribers = await Newsletter.countDocuments({ status: 'active' });
    const totalUnsubscribed = await Newsletter.countDocuments({ status: 'unsubscribed' });
    const totalBounced = await Newsletter.countDocuments({ status: 'bounced' });
    const verifiedEmails = await Newsletter.countDocuments({ status: 'active', emailVerified: true });
    const unverifiedEmails = await Newsletter.countDocuments({ status: 'active', emailVerified: false });

    // Growth stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newSubscribers = await Newsletter.countDocuments({
      status: 'active',
      subscribedAt: { $gte: thirtyDaysAgo },
    });

    const unsubscribedLast30Days = await Newsletter.countDocuments({
      status: 'unsubscribed',
      unsubscribedAt: { $gte: thirtyDaysAgo },
    });

    res.status(200).json({
      total: totalSubscribers,
      unsubscribed: totalUnsubscribed,
      bounced: totalBounced,
      verified: verifiedEmails,
      unverified: unverifiedEmails,
      growth: {
        newLast30Days: newSubscribers,
        unsubscribedLast30Days,
        netGrowth: newSubscribers - unsubscribedLast30Days,
      },
    });
  } catch (error) {
    logger.error('Newsletter stats error:', error);
    throw ApiError.internal('Failed to get newsletter stats');
  }
};