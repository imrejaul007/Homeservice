/**
 * VPN/Proxy Detection Service
 * Detects VPN, Proxy, and other anonymization services
 */

import axios from 'axios';
import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface IPReputationResult {
  ip: string;
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  isVPNDatabase: boolean;
  riskScore: number;
  country: string;
  city?: string;
  isp?: string;
  org?: string;
  asn?: string;
  isHosting: boolean;
  recentAbuse: boolean;
  confidence: number;
  checkedAt: Date;
}

export interface VPNProxyCheckRequest {
  ip: string;
  userId?: string;
  action?: 'login' | 'registration' | 'transaction';
  userAgent?: string;
}

export interface VPNProxyCheckResult {
  allowed: boolean;
  requiresChallenge: boolean;
  blockAction: boolean;
  ipData: IPReputationResult;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'allow' | 'challenge' | 'block';
}

export interface VPNProxyStats {
  totalChecks: number;
  vpnDetections: number;
  proxyDetections: number;
  torDetections: number;
  datacenterDetections: number;
  blockedRequests: number;
  challengeRequests: number;
}

// ============================================
// Configuration
// ============================================

// Known hosting provider ASNs and organizations
const HOSTING_ASN_PATTERNS = [
  'aws', 'amazon', 'digitalocean', 'linode', 'vultr', 'ovh', 'hetzner',
  'google cloud', 'microsoft azure', 'cloudflare', 'akamai', 'fastly',
  'leaseweb', 'godaddy', 'hostgator', 'bluehost', 'hostinger',
  'contabo', 'netcup', 'scaleway', 'render', 'heroku', 'vercel',
];

// Known VPN provider keywords
const VPN_PROVIDER_KEYWORDS = [
  'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
  'ipvanish', 'hotspot shield', 'tunnelbear', 'protonvpn', 'windscribe',
  'mullvad', 'airvpn', 'vyprvpn', 'purevpn', 'torGuard', 'browsec',
];

// Countries with high fraud rates (for enhanced scrutiny)
const HIGH_RISK_COUNTRIES = [
  'North Korea', 'Iran', 'Syria', 'Cuba', 'Russia', 'North Macedonia',
];

// ============================================
// VPNProxyDetectionService Class
// ============================================

export class VPNProxyDetectionService {
  private stats: VPNProxyStats = {
    totalChecks: 0,
    vpnDetections: 0,
    proxyDetections: 0,
    torDetections: 0,
    datacenterDetections: 0,
    blockedRequests: 0,
    challengeRequests: 0,
  };

  // ========================================
  // IP Reputation Check
  // ========================================

  /**
   * Check IP reputation using multiple signals
   */
  async checkIPReputation(ip: string): Promise<IPReputationResult> {
    const result: IPReputationResult = {
      ip,
      isVPN: false,
      isProxy: false,
      isTor: false,
      isDatacenter: false,
      isVPNDatabase: false,
      riskScore: 0,
      country: 'Unknown',
      isHosting: false,
      recentAbuse: false,
      confidence: 50,
      checkedAt: new Date(),
    };

    // 1. Check for private/reserved IP ranges
    const privateCheck = this.checkPrivateIP(ip);
    if (privateCheck.isPrivate) {
      result.confidence += 20;
      result.riskScore += privateCheck.riskScore;
      if (privateCheck.isVPN) {
        result.isVPN = true;
        this.stats.vpnDetections++;
      }
      return result;
    }

    // 2. Check for Tor exit nodes (simplified - in production use Tor DNSL)
    const torCheck = await this.checkTorExitNode(ip);
    if (torCheck.isTor) {
      result.isTor = true;
      result.riskScore += 80;
      result.confidence += 60;
      this.stats.torDetections++;
    }

    // 3. Check VPN/Proxy databases (in production, use IPQualityScore, MaxMind, etc.)
    const databaseCheck = await this.checkVPNDatabase(ip);
    if (databaseCheck.isVPN || databaseCheck.isProxy) {
      result.isVPNDatabase = true;
      result.isVPN = databaseCheck.isVPN || result.isVPN;
      result.isProxy = databaseCheck.isProxy || result.isProxy;
      result.riskScore += databaseCheck.riskScore;
      result.confidence += 40;
      if (databaseCheck.isVPN) this.stats.vpnDetections++;
      if (databaseCheck.isProxy) this.stats.proxyDetections++;
    }

    // 4. Check for datacenter/hosting provider IPs
    const datacenterCheck = await this.checkDatacenterIP(ip);
    if (datacenterCheck.isDatacenter) {
      result.isDatacenter = true;
      result.isHosting = true;
      result.riskScore += datacenterCheck.riskScore;
      result.confidence += 30;
      result.isp = datacenterCheck.isp;
      result.org = datacenterCheck.org;
      result.asn = datacenterCheck.asn;
      this.stats.datacenterDetections++;
    }

    // 5. Check country risk
    const countryRisk = this.checkCountryRisk(result.country);
    if (countryRisk.isHighRisk) {
      result.riskScore += countryRisk.riskScore;
      result.confidence += 20;
    }

    // 6. Check for recent abuse reports (would integrate with abuse service)
    const abuseCheck = await this.checkAbuseHistory(ip);
    if (abuseCheck.hasAbuse) {
      result.recentAbuse = true;
      result.riskScore += abuseCheck.riskScore;
      result.confidence += 25;
    }

    // Cap risk score at 100
    result.riskScore = Math.min(100, result.riskScore);
    result.confidence = Math.min(100, result.confidence);

    this.stats.totalChecks++;

    return result;
  }

