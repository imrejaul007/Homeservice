import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Email templates
interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// ============================================
// SMTP Configuration (Nodemailer)
// ============================================

// Initialize SMTP transporter if SMTP credentials are provided
const createSmtpTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

const smtpTransporter = createSmtpTransporter();

// ============================================
// Resend Configuration (Backup)
// ============================================

// Initialize Resend client only if API key exists
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// ============================================
// Common Configuration
// ============================================

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@nilin.com';
const FROM_NAME = process.env.FROM_NAME || process.env.APP_NAME || 'NILIN';
// Fail-fast: require FRONTEND_URL in production
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL && process.env.NODE_ENV === 'production') {
  const error = new Error('FRONTEND_URL environment variable is required in production');
  logger.error('Email service configuration error:', error.message);
  throw error;
}
// Use empty string as fallback only in development (will log warning when used)
const FRONTEND_URL_FALLBACK = FRONTEND_URL || '';

// NILIN Brand Colors
const BRAND_COLORS = {
  primary: '#E11D48',      // Rose/Rose-600 (coral theme)
  primaryDark: '#BE123C',  // Rose-700
  primaryLight: '#FCE7F3', // Rose-100
  secondary: '#F97316',    // Orange-500
  text: '#1F2937',         // Gray-800
  textLight: '#6B7280',    // Gray-500
  background: '#FFF1F2',   // Rose-50
  white: '#FFFFFF',
  success: '#10B981',      // Emerald-500
  warning: '#F59E0B',      // Amber-500
  error: '#EF4444',        // Red-500
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ============================================
// Base email function with retry support
// ============================================
const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> => {
  // Log email in development
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Email would be sent', { to, subject, preview: html.substring(0, 200) });
  }

  // Check if either SMTP or Resend is configured
  const hasSmtp = smtpTransporter !== null;
  const hasResend = resend !== null;

  if (!hasSmtp && !hasResend) {
    logger.warn('Email service not configured - skipping email', { to, subject });
    logger.info('Configure SMTP_HOST, SMTP_USER, SMTP_PASS or RESEND_API_KEY to enable emails');
    return;
  }

  let lastError: Error | null = null;

  // Try SMTP first if available, then fall back to Resend
  const methods = hasSmtp
    ? [
        async () => {
          const info = await smtpTransporter!.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''),
          });
          return { messageId: info.messageId || 'unknown' };
        },
      ]
    : [];

  // Add Resend as fallback if available
  if (hasResend) {
    methods.push(async () => {
      const result = await resend!.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { messageId: result.data?.id || 'unknown' };
    });
  }

  // Try each method in order
  for (const sendMethod of methods) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await sendMethod();

        logger.info('Email sent successfully', {
          to,
          subject,
          messageId: result.messageId,
          attempt,
          action: 'EMAIL_SENT',
        });

        return;
      } catch (error: any) {
        lastError = error;
        logger.warn('Email send attempt failed', {
          to,
          subject,
          attempt,
          maxRetries: MAX_RETRIES,
          error: error.message,
          action: 'EMAIL_RETRY',
        });

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        }
      }
    }
  }

  logger.error('Failed to send email after all retries', {
    to,
    subject,
    error: lastError?.message,
    action: 'EMAIL_FAILED',
  });

  // Don't throw - we want email failures to be non-blocking
  // throw new ApiError(500, 'Failed to send email after multiple attempts');
};

