/**
 * Trusted Device Flow Service
 * Manages trusted device registration, verification, and 2FA bypass
 */

import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface TrustedDevice {
  id: string;
  fingerprint: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
  firstSeen: Date;
  lastActive: Date;
  trustedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  verificationMethod?: 'email' | 'sms' | 'biometric' | 'manual';
}

export interface DeviceVerificationRequest {
  userId: string;
  fingerprint: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  verificationMethod: 'email' | 'sms' | 'biometric';
  verificationCode?: string;
}

export interface DeviceVerificationResult {
  success: boolean;
  device?: TrustedDevice;
  message: string;
  bypass2FA: boolean;
  requiresVerification: boolean;
}

export interface TrustedDeviceFlowResult {
  isTrusted: boolean;
  canBypass2FA: boolean;
  verificationRequired: boolean;
  verificationMethods: string[];
  device?: {
    id: string;
    name: string;
    lastActive: Date;
    trustedAt?: Date;
  };
}

export interface DeviceManagementAction {
  action: 'add' | 'remove' | 'verify' | 'rename';
  deviceId: string;
  success: boolean;
  message: string;
  timestamp: Date;
}

// ============================================
// TrustedDeviceFlowService Class
// ============================================

export class TrustedDeviceFlowService {
  // ========================================
  // Device Flow Check
  // ========================================

  /**
   * Check device trust status and determine flow
   */
  async checkDeviceFlow(
    userId: string,
    fingerprint: string,
    userAgent: string
  ): Promise<TrustedDeviceFlowResult> {
    const user = await User.findById(userId).select('deviceFingerprints sessions');

    if (!user) {
      throw new Error('User not found');
    }

    // Find device
    const device = user.deviceFingerprints?.find(
      (d: any) => d.fingerprint === fingerprint
    );

    // Update last active
    if (device) {
      await User.updateOne(
        { _id: userId, 'deviceFingerprints.fingerprint': fingerprint },
        { $set: { 'deviceFingerprints.$.lastActive': new Date() } }
      );
    }

    // Determine flow based on device status
    if (device?.isTrusted && device.verified) {
      // Fully trusted and verified device
      return {
        isTrusted: true,
        canBypass2FA: true,
        verificationRequired: false,
        verificationMethods: [],
        device: {
          id: fingerprint,
          name: (device as any).deviceName || (device as any).device || 'Unknown Device',
          lastActive: device.lastActive ?? new Date(),
          trustedAt: (device as any).trustedAt,
        },
      };
    }

    if (device?.isTrusted) {
      // Trusted but not verified - can bypass with verification
      return {
        isTrusted: true,
        canBypass2FA: false,
        verificationRequired: true,
        verificationMethods: ['email', 'sms', 'biometric'],
        device: {
          id: fingerprint,
          name: (device as any).deviceName || (device as any).device || 'Unknown Device',
          lastActive: device.lastActive ?? new Date(),
          trustedAt: (device as any).trustedAt,
        },
      };
    }

    // New or unrecognized device
    return {
      isTrusted: false,
      canBypass2FA: false,
      verificationRequired: true,
      verificationMethods: ['email', 'sms', 'biometric'],
      device: device ? {
        id: fingerprint,
        name: (device as any).deviceName || (device as any).device || 'Unknown Device',
        lastActive: device.lastActive ?? new Date(),
      } : undefined,
    };
  }

  // ========================================
  // Device Registration
  // ========================================