  /**
   * Check for private/reserved IP ranges
   */
  private checkPrivateIP(ip: string): { isPrivate: boolean; isVPN: boolean; riskScore: number } {
    // Loopback
    if (ip === '127.0.0.1' || ip === '::1') {
      return { isPrivate: true, isVPN: false, riskScore: 10 };
    }

    // Private ranges
    if (ip.startsWith('10.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') ||
        ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
        ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') ||
        ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
        ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') ||
        ip.startsWith('172.31.') ||
        ip.startsWith('192.168.')) {
      return { isPrivate: true, isVPN: true, riskScore: 25 };
    }

    // Link-local
    if (ip.startsWith('169.254.')) {
      return { isPrivate: true, isVPN: false, riskScore: 5 };
    }

    return { isPrivate: false, isVPN: false, riskScore: 0 };
  }

  /**
   * Check if IP is a known Tor exit node
   * In production, use: https://check.torproject.org/api/ip
   */
  private async checkTorExitNode(ip: string): Promise<{ isTor: boolean }> {
    try {
      const response = await axios.get(`https://check.torproject.org/api/ip`, {
        timeout: 3000,
      });

      if (response.data?.IsTor !== undefined) {
        return { isTor: response.data.IsTor };
      }

      // Fallback: Check against known Tor exit node list (simplified)
      // In production, use a real-time database
      return { isTor: false };
    } catch (error) {
      logger.warn('Tor check failed', { ip, error });
      return { isTor: false };
    }
  }

  /**
   * Check VPN/Proxy databases
   * In production, use IPQualityScore, MaxMind GeoIP2, or IPHub
   */
  private async checkVPNDatabase(ip: string): Promise<{
    isVPN: boolean;
    isProxy: boolean;
    riskScore: number;
  }> {
    // Simulated check - in production, integrate with real service
    // Example IPQualityScore integration:
    // const response = await axios.get(`https://ipqualityscore.com/api/json/ip/${API_KEY}/${ip}`);

    // For now, return based on known patterns
    const result = {
      isVPN: false,
      isProxy: false,
      riskScore: 0,
    };

    // This is where you'd integrate with real VPN/Proxy detection services
    // Example: Check against your own VPN/Proxy database

    return result;
  }

  /**
   * Check if IP belongs to a datacenter/hosting provider
   */
  private async checkDatacenterIP(ip: string): Promise<{
    isDatacenter: boolean;
    riskScore: number;
    isp?: string;
    org?: string;
    asn?: string;
  }> {
    // In production, use reverse DNS and ASN lookups
    // For now, return empty result (would integrate with MaxMind or similar)

    const result = {
      isDatacenter: false,
      riskScore: 0,
    };

    // This is where you'd check hosting provider databases
    // Example integration with MaxMind:
    // const geo = await maxmind.open('/path/to/GeoLite2-ASN.mmdb');
    // const asnData = geo.get(ip);

    return result;
  }

  /**
   * Check abuse history for IP
   */
  private async checkAbuseHistory(ip: string): Promise<{ hasAbuse: boolean; riskScore: number }> {
    // In production, check against abuse databases like AbuseIPDB
    // Example:
    // const response = await axios.get(`https://api.abuseipdb.com/api/v2/check`, {
    //   headers: { 'Key': API_KEY },
    //   params: { ipAddress: ip }
    // });

    return { hasAbuse: false, riskScore: 0 };
  }

  /**
   * Check country risk level
   */
  private checkCountryRisk(country: string): { isHighRisk: boolean; riskScore: number } {
    if (HIGH_RISK_COUNTRIES.includes(country)) {
      return { isHighRisk: true, riskScore: 25 };
    }

    return { isHighRisk: false, riskScore: 0 };
  }

  // ========================================
  // Comprehensive Check
  // ========================================

