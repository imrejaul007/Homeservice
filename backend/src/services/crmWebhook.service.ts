import axios from 'axios';
import logger from '../utils/logger';

export interface CrmWebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET;

/**
 * Dispatches support events to an external CRM (Zendesk, HubSpot, etc.)
 * via configurable webhook URL. No-op when CRM_WEBHOOK_URL is unset.
 */
export const crmWebhookService = {
  async dispatch(event: string, data: Record<string, unknown>): Promise<void> {
    if (!CRM_WEBHOOK_URL) {
      logger.debug('CRM webhook skipped — CRM_WEBHOOK_URL not configured', {
        event,
        action: 'CRM_WEBHOOK_SKIPPED',
      });
      return;
    }

    const payload: CrmWebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      await axios.post(CRM_WEBHOOK_URL, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(CRM_WEBHOOK_SECRET ? { 'X-CRM-Secret': CRM_WEBHOOK_SECRET } : {}),
        },
      });

      logger.info('CRM webhook dispatched', { event, action: 'CRM_WEBHOOK_SENT' });
    } catch (error) {
      logger.error('CRM webhook failed', {
        event,
        error: (error as Error).message,
        action: 'CRM_WEBHOOK_FAILED',
      });
    }
  },

  async contactSubmissionCreated(data: {
    submissionId: string;
    name: string;
    email: string;
    department: string;
    priority: string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.dispatch('contact.submission_created', data);
  },

  async ticketCreated(data: {
    ticketId: string;
    ticketNumber: string;
    userId: string;
    category: string;
    priority: string;
    subject: string;
    source?: string;
  }): Promise<void> {
    await this.dispatch('support.ticket_created', data);
  },

  async callbackRequested(data: {
    requestId: string;
    userId: string;
    phoneNumber: string;
    category: string;
    preferredTime: string;
  }): Promise<void> {
    await this.dispatch('support.callback_requested', data);
  },
};