  /**
   * Register a new device
   */
  async registerDevice(
    userId: string,
    data: {
      fingerprint: string;
      deviceName: string;
      deviceType: 'mobile' | 'tablet' | 'desktop';
      browser?: string;
      os?: string;
      userAgent: string;
      ip: string;
    }
  ): Promise<{
    success: boolean;
    device: TrustedDevice;
    message: string;
    requiresVerification: boolean;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if device already exists
    const existingDevice = user.deviceFingerprints?.find(
      (d: any) => d.fingerprint === data.fingerprint
    );

    if (existingDevice) {
      // Update existing device
      existingDevice.lastActive = new Date();
      existingDevice.lastIp = data.ip;
      await user.save({ validateBeforeSave: false });

      return {
        success: true,
        device: this.mapToTrustedDevice(existingDevice),
        message: 'Device already registered',
        requiresVerification: !existingDevice.isTrusted || !existingDevice.verified,
      };
    }

    // Add new device
    const newDevice = {
      fingerprint: data.fingerprint,
      device: data.deviceName,
      deviceType: data.deviceType,
      browser: data.browser,
      os: data.os,
      userAgent: data.userAgent,
      ip: data.ip,
      firstSeen: new Date(),
      lastSeen: new Date(),
      lastActive: new Date(),
      isTrusted: false,
      isSuspicious: false,
      verified: false,
      loginCount: 1,
    };

    user.deviceFingerprints = user.deviceFingerprints || [];
    user.deviceFingerprints.push(newDevice);

    // Keep only last 20 devices
    if (user.deviceFingerprints.length > 20) {
      user.deviceFingerprints = user.deviceFingerprints
        .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
        .slice(0, 20);
    }

    await user.save({ validateBeforeSave: false });

    logger.info('Device registered', {
      userId,
      fingerprint: data.fingerprint.substring(0, 8) + '...',
      deviceName: data.deviceName,
    });

    await createAuditLog({
      userId,
      action: 'DEVICE_REGISTERED',
      resource: 'device',
      resourceId: data.fingerprint,
      details: { deviceName: data.deviceName, deviceType: data.deviceType },
      status: 'success',
    });

    return {
      success: true,
      device: this.mapToTrustedDevice(newDevice),
      message: 'Device registered successfully',
      requiresVerification: true,
    };
  }

  /**
   * Map device object to TrustedDevice interface
   */
  private mapToTrustedDevice(device: any): TrustedDevice {
    return {
      id: device.fingerprint,
      fingerprint: device.fingerprint,
      deviceName: device.deviceName || device.device || 'Unknown Device',
      deviceType: device.deviceType || 'desktop',
      browser: device.browser,
      os: device.os,
      firstSeen: device.firstSeen,
      lastActive: device.lastActive,
      trustedAt: device.trustedAt,
      verified: device.verified || false,
      verifiedAt: device.verifiedAt,
      verificationMethod: device.verificationMethod,
    };
  }

  // ========================================
  // Device Verification
  // ========================================

