import { Router, Request, Response } from 'express';
import { smsService, SmsDeliveryReceipt } from '../../services/sms.service';
import logger from '../../utils/logger';
import twilio from 'twilio';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/auth.middleware';

const router = Router();

// ============================================
// Twilio Webhook Authentication
// ============================================

const getTwilioCredentials = async (): Promise<{ accountSid: string; authToken: string } | null> => {
  const { getTwilioTransportConfig } = await import('../../services/platformSmsTransport.service');
  const transport = await getTwilioTransportConfig();
  if (transport) {
    return { accountSid: transport.accountSid, authToken: transport.authToken };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    logger.error('Twilio credentials not configured', {
      context: 'TwilioWebhooks',
      action: 'TWILIO_NOT_CONFIGURED',
    });
    return null;
  }
  return { accountSid, authToken };
};

/**
 * Verify Twilio webhook signature using twilio.validateRequest()
 * SECURITY FIX: Implements proper signature verification to prevent spoofed webhooks
 */
const verifyTwilioSignature = async (req: Request): Promise<boolean> => {
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const credentials = await getTwilioCredentials();

  // In development, skip verification
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // Check if credentials are configured
  if (!credentials) {
    logger.error('Cannot verify Twilio signature - credentials not configured', {
      context: 'TwilioWebhooks',
      action: 'SIGNATURE_VERIFICATION_FAILED',
    });
    // Fail closed in production if credentials missing
    return false;
  }

  // Check if signature header is present
  if (!twilioSignature) {
    logger.warn('Twilio webhook received without signature', {
      context: 'TwilioWebhooks',
      action: 'MISSING_SIGNATURE',
      path: req.path,
      ip: req.ip,
    });
    return false;
  }

  // Construct the webhook URL
  const webhookUrl = `${process.env.API_BASE_URL || process.env.BASE_URL}/api/v1/webhooks/twilio${req.path}`;

  // Get all parameters from the request for validation
  // For GET requests, use query params; for POST, use body
  const params = req.method === 'GET' ? req.query : req.body;

  try {
    // Use Twilio's built-in validation
    const isValid = twilio.validateRequest(
      credentials.authToken,
      twilioSignature,
      webhookUrl,
      params
    );

    if (!isValid) {
      logger.warn('Twilio webhook signature validation failed', {
        context: 'TwilioWebhooks',
        action: 'INVALID_SIGNATURE',
        path: req.path,
        ip: req.ip,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error validating Twilio signature', {
      context: 'TwilioWebhooks',
      action: 'SIGNATURE_VALIDATION_ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

// ============================================
// SMS Status Callback (Delivery Receipts)
// ============================================

/**
 * POST /api/v1/webhooks/twilio/status
 * Handle Twilio delivery status callbacks
 */
router.post('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && !(await verifyTwilioSignature(req))) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    logger.debug('Received Twilio status callback', {
      context: 'TwilioWebhooks',
      action: 'STATUS_CALLBACK',
      MessageSid,
      MessageStatus,
      To,
    });

    const receipt: SmsDeliveryReceipt = {
      messageSid: MessageSid,
      messageStatus: MessageStatus,
      to: To,
      from: From,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage,
      timestamp: new Date(),
    };

    await smsService.handleDeliveryReceipt(receipt);

    // Respond with TwiML to acknowledge receipt
    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    logger.error('Error processing Twilio status callback', {
      context: 'TwilioWebhooks',
      action: 'STATUS_CALLBACK_ERROR',
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    // Still respond with 200 to prevent Twilio retries
    // Log the error for investigation but don't fail the webhook
    res.status(200).type('text/xml').send('<Response></Response>');
  }
});

// ============================================
// Incoming SMS (STOP/Keywords)
// ============================================

/**
 * POST /api/v1/webhooks/twilio/incoming
 * Handle incoming SMS messages (for keyword processing)
 */
router.post('/incoming', async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && !(await verifyTwilioSignature(req))) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const {
      From,
      Body,
      MessageSid,
    } = req.body;

    logger.info('Received incoming SMS', {
      context: 'TwilioWebhooks',
      action: 'INCOMING_SMS',
      from: From ? From.slice(0, -4) + '****' : 'unknown',
      bodyLength: Body?.length,
    });

    if (!From || !Body) {
      logger.warn('Invalid incoming SMS - missing From or Body', {
        context: 'TwilioWebhooks',
        action: 'INVALID_INCOMING_SMS',
        body: req.body,
      });
      res.status(400).type('text/xml').send('<Response></Response>');
      return;
    }

    const result = await smsService.handleIncomingMessage(From, Body, MessageSid);

    if (result.processed) {
      logger.info('Processed incoming SMS keyword', {
        context: 'TwilioWebhooks',
        action: 'KEYWORD_PROCESSED',
        keywordAction: result.action,
      });
    }

    // Respond with empty TwiML (no auto-reply needed for STOP)
    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    logger.error('Error processing incoming SMS', {
      context: 'TwilioWebhooks',
      action: 'INCOMING_SMS_ERROR',
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    // Respond with 200 to prevent retries
    res.status(200).type('text/xml').send('<Response></Response>');
  }
});

// ============================================
// Health Check
// ============================================

/**
 * GET /api/v1/webhooks/twilio/health
 * Health check endpoint for Twilio webhooks
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const dlqStats = await smsService.getDlqStats();

  res.json({
    status: 'ok',
    service: 'twilio-webhooks',
    timestamp: new Date().toISOString(),
    dlq: {
      total: dlqStats.totalEntries,
      recent: dlqStats.recentEntries,
    },
  });
});

// ============================================
// DLQ Management (Admin Only)
// ============================================

/**
 * GET /api/v1/webhooks/twilio/dlq
 * Get SMS dead letter queue entries
 * SECURITY: Requires admin authentication
 */
router.get('/dlq', authenticate, requireRole('admin'), async (_req: Request, res: Response): Promise<void> => {
  const entries = await smsService.getDeadLetterQueue();
  const stats = await smsService.getDlqStats();

  // Mask phone numbers for security
  const maskedEntries = entries.map((entry: any) => ({
    ...entry,
    phoneNumber: maskPhoneNumber(entry.phoneNumber),
  }));

  res.json({
    entries: maskedEntries,
    stats,
  });
});

/**
 * POST /api/v1/webhooks/twilio/dlq/:entryId/retry
 * Retry a specific DLQ entry
 * SECURITY: Requires admin authentication
 */
router.post('/dlq/:entryId/retry', authenticate, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { entryId } = req.params;

    const result = await smsService.retryFromDlq(entryId);

    if (result.success) {
      res.json({
        success: true,
        message: 'SMS retried successfully',
        entryId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        entryId,
      });
    }
  } catch (error) {
    logger.error('Error retrying DLQ entry', {
      context: 'TwilioWebhooks',
      action: 'DLQ_RETRY_ERROR',
      entryId: req.params.entryId,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================
// Helper Functions
// ============================================

function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

export default router;