// Email verification template with NILIN branding
const getVerificationEmailTemplate = (firstName: string, verificationToken: string, to?: string): EmailTemplate => {
  const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;

  return {
    subject: 'Verify Your Email Address - NILIN',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: -0.5px;">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Home Services Marketplace</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px;">Hi ${firstName}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">
                Thank you for joining NILIN! To complete your registration and start booking home services, please verify your email address.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">Verify Email Address</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px; text-align: center;">or copy this link:</p>
              <p style="margin: 0; padding: 12px; background: ${BRAND_COLORS.background}; border-radius: 6px; font-size: 12px; color: ${BRAND_COLORS.textLight}; word-break: break-all;">${verificationUrl}</p>

              <div style="margin-top: 32px; padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.warning};">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>Security Notice:</strong> This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                <span style="color: ${BRAND_COLORS.primary};">Transforming home services, one booking at a time.</span>
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!

      Welcome to NILIN!

      Please verify your email address by clicking this link: ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create this account, you can safely ignore this email.

      &copy; ${new Date().getFullYear()} NILIN
    `
  };
};

// Welcome email template
const getWelcomeEmailTemplate = (firstName: string, role: string, to?: string): EmailTemplate => {
  const dashboardUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/${role}/dashboard`;
  
  const roleSpecificContent = {
    customer: {
      title: 'Welcome to Your New Home Service Experience! 🎉',
      benefits: [
        '🔍 Browse thousands of verified service providers',
        '⚡ Book services instantly or schedule for later',
        '💰 Earn loyalty coins with every booking',
        '⭐ Read real reviews from other customers',
        '📱 Manage everything from your mobile device'
      ],
      cta: 'Start Exploring Services'
    },
    provider: {
      title: 'Welcome to the Provider Community! 💼',
      benefits: [
        '📈 Grow your business with new customers',
        '💳 Get paid quickly and securely',
        '📊 Track your performance with analytics',
        '⭐ Build your reputation with reviews',
        '🎯 Use marketing tools to attract clients'
      ],
      cta: 'Complete Your Profile'
    },
    admin: {
      title: 'Welcome to the Admin Panel! 🛠️',
      benefits: [
        '👥 Manage users and providers',
        '📊 Monitor platform analytics',
        '🔧 Configure platform settings',
        '🛡️ Ensure platform security',
        '📈 Drive platform growth'
      ],
      cta: 'Access Admin Dashboard'
    }
  };

  const content = roleSpecificContent[role as keyof typeof roleSpecificContent] || roleSpecificContent.customer;

  return {
    subject: `${content.title}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Home Service Platform</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 25px 0; }
          .benefits { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .logo { font-size: 28px; font-weight: bold; }
          ul { padding-left: 0; }
          li { list-style: none; padding: 8px 0; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏠 Home Service Platform</div>
          <h1>${content.title}</h1>
        </div>
        <div class="content">
          <h2>Hi ${firstName}! 🎉</h2>
          <p>Your email has been verified and your account is now active! We're thrilled to have you join our community.</p>
          
          <div class="benefits">
            <h3>Here's what you can do now:</h3>
            <ul>
              ${content.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">${content.cta}</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <h3>Need Help? 🤝</h3>
          <p>Our support team is here to help you get started:</p>
          <ul>
            <li>📧 Email: support@homeservice.com</li>
            <li>💬 Live chat on our website</li>
            <li>📞 Phone: 1-800-HOME-SVC</li>
            <li>📱 Download our mobile app for iOS and Android</li>
          </ul>
          
          <p>Welcome aboard! We can't wait to see what amazing experiences await you.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
          <p>This email was sent to ${to || 'you'}</p>
        </div>
      </body>
      </html>
    `
  };
};

// Password reset email template
const getPasswordResetEmailTemplate = (firstName: string, resetToken: string, to?: string): EmailTemplate => {
  const resetUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/reset-password/${resetToken}`;
  
  return {
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff6b6b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔒 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hi ${firstName},</h2>
          <p>We received a request to reset your password for your Home Service Platform account.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
          </div>
          
          <p><strong>Or copy and paste this link:</strong></p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul>
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password remains unchanged until you create a new one</li>
            </ul>
          </div>
          
          <p>For your security, we recommend choosing a strong password that includes:</p>
          <ul>
            <li>At least 8 characters</li>
            <li>One uppercase and one lowercase letter</li>
            <li>At least one number</li>
            <li>At least one special character (@$!%*?&)</li>
          </ul>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
          <p>This email was sent to ${to || 'you'}</p>
        </div>
      </body>
      </html>
    `
  };
};

// Public email service functions
export const sendVerificationEmail = async (
  email: string, 
  firstName: string, 
  verificationToken: string
): Promise<void> => {
  const template = getVerificationEmailTemplate(firstName, verificationToken, email);
  await sendEmail(email, template.subject, template.html, template.text);
};

export const sendWelcomeEmail = async (
  email: string, 
  firstName: string, 
  role: string
): Promise<void> => {
  const template = getWelcomeEmailTemplate(firstName, role, email);
  await sendEmail(email, template.subject, template.html);
};

export const sendPasswordResetEmail = async (
  email: string, 
  firstName: string, 
  resetToken: string
): Promise<void> => {
  const template = getPasswordResetEmailTemplate(firstName, resetToken, email);
  await sendEmail(email, template.subject, template.html);
};

// ===================================
// BOOKING EMAIL TEMPLATES
// ===================================