  /**
   * Initiate device verification
   */
  async initiateVerification(request: DeviceVerificationRequest): Promise<{
    success: boolean;
    verificationId: string;
    method: string;
    expiresAt: Date;
    message: string;
  }> {
    const { userId, fingerprint, verificationMethod } = request;

    // Generate verification code
    const verificationCode = this.generateVerificationCode();
    const verificationId = new Types.ObjectId().toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry

    // Store verification in user document (temporary)
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pendingDeviceVerification: {
            fingerprint,
            verificationId,
            method: verificationMethod,
            code: verificationCode,
            expiresAt,
            createdAt: new Date(),
          },
        },
      }
    );

    // Send verification code based on method
    const user = await User.findById(userId).select('email phone');
    let sentTo = '';

    switch (verificationMethod) {
      case 'email':
        // In production, send email with code
        sentTo = user?.email || '';
        logger.info('Device verification email sent', { userId, sentTo });
        break;
      case 'sms':
        // In production, send SMS with code
        sentTo = user?.phone ? this.maskPhone(user.phone) : '';
        logger.info('Device verification SMS sent', { userId, sentTo });
        break;
      case 'biometric':
        // In production, trigger biometric prompt
        logger.info('Device biometric verification initiated', { userId });
        break;
    }

    logger.info('Device verification initiated', {
      userId,
      verificationId,
      method: verificationMethod,
      expiresAt,
    });

    return {
      success: true,
      verificationId,
      method: verificationMethod,
      expiresAt,
      message: `Verification code sent via ${verificationMethod}${sentTo ? ` to ${sentTo}` : ''}`,
    };
  }

  /**
   * Verify device with code
   */
  async verifyDevice(
    userId: string,
    verificationId: string,
    code: string
  ): Promise<DeviceVerificationResult> {
    const user = await User.findById(userId);

    if (!user || !user.pendingDeviceVerification) {
      return {
        success: false,
        message: 'No pending verification found',
        bypass2FA: false,
        requiresVerification: true,
      };
    }

    const pending = user.pendingDeviceVerification as {
      expiresAt: Date;
      code: string;
      fingerprint: string;
      method?: string;
    };

    // Check expiry
    if (pending.expiresAt < new Date()) {
      // Clear pending verification
      await User.updateOne(
        { _id: userId },
        { $unset: { pendingDeviceVerification: 1 } }
      );

      return {
        success: false,
        message: 'Verification code has expired',
        bypass2FA: false,
        requiresVerification: true,
      };
    }

    // Check code
    if (pending.code !== code) {
      return {
        success: false,
        message: 'Invalid verification code',
        bypass2FA: false,
        requiresVerification: true,
      };
    }

    // Find device
    const device = user.deviceFingerprints?.find(
      (d: any) => d.fingerprint === pending.fingerprint
    );

    if (!device) {
      return {
        success: false,
        message: 'Device not found',
        bypass2FA: false,
        requiresVerification: true,
      };
    }

    // Mark device as trusted and verified
    device.isTrusted = true;
    device.trustedAt = new Date();
    device.verified = true;
    device.verifiedAt = new Date();
    device.verificationMethod = pending.method;

    // Clear pending verification
    await User.updateOne(
      { _id: userId },
      { $unset: { pendingDeviceVerification: 1 } }
    );

    await user.save({ validateBeforeSave: false });

    logger.info('Device verified and trusted', {
      userId,
      fingerprint: pending.fingerprint.substring(0, 8) + '...',
      method: pending.method,
    });

    await createAuditLog({
      userId,
      action: 'DEVICE_VERIFIED',
      resource: 'device',
      resourceId: pending.fingerprint,
      details: { method: pending.method },
      status: 'success',
    });

    return {
      success: true,
      device: this.mapToTrustedDevice(device),
      message: 'Device verified and added to trusted devices',
      bypass2FA: true,
      requiresVerification: false,
    };
  }

  /**
   * Generate verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Mask phone number for display
   */
  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2);
  }

  // ========================================
  // Device Management
  // ========================================

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<{
    devices: TrustedDevice[];
    totalCount: number;
    trustedCount: number;
    maxDevices: number;
  }> {
    const user = await User.findById(userId).select('deviceFingerprints');

    if (!user || !user.deviceFingerprints) {
      return {
        devices: [],
        totalCount: 0,
        trustedCount: 0,
        maxDevices: 5,
      };
    }

    const devices = user.deviceFingerprints
      .map((d: any) => this.mapToTrustedDevice(d))
      .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());

    const trustedCount = devices.filter((d) => d.verified && d.trustedAt).length;

    return {
      devices,
      totalCount: devices.length,
      trustedCount,
      maxDevices: 5,
    };
  }

  /**
   * Remove a device
   */
  async removeDevice(userId: string, fingerprint: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Find device
    const deviceIndex = user.deviceFingerprints?.findIndex(
      (d: any) => d.fingerprint === fingerprint
    );

    if (deviceIndex === undefined || deviceIndex === -1) {
      return { success: false, message: 'Device not found' };
    }

    const device = user.deviceFingerprints[deviceIndex];
    const wasTrusted = device.isTrusted;

    // Remove device
    user.deviceFingerprints.splice(deviceIndex, 1);

    // Also remove sessions from this device
    user.sessions = (user.sessions || []).filter(
      (s: any) => s.deviceFingerprint !== fingerprint
    );

    await user.save({ validateBeforeSave: false });

    logger.info('Device removed', {
      userId,
      fingerprint: fingerprint.substring(0, 8) + '...',
      wasTrusted,
    });

    await createAuditLog({
      userId,
      action: 'DEVICE_REMOVED',
      resource: 'device',
      resourceId: fingerprint,
      details: { wasTrusted },
      status: 'success',
    });

    return {
      success: true,
      message: wasTrusted
        ? 'Trusted device removed'
        : 'Device removed from your account',
    };
  }

  /**
   * Rename a device
   */
  async renameDevice(
    userId: string,
    fingerprint: string,
    newName: string
  ): Promise<{
    success: boolean;
    device?: TrustedDevice;
    message: string;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Find device
    const device = user.deviceFingerprints?.find(
      (d: any) => d.fingerprint === fingerprint
    );

    if (!device) {
      return { success: false, message: 'Device not found' };
    }

    // Update name
    device.deviceName = newName;

    await user.save({ validateBeforeSave: false });

    logger.info('Device renamed', { userId, fingerprint: fingerprint.substring(0, 8) + '...', newName });

    return {
      success: true,
      device: this.mapToTrustedDevice(device),
      message: 'Device renamed successfully',
    };
  }

  /**
   * Set device as trusted without verification (admin action)
   */
  async trustDeviceManually(
    userId: string,
    fingerprint: string,
    adminId: string
  ): Promise<{
    success: boolean;
    device?: TrustedDevice;
    message: string;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Find device
    const device = user.deviceFingerprints?.find(
      (d: any) => d.fingerprint === fingerprint
    );

    if (!device) {
      return { success: false, message: 'Device not found' };
    }

    // Mark as trusted
    device.isTrusted = true;
    device.trustedAt = new Date();
    device.verified = true;
    device.verifiedAt = new Date();
    device.verificationMethod = 'manual';

    await user.save({ validateBeforeSave: false });

    logger.info('Device trusted manually by admin', {
      userId,
      fingerprint: fingerprint.substring(0, 8) + '...',
      adminId,
    });

    await createAuditLog({
      userId,
      action: 'DEVICE_TRUSTED_ADMIN',
      resource: 'device',
      resourceId: fingerprint,
      details: { adminId },
      status: 'success',
    });

    return {
      success: true,
      device: this.mapToTrustedDevice(device),
      message: 'Device trusted by administrator',
    };
  }

  // ========================================
  // 2FA Bypass Logic
  // ========================================

  /**
   * Check if a device/session can bypass 2FA
   */
  async canBypass2FA(
    userId: string,
    sessionId: string
  ): Promise<{
    canBypass: boolean;
    reason?: string;
    requirements?: string[];
  }> {
    const user = await User.findById(userId).select('sessions deviceFingerprints twoFactorEnabled');

    if (!user) {
      return { canBypass: false, reason: 'User not found' };
    }

    // Find session
    const session = user.sessions?.find((s: any) => s.sessionId === sessionId);

    if (!session) {
      return { canBypass: false, reason: 'Session not found' };
    }

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled) {
      return { canBypass: true };
    }

    // Check if device is trusted and verified
    if (session.deviceFingerprint) {
      const device = user.deviceFingerprints?.find(
        (d: any) => d.fingerprint === session.deviceFingerprint
      );

      if (device?.isTrusted && device.verified) {
        // Check if biometric is verified for additional security
        if (session.biometricVerified) {
          return { canBypass: true };
        }

        return {
          canBypass: false,
          reason: 'Biometric verification required for trusted device',
          requirements: ['biometric'],
        };
      }
    }

    return {
      canBypass: false,
      reason: 'Device not trusted or verified',
      requirements: ['trusted_device', '2fa'],
    };
  }

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Remove all non-trusted devices
   */
  async removeUntrustedDevices(userId: string): Promise<{
    success: boolean;
    removedCount: number;
    message: string;
  }> {
    const user = await User.findById(userId);

    if (!user || !user.deviceFingerprints) {
      return { success: true, removedCount: 0, message: 'No devices to remove' };
    }

    const initialCount = user.deviceFingerprints.length;

    // Filter out non-trusted devices
    user.deviceFingerprints = user.deviceFingerprints.filter(
      (d: any) => d.isTrusted
    );

    const removedCount = initialCount - user.deviceFingerprints.length;

    if (removedCount > 0) {
      await user.save({ validateBeforeSave: false });

      logger.info('Untrusted devices removed', { userId, removedCount });

      await createAuditLog({
        userId,
        action: 'UNTRUSTED_DEVICES_REMOVED',
        resource: 'device',
        resourceId: userId,
        details: { removedCount },
        status: 'success',
      });
    }

    return {
      success: true,
      removedCount,
      message: removedCount > 0
        ? `Removed ${removedCount} untrusted device(s)`
        : 'No untrusted devices found',
    };
  }

  /**
   * Reset all trusted devices (security action)
   */
  async resetAllTrustedDevices(userId: string, reason: string): Promise<{
    success: boolean;
    resetCount: number;
    message: string;
  }> {
    const user = await User.findById(userId);

    if (!user || !user.deviceFingerprints) {
      return { success: true, resetCount: 0, message: 'No devices to reset' };
    }

    const trustedCount = user.deviceFingerprints.filter(
      (d: any) => d.isTrusted
    ).length;

    // Reset all devices to untrusted
    user.deviceFingerprints.forEach((d: any) => {
      d.isTrusted = false;
      d.verified = false;
      d.verifiedAt = undefined;
      d.trustedAt = undefined;
      d.verificationMethod = undefined;
    });

    // Invalidate all sessions
    user.sessions = [];

    await user.save({ validateBeforeSave: false });

    logger.warn('All trusted devices reset', { userId, reason, trustedCount });

    await createAuditLog({
      userId,
      action: 'ALL_TRUSTED_DEVICES_RESET',
      resource: 'device',
      resourceId: userId,
      details: { reason, deviceCount: trustedCount },
      status: 'success',
    });

    return {
      success: true,
      resetCount: trustedCount,
      message: `Reset ${trustedCount} trusted device(s). You will need to re-verify devices.`,
    };
  }
}

// Export singleton instance
export const trustedDeviceFlowService = new TrustedDeviceFlowService();
export default trustedDeviceFlowService;