  /**
   * Perform comprehensive VPN/Proxy check for a request
   */
  async checkRequest(request: VPNProxyCheckRequest): Promise<VPNProxyCheckResult> {
    const ipData = await this.checkIPReputation(request.ip);

    const reasons: string[] = [];
    let requiresChallenge = false;
    let blockAction = false;
    let riskLevel: VPNProxyCheckResult['riskLevel'] = 'low';

    // Determine risk level based on IP data
    if (ipData.riskScore >= 70) {
      riskLevel = 'critical';
      blockAction = true;
      reasons.push('Critical risk detected: High-confidence anonymization service');
      this.stats.blockedRequests++;
    } else if (ipData.riskScore >= 50) {
      riskLevel = 'high';
      requiresChallenge = true;
      reasons.push('High risk detected: Possible VPN/Proxy usage');
      this.stats.challengeRequests++;
    } else if (ipData.riskScore >= 30) {
      riskLevel = 'medium';
      reasons.push('Medium risk: Enhanced verification recommended');
    }

    // Add specific reasons
    if (ipData.isVPN) {
      reasons.push('VPN connection detected');
    }
    if (ipData.isProxy) {
      reasons.push('Proxy connection detected');
    }
    if (ipData.isTor) {
      reasons.push('Tor exit node detected');
    }
    if (ipData.isDatacenter) {
      reasons.push('Datacenter IP address detected');
    }
    if (ipData.recentAbuse) {
      reasons.push('IP has recent abuse reports');
    }

    // Log the check
    if (request.userId && ipData.riskScore >= 30) {
      await createAuditLog({
        userId: request.userId,
        action: 'VPN_PROXY_DETECTED',
        resource: 'security',
        resourceId: request.ip,
        details: {
          ip: request.ip,
          riskScore: ipData.riskScore,
          isVPN: ipData.isVPN,
          isProxy: ipData.isProxy,
          isTor: ipData.isTor,
          action: request.action,
        },
        status: 'success',
      });

      logger.info('VPN/Proxy detected', {
        userId: request.userId,
        ip: request.ip,
        riskScore: ipData.riskScore,
        action: request.action,
      });
    }

    // Determine recommended action
    let recommendedAction: 'allow' | 'challenge' | 'block' = 'allow';
    if (blockAction) {
      recommendedAction = 'block';
    } else if (requiresChallenge) {
      recommendedAction = 'challenge';
    }

    return {
      allowed: !blockAction,
      requiresChallenge,
      blockAction,
      ipData,
      reasons,
      riskLevel,
      recommendedAction,
    };
  }

  // ========================================
  // Batch Processing
  // ========================================

  /**
   * Check multiple IPs for VPN/Proxy
   */
  async checkMultipleIPs(ips: string[]): Promise<IPReputationResult[]> {
    const results: IPReputationResult[] = [];

    for (const ip of ips) {
      const result = await this.checkIPReputation(ip);
      results.push(result);
    }

    return results;
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get detection statistics
   */
  getStats(): VPNProxyStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      vpnDetections: 0,
      proxyDetections: 0,
      torDetections: 0,
      datacenterDetections: 0,
      blockedRequests: 0,
      challengeRequests: 0,
    };
  }

  // ========================================
  // IP Geolocation
  // ========================================

  /**
   * Get geolocation data for an IP
   */
  async getGeolocation(ip: string): Promise<{
    country: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  } | null> {
    // In production, use a geolocation service like MaxMind, IP-API, or ipstack
    try {
      const response = await axios.get(`http://ip-api.com/json/${ip}?fields=country,city,region,lat,lon,timezone`, {
        timeout: 3000,
      });

      if (response.data?.status === 'success') {
        return {
          country: response.data.country || 'Unknown',
          city: response.data.city,
          region: response.data.regionName,
          latitude: response.data.lat,
          longitude: response.data.lon,
          timezone: response.data.timezone,
        };
      }
    } catch (error) {
      logger.warn('Geolocation lookup failed', { ip, error });
    }

    return null;
  }

  // ========================================
  // Impossible Travel Detection
  // ========================================

  /**
   * Detect impossible travel between two logins
   */
  async detectImpossibleTravel(
    userId: string,
    currentIP: string,
    previousIP: string,
    previousTimestamp: Date
  ): Promise<{
    isImpossible: boolean;
    confidence: number;
    distance: number; // km
    timeDifference: number; // hours
    maxPossibleSpeed: number; // km/h
  }> {
    // Get locations for both IPs
    const [currentLocation, previousLocation] = await Promise.all([
      this.getGeolocation(currentIP),
      this.getGeolocation(previousIP),
    ]);

    if (!currentLocation || !previousLocation ||
        !currentLocation.latitude || !previousLocation.latitude) {
      return {
        isImpossible: false,
        confidence: 0,
        distance: 0,
        timeDifference: 0,
        maxPossibleSpeed: 0,
      };
    }

    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(
      previousLocation.latitude ?? 0,
      previousLocation.longitude ?? 0,
      currentLocation.latitude ?? 0,
      currentLocation.longitude ?? 0
    );

    // Calculate time difference
    const timeDifference = (Date.now() - previousTimestamp.getTime()) / (1000 * 60 * 60); // hours

    // Calculate required speed
    const requiredSpeed = timeDifference > 0 ? distance / timeDifference : Infinity;

    // Maximum realistic travel speed (commercial flight + buffer)
    const MAX_POSSIBLE_SPEED = 1000; // km/h

    return {
      isImpossible: requiredSpeed > MAX_POSSIBLE_SPEED,
      confidence: 85, // Confidence in the calculation
      distance,
      timeDifference,
      maxPossibleSpeed: requiredSpeed,
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

// Export singleton instance
export const vpnProxyDetectionService = new VPNProxyDetectionService();
export default vpnProxyDetectionService;
