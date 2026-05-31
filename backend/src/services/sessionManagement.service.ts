/**
 * Session Management Service
 * Manages user sessions, active devices, and trusted device flows
 */

import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import User from '../models/user.model';
import { cache } from '../config/redis';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface Session {
  sessionId: string;
  userId: string;
  device: string;
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  userAgent: string;
  deviceFingerprint?: string;
  createdAt: Date;
  lastActive: Date;
  expiresAt: Date;
  isCurrent: boolean;
  isTrusted: boolean;
  biometricVerified?: boolean;
}

export interface SessionCreateOptions {
  device: string;
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  userAgent: string;
  deviceFingerprint?: string;
  biometricVerified?: boolean;
}

export interface SessionListResult {
  sessions: Session[];
  totalCount: number;
  currentSessionId: string;
  trustedDeviceCount: number;
}

export interface SessionLimitConfig {
  maxSessions: number;
  maxTrustedDevices: number;
  sessionTTL: number; // days
  trustedDeviceTTL: number; // days
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_SESSION_CONFIG: SessionLimitConfig = {
  maxSessions: 10,
  maxTrustedDevices: 5,
  sessionTTL: 30, // 30 days
  trustedDeviceTTL: 90, // 90 days
};

// ============================================
// SessionManagementService Class
// ============================================

export class SessionManagementService {
  private config: SessionLimitConfig = DEFAULT_SESSION_CONFIG;

  /**
   * Configure session limits
   */
  configure(config: Partial<SessionLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========================================
  // Session Creation
  // ========================================

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: string,
    options: SessionCreateOptions
  ): Promise<Session> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.sessionTTL);

    // Check if this is a trusted device
    let isTrusted = false;
    if (options.deviceFingerprint) {
      const trustedDevice = user.deviceFingerprints?.find(
        (d: any) => d.fingerprint === options.deviceFingerprint && d.isTrusted
      );
      isTrusted = !!trustedDevice;
    }

    // Create session object
    const session: Session = {
      sessionId,
      userId,
      device: options.device,
      browser: options.browser,
      os: options.os,
      ip: options.ip,
      location: options.location,
      userAgent: options.userAgent,
      deviceFingerprint: options.deviceFingerprint,
      createdAt: new Date(),
      lastActive: new Date(),
      expiresAt,
      isCurrent: true,
      isTrusted,
      biometricVerified: options.biometricVerified,
    };

    // Mark other sessions as not current
    if (user.sessions) {
      user.sessions.forEach((s: any) => {
        s.isCurrent = false;
      });
    } else {
      user.sessions = [];
    }

    // Add new session
    user.sessions.push({
      sessionId: session.sessionId,
      token: sessionId,
      device: session.device,
      browser: session.browser,
      os: session.os,
      ip: session.ip,
      location: session.location,
      userAgent: session.userAgent,
      deviceFingerprint: session.deviceFingerprint,
      createdAt: session.createdAt,
      lastActive: session.lastActive,
      expiresAt: session.expiresAt,
      isCurrent: session.isCurrent,
      biometricVerified: session.biometricVerified,
    });

    // Track device
    await this.trackDevice(user, {
      fingerprint: options.deviceFingerprint,
      device: options.device,
      browser: options.browser,
      os: options.os,
      ip: options.ip,
    });

    // Enforce session limit
    await this.enforceSessionLimit(user);

    await user.save({ validateBeforeSave: false });

    // Store in Redis for fast lookup
    await this.cacheSession(session);

    logger.info('Session created', {
      userId,
      sessionId: sessionId.substring(0, 8) + '...',
      device: options.device,
      isTrusted,
    });

    // Audit log
    await createAuditLog({
      userId,
      action: 'SESSION_CREATED',
      resource: 'session',
      resourceId: sessionId,
      details: { device: options.device, ip: options.ip },
      status: 'success',
    });

