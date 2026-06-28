import { Router, Request, Response } from 'express';
import User from '../../models/user.model';
import logger from '../../utils/logger';

const router = Router();

/**
 * Email Bounce/Complaint Webhook Handler
 * FIX P2: Implements bounce/complaint webhook handlers for SES and other email providers
 *
 * Supported providers:
 * - AWS SES bounce/complaint notifications
 * - Resend webhook events
 * - SendGrid bounce events
 */

/**
 * Handle AWS SES bounce notification
 * POST /webhooks/email/ses/bounce
 */
router.post('/ses/bounce', async (req: Request, res: Response) => {
  try {
    const { Message } = req.body;
    if (!Message) {
      return res.status(400).json({ error: 'Invalid SES bounce payload' });
    }

    const message = typeof Message === 'string' ? JSON.parse(Message) : Message;
    const { bounce } = message;

    if (!bounce || !bounce.bouncedRecipients) {
      return res.status(400).json({ error: 'Missing bounce details' });
    }

    const bouncedEmails = bounce.bouncedRecipients.map((r: any) => r.emailAddress);

    logger.warn('Email bounce received from SES', {
      context: 'EmailBounceWebhook',
      action: 'BOUNCE_RECEIVED',
      bouncedEmails,
      bounceType: bounce.bounceType,
      bouncedCount: bouncedEmails.length
    });

    // Mark users with bounced emails as having invalid email
    for (const email of bouncedEmails) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.isEmailVerified = false;
        user.emailBounceAt = new Date();
        user.emailBounceType = bounce.bounceType;
        await user.save();

        logger.info('User email marked as bounced', {
          context: 'EmailBounceWebhook',
          action: 'EMAIL_BOUNCED',
          userId: user._id,
          email,
          bounceType: bounce.bounceType
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing SES bounce webhook', {
      context: 'EmailBounceWebhook',
      error: (error as Error).message
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle AWS SES complaint notification
 * POST /webhooks/email/ses/complaint
 */
router.post('/ses/complaint', async (req: Request, res: Response) => {
  try {
    const { Message } = req.body;
    if (!Message) {
      return res.status(400).json({ error: 'Invalid SES complaint payload' });
    }

    const message = typeof Message === 'string' ? JSON.parse(Message) : Message;
    const { complaint } = message;

    if (!complaint || !complaint.complainedRecipients) {
      return res.status(400).json({ error: 'Missing complaint details' });
    }

    const complainedEmails = complaint.complainedRecipients.map((r: any) => r.emailAddress);

    logger.warn('Email complaint received from SES', {
      context: 'EmailBounceWebhook',
      action: 'COMPLAINT_RECEIVED',
      complainedEmails,
      complainedCount: complainedEmails.length
    });

    // Mark users with complained emails - opt them out of marketing
    for (const email of complainedEmails) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        // Set email marketing to false but don't disable the account
        if (user.communicationPreferences) {
          user.communicationPreferences.email = user.communicationPreferences.email || {};
          user.communicationPreferences.email.marketing = false;
        }
        user.emailComplaintAt = new Date();
        await user.save();

        logger.info('User marked as having email complaint', {
          context: 'EmailBounceWebhook',
          action: 'EMAIL_COMPLAINT',
          userId: user._id,
          email
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing SES complaint webhook', {
      context: 'EmailBounceWebhook',
      error: (error as Error).message
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle Resend webhook events
 * POST /webhooks/email/resend
 */
router.post('/resend', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Invalid Resend webhook payload' });
    }

    switch (type) {
      case 'email.bounced': {
        const { email, bounced: bouncedData } = data;

        logger.warn('Email bounce received from Resend', {
          context: 'EmailBounceWebhook',
          action: 'RESEND_BOUNCE',
          email,
          bouncedData
        });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          user.isEmailVerified = false;
          user.emailBounceAt = new Date();
          user.emailBounceType = bouncedData?.bounceType || 'Unknown';
          await user.save();
        }
        break;
      }

      case 'email.complaint': {
        const { email } = data;

        logger.warn('Email complaint received from Resend', {
          context: 'EmailBounceWebhook',
          action: 'RESEND_COMPLAINT',
          email
        });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          if (user.communicationPreferences) {
            user.communicationPreferences.email = user.communicationPreferences.email || {};
            user.communicationPreferences.email.marketing = false;
          }
          user.emailComplaintAt = new Date();
          await user.save();
        }
        break;
      }

      case 'email.delivered': {
        // Clear any bounce flags on successful delivery
        const { email } = data;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user && user.emailBounceAt) {
          user.emailBounceAt = undefined;
          user.emailBounceType = undefined;
          await user.save();
        }
        break;
      }

      default:
        logger.debug('Unhandled Resend webhook event', { type, data });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing Resend webhook', {
      context: 'EmailBounceWebhook',
      error: (error as Error).message
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle generic email bounce (for providers without specific handlers)
 * POST /webhooks/email/bounce
 */
router.post('/bounce', async (req: Request, res: Response) => {
  try {
    const { email, bounceType, bouncedAt } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.isEmailVerified = false;
      user.emailBounceAt = bouncedAt ? new Date(bouncedAt) : new Date();
      user.emailBounceType = bounceType || 'Unknown';
      await user.save();

      logger.info('User email marked as bounced (generic handler)', {
        context: 'EmailBounceWebhook',
        action: 'GENERIC_BOUNCE',
        userId: user._id,
        email,
        bounceType
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing generic bounce webhook', {
      context: 'EmailBounceWebhook',
      error: (error as Error).message
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