// Booking request submitted (Customer)
export const sendBookingRequestEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingRequestTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking request notification (Provider)
export const sendNewBookingRequestEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getNewBookingRequestTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking confirmation email (Customer)
export const sendBookingConfirmationEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingConfirmationTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking accepted notification (Provider)
export const sendBookingAcceptedEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingAcceptedTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking cancelled email
export const sendBookingCancelledEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any,
  isProvider: boolean = false
): Promise<void> => {
  const template = getBookingCancelledTemplate(firstName, bookingDetails, isProvider);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking rejected email (Customer)
export const sendBookingRejectedEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingRejectedTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking completed email
export const sendBookingCompletedEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any,
  isProvider: boolean = false
): Promise<void> => {
  const template = getBookingCompletedTemplate(firstName, bookingDetails, isProvider);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking reminder email (24 hours before)
export const sendBookingReminderEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingReminderTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// ===================================
// BOOKING EMAIL TEMPLATE GENERATORS
// ===================================

const getBookingRequestTemplate = (firstName: string, booking: any): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/bookings/${booking.bookingNumber}`;

  return {
    subject: `Booking Request Submitted - ${booking.serviceName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Request Submitted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .booking-card { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #4CAF50; margin: 20px 0; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .status-badge { background: #e3f2fd; color: #1976d2; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Booking Request Submitted</h1>
          <p>Your request has been sent to the provider</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName}! 👋</h2>
          <p>Great news! Your booking request has been successfully submitted. The provider will review your request and respond within 24 hours.</p>

          <div class="booking-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3>Booking Details</h3>
              <span class="status-badge">Pending Approval</span>
            </div>
            <p><strong>📋 Booking #:</strong> ${booking.bookingNumber}</p>
            <p><strong>🏠 Service:</strong> ${booking.serviceName}</p>
            <p><strong>👤 Provider:</strong> ${booking.providerName}</p>
            <p><strong>📅 Date & Time:</strong> ${booking.scheduledDate} at ${booking.scheduledTime}</p>
            <p><strong>⏱️ Duration:</strong> ${booking.duration} minutes</p>
            <p><strong>📍 Location:</strong> ${booking.location}</p>
            <p><strong>💰 Total Cost:</strong> ${booking.currency} ${booking.totalAmount}</p>
          </div>

          <div style="text-align: center;">
            <a href="${viewBookingUrl}" class="button">View Booking Details</a>
          </div>

          <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>What happens next? 🔄</h4>
            <ul>
              <li>✅ The provider will review your request</li>
              <li>📧 You'll get an email when they respond</li>
              <li>💳 Payment will be processed upon confirmation</li>
              <li>📱 You can track everything in your dashboard</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!

      Your booking request has been submitted successfully.

      Booking Details:
      - Booking #: ${booking.bookingNumber}
      - Service: ${booking.serviceName}
      - Provider: ${booking.providerName}
      - Date & Time: ${booking.scheduledDate} at ${booking.scheduledTime}
      - Total Cost: ${booking.currency} ${booking.totalAmount}

      The provider will respond within 24 hours. You'll receive an email notification when they accept or decline your request.

      View booking: ${viewBookingUrl}
    `
  };
};

const getNewBookingRequestTemplate = (firstName: string, booking: any): EmailTemplate => {
  const respondUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/provider/bookings/${booking.bookingNumber}`;

  return {
    subject: `New Booking Request - ${booking.serviceName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .booking-card { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #2196F3; margin: 20px 0; }
          .action-buttons { text-align: center; margin: 25px 0; }
          .button { display: inline-block; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; }
          .accept-btn { background: #4CAF50; }
          .decline-btn { background: #f44336; }
          .view-btn { background: #2196F3; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔔 New Booking Request</h1>
          <p>A customer wants to book your service</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName}! 💼</h2>
          <p>You have a new booking request! A customer is interested in your service and would like to schedule an appointment.</p>

          <div class="booking-card">
            <h3>Booking Request Details</h3>
            <p><strong>📋 Booking #:</strong> ${booking.bookingNumber}</p>
            <p><strong>🏠 Service:</strong> ${booking.serviceName}</p>
            <p><strong>👤 Customer:</strong> ${booking.customerName}</p>
            <p><strong>📞 Phone:</strong> ${booking.customerPhone}</p>
            <p><strong>📅 Requested Date & Time:</strong> ${booking.scheduledDate} at ${booking.scheduledTime}</p>
            <p><strong>⏱️ Duration:</strong> ${booking.duration} minutes</p>
            <p><strong>📍 Location:</strong> ${booking.location}</p>
            <p><strong>💰 Service Fee:</strong> ${booking.currency} ${booking.totalAmount}</p>
            ${booking.specialRequests ? `<p><strong>📝 Special Requests:</strong> ${booking.specialRequests}</p>` : ''}
          </div>

          <div class="action-buttons">
            <a href="${respondUrl}&action=accept" class="button accept-btn">✅ Accept Request</a>
            <a href="${respondUrl}&action=decline" class="button decline-btn">❌ Decline</a>
          </div>

          <div style="text-align: center;">
            <a href="${respondUrl}" class="button view-btn">View Full Details</a>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>⏰ Response Required</h4>
            <p>Please respond to this booking request within 24 hours to maintain your response rate and customer satisfaction.</p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!

      You have a new booking request for ${booking.serviceName}.

      Customer: ${booking.customerName}
      Date & Time: ${booking.scheduledDate} at ${booking.scheduledTime}
      Duration: ${booking.duration} minutes
      Service Fee: ${booking.currency} ${booking.totalAmount}

      Please respond within 24 hours: ${respondUrl}
    `
  };
};

const getBookingConfirmationTemplate = (firstName: string, booking: any): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/bookings/${booking.bookingNumber}`;

  return {
    subject: `Booking Confirmed! ${booking.serviceName} on ${booking.scheduledDate}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .booking-card { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #4CAF50; margin: 20px 0; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .status-badge { background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
          <p>Your appointment is all set</p>
        </div>
        <div class="content">
          <h2>Great news, ${firstName}! ✨</h2>
          <p>Your booking has been confirmed by the provider. Your appointment is scheduled and ready to go!</p>

          <div class="booking-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3>Confirmed Appointment</h3>
              <span class="status-badge">✅ Confirmed</span>
            </div>
            <p><strong>📋 Booking #:</strong> ${booking.bookingNumber}</p>
            <p><strong>🏠 Service:</strong> ${booking.serviceName}</p>
            <p><strong>👤 Provider:</strong> ${booking.providerName}</p>
            <p><strong>📅 Date & Time:</strong> ${booking.scheduledDate} at ${booking.scheduledTime}</p>
            <p><strong>⏱️ Duration:</strong> ${booking.duration} minutes</p>
            <p><strong>📍 Location:</strong> ${booking.location}</p>
            <p><strong>💰 Total Cost:</strong> ${booking.currency} ${booking.totalAmount}</p>
            ${booking.providerNotes ? `<p><strong>📝 Provider Notes:</strong> ${booking.providerNotes}</p>` : ''}
          </div>

          <div style="text-align: center;">
            <a href="${viewBookingUrl}" class="button">View Booking Details</a>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>📋 What to expect next:</h4>
            <ul>
              <li>📧 We'll send you a reminder 24 hours before your appointment</li>
              <li>📱 You can message your provider directly through the app</li>
              <li>💳 Payment will be processed after service completion</li>
              <li>⭐ You'll earn loyalty coins after the service</li>
            </ul>
          </div>

          <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>📞 Provider Contact</h4>
            <p>If you need to reach your provider directly:</p>
            <p><strong>📧 Email:</strong> ${booking.providerEmail}</p>
            <p><strong>📱 In-app messaging:</strong> Available in your booking details</p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Great news, ${firstName}! Your booking has been confirmed.

      Booking Details:
      - Booking #: ${booking.bookingNumber}
      - Service: ${booking.serviceName}
      - Provider: ${booking.providerName}
      - Date & Time: ${booking.scheduledDate} at ${booking.scheduledTime}
      - Total Cost: ${booking.currency} ${booking.totalAmount}

      We'll send you a reminder 24 hours before your appointment.

      View booking: ${viewBookingUrl}
    `
  };
};

// Loyalty points notification
export const sendLoyaltyPointsEmail = async (
  email: string,
  firstName: string,
  pointsEarned: number,
  totalPoints: number,
  reason: string
): Promise<void> => {
  const subject = `You earned ${pointsEarned} loyalty coins! 🪙`;
  const html = `
    <h2>Congratulations ${firstName}! 🎉</h2>
    <p>You just earned <strong>${pointsEarned} loyalty coins</strong> for: ${reason}</p>
    <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <h3>Your Loyalty Balance</h3>
      <p style="font-size: 24px; color: #667eea;"><strong>${totalPoints} coins</strong></p>
    </div>
    <p>Use your coins to get discounts on future bookings!</p>
  `;
  
  await sendEmail(email, subject, html);
};

// Add the remaining template functions
const getBookingAcceptedTemplate = (firstName: string, booking: any): EmailTemplate => {
  return {
    subject: `Booking Accepted - ${booking.serviceName}`,
    html: `<h2>Hi ${firstName}!</h2><p>You have successfully accepted the booking request for ${booking.serviceName}.</p>`,
    text: `Hi ${firstName}! You have accepted the booking request for ${booking.serviceName}.`
  };
};

const getBookingCancelledTemplate = (firstName: string, booking: any, isProvider: boolean = false): EmailTemplate => {
  const title = isProvider ? 'Booking Cancelled by Customer' : 'Booking Cancelled';
  return {
    subject: `${title} - ${booking.serviceName}`,
    html: `<h2>Hi ${firstName}!</h2><p>Booking ${booking.bookingNumber} for ${booking.serviceName} has been cancelled.</p>`,
    text: `Hi ${firstName}! Booking ${booking.bookingNumber} has been cancelled.`
  };
};

const getBookingRejectedTemplate = (firstName: string, booking: any): EmailTemplate => {
  return {
    subject: `Booking Request Declined - ${booking.serviceName}`,
    html: `<h2>Hi ${firstName}!</h2><p>Unfortunately, your booking request for ${booking.serviceName} has been declined.</p>`,
    text: `Hi ${firstName}! Your booking request for ${booking.serviceName} has been declined.`
  };
};

const getBookingCompletedTemplate = (firstName: string, booking: any, isProvider: boolean = false): EmailTemplate => {
  const title = isProvider ? 'Service Completed Successfully' : 'Service Completed - Please Review';
  return {
    subject: `${title} - ${booking.serviceName}`,
    html: `<h2>Hi ${firstName}!</h2><p>The service ${booking.serviceName} has been completed successfully.</p>`,
    text: `Hi ${firstName}! The service ${booking.serviceName} has been completed.`
  };
};

const getBookingReminderTemplate = (firstName: string, booking: any): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/bookings/${booking.bookingNumber}`;

  return {
    subject: `Reminder: Your ${booking.serviceName} appointment is tomorrow!`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Appointment Reminder</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 64px; height: 64px; background: ${BRAND_COLORS.primaryLight}; border-radius: 50%; line-height: 64px; font-size: 32px;">&#128276;</span>
              </div>

              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px; text-align: center;">Don't forget your appointment!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; text-align: center;">
                Hi ${firstName}, this is a friendly reminder about your upcoming appointment tomorrow.
              </p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 16px; color: ${BRAND_COLORS.primary}; font-size: 18px;">${booking.serviceName}</h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Provider</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.providerName}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Location</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.location}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.warning};">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>Tip:</strong> Please ensure you're at the location 10 minutes before your scheduled time.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${firstName}! Reminder: ${booking.serviceName} tomorrow at ${booking.scheduledTime}. Location: ${booking.location}.`
  };
};

const getBookingReminderFullTemplate = (booking: BookingNotificationData, recipient: 'customer' | 'provider'): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;
  const isCustomer = recipient === 'customer';
  const greeting = isCustomer ? booking.customerName : booking.providerName;
  const otherParty = isCustomer ? booking.providerName : booking.customerName;

  return {
    subject: `Reminder: Your ${booking.serviceName} appointment is tomorrow!`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Appointment Reminder</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 64px; height: 64px; background: ${BRAND_COLORS.primaryLight}; border-radius: 50%; line-height: 64px; font-size: 32px;">&#128276;</span>
              </div>

              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px; text-align: center;">Don't forget your appointment!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; text-align: center;">
                Hi ${greeting}, this is a friendly reminder about your upcoming appointment tomorrow.
              </p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 16px; color: ${BRAND_COLORS.primary}; font-size: 18px;">${booking.serviceName}</h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">${isCustomer ? 'Provider' : 'Customer'}</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${otherParty}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Location</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.location}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.warning};">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>Tip:</strong> Please ensure you're at the location 10 minutes before your scheduled time.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${greeting}! Reminder: ${booking.serviceName} tomorrow at ${booking.scheduledTime}. Location: ${booking.location}.`
  };
};

