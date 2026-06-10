import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import logger from '../../utils/logger';

const router = Router();

/**
 * WhatsApp webhook verification (Meta)
 */
router.get('/whatsapp', asyncHandler(async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
}));

/**
 * WhatsApp webhook events
 */
router.post('/whatsapp', asyncHandler(async (req: Request, res: Response) => {
  const { whatsAppService } = await import('../../services/notifications/whatsapp.service');

  try {
    const body = req.body;

    if (body.entry) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value?.statuses) {
            for (const status of value.statuses) {
              await whatsAppService.processStatusWebhook({
                statuses: [{
                  id: status.id,
                  status: status.status,
                  timestamp: status.timestamp,
                  recipient_id: status.recipient_id,
                }],
              } as Parameters<typeof whatsAppService.processStatusWebhook>[0]);
            }
          }
          if (value?.messages) {
            for (const message of value.messages) {
              await whatsAppService.processIncomingMessage({
                messages: [message],
              } as Parameters<typeof whatsAppService.processIncomingMessage>[0]);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('WhatsApp webhook processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  res.sendStatus(200);
}));

/**
 * Telegram bot webhook
 */
router.post('/telegram', asyncHandler(async (req: Request, res: Response) => {
  const { telegramService } = await import('../../services/notifications/telegram.service');

  try {
    await telegramService.processUpdate(req.body);
  } catch (error) {
    logger.error('Telegram webhook processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  res.sendStatus(200);
}));

export default router;
