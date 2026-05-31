/**
 * Device Fingerprint Service
 * Tracks device fingerprints for fraud detection and security
 */

import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface DeviceFingerprint {
  hash: string;
  userAgent: string;
  os: string;
  browser: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenResolution?: string;
  timezone?: string;
  language: string;
  ip: string;
  firstSeen: Date;
  lastSeen: Date;
  isSuspicious: boolean;
  suspiciousReasons: string[];
}

export interface DeviceHistory {
  userId: string;
  fingerprint: string;
  ip: string;
  location?: string;
  userAgent: string;
  timestamp: Date;
  action: 'login' | 'registration' | 'transaction' | 'password_change';
}

export interface FraudPatternMatch {
  patternType: 'duplicate_accounts' | 'account_sharing' | 'bot_behavior' | 'emulator_detection';
  confidence: number;
  details: string;
  matchedAt: Date;
}

export interface DeviceFingerprintResult {
  fingerprint: string;
  isNew: boolean;
  isSuspicious: boolean;
  riskScore: number;
  suspiciousReasons: string[];
  patterns: FraudPatternMatch[];
  shouldBlock: boolean;
}

// ============================================
// VPN/Proxy Detection Constants
// ============================================

const VPN_PROXY_INDICATORS = {
  // Private IP ranges that shouldn't be used by regular users
  privateIPRanges: ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'],
  // Known hosting/datacenter IP patterns (simplified)
  hostingProviders: ['aws', 'digitalocean', 'linode', 'vultr', 'ovh', 'azure'],
};

// ============================================
// DeviceFingerprintService Class
// ============================================

export class DeviceFingerprintService {
  // ========================================
  // Fingerprint Generation
  // ========================================