// ============================================
// NEW BOOKING EMAIL FUNCTIONS
// ============================================

// Booking interface for notification functions
interface BookingNotificationData {
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  providerEmail: string;
  customerName: string;
  customerEmail: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location: string;
  totalAmount: number;
  currency: string;
  status: string;
  specialRequests?: string;
  providerNotes?: string;
}

/**
 * Send booking confirmation email to both customer and provider
 */
export const sendBookingConfirmation = async (booking: BookingNotificationData): Promise<void> => {
  try {
    // Send to customer
    const customerTemplate = getBookingConfirmationFullTemplate(booking, 'customer');
    await sendEmail(booking.customerEmail, customerTemplate.subject, customerTemplate.html, customerTemplate.text);

    // Send to provider
    const providerTemplate = getBookingConfirmationFullTemplate(booking, 'provider');
    await sendEmail(booking.providerEmail, providerTemplate.subject, providerTemplate.html, providerTemplate.text);

    logger.info('Booking confirmation emails sent', {
      bookingNumber: booking.bookingNumber,
      customerEmail: booking.customerEmail,
      providerEmail: booking.providerEmail,
      action: 'BOOKING_CONFIRMATION_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking confirmation emails', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_CONFIRMATION_FAILED',
    });
    // Don't throw - email failure should not break booking flow
  }
};

