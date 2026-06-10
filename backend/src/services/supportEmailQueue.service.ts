import { addJob } from '../queue';
import { sendEmail } from './email.service';
import logger from '../utils/logger';

export type SupportEmailType =
  | 'contact_acknowledgement'
  | 'contact_team_notification';

interface QueueSupportEmailParams {
  to: string;
  type: SupportEmailType;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Queues support emails via BullMQ when Redis is available,
 * falls back to direct sendEmail otherwise.
 */
export async function queueSupportEmail(params: QueueSupportEmailParams): Promise<void> {
  const job = await addJob('email-queue', 'send_email', {
    to: params.to,
    type: params.type,
    metadata: {
      subject: params.subject,
      html: params.html,
      text: params.text,
    },
  });

  if (job) {
    logger.debug('Support email queued', {
      type: params.type,
      to: params.to,
      jobId: job.id,
      action: 'SUPPORT_EMAIL_QUEUED',
    });
    return;
  }

  await sendEmail(params.to, params.subject, params.html, params.text);
}