    return session;
  }

  /**
   * Track device for a user
   */
  private async trackDevice(
    user: any,
    deviceInfo: {
      fingerprint?: string;
      device: string;
      browser?: string;
      os?: string;
      ip?: string;
    }
  ): Promise<void> {
    if (!deviceInfo.fingerprint) return;

    user.deviceList = user.deviceList || [];

    const existingIndex = user.deviceList.findIndex(
      (d: any) => d.fingerprint === deviceInfo.fingerprint
    );

    if (existingIndex >= 0) {
      // Update existing device
      user.deviceList[existingIndex].lastActive = new Date();
      user.deviceList[existingIndex].lastIp = deviceInfo.ip;
      user.deviceList[existingIndex].loginCount = (user.deviceList[existingIndex].loginCount || 1) + 1;
    } else {
      // Add new device
      user.deviceList.push({
        fingerprint: deviceInfo.fingerprint,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        firstSeen: new Date(),
        lastActive: new Date(),
        lastIp: deviceInfo.ip,
        loginCount: 1,
        isTrusted: false,
      });

      // Limit device list
      if (user.deviceList.length > 20) {
        user.deviceList = user.deviceList
          .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, 20);
      }
    }
  }

  /**
   * Enforce session limit
   */
  private async enforceSessionLimit(user: any): Promise<void> {
    if (!user.sessions || user.sessions.length <= this.config.maxSessions) {
      return;
    }

    // Sort by last active, keeping most recent
    const sortedSessions = user.sessions
      .filter((s: any) => s.isCurrent) // Always keep current session
      .concat(
        user.sessions
          .filter((s: any) => !s.isCurrent)
          .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
      );

    // Keep only maxSessions
    user.sessions = sortedSessions.slice(0, this.config.maxSessions);

    logger.info('Sessions trimmed due to limit', {
      userId: user._id.toString(),
      sessionCount: user.sessions.length,
    });
  }

  /**
   * Cache session in Redis
   */
  private async cacheSession(session: Session): Promise<void> {
    try {
      const ttlSeconds = Math.floor(
        (session.expiresAt.getTime() - Date.now()) / 1000
      );

      await cache.set(
        `session:${session.sessionId}`,
        JSON.stringify({
          userId: session.userId,
          deviceFingerprint: session.deviceFingerprint,
          isTrusted: session.isTrusted,
          biometricVerified: session.biometricVerified,
        }),
        ttlSeconds
      );
    } catch (error) {
      logger.warn('Failed to cache session in Redis', { sessionId: session.sessionId, error });
    }
  }

  // ========================================
  // Session Validation
  // ========================================

  /**
   * Validate a session
   */
  async validateSession(sessionId: string, userId: string): Promise<{
    valid: boolean;
    session?: Session;
    reason?: string;
  }> {
    // Check Redis first
    try {
      const cached = await cache.get(`session:${sessionId}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.userId === userId) {
          // Verify still exists in DB
          const user = await User.findOne({
            _id: userId,
            'sessions.sessionId': sessionId,
            'sessions.expiresAt': { $gt: new Date() },
          }).select('sessions.$');

          if (user?.sessions?.[0]) {
            return { valid: true, session: user.sessions[0] as unknown as Session };
          }
        }
      }
    } catch (error) {
      logger.warn('Redis session lookup failed', { sessionId, error });
    }

    // Fallback to MongoDB
    const user = await User.findOne({
      _id: userId,
      'sessions.sessionId': sessionId,
    }).select('sessions.$');

    if (!user?.sessions?.[0]) {
      return { valid: false, reason: 'Session not found' };
    }

    const session = user.sessions[0] as unknown as Session;

    // Check expiry
    if (session.expiresAt < new Date()) {
      await this.invalidateSession(userId, sessionId);
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true, session };
  }

  /**
   * Update session last active time
   */
  async touchSession(userId: string, sessionId: string): Promise<void> {
    const now = new Date();

    // Update MongoDB
    await User.updateOne(
      { _id: userId, 'sessions.sessionId': sessionId },
      { $set: { 'sessions.$.lastActive': now } }
    );

    // Refresh Redis TTL
    try {
      const cached = await cache.get(`session:${sessionId}`);
      if (cached) {
        const data = JSON.parse(cached);
        const ttlSeconds = this.config.sessionTTL * 24 * 60 * 60;
        await cache.set(`session:${sessionId}`, cached, ttlSeconds);
      }
    } catch (error) {
      logger.warn('Failed to refresh session TTL', { sessionId, error });
    }
  }

  // ========================================
  // Session Retrieval
  // ========================================

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionListResult> {
    const user = await User.findById(userId).select('sessions deviceFingerprints');

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const sessions = (user.sessions || [])
      .filter((s: any) => s.expiresAt > now)
      .map((s: any) => ({
        sessionId: s.sessionId,
        userId: s.userId || userId,
        device: s.device,
        browser: s.browser,
        os: s.os,
        ip: s.ip,
        location: s.location,
        userAgent: s.userAgent,
        deviceFingerprint: s.deviceFingerprint,
        createdAt: s.createdAt,
        lastActive: s.lastActive,
        expiresAt: s.expiresAt,
        isCurrent: s.isCurrent,
        isTrusted: s.isTrusted || false,
        biometricVerified: s.biometricVerified,
      })) as Session[];

    // Count trusted devices
    const trustedDeviceCount = (user.deviceFingerprints || [])
      .filter((d: any) => d.isTrusted)
      .length;

    const currentSession = sessions.find((s) => s.isCurrent);

    return {
      sessions,
      totalCount: sessions.length,
      currentSessionId: currentSession?.sessionId || '',
      trustedDeviceCount,
    };
  }

  // ========================================
  // Session Invalidation
  // ========================================

  /**
   * Invalidate a specific session
   */
  async invalidateSession(userId: string, sessionId: string): Promise<void> {
    // Remove from Redis
    try {
      await cache.del(`session:${sessionId}`);
    } catch (error) {
      logger.warn('Failed to remove session from Redis', { sessionId, error });
    }

    // Remove from MongoDB
    const result = await User.updateOne(
      { _id: userId },
      { $pull: { sessions: { sessionId } } }
    );

    if (result.modifiedCount > 0) {
      logger.info('Session invalidated', { userId, sessionId: sessionId.substring(0, 8) + '...' });

      await createAuditLog({
        userId,
        action: 'SESSION_INVALIDATED',
        resource: 'session',
        resourceId: sessionId,
        details: { reason: 'user_request' },
        status: 'success',
      });
    }
  }

  /**
   * Invalidate all sessions except current
   */
  async invalidateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const result = await User.updateOne(
      { _id: userId },
      { $pull: { sessions: { sessionId: { $ne: currentSessionId } } } }
    );

    // Clear all session caches
    try {
      // Get all session keys for this user and clear them
      const keys = await cache.client?.keys(`session:*`);
      if (keys && keys.length > 0) {
        for (const key of keys) {
          const data = await cache.get(key);
          if (data) {
            const sessionData = JSON.parse(data);
            if (sessionData.userId === userId && !key.includes(currentSessionId)) {
              await cache.del(key);
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to clear session caches', { userId, error });
    }

    logger.info('Other sessions invalidated', {
      userId,
      currentSessionId: currentSessionId.substring(0, 8) + '...',
      count: result.modifiedCount,
    });

    await createAuditLog({
      userId,
      action: 'OTHER_SESSIONS_INVALIDATED',
      resource: 'session',
      resourceId: currentSessionId,
      details: { invalidatedCount: result.modifiedCount },
      status: 'success',
    });

    return result.modifiedCount;
  }

  /**
   * Invalidate all sessions
   */
  async invalidateAllSessions(userId: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $set: { sessions: [] } }
    );

    // Clear all session caches
    try {
      const keys = await cache.client?.keys(`session:*`);
      if (keys && keys.length > 0) {
        for (const key of keys) {
          const data = await cache.get(key);
          if (data) {
            const sessionData = JSON.parse(data);
            if (sessionData.userId === userId) {
              await cache.del(key);
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to clear session caches', { userId, error });
    }

    logger.info('All sessions invalidated', { userId });

    await createAuditLog({
      userId,
      action: 'ALL_SESSIONS_INVALIDATED',
      resource: 'session',
      resourceId: userId,
      details: {},
      status: 'success',
    });
  }

  // ========================================
  // Trusted Devices
  // ========================================

  /**
   * Add device as trusted
   */
  async addTrustedDevice(
    userId: string,
    fingerprint: string,
    deviceName: string
  ): Promise<{ success: boolean; trustedDeviceCount: number }> {
    if (this.config.maxTrustedDevices > 0) {
      // Check current count
      const user = await User.findById(userId).select('deviceFingerprints');
      const currentCount = (user?.deviceFingerprints || [])
        .filter((d: any) => d.isTrusted)
        .length;

      if (currentCount >= this.config.maxTrustedDevices) {
        return { success: false, trustedDeviceCount: currentCount };
      }
    }

    // Update device fingerprint
    const result = await User.updateOne(
      { _id: userId, 'deviceFingerprints.fingerprint': fingerprint },
      {
        $set: {
          'deviceFingerprints.$.isTrusted': true,
          'deviceFingerprints.$.trustedAt': new Date(),
          'deviceFingerprints.$.deviceName': deviceName,
        },
      }
    );

    if (result.modifiedCount === 0) {
      // Device not found, add it
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            deviceFingerprints: {
              fingerprint,
              device: deviceName,
              firstSeen: new Date(),
              lastActive: new Date(),
              isTrusted: true,
              trustedAt: new Date(),
              deviceName,
            },
          },
        }
      );
    }

    // Update any existing sessions with this fingerprint
    await User.updateOne(
      { _id: userId, 'sessions.deviceFingerprint': fingerprint },
      { $set: { 'sessions.$.isTrusted': true } }
    );

    const user = await User.findById(userId).select('deviceFingerprints');
    const trustedCount = (user?.deviceFingerprints || [])
      .filter((d: any) => d.isTrusted)
      .length;

    logger.info('Device added as trusted', { userId, fingerprint: fingerprint.substring(0, 8) + '...', deviceName });

    await createAuditLog({
      userId,
      action: 'DEVICE_TRUSTED',
      resource: 'device',
      resourceId: fingerprint,
      details: { deviceName },
      status: 'success',
    });

    return { success: true, trustedDeviceCount: trustedCount };
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId: string, fingerprint: string): Promise<void> {
    // Update device fingerprint
    await User.updateOne(
      { _id: userId, 'deviceFingerprints.fingerprint': fingerprint },
      {
        $set: {
          'deviceFingerprints.$.isTrusted': false,
        },
        $unset: {
          'deviceFingerprints.$.trustedAt': 1,
        },
      }
    );

    // Update any existing sessions
    await User.updateOne(
      { _id: userId, 'sessions.deviceFingerprint': fingerprint },
      { $set: { 'sessions.$.isTrusted': false } }
    );

    // Invalidate sessions from this device
    await User.updateOne(
      { _id: userId, 'sessions.deviceFingerprint': fingerprint },
      { $pull: { sessions: { deviceFingerprint: fingerprint } } }
    );

    logger.info('Device removed from trusted', { userId, fingerprint: fingerprint.substring(0, 8) + '...' });

    await createAuditLog({
      userId,
      action: 'DEVICE_UNTRUSTED',
      resource: 'device',
      resourceId: fingerprint,
      details: {},
      status: 'success',
    });
  }

  /**
   * Get all trusted devices for a user
   */
  async getTrustedDevices(userId: string): Promise<Array<{
    fingerprint: string;
    device: string;
    browser?: string;
    os?: string;
    trustedAt: Date;
    lastActive: Date;
    deviceName?: string;
  }>> {
    const user = await User.findById(userId).select('deviceFingerprints');

    if (!user?.deviceFingerprints) {
      return [];
    }

    return (user.deviceFingerprints as any[])
      .filter((d) => d.isTrusted)
      .map((d) => ({
        fingerprint: d.fingerprint,
        device: d.device,
        browser: d.browser,
        os: d.os,
        trustedAt: d.trustedAt || d.firstSeen,
        lastActive: d.lastActive,
        deviceName: d.deviceName || d.device,
      }));
  }

  // ========================================
  // Biometric Integration
  // ========================================

  /**
   * Verify biometric for session (2FA bypass)
   */
  async verifyBiometric(
    userId: string,
    sessionId: string,
    biometricToken: string
  ): Promise<{ success: boolean; message: string }> {
    // In production, verify biometric token with biometric provider
    // For now, simulate verification

    // Check if device is trusted
    const sessionValidation = await this.validateSession(sessionId, userId);
    if (!sessionValidation.valid || !sessionValidation.session) {
      return { success: false, message: 'Invalid session' };
    }

    if (!sessionValidation.session.isTrusted) {
      return { success: false, message: 'Device not trusted for biometric verification' };
    }

    // Update session with biometric verification
    await User.updateOne(
      { _id: userId, 'sessions.sessionId': sessionId },
      { $set: { 'sessions.$.biometricVerified': true } }
    );

    // Update Redis cache
    try {
      const cached = await cache.get(`session:${sessionId}`);
      if (cached) {
        const data = JSON.parse(cached);
        data.biometricVerified = true;
        const ttlSeconds = this.config.sessionTTL * 24 * 60 * 60;
        await cache.set(`session:${sessionId}`, JSON.stringify(data), ttlSeconds);
      }
    } catch (error) {
      logger.warn('Failed to update biometric status in cache', { sessionId, error });
    }

    logger.info('Biometric verification successful', { userId, sessionId: sessionId.substring(0, 8) + '...' });

    return { success: true, message: 'Biometric verified' };
  }

  /**
   * Check if session can bypass 2FA (trusted device with biometric)
   */
  async canBypass2FA(sessionId: string, userId: string): Promise<boolean> {
    const sessionValidation = await this.validateSession(sessionId, userId);

    if (!sessionValidation.valid || !sessionValidation.session) {
      return false;
    }

    // Can bypass if trusted device with verified biometric
    return sessionValidation.session.isTrusted &&
           (sessionValidation.session.biometricVerified === true);
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Cleanup expired sessions (maintenance job)
   */
  async cleanupExpiredSessions(): Promise<{ deleted: number }> {
    const now = new Date();

    const result = await User.updateMany(
      { 'sessions.expiresAt': { $lt: now } },
      { $pull: { sessions: { expiresAt: { $lt: now } } } }
    );

    if (result.modifiedCount > 0) {
      logger.info('Expired sessions cleaned up', { modifiedCount: result.modifiedCount });
    }

    return { deleted: result.modifiedCount };
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeUsers: number;
    trustedDevices: number;
  }> {
    const sessionCount = await User.aggregate([
      { $unwind: '$sessions' },
      { $match: { 'sessions.expiresAt': { $gt: new Date() } } },
      { $count: 'total' },
    ]);

    const activeUserCount = await User.countDocuments({
      'sessions.0': { $exists: true },
    });

    const trustedDeviceCount = await User.aggregate([
      { $unwind: '$deviceFingerprints' },
      { $match: { 'deviceFingerprints.isTrusted': true } },
      { $count: 'total' },
    ]);

    return {
      totalSessions: sessionCount[0]?.total || 0,
      activeUsers: activeUserCount,
      trustedDevices: trustedDeviceCount[0]?.total || 0,
    };
  }
}

// Export singleton instance
export const sessionManagementService = new SessionManagementService();
export default sessionManagementService;