/**
 * Send booking reminder email (24h before appointment)
 */
export const sendBookingReminder = async (booking: BookingNotificationData): Promise<void> => {
  try {
    // Send to customer
    const customerTemplate = getBookingReminderFullTemplate(booking, 'customer');
    await sendEmail(booking.customerEmail, customerTemplate.subject, customerTemplate.html, customerTemplate.text);

    // Send to provider
    const providerTemplate = getBookingReminderFullTemplate(booking, 'provider');
    await sendEmail(booking.providerEmail, providerTemplate.subject, providerTemplate.html, providerTemplate.text);

    logger.info('Booking reminder emails sent', {
      bookingNumber: booking.bookingNumber,
      action: 'BOOKING_REMINDER_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking reminder emails', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_REMINDER_FAILED',
    });
  }
};

/**
 * Send booking cancellation email to both parties
 */
export const sendBookingCancellation = async (
  booking: BookingNotificationData,
  cancelledBy: 'customer' | 'provider' | 'admin'
): Promise<void> => {
  try {
    const recipient = cancelledBy === 'customer' ? booking.providerEmail : booking.customerEmail;
    const cancellerName = cancelledBy === 'customer' ? booking.customerName : booking.providerName;

    const template = getBookingCancellationFullTemplate(booking, cancelledBy, cancellerName);
    await sendEmail(recipient, template.subject, template.html, template.text);

    logger.info('Booking cancellation email sent', {
      bookingNumber: booking.bookingNumber,
      cancelledBy,
      recipient,
      action: 'BOOKING_CANCELLATION_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking cancellation email', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_CANCELLATION_FAILED',
    });
  }
};