  /**
   * Generate a device fingerprint hash from multiple signals
   */
  generateFingerprint(data: {
    userAgent: string;
    ip: string;
    acceptLanguage?: string;
    screenResolution?: string;
    timezone?: string;
    canvas?: boolean;
    webgl?: boolean;
  }): string {
    const crypto = require('crypto');

    const fingerprintData = {
      ua: this.extractUserAgentSignature(data.userAgent),
      os: this.extractOS(data.userAgent),
      browser: this.extractBrowser(data.userAgent),
      deviceType: this.getDeviceType(data.userAgent),
      screenHash: data.screenResolution ? this.hashString(data.screenResolution) : 'unknown',
      tzHash: data.timezone ? this.hashString(data.timezone) : 'unknown',
      lang: data.acceptLanguage?.split(',')[0]?.substring(0, 5) || 'unknown',
      ipPrefix: data.ip.substring(0, 7), // First 3 octets for geo privacy
      canvasSupported: data.canvas ?? false,
      webglSupported: data.webgl ?? false,
    };

    const fingerprintString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 32);
  }

  /**
   * Extract a simplified user agent signature
   */
  private extractUserAgentSignature(userAgent: string): string {
    const parts = userAgent.toLowerCase().split(' ').slice(0, 3);
    return parts.join('_');
  }

  /**
   * Extract OS from user agent string
   */
  extractOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'windows';
    if (userAgent.includes('Mac OS') || userAgent.includes('Macintosh')) return 'macos';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
    if (userAgent.includes('Android')) return 'android';
    if (userAgent.includes('Linux')) return 'linux';
    return 'unknown';
  }

  /**
   * Extract browser from user agent string
   */
  extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'chrome';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'safari';
    if (userAgent.includes('Edg')) return 'edge';
    if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'opera';
    if (userAgent.includes('SamsungBrowser')) return 'samsung';
    return 'unknown';
  }

  /**
   * Get device type from user agent
   */
  getDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Simple string hashing
   */
  private hashString(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
  }

  // ========================================
  // Device Analysis
  // ========================================

  /**
   * Analyze a device fingerprint for fraud indicators
   */
  async analyzeFingerprint(
    userId: string,
    fingerprint: string,
    ip: string,
    userAgent: string
  ): Promise<DeviceFingerprintResult> {
    const result: DeviceFingerprintResult = {
      fingerprint,
      isNew: true,
      isSuspicious: false,
      riskScore: 0,
      suspiciousReasons: [],
      patterns: [],
      shouldBlock: false,
    };

    // 1. Check if this is a new device for this user
    const user = await User.findById(userId);
    if (user) {
      const existingDevice = user.deviceFingerprints?.find(
        (d: any) => d.fingerprint === fingerprint
      );
      result.isNew = !existingDevice;

      if (existingDevice) {
        // Update last seen
        existingDevice.lastSeen = new Date();
        existingDevice.ip = ip;
        await user.save({ validateBeforeSave: false });
      }
    }

    // 2. Check for VPN/Proxy indicators
    const vpnCheck = this.checkVPNProxy(ip, userAgent);
    if (vpnCheck.isVPN || vpnCheck.isProxy) {
      result.riskScore += 30;
      result.suspiciousReasons.push(
        vpnCheck.isVPN ? 'VPN detected' : 'Proxy detected'
      );
      result.patterns.push({
        patternType: 'bot_behavior',
        confidence: 60,
        details: vpnCheck.isVPN
          ? 'VPN connection detected from IP address'
          : 'Proxy connection detected from IP address',
        matchedAt: new Date(),
      });
    }

    // 3. Check for duplicate accounts from same device
    const duplicateAccounts = await this.findDuplicateAccountsByFingerprint(fingerprint, userId);
    if (duplicateAccounts.length > 0) {
      result.riskScore += 25 * Math.min(duplicateAccounts.length, 4); // Cap at 100
      result.suspiciousReasons.push(
        `Device used by ${duplicateAccounts.length + 1} accounts`
      );
      result.patterns.push({
        patternType: 'duplicate_accounts',
        confidence: 70 + (duplicateAccounts.length * 5),
        details: `Multiple accounts detected from same device fingerprint`,
        matchedAt: new Date(),
      });
    }

    // 4. Check for emulator/automated behavior
    const emulatorCheck = this.detectEmulator(userAgent);
    if (emulatorCheck.isEmulator) {
      result.riskScore += 50;
      result.suspiciousReasons.push(...emulatorCheck.reasons);
      result.patterns.push({
        patternType: 'emulator_detection',
        confidence: 80,
        details: emulatorCheck.reasons.join('; '),
        matchedAt: new Date(),
      });
    }

    // 5. Check for suspicious browser patterns
    const browserCheck = this.detectSuspiciousBrowser(userAgent);
    if (browserCheck.isSuspicious) {
      result.riskScore += 15;
      result.suspiciousReasons.push(...browserCheck.reasons);
    }

    // Determine overall suspicious status
    result.isSuspicious = result.riskScore >= 30;
    result.shouldBlock = result.riskScore >= 70;

    return result;
  }

  /**
   * Check if IP is likely VPN or Proxy
   */
  private checkVPNProxy(ip: string, userAgent: string): { isVPN: boolean; isProxy: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let isVPN = false;
    let isProxy = false;

    // Check private IP ranges
    for (const range of VPN_PROXY_INDICATORS.privateIPRanges) {
      if (ip.startsWith(range)) {
        reasons.push(`Private IP range detected: ${ip}`);
        isVPN = true;
        break;
      }
    }

    // Check localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      reasons.push('Localhost address detected');
      isVPN = true;
    }

    // Check for hosting provider signatures in user agent (simplified)
    const uaLower = userAgent.toLowerCase();
    for (const provider of VPN_PROXY_INDICATORS.hostingProviders) {
      if (uaLower.includes(provider)) {
        reasons.push(`Hosting provider detected: ${provider}`);
        isProxy = true;
        break;
      }
    }

    return { isVPN, isProxy, reasons };
  }

  /**
   * Detect potential emulator/automated usage
   */
  private detectEmulator(userAgent: string): { isEmulator: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const uaLower = userAgent.toLowerCase();

    // Check for common emulator signatures
    const emulatorPatterns = [
      { pattern: 'genymotion', reason: 'Genymotion emulator detected' },
      { pattern: 'bluestacks', reason: 'Bluestacks emulator detected' },
      { pattern: 'noxplayer', reason: 'NoxPlayer emulator detected' },
      { pattern: 'memu', reason: 'MEmu emulator detected' },
      { pattern: 'ldplayer', reason: 'LDPlayer emulator detected' },
      { pattern: 'koplayer', reason: 'KOPLAYER emulator detected' },
      { pattern: 'android studio', reason: 'Android Studio emulator detected' },
      { pattern: 'selenium', reason: 'Selenium automation detected' },
      { pattern: 'phantomjs', reason: 'PhantomJS detected' },
      { pattern: 'headless', reason: 'Headless browser detected' },
      { pattern: 'puppeteer', reason: 'Puppeteer automation detected' },
    ];

    for (const { pattern, reason } of emulatorPatterns) {
      if (uaLower.includes(pattern)) {
        reasons.push(reason);
      }
    }

    return {
      isEmulator: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Detect suspicious browser patterns
   */
  private detectSuspiciousBrowser(userAgent: string): { isSuspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const uaLower = userAgent.toLowerCase();

    // Check for extremely old browsers
    if (uaLower.includes('ie 6') || uaLower.includes('internet explorer 6')) {
      reasons.push('Very old browser detected (IE6)');
    }

    // Check for missing common browser identifiers
    if (!uaLower.includes('chrome') && !uaLower.includes('firefox') &&
        !uaLower.includes('safari') && !uaLower.includes('edge')) {
      reasons.push('Unknown browser detected');
    }

    // Check for automation tools
    if (uaLower.includes('webdriver') || uaLower.includes('automated')) {
      reasons.push('WebDriver/automation detected');
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  }

  // ========================================
  // Device History Tracking
  // ========================================

  /**
   * Track device history for a user
   */
  async trackDeviceHistory(
    userId: string,
    data: {
      fingerprint: string;
      ip: string;
      location?: string;
      userAgent: string;
      action: DeviceHistory['action'];
    }
  ): Promise<void> {
    const historyEntry: DeviceHistory = {
      userId,
      fingerprint: data.fingerprint,
      ip: data.ip,
      location: data.location,
      userAgent: data.userAgent,
      timestamp: new Date(),
      action: data.action,
    };

    // Store in user document (append to device history)
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          deviceHistory: {
            $each: [historyEntry],
            $slice: -100, // Keep last 100 entries
          },
        },
      }
    );

    logger.info('Device history tracked', {
      userId,
      fingerprint: data.fingerprint.substring(0, 8) + '...',
      action: data.action,
    });
  }

  /**
   * Get device history for a user
   */
  async getDeviceHistory(userId: string, limit: number = 50): Promise<DeviceHistory[]> {
    const user = await User.findById(userId).select('deviceHistory');

    if (!user || !user.deviceHistory) {
      return [];
    }

    return user.deviceHistory
      .slice(-limit)
      .reverse() as unknown as DeviceHistory[];
  }

  // ========================================
  // Duplicate Account Detection
  // ========================================

  /**
   * Find duplicate accounts using the same device fingerprint
   */
  async findDuplicateAccountsByFingerprint(
    fingerprint: string,
    excludeUserId?: string
  ): Promise<Array<{ userId: string; email: string; createdAt: Date }>> {
    const query: any = {
      'deviceFingerprints.fingerprint': fingerprint,
    };

    if (excludeUserId) {
      query._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    const users = await User.find(query)
      .select('_id email createdAt')
      .lean();

    return users.map((u) => ({
      userId: u._id.toString(),
      email: u.email,
      createdAt: u.createdAt,
    }));
  }

  /**
   * Find accounts using the same IP address
   */
  async findAccountsByIP(
    ip: string,
    excludeUserId?: string
  ): Promise<Array<{ userId: string; email: string; createdAt: Date }>> {
    const query: any = {
      $or: [
        { registrationIP: ip },
        { 'deviceFingerprints.ip': ip },
        { 'knownIPs': ip },
      ],
    };

    if (excludeUserId) {
      query._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    const users = await User.find(query)
      .select('_id email createdAt')
      .lean();

    return users.map((u) => ({
      userId: u._id.toString(),
      email: u.email,
      createdAt: u.createdAt,
    }));
  }

  // ========================================
  // Account Sharing Detection
  // ========================================

  /**
   * Detect potential account sharing patterns
   */
  async detectAccountSharing(userId: string): Promise<{
    isSharing: boolean;
    confidence: number;
    sharedWith: Array<{ userId: string; email: string; evidence: string[] }>;
  }> {
    const user = await User.findById(userId).select('deviceFingerprints deviceHistory');

    if (!user || !user.deviceFingerprints?.length) {
      return { isSharing: false, confidence: 0, sharedWith: [] };
    }

    const fingerprints = user.deviceFingerprints.map((d: any) => d.fingerprint);
    const sharedWith: Array<{ userId: string; email: string; evidence: string[] }> = [];

    // Find other users with matching fingerprints
    for (const fingerprint of fingerprints) {
      const sharingUsers = await User.find({
        'deviceFingerprints.fingerprint': fingerprint,
        _id: { $ne: new Types.ObjectId(userId) },
      }).select('_id email');

      for (const sharingUser of sharingUsers) {
        const existing = sharedWith.find((s) => s.userId === sharingUser._id.toString());
        if (existing) {
          existing.evidence.push(`Shared device fingerprint: ${fingerprint.substring(0, 8)}...`);
        } else {
          sharedWith.push({
            userId: sharingUser._id.toString(),
            email: sharingUser.email,
            evidence: [`Shared device fingerprint: ${fingerprint.substring(0, 8)}...`],
          });
        }
      }
    }

    // Calculate confidence based on number of shared devices and evidence
    let confidence = 0;
    if (sharedWith.length > 0) {
      confidence = Math.min(30 + (sharedWith.length * 20), 90);

      // Add bonus if multiple fingerprints are shared
      if (sharedWith.some((s) => s.evidence.length > 1)) {
        confidence += 20;
      }
    }

    return {
      isSharing: confidence >= 50,
      confidence,
      sharedWith,
    };
  }

  // ========================================
  // Device Management
  // ========================================

  /**
   * Store a new device for a user
   */
  async storeDevice(
    userId: string,
    data: {
      fingerprint: string;
      userAgent: string;
      ip: string;
      isSuspicious?: boolean;
      suspiciousReasons?: string[];
    }
  ): Promise<{ isNew: boolean; totalDevices: number }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Initialize arrays if needed
    user.deviceFingerprints = user.deviceFingerprints || [];
    user.knownIPs = user.knownIPs || [];

    // Check if device already exists
    const existingIndex = user.deviceFingerprints.findIndex(
      (d: any) => d.fingerprint === data.fingerprint
    );

    if (existingIndex >= 0) {
      // Update existing device
      user.deviceFingerprints[existingIndex].lastSeen = new Date();
      user.deviceFingerprints[existingIndex].ip = data.ip;
      if (data.isSuspicious !== undefined) {
        user.deviceFingerprints[existingIndex].isSuspicious = data.isSuspicious;
      }
      if (data.suspiciousReasons) {
        user.deviceFingerprints[existingIndex].suspiciousReasons = data.suspiciousReasons;
      }
      await user.save({ validateBeforeSave: false });
      return { isNew: false, totalDevices: user.deviceFingerprints.length };
    }

    // Add new device
    user.deviceFingerprints.push({
      fingerprint: data.fingerprint,
      userAgent: data.userAgent.substring(0, 500) || 'unknown',
      ip: data.ip,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isSuspicious: data.isSuspicious || false,
      suspiciousReasons: data.suspiciousReasons || [],
    });

    // Track IP
    if (!user.knownIPs.includes(data.ip)) {
      user.knownIPs.push(data.ip);
    }

    // Limit total devices (keep most recent 20)
    if (user.deviceFingerprints.length > 20) {
      user.deviceFingerprints = user.deviceFingerprints
        .sort((a: any, b: any) => b.lastSeen.getTime() - a.lastSeen.getTime())
        .slice(0, 20);
    }

    await user.save({ validateBeforeSave: false });

    // Audit log for new device
    await createAuditLog({
      userId,
      action: 'NEW_DEVICE_ADDED',
      resource: 'user',
      resourceId: userId,
      details: {
        fingerprint: data.fingerprint.substring(0, 8) + '...',
        ip: data.ip,
        isSuspicious: data.isSuspicious,
      },
      status: 'success',
    });

    return { isNew: true, totalDevices: user.deviceFingerprints.length };
  }

  /**
   * Remove a device from user's devices
   */
  async removeDevice(userId: string, fingerprint: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.deviceFingerprints = user.deviceFingerprints.filter(
      (d: any) => d.fingerprint !== fingerprint
    );

    // Also remove sessions with this device
    user.sessions = (user.sessions || []).filter(
      (s: any) => s.deviceFingerprint !== fingerprint
    );

    await user.save({ validateBeforeSave: false });

    await createAuditLog({
      userId,
      action: 'DEVICE_REMOVED',
      resource: 'user',
      resourceId: userId,
      details: { fingerprint: fingerprint.substring(0, 8) + '...' },
      status: 'success',
    });
  }

  /**
   * Mark a device as trusted
   */
  async trustDevice(userId: string, fingerprint: string, trusted: boolean = true): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const device = user.deviceFingerprints.find((d: any) => d.fingerprint === fingerprint);
    if (device) {
      device.isTrusted = trusted;
      device.trustedAt = trusted ? new Date() : undefined;
      await user.save({ validateBeforeSave: false });

      await createAuditLog({
        userId,
        action: trusted ? 'DEVICE_TRUSTED' : 'DEVICE_UNTRUSTED',
        resource: 'user',
        resourceId: userId,
        details: { fingerprint: fingerprint.substring(0, 8) + '...' },
        status: 'success',
      });
    }
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<any[]> {
    const user = await User.findById(userId).select('deviceFingerprints');

    if (!user || !user.deviceFingerprints) {
      return [];
    }

    return user.deviceFingerprints.map((d: any) => ({
      fingerprint: d.fingerprint,
      userAgent: d.userAgent,
      firstSeen: d.firstSeen,
      lastSeen: d.lastSeen,
      isTrusted: d.isTrusted || false,
      isSuspicious: d.isSuspicious || false,
      suspiciousReasons: d.suspiciousReasons || [],
      ip: d.ip,
    }));
  }

  /**
   * Check if a device is trusted
   */
  async isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
    const user = await User.findById(userId).select('deviceFingerprints');

    if (!user || !user.deviceFingerprints) {
      return false;
    }

    const device = user.deviceFingerprints.find((d: any) => d.fingerprint === fingerprint);
    return device?.isTrusted || false;
  }
}

// Export singleton instance
export const deviceFingerprintService = new DeviceFingerprintService();
export default deviceFingerprintService;
