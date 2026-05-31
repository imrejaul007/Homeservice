/**
 * Login Anomaly Detection Service
 * Detects login security threats including credential stuffing, impossible travel
 */

import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';
import { vpnProxyDetectionService } from './vpnProxyDetection.service';

// ============================================
// Type Definitions
// ============================================

export interface LoginAttempt {
  userId: string;
  ip: string;
  userAgent: string;
  location?: string;
  success: boolean;
  timestamp: Date;
  deviceFingerprint?: string;
}

export interface AnomalyAlert {
  id: string;
  type: 'impossible_travel' | 'credential_stuffing' | 'new_location' | 'new_device' |
         'brute_force' | 'account_takeover' | 'suspicious_ip';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  message: string;
  details: Record<string, unknown>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  action?: string;
}

export interface LoginSecurityCheck {
  allowed: boolean;
  challenges: string[];
  blocked: boolean;
  blockReason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  alerts: AnomalyAlert[];
  recommendations: string[];
}

export interface ImpossibleTravelEvent {
  userId: string;
  previousLocation: {
    ip: string;
    city?: string;
    country?: string;
    timestamp: Date;
  };
  currentLocation: {
    ip: string;
    city?: string;
    country?: string;
    timestamp: Date;
  };
  distance: number; // km
  timeDifference: number; // hours
  speed: number; // km/h
  isImpossible: boolean;
}

export interface BruteForceStatus {
  attempts: number;
  locked: boolean;
  lockExpiresAt?: Date;
  lastAttempt: Date;
}

// ============================================
// Thresholds
// ============================================

const LOGIN_SECURITY_THRESHOLDS = {
  // Impossible travel
  impossibleTravel: {
    maxSpeed: 1000, // km/h (commercial flight + buffer)
    minDistance: 100, // km (ignore very short distances)
  },

  // Brute force
  bruteForce: {
    maxAttempts: 5,
    lockoutMinutes: 30,
    windowMinutes: 15,
  },

  // Credential stuffing
  credentialStuffing: {
    maxFailedFromSameIP: 10,
    windowMinutes: 60,
  },

  // New device/location
  newDevice: {
    trustedDeviceThreshold: 3, // Login count before device is considered trusted
  },

  // Rate limiting
  rateLimit: {
    maxLoginAttemptsPerMinute: 3,
    maxLoginAttemptsPerHour: 20,
  },
};

// ============================================
// LoginAnomalyDetectionService Class
// ============================================

export class LoginAnomalyDetectionService {
  // ========================================
  // Login Security Check
  // ========================================

  /**
   * Perform comprehensive login security check
   */
  async checkLogin(
    userId: string,
    email: string,
    ip: string,
    userAgent: string,
    success: boolean
  ): Promise<LoginSecurityCheck> {
    const alerts: AnomalyAlert[] = [];
    const challenges: string[] = [];
    let riskScore = 0;

    // 1. Check for brute force attacks
    const bruteForceCheck = await this.checkBruteForce(email, ip, success);
    if (bruteForceCheck.isBlocked) {
      return {
        allowed: false,
        challenges: [],
        blocked: true,
        blockReason: bruteForceCheck.reason,
        riskLevel: 'critical',
        riskScore: 100,
        alerts: bruteForceCheck.alerts,
        recommendations: ['Account temporarily locked due to too many failed attempts'],
      };
    }
    if (bruteForceCheck.riskScore > 0) {
      riskScore += bruteForceCheck.riskScore;
      alerts.push(...bruteForceCheck.alerts);
    }

    // 2. Check for credential stuffing
    const stuffingCheck = await this.checkCredentialStuffing(ip);
    if (stuffingCheck.isBlocked) {
      return {
        allowed: false,
        challenges: [],
        blocked: true,
        blockReason: stuffingCheck.reason,
        riskLevel: 'critical',
        riskScore: 100,
        alerts: stuffingCheck.alerts,
        recommendations: ['Too many failed login attempts from this location'],
      };
    }
    if (stuffingCheck.riskScore > 0) {
      riskScore += stuffingCheck.riskScore;
      alerts.push(...stuffingCheck.alerts);
    }

    // 3. Check for impossible travel (only on successful logins)
    if (success) {
      const travelCheck = await this.checkImpossibleTravel(userId, ip);
      if (travelCheck.isImpossible) {
        riskScore += 50;
        alerts.push({
          id: new Types.ObjectId().toString(),
          type: 'impossible_travel',
          severity: 'high',
          userId,
          message: `Impossible travel detected: ${travelCheck.distance.toFixed(0)}km in ${travelCheck.timeDifference.toFixed(1)} hours`,
          details: {
            previousLocation: travelCheck.previousLocation,
            currentLocation: travelCheck.currentLocation,
            speed: travelCheck.speed,
          },
          detectedAt: new Date(),
        });
        challenges.push('verify_location');
      }

      // 4. Check for new location
      const locationCheck = await this.checkNewLocation(userId, ip);
      if (locationCheck.isNew) {
        riskScore += 20;
        alerts.push({
          id: new Types.ObjectId().toString(),
          type: 'new_location',
          severity: 'medium',
          userId,
          message: `Login from new location: ${locationCheck.city}, ${locationCheck.country}`,
          details: {
            city: locationCheck.city,
            country: locationCheck.country,
            isVPN: locationCheck.isVPN,
          },
          detectedAt: new Date(),
        });
        challenges.push('verify_new_location');
      }

      // 5. Check for new device
      const deviceCheck = await this.checkNewDevice(userId, userAgent, ip);
      if (deviceCheck.isNew) {
        riskScore += 15;
        alerts.push({
          id: new Types.ObjectId().toString(),
          type: 'new_device',
          severity: 'low',
          userId,
          message: `Login from new device: ${deviceCheck.deviceType}`,
          details: {
            deviceType: deviceCheck.deviceType,
            browser: deviceCheck.browser,
            os: deviceCheck.os,
          },
          detectedAt: new Date(),
        });
        challenges.push('verify_device');
      }
    }

    // 6. Check VPN/Proxy
    const vpnCheck = await vpnProxyDetectionService.checkRequest({
      ip,
      userId,
      action: 'login',
    });
    if (!vpnCheck.allowed) {
      riskScore += vpnCheck.ipData.riskScore;
      if (vpnCheck.blockAction) {
        return {
          allowed: false,
          challenges: [],
          blocked: true,
          blockReason: vpnCheck.reasons.join('; '),
          riskLevel: 'critical',
          riskScore: 100,
          alerts: [
            {
              id: new Types.ObjectId().toString(),
              type: 'suspicious_ip',
              severity: 'critical',
              userId,
              message: 'VPN/Proxy/Tor detected',
              details: { reasons: vpnCheck.reasons },
              detectedAt: new Date(),
            },
          ],
          recommendations: ['Contact support to verify your identity'],
        };
      }
      challenges.push('verify_vpn');
    }

    // Determine overall risk level
    let riskLevel: LoginSecurityCheck['riskLevel'] = 'low';
    if (riskScore >= 80) riskLevel = 'critical';
    else if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    // Generate recommendations
    const recommendations: string[] = [];
    if (alerts.some((a) => a.type === 'impossible_travel')) {
      recommendations.push('Verify your account via email or phone');
    }
    if (alerts.some((a) => a.type === 'new_location')) {
      recommendations.push('Consider enabling 2FA for additional security');
    }
    if (alerts.some((a) => a.type === 'new_device')) {
      recommendations.push('Add this device to your trusted devices');
    }

    // Log alerts
    for (const alert of alerts) {
      await this.logAlert(alert);
    }

    return {
      allowed: riskScore < 80,
      challenges,
      blocked: riskScore >= 80,
      riskLevel,
      riskScore,
      alerts,
      recommendations,
    };
  }

  // ========================================
  // Brute Force Detection
  // ========================================

  /**
   * Check for brute force attacks
   */
  private async checkBruteForce(
    email: string,
    ip: string,
    success: boolean
  ): Promise<{
    isBlocked: boolean;
    reason?: string;
    riskScore: number;
    alerts: AnomalyAlert[];
  }> {
    const alerts: AnomalyAlert[] = [];
    let riskScore = 0;

    // Get recent login attempts
    const recentAttempts = await this.getRecentLoginAttempts(email, LOGIN_SECURITY_THRESHOLDS.bruteForce.windowMinutes);

    // Filter failed attempts
    const failedAttempts = recentAttempts.filter((a) => !a.success);

    if (failedAttempts.length >= LOGIN_SECURITY_THRESHOLDS.bruteForce.maxAttempts) {
      // Check if already locked
      const user = await User.findOne({ email }).select('lockUntil');
      if (user?.lockUntil && user.lockUntil > new Date()) {
        return {
          isBlocked: true,
          reason: 'Account is temporarily locked due to too many failed attempts',
          riskScore: 100,
          alerts: [],
        };
      }

      // Lock the account
      await this.lockAccount(email, LOGIN_SECURITY_THRESHOLDS.bruteForce.lockoutMinutes);

      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'brute_force',
        severity: 'critical',
        userId: (await User.findOne({ email }))?._id?.toString() || '',
        message: `Account locked due to ${failedAttempts.length} failed login attempts`,
        details: { attempts: failedAttempts.length, windowMinutes: LOGIN_SECURITY_THRESHOLDS.bruteForce.windowMinutes },
        detectedAt: new Date(),
      });

      return {
        isBlocked: true,
        reason: 'Account temporarily locked for security',
        riskScore: 100,
        alerts,
      };
    }

    // Add warning for high failed attempts
    if (failedAttempts.length >= LOGIN_SECURITY_THRESHOLDS.bruteForce.maxAttempts - 2) {
      riskScore += 30;
      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'brute_force',
        severity: 'high',
        userId: (await User.findOne({ email }))?._id?.toString() || '',
        message: `${failedAttempts.length} failed login attempts detected`,
        details: { attempts: failedAttempts.length },
        detectedAt: new Date(),
      });
    }

    return { isBlocked: false, riskScore, alerts };
  }

  /**
   * Lock user account
   */
  private async lockAccount(email: string, minutes: number): Promise<void> {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + minutes);

    await User.updateOne(
      { email },
      {
        $set: {
          lockUntil,
          accountStatus: 'locked',
        },
      }
    );

    logger.warn('Account locked due to brute force', { email, lockUntil });

    await createAuditLog({
      userId: email,
      action: 'ACCOUNT_LOCKED',
      resource: 'security',
      resourceId: email,
      details: { reason: 'brute_force', lockUntil },
      status: 'success',
    });
  }

  /**
   * Get recent login attempts for an email
   */
  private async getRecentLoginAttempts(email: string, windowMinutes: number): Promise<LoginAttempt[]> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

    // In production, query LoginAttempt model
    // For now, return empty array (actual implementation would track login attempts)
    return [];
  }

  // ========================================
  // Credential Stuffing Detection
  // ========================================

  /**
   * Check for credential stuffing attacks
   */
  private async checkCredentialStuffing(ip: string): Promise<{
    isBlocked: boolean;
    reason?: string;
    riskScore: number;
    alerts: AnomalyAlert[];
  }> {
    const alerts: AnomalyAlert[] = [];
    let riskScore = 0;

    // In production, query LoginAttempt model for IP-based stats
    // Check how many failed logins from this IP in the time window
    const failedFromIP = await this.getFailedLoginsFromIP(ip, LOGIN_SECURITY_THRESHOLDS.credentialStuffing.windowMinutes);

    if (failedFromIP >= LOGIN_SECURITY_THRESHOLDS.credentialStuffing.maxFailedFromSameIP) {
      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'credential_stuffing',
        severity: 'critical',
        userId: '',
        message: `Credential stuffing detected: ${failedFromIP} failed logins from IP ${ip}`,
        details: { ip, attempts: failedFromIP },
        detectedAt: new Date(),
      });

      return {
        isBlocked: true,
        reason: 'Too many failed login attempts from this location',
        riskScore: 100,
        alerts,
      };
    }

    if (failedFromIP >= LOGIN_SECURITY_THRESHOLDS.credentialStuffing.maxFailedFromSameIP / 2) {
      riskScore += 40;
      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'credential_stuffing',
        severity: 'medium',
        userId: '',
        message: `High failed login count from IP: ${failedFromIP}`,
        details: { ip, attempts: failedFromIP },
        detectedAt: new Date(),
      });
    }

    return { isBlocked: false, riskScore, alerts };
  }

  /**
   * Get failed logins from an IP
   */
  private async getFailedLoginsFromIP(ip: string, windowMinutes: number): Promise<number> {
    // In production, query LoginAttempt model
    return 0;
  }

  // ========================================
  // Impossible Travel Detection
  // ========================================

  /**
   * Check for impossible travel
   */
  private async checkImpossibleTravel(userId: string, currentIP: string): Promise<ImpossibleTravelEvent> {
    // Get last login
    const lastLogin = await this.getLastLogin(userId);

    if (!lastLogin) {
      return {
        userId,
        previousLocation: {
          ip: '',
          timestamp: new Date(),
        },
        currentLocation: {
          ip: currentIP,
          timestamp: new Date(),
        },
        distance: 0,
        timeDifference: 0,
        speed: 0,
        isImpossible: false,
      };
    }

    // Check travel using VPN/Proxy service
    const travelCheck = await vpnProxyDetectionService.detectImpossibleTravel(
      userId,
      currentIP,
      lastLogin.ip,
      lastLogin.timestamp
    );

    // Get current location
    const currentGeo = await vpnProxyDetectionService.getGeolocation(currentIP);
    const previousGeo = await vpnProxyDetectionService.getGeolocation(lastLogin.ip);

    return {
      userId,
      previousLocation: {
        ip: lastLogin.ip,
        city: previousGeo?.city,
        country: previousGeo?.country,
        timestamp: lastLogin.timestamp,
      },
      currentLocation: {
        ip: currentIP,
        city: currentGeo?.city,
        country: currentGeo?.country,
        timestamp: new Date(),
      },
      distance: travelCheck.distance,
      timeDifference: travelCheck.timeDifference,
      speed: travelCheck.maxPossibleSpeed,
      isImpossible: travelCheck.isImpossible && travelCheck.distance > LOGIN_SECURITY_THRESHOLDS.impossibleTravel.minDistance,
    };
  }

  /**
   * Get last login for a user
   */
  private async getLastLogin(userId: string): Promise<{ ip: string; timestamp: Date } | null> {
    const user = await User.findById(userId).select('lastLogin');

    if (!user?.lastLogin) {
      return null;
    }

    // In production, also query LoginAttempt model for IP
    return {
      ip: '', // Would come from LoginAttempt
      timestamp: user.lastLogin,
    };
  }

  // ========================================
  // New Location Detection
  // ========================================

  /**
   * Check for new location
   */
  private async checkNewLocation(userId: string, ip: string): Promise<{
    isNew: boolean;
    city?: string;
    country?: string;
    isVPN: boolean;
  }> {
    const geo = await vpnProxyDetectionService.getGeolocation(ip);

    if (!geo) {
      return { isNew: false, isVPN: false };
    }

    // Check against known locations
    const user = await User.findById(userId).select('knownLocations');

    if (!user?.knownLocations || user.knownLocations.length === 0) {
      // First login - add location
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            knownLocations: {
              $each: [{
                city: geo.city,
                country: geo.country,
                ip: ip.substring(0, 7) + 'xxx', // Masked
                firstSeen: new Date(),
                lastSeen: new Date(),
              }],
              $slice: -50,
            },
          },
        }
      );
      return { isNew: true, city: geo.city, country: geo.country, isVPN: false };
    }

    // Check if location is known
    const knownLocation = user.knownLocations.find(
      (l: any) => l.city === geo.city && l.country === geo.country
    );

    if (knownLocation) {
      // Update last seen
      await User.updateOne(
        { _id: userId, 'knownLocations.city': geo.city, 'knownLocations.country': geo.country },
        { $set: { 'knownLocations.$.lastSeen': new Date() } }
      );
      return { isNew: false, isVPN: false };
    }

    // New location - add it
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          knownLocations: {
            $each: [{
              city: geo.city,
              country: geo.country,
              ip: ip.substring(0, 7) + 'xxx',
              firstSeen: new Date(),
              lastSeen: new Date(),
            }],
            $slice: -50,
          },
        },
      }
    );

    // Check VPN
    const vpnCheck = await vpnProxyDetectionService.checkRequest({
      ip,
      userId,
      action: 'login',
    });

    return { isNew: true, city: geo.city, country: geo.country, isVPN: !vpnCheck.allowed };
  }

  // ========================================
  // New Device Detection
  // ========================================

  /**
   * Check for new device
   */
  private async checkNewDevice(
    userId: string,
    userAgent: string,
    ip: string
  ): Promise<{
    isNew: boolean;
    deviceType: string;
    browser: string;
    os: string;
  }> {
    // Generate device fingerprint
    const fingerprint = this.generateDeviceFingerprint(userAgent, ip);

    // Check against known devices
    const user = await User.findById(userId).select('deviceFingerprints');

    if (!user?.deviceFingerprints || user.deviceFingerprints.length === 0) {
      // First device
      return {
        isNew: true,
        deviceType: this.getDeviceType(userAgent),
        browser: this.extractBrowser(userAgent),
        os: this.extractOS(userAgent),
      };
    }

    // Check if device is known
    const knownDevice = user.deviceFingerprints.find(
      (d: any) => d.fingerprint === fingerprint
    );

    if (knownDevice) {
      // Update last seen
      await User.updateOne(
        { _id: userId, 'deviceFingerprints.fingerprint': fingerprint },
        { $set: { 'deviceFingerprints.$.lastSeen': new Date() } }
      );
      return { isNew: false, deviceType: '', browser: '', os: '' };
    }

    return {
      isNew: true,
      deviceType: this.getDeviceType(userAgent),
      browser: this.extractBrowser(userAgent),
      os: this.extractOS(userAgent),
    };
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(userAgent: string, ip: string): string {
    const crypto = require('crypto');
    const data = {
      ua: userAgent.split(' ').slice(0, 2).join(' '),
      os: this.extractOS(userAgent),
      browser: this.extractBrowser(userAgent),
      ip: ip.substring(0, 7),
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
  }

  /**
   * Extract OS from user agent
   */
  private extractOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown';
  }

  /**
   * Extract browser from user agent
   */
  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edg')) return 'Edge';
    return 'Unknown';
  }

  /**
   * Get device type from user agent
   */
  private getDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'Mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'Tablet';
    }
    return 'Desktop';
  }

  // ========================================
  // Alert Management
  // ========================================

  /**
   * Log an anomaly alert
   */
  private async logAlert(alert: AnomalyAlert): Promise<void> {
    // Store alert (in production, query Alert model)
    logger.info('Login anomaly detected', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      userId: alert.userId,
      message: alert.message,
    });

    if (alert.severity === 'high' || alert.severity === 'critical') {
      await createAuditLog({
        userId: alert.userId,
        action: 'LOGIN_ANOMALY_DETECTED',
        resource: 'security',
        resourceId: alert.id,
        details: {
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
        },
        status: 'success',
      });
    }
  }

  /**
   * Get alerts for a user
   */
  async getAlerts(userId: string, options?: {
    severity?: AnomalyAlert['severity'];
    type?: AnomalyAlert['type'];
    limit?: number;
  }): Promise<AnomalyAlert[]> {
    // In production, query Alert model
    return [];
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    logger.info('Login anomaly alert resolved', { alertId, resolvedBy, resolution });

    await createAuditLog({
      userId: resolvedBy,
      action: 'LOGIN_ANOMALY_ALERT_RESOLVED',
      resource: 'alert',
      resourceId: alertId,
      details: { resolution },
      status: 'success',
    });
  }

  // ========================================
  // Brute Force Status
  // ========================================

  /**
   * Get brute force status for an email
   */
  async getBruteForceStatus(email: string): Promise<BruteForceStatus> {
    const user = await User.findOne({ email }).select('lockUntil loginAttempts');

    if (!user) {
      return {
        attempts: 0,
        locked: false,
        lastAttempt: new Date(),
      };
    }

    const locked = user.lockUntil && user.lockUntil > new Date();

    return {
      attempts: user.loginAttempts || 0,
      locked: !!locked,
      lockExpiresAt: locked ? user.lockUntil : undefined,
      lastAttempt: new Date(), // Would come from LoginAttempt model
    };
  }

  /**
   * Unlock account manually
   */
  async unlockAccount(userId: string, unlockedBy: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          lockUntil: undefined,
          accountStatus: 'active',
        },
        $unset: {
          loginAttempts: 1,
        },
      }
    );

    logger.info('Account manually unlocked', { userId, unlockedBy });

    await createAuditLog({
      userId: unlockedBy,
      action: 'ACCOUNT_UNLOCKED',
      resource: 'security',
      resourceId: userId,
      details: { unlockedBy },
      status: 'success',
    });
  }
}

// Export singleton instance
export const loginAnomalyDetectionService = new LoginAnomalyDetectionService();
export default loginAnomalyDetectionService;