/**
 * Send booking rescheduled email to both parties
 */
export const sendBookingRescheduled = async (
  booking: BookingNotificationData,
  oldDate: string,
  newDate: string
): Promise<void> => {
  try {
    // Send to customer
    const customerTemplate = getBookingRescheduledFullTemplate(booking, oldDate, newDate, 'customer');
    await sendEmail(booking.customerEmail, customerTemplate.subject, customerTemplate.html, customerTemplate.text);

    // Send to provider
    const providerTemplate = getBookingRescheduledFullTemplate(booking, oldDate, newDate, 'provider');
    await sendEmail(booking.providerEmail, providerTemplate.subject, providerTemplate.html, providerTemplate.text);

    logger.info('Booking rescheduled emails sent', {
      bookingNumber: booking.bookingNumber,
      oldDate,
      newDate,
      action: 'BOOKING_RESCHEDULED_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking rescheduled emails', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_RESCHEDULED_FAILED',
    });
  }
};

/**
 * Send provider approval email (admin approval)
 */
export const sendProviderApproval = async (
  provider: {
    email: string;
    firstName: string;
    businessName: string;
  }
): Promise<void> => {
  try {
    const dashboardUrl = `${FRONTEND_URL}/provider/dashboard`;
    const template = getProviderApprovalTemplate(provider, dashboardUrl);
    await sendEmail(provider.email, template.subject, template.html, template.text);

    logger.info('Provider approval email sent', {
      email: provider.email,
      businessName: provider.businessName,
      action: 'PROVIDER_APPROVAL_SENT',
    });
  } catch (error) {
    logger.error('Failed to send provider approval email', {
      email: provider.email,
      error: error instanceof Error ? error.message : String(error),
      action: 'PROVIDER_APPROVAL_FAILED',
    });
  }
};

