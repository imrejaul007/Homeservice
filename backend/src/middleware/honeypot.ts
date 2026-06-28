/**
 * Honeypot middleware for bot detection
 *
 * Adds a hidden field to forms that humans won't see/fill out,
 * but bots will typically fill automatically.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface HoneypotConfig {
  fieldName: string;
  shouldCapture?: (req: Request) => boolean;
}

/**
 * Creates honeypot middleware
 * @param config - Configuration for the honeypot field
 */
export const createHoneypotMiddleware = (config: HoneypotConfig) => {
  const { fieldName, shouldCapture } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if we should capture (e.g., only for POST requests)
    if (shouldCapture && !shouldCapture(req)) {
      next();
      return;
    }

    const honeypotValue = req.body[fieldName];

    // If honeypot field has a value, it's likely a bot
    if (honeypotValue && honeypotValue.toString().trim() !== '') {
      // Log the attempt for monitoring
      logger.warn('[HONEYPOT] Bot detected via honeypot field', {
        context: 'Honeypot',
        ip: req.ip,
        path: req.path,
        fieldName,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        timestamp: new Date().toISOString(),
      });

      // Return a fake success response to fool the bot
      // but don't actually process the request
      res.status(200).json({
        success: true,
        message: 'Request processed',
        data: null,
      });
      return;
    }

    next();
  };
};

/**
 * Default honeypot config for offer claims
 */
export const claimHoneypot = createHoneypotMiddleware({
  fieldName: 'website_url',
  shouldCapture: (req) => req.method === 'POST' && req.path === '/claim',
});

/**
 * HTML snippet for the honeypot field
 * Add this to any form that needs bot protection
 * The field is hidden via CSS (display:none) so humans won't see it
 */
export const HONEYPOT_FIELD_HTML = `
  <div style="position: absolute; left: -9999px; top: -9999px;" aria-hidden="true">
    <label for="website_url">Website (leave empty):</label>
    <input
      type="text"
      id="website_url"
      name="website_url"
      tabindex="-1"
      autocomplete="off"
    />
  </div>
`;
