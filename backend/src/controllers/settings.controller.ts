import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as settingsService from '../services/settings.service';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import PlatformSettings from '../models/settings.model';
import logger from '../utils/logger';
import { sendEmail } from '../services/email.service';
import { IUser } from '../models/user.model';

/**
 * Get all platform settings
 * GET /api/settings
 */
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();

  res.json({
    success: true,
    data: { settings }
  });
});

/**
 * Update platform settings
 * PATCH /api/settings
 */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req.user as IUser)?._id?.toString();

  if (!adminId) {
    throw new ApiError(401, 'Authentication required');
  }

  const { reason } = req.body;
  delete req.body.reason; // Remove reason from settings update

  const settings = await settingsService.updateSettings(req.body, adminId, reason);

  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: { settings }
  });
});

/**
 * Reset settings to defaults
 * POST /api/settings/reset
 */
export const resetSettings = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req.user as IUser)?._id?.toString();
  const settings = await settingsService.resetSettings(adminId);

  res.json({
    success: true,
    message: 'Settings reset to defaults',
    data: { settings }
  });
});

/**
 * Get settings history
 * GET /api/settings/history
 */
export const getSettingsHistory = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '50', skip = '0' } = req.query;

  const history = await settingsService.getSettingsHistory(
    parseInt(limit as string),
    parseInt(skip as string)
  );

  res.json({
    success: true,
    data: { history }
  });
});

/**
 * Upload platform logo
 * POST /api/settings/upload-logo
 */
export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req.user as IUser)?._id?.toString();

  if (!adminId) {
    throw new ApiError(401, 'Authentication required');
  }

  const file = req.file;
  if (!file) {
    throw new ApiError(400, 'No file uploaded');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new ApiError(400, 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP');
  }

  // Get current settings to check for existing logo
  const currentSettings = await PlatformSettings.getSettings();

  // Delete old logo if exists
  if (currentSettings.platformLogoPublicId) {
    try {
      await deleteFromCloudinary(currentSettings.platformLogoPublicId);
    } catch (error) {
      logger.error('Failed to delete old logo', {
        context: 'SettingsController',
        action: 'DELETE_OLD_LOGO_ERROR',
        publicId: currentSettings.platformLogoPublicId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Upload new logo using buffer upload
  const uploadResult = await uploadBufferToCloudinary(file.buffer, 'logos', {
    resourceType: 'image'
  });

  // Update settings with logo info
  const updates: any = {
    platformLogo: uploadResult.secureUrl,
    platformLogoPublicId: uploadResult.publicId
  };

  const settings = await settingsService.updateSettings(updates, adminId, 'Logo uploaded');

  res.json({
    success: true,
    message: 'Logo uploaded successfully',
    data: {
      logoUrl: uploadResult.secureUrl,
      settings
    }
  });
});

/**
 * Delete platform logo
 * DELETE /api/settings/logo
 */
export const deleteLogo = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req.user as IUser)?._id?.toString();

  if (!adminId) {
    throw new ApiError(401, 'Authentication required');
  }

  const currentSettings = await PlatformSettings.getSettings();

  if (currentSettings.platformLogoPublicId) {
    try {
      await deleteFromCloudinary(currentSettings.platformLogoPublicId);
    } catch (error) {
      logger.error('Failed to delete logo', {
        context: 'SettingsController',
        action: 'DELETE_LOGO_ERROR',
        publicId: currentSettings.platformLogoPublicId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update settings to remove logo
  const updates: any = {
    platformLogo: '',
    platformLogoPublicId: ''
  };

  const settings = await settingsService.updateSettings(updates, adminId, 'Logo deleted');

  res.json({
    success: true,
    message: 'Logo deleted successfully',
    data: { settings }
  });
});

/**
 * Export settings as JSON
 * GET /api/settings/export
 */
export const exportSettings = asyncHandler(async (_req: Request, res: Response) => {
  const exportData = await settingsService.exportSettings();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=settings-${Date.now()}.json`);

  res.json(exportData);
});

/**
 * Import settings from JSON
 * POST /api/settings/import
 */
export const importSettings = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req.user as IUser)?._id?.toString();

  if (!adminId) {
    throw new ApiError(401, 'Authentication required');
  }

  const importData = req.body;

  if (!importData || !importData.settings) {
    throw new ApiError(400, 'Invalid import file format');
  }

  const settings = await settingsService.importSettings(
    importData,
    adminId,
    'Settings imported via admin panel'
  );

  res.json({
    success: true,
    message: 'Settings imported successfully',
    data: { settings }
  });
});

/**
 * Get a single setting value
 * GET /api/settings/:key
 */
export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  const settings = await settingsService.getSettings();
  const value = (settings as any)[key];

  if (value === undefined) {
    throw new ApiError(404, `Setting '${key}' not found`);
  }

  res.json({
    success: true,
    data: { key, value }
  });
});

/**
 * Test email configuration
 * POST /api/settings/test-email
 */
export const testEmailConfig = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req.user as IUser)?._id?.toString();

  if (!adminId) {
    throw new ApiError(401, 'Authentication required');
  }

  const { testEmail } = req.body;

  if (!testEmail) {
    throw new ApiError(400, 'Test email address is required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(testEmail)) {
    throw new ApiError(400, 'Invalid email address');
  }

  // Send actual test email to verify email configuration
  const testSubject = 'NILIN Platform - Test Email';
  const testHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #E8B4A8 0%, #D4A89A 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">NILIN Platform</h1>
        <p style="color: white; margin: 10px 0 0;">Test Email Configuration</p>
      </div>
      <div style="padding: 30px; background: #F5E6E0;">
        <h2 style="color: #2D2D2D; margin-top: 0;">Email Configuration Verified</h2>
        <p style="color: #666; line-height: 1.6;">
          This is a test email sent from the NILIN Platform admin settings.
          If you received this email, your email configuration is working correctly.
        </p>
        <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Sent to:</strong> ${testEmail}<br>
            <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
            <strong>Status:</strong> <span style="color: #22c55e;">Success</span>
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    await sendEmail(testEmail, testSubject, testHtml);

    logger.info('Test email sent successfully', {
      action: 'TEST_EMAIL_SENT',
      adminId,
      testEmail,
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      data: { testEmail, sentAt: new Date().toISOString() }
    });
  } catch (error) {
    logger.error('Failed to send test email', {
      action: 'TEST_EMAIL_FAILED',
      adminId,
      testEmail,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ApiError(500, `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});