/**
 * Send provider rejection email (admin rejection)
 */
export const sendProviderRejection = async (
  provider: {
    email: string;
    firstName: string;
    businessName: string;
  },
  reason: string
): Promise<void> => {
  try {
    const helpUrl = `${FRONTEND_URL}/support`;
    const template = getProviderRejectionTemplate(provider, reason, helpUrl);
    await sendEmail(provider.email, template.subject, template.html, template.text);

    logger.info('Provider rejection email sent', {
      email: provider.email,
      businessName: provider.businessName,
      action: 'PROVIDER_REJECTION_SENT',
    });
  } catch (error) {
    logger.error('Failed to send provider rejection email', {
      email: provider.email,
      error: error instanceof Error ? error.message : String(error),
      action: 'PROVIDER_REJECTION_FAILED',
    });
  }
};

// ============================================
// FULL TEMPLATE GENERATORS
// ============================================

const getBookingConfirmationFullTemplate = (booking: BookingNotificationData, recipient: 'customer' | 'provider'): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;
  const isCustomer = recipient === 'customer';
  const greeting = isCustomer ? `Great news, ${booking.customerName}!` : `Hello, ${booking.providerName}!`;
  const subtitle = isCustomer ? 'Your booking has been confirmed!' : 'You have confirmed a booking!';

  return {
    subject: `Booking Confirmed! - ${booking.bookingNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Booking Confirmed</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px;">${greeting}</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">${subtitle}</p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td style="border-left: 4px solid ${BRAND_COLORS.success}; padding-left: 16px;">
                    <p style="margin: 0 0 4px; font-size: 12px; color: ${BRAND_COLORS.textLight}; text-transform: uppercase; letter-spacing: 0.5px;">Booking Number</p>
                    <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.text};">${booking.bookingNumber}</p>

                    <h3 style="margin: 0 0 16px; font-size: 18px; color: ${BRAND_COLORS.primary};">${booking.serviceName}</h3>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">${isCustomer ? 'Provider' : 'Customer'}</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${isCustomer ? booking.providerName : booking.customerName}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Duration</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.duration} minutes</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Location</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.location}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Total Amount</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${booking.currency} ${booking.totalAmount}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              ${booking.providerNotes ? `
              <div style="margin-top: 24px; padding: 16px; background: ${BRAND_COLORS.primaryLight}; border-radius: 8px;">
                <p style="margin: 0; color: ${BRAND_COLORS.primaryDark}; font-size: 14px;">
                  <strong>Provider Notes:</strong> ${booking.providerNotes}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                Questions? Contact us at support@nilin.com
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `${greeting} Your booking ${booking.bookingNumber} for ${booking.serviceName} has been confirmed on ${booking.scheduledDate} at ${booking.scheduledTime}. ${booking.currency} ${booking.totalAmount}.`
  };
};

const getBookingCancellationFullTemplate = (
  booking: BookingNotificationData,
  cancelledBy: 'customer' | 'provider' | 'admin',
  cancellerName: string
): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;

  return {
    subject: `Booking Cancelled - ${booking.bookingNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancelled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.error} 0%, #DC2626 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Booking Cancelled</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px;">Booking Cancelled</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">
                The booking <strong>${booking.bookingNumber}</strong> for <strong>${booking.serviceName}</strong> has been cancelled by <strong>${cancellerName}</strong>.
              </p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Service</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.serviceName}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Scheduled For</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate} at ${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Cancelled By</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.error};">${cancellerName}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 16px; background: #FEE2E2; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.error};">
                <p style="margin: 0; color: #991B1B; font-size: 14px;">
                  If you have any questions about this cancellation, please contact our support team.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Booking ${booking.bookingNumber} for ${booking.serviceName} has been cancelled by ${cancellerName}.`
  };
};

const getBookingRescheduledFullTemplate = (
  booking: BookingNotificationData,
  oldDate: string,
  newDate: string,
  recipient: 'customer' | 'provider'
): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;
  const greeting = recipient === 'customer' ? booking.customerName : booking.providerName;

  return {
    subject: `Booking Rescheduled - ${booking.bookingNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Rescheduled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.secondary} 0%, #EA580C 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Booking Rescheduled</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px;">Hi ${greeting}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">Your booking has been rescheduled to a new time.</p>

              <!-- Date Change Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND_COLORS.textLight};">Booking Number</p>
                    <p style="margin: 0 0 24px; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.text};">${booking.bookingNumber}</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 16px; background: #FEE2E2; border-radius: 8px; text-align: center;">
                          <p style="margin: 0 0 4px; font-size: 12px; color: #991B1B; text-transform: uppercase;">Previous</p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.error}; text-decoration: line-through;">${oldDate}</p>
                        </td>
                        <td style="width: 40px; text-align: center; vertical-align: middle;">
                          <span style="color: ${BRAND_COLORS.textLight}; font-size: 20px;">&rarr;</span>
                        </td>
                        <td style="padding: 16px; background: #D1FAE5; border-radius: 8px; text-align: center;">
                          <p style="margin: 0 0 4px; font-size: 12px; color: #065F46; text-transform: uppercase;">New</p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.success};">${newDate}</p>
                        </td>
                      </tr>
                    </table>

                    <h3 style="margin: 24px 0 8px; font-size: 16px; color: ${BRAND_COLORS.primary};">${booking.serviceName}</h3>
                    <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">at ${booking.scheduledTime}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Updated Booking</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${greeting}! Your booking ${booking.bookingNumber} for ${booking.serviceName} has been rescheduled from ${oldDate} to ${newDate}.`
  };
};

const getProviderApprovalTemplate = (
  provider: { email: string; firstName: string; businessName: string },
  dashboardUrl: string
): EmailTemplate => {
  return {
    subject: 'Congratulations! Your NILIN Provider Account is Approved',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Provider Account Approved</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Provider Account Approved</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 80px; height: 80px; background: ${BRAND_COLORS.primaryLight}; border-radius: 50%; line-height: 80px; font-size: 40px;">&#127881;</span>
              </div>

              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px; text-align: center;">Congratulations, ${provider.firstName}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; text-align: center;">
                Your provider account for <strong>${provider.businessName}</strong> has been approved.
              </p>

              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                Welcome to the NILIN provider community! You can now start listing your services and accepting bookings from customers.
              </p>

              <!-- Features List -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td>
                    ${['List and manage your services', 'Accept bookings from customers', 'Track your earnings and performance', 'Build your reputation with reviews'].map(
                      feature => `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                        <tr>
                          <td style="width: 24px; vertical-align: top;">
                            <span style="color: ${BRAND_COLORS.success};">&#10003;</span>
                          </td>
                          <td style="color: ${BRAND_COLORS.text};">${feature}</td>
                        </tr>
                      </table>
                    `
                    ).join('')}
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                Questions? Contact us at support@nilin.com
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Congratulations, ${provider.firstName}! Your provider account for ${provider.businessName} has been approved. Go to your dashboard to start accepting bookings: ${dashboardUrl}`
  };
};

const getProviderRejectionTemplate = (
  provider: { email: string; firstName: string; businessName: string },
  reason: string,
  helpUrl: string
): EmailTemplate => {
  return {
    subject: 'Provider Application Update - NILIN',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Provider Application Update</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.textLight} 0%, ${BRAND_COLORS.text} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Application Update</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px;">Hello ${provider.firstName},</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">
                Thank you for your interest in becoming a NILIN provider. After careful review, we're unable to approve your application for <strong>${provider.businessName}</strong> at this time.
              </p>

              <!-- Reason Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND_COLORS.textLight}; text-transform: uppercase;">Reason for Decision</p>
                    <p style="margin: 0; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">${reason}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                If you believe this decision was made in error or if you'd like to address the concerns mentioned, please don't hesitate to reach out to our support team.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${helpUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">Contact Support</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: ${BRAND_COLORS.textLight}; font-size: 14px; text-align: center;">
                We appreciate your interest in NILIN and hope to work with you in the future.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                support@nilin.com
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hello ${provider.firstName}, thank you for your interest in becoming a NILIN provider. After careful review, we're unable to approve your application for ${provider.businessName} at this time. Reason: ${reason}. If you have questions, please contact our support team.`
  };
};

export default {
  // Auth emails
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,

  // Booking emails
  sendBookingRequestEmail,
  sendNewBookingRequestEmail,
  sendBookingConfirmationEmail,
  sendBookingAcceptedEmail,
  sendBookingCancelledEmail,
  sendBookingRejectedEmail,
  sendBookingCompletedEmail,
  sendBookingReminderEmail,

  // New comprehensive booking emails
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendBookingRescheduled,

  // Provider emails
  sendProviderApproval,
  sendProviderRejection,

  // Loyalty emails
  sendLoyaltyPointsEmail,
};