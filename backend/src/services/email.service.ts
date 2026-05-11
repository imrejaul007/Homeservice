import { Resend } from 'resend';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Email templates
interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// Initialize Resend client only if API key exists
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@nilin.com';
const APP_NAME = process.env.APP_NAME || 'NILIN';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Base email function with retry support
const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> => {
  // Skip if Resend is not configured
  if (!resend) {
    logger.warn('Email service not configured - skipping email', { to, subject });
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await resend.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.data?.id,
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

  logger.error('Failed to send email after all retries', {
    to,
    subject,
    error: lastError?.message,
    action: 'EMAIL_FAILED',
  });

  throw new ApiError(500, 'Failed to send email after multiple attempts');
};

// Email verification template
const getVerificationEmailTemplate = (firstName: string, verificationToken: string, to?: string): EmailTemplate => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
  
  return {
    subject: 'Verify Your Email Address',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .logo { font-size: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏠 Home Service Platform</div>
          <p>Welcome to our community!</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName}! 👋</h2>
          <p>Thank you for registering with Home Service Platform. To complete your registration and start using our services, please verify your email address.</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p><strong>Or copy and paste this link:</strong></p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
          
          <p>This verification link will expire in 24 hours for security reasons.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <h3>What's Next? 🚀</h3>
          <ul>
            <li>✅ Verify your email (you're doing this now!)</li>
            <li>🏠 Complete your profile</li>
            <li>🔍 Start browsing amazing services</li>
            <li>⭐ Book your first appointment</li>
          </ul>
          
          <p>If you didn't create this account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
          <p>This email was sent to ${to || 'you'}</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!
      
      Welcome to Home Service Platform! 
      
      Please verify your email address by clicking this link: ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create this account, you can safely ignore this email.
      
      © ${new Date().getFullYear()} Home Service Platform
    `
  };
};

// Welcome email template
const getWelcomeEmailTemplate = (firstName: string, role: string, to?: string): EmailTemplate => {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/${role}/dashboard`;
  
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
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
  
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
  const viewBookingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking.bookingNumber}`;

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
  const respondUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/provider/bookings/${booking.bookingNumber}`;

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
  const viewBookingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking.bookingNumber}`;

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
  return {
    subject: `Reminder: ${booking.serviceName} Tomorrow`,
    html: `<h2>Hi ${firstName}!</h2><p>Just a reminder that you have ${booking.serviceName} scheduled for tomorrow at ${booking.scheduledTime}.</p>`,
    text: `Hi ${firstName}! Reminder: ${booking.serviceName} tomorrow at ${booking.scheduledTime}.`
  };
};

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingRequestEmail,
  sendNewBookingRequestEmail,
  sendBookingConfirmationEmail,
  sendBookingAcceptedEmail,
  sendBookingCancelledEmail,
  sendBookingRejectedEmail,
  sendBookingCompletedEmail,
  sendBookingReminderEmail,
  sendLoyaltyPointsEmail
};