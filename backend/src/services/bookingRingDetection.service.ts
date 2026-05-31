/**
 * Booking Ring Detection Service
 * Detects coordinated fraud rings through network analysis
 */

import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import ProviderVerification from '../models/providerVerification.model';
import CustomerMetrics from '../models/customerMetrics.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface FraudRing {
  ringId: string;
  members: RingMember[];
  ringType: 'customer' | 'provider' | 'mixed';
  confidence: number;
  suspiciousIndicators: string[];
  firstDetected: Date;
  lastActivity: Date;
  estimatedLoss?: number;
  status: 'investigating' | 'confirmed' | 'dismantled';
}

export interface RingMember {
  userId: string;
  role: 'customer' | 'provider';
  email: string;
  joinDate: Date;
  riskScore: number;
  suspiciousActivities: string[];
  linkedTo: string[]; // Other member IDs
}

export interface NetworkLink {
  sourceId: string;
  targetId: string;
  linkType: 'ip' | 'device' | 'phone' | 'email' | 'account' | 'booking_pattern';
  weight: number; // 0-1, higher = stronger link
  details?: Record<string, any>;
}

export interface RingAnalysisResult {
  isPartOfRing: boolean;
  ringId?: string;
  confidence: number;
  indicators: string[];
  linkedUsers: Array<{ userId: string; role: string; linkStrength: number }>;
  recommendations: string[];
}

export interface LinkAnalysisResult {
  links: NetworkLink[];
  clusters: string[][]; // Groups of tightly linked users
  bridgeUsers: string[]; // Users connecting different clusters
  totalLinks: number;
  strongLinks: number;
}

export interface CoordinatedActivity {
  type: 'booking' | 'cancellation' | 'review' | 'refund' | 'payment';
  timestamp: Date;
  participants: string[];
  pattern: 'burst' | 'sequential' | 'overlapping';
  confidence: number;
}

// ============================================
// Detection Thresholds
// ============================================

const THRESHOLDS = {
  // IP sharing
  sharedIPsToFlag: 3, // Users sharing same IP to flag
  sharedIPsCritical: 5, // Users sharing same IP for critical flag

  // Device sharing
  sharedDevicesToFlag: 2,

  // Phone sharing
  sharedPhonesToFlag: 2,

  // Account linking
  rapidReferralsToFlag: 3,

  // Booking patterns
  bookingOverlapMinutes: 5, // Minutes for "overlapping" bookings to count as suspicious
  cancellationClusterSize: 3, // Concurrent cancellations to flag

  // Financial
  paymentAccountSharing: 2, // Shared payment accounts to flag

  // Time windows
  burstWindowMinutes: 60,
  coordinatedWindowDays: 7,
};

// ============================================
// BookingRingDetectionService Class
// ============================================

export class BookingRingDetectionService {
  // ========================================
  // Ring Detection
  // ========================================

  /**
   * Detect if user is part of a fraud ring
   */
  async detectRingMembership(userId: string): Promise<RingAnalysisResult> {
    const indicators: string[] = [];
    const linkedUsers: Array<{ userId: string; role: string; linkStrength: number }> = [];
    let confidence = 0;

    // 1. Check for IP overlap
    const ipLinks = await this.findSharedIPLinks(userId);
    if (ipLinks.length > 0) {
      indicators.push(`${ipLinks.length} user(s) share IP address`);
      confidence += Math.min(30, ipLinks.length * 10);
      linkedUsers.push(...ipLinks.map((l) => ({
        userId: l.targetId,
        role: 'unknown',
        linkStrength: l.weight,
      })));
    }

    // 2. Check for device overlap
    const deviceLinks = await this.findSharedDeviceLinks(userId);
    if (deviceLinks.length > 0) {
      indicators.push(`${deviceLinks.length} user(s) share device`);
      confidence += Math.min(25, deviceLinks.length * 12);
      linkedUsers.push(...deviceLinks.map((l) => ({
        userId: l.targetId,
        role: 'unknown',
        linkStrength: l.weight,
      })));
    }

    // 3. Check for phone sharing
    const phoneLinks = await this.findSharedPhoneLinks(userId);
    if (phoneLinks.length > 0) {
      indicators.push(`${phoneLinks.length} user(s) share phone number`);
      confidence += Math.min(30, phoneLinks.length * 15);
      linkedUsers.push(...phoneLinks.map((l) => ({
        userId: l.targetId,
        role: 'unknown',
        linkStrength: l.weight,
      })));
    }

    // 4. Check for referral ring
    const referralLinks = await this.findReferralRing(userId);
    if (referralLinks.length > 0) {
      indicators.push(`${referralLinks.length} suspicious referral links detected`);
      confidence += Math.min(25, referralLinks.length * 10);
    }

    // 5. Check for coordinated booking patterns
    const bookingPatterns = await this.checkCoordinatedBookings(userId);
    if (bookingPatterns.length > 0) {
      indicators.push(`${bookingPatterns.length} coordinated booking activity detected`);
      confidence += Math.min(30, bookingPatterns.length * 10);
    }

    // 6. Check for coordinated cancellations
    const cancelPatterns = await this.checkCoordinatedCancellations(userId);
    if (cancelPatterns.length > 0) {
      indicators.push(`${cancelPatterns.length} coordinated cancellation activity detected`);
      confidence += Math.min(25, cancelPatterns.length * 10);
    }

    // 7. Check for shared payment methods
    const paymentLinks = await this.findSharedPaymentLinks(userId);
    if (paymentLinks.length > 0) {
      indicators.push(`${paymentLinks.length} user(s) share payment method`);
      confidence += Math.min(35, paymentLinks.length * 15);
      linkedUsers.push(...paymentLinks.map((l) => ({
        userId: l.targetId,
        role: 'unknown',
        linkStrength: l.weight,
      })));
    }

    // Determine if part of ring
    const isPartOfRing = confidence >= 40 && linkedUsers.length >= 2;
    confidence = Math.min(100, confidence);

    // Generate recommendations
    const recommendations: string[] = [];
    if (isPartOfRing) {
      recommendations.push('Account flagged for potential fraud ring membership');
      if (confidence >= 70) {
        recommendations.push('HIGH CONFIDENCE: Manual investigation strongly recommended');
      }
    }

    return {
      isPartOfRing,
      ringId: isPartOfRing ? `RING-${Date.now()}` : undefined,
      confidence,
      indicators,
      linkedUsers,
      recommendations,
    };
  }

  // ========================================
  // Network Link Analysis
  // ========================================

  /**
   * Find all network links for a user
   */
  async analyzeNetworkLinks(userId: string): Promise<LinkAnalysisResult> {
    const links: NetworkLink[] = [];

    // Get all link types
    const [ipLinks, deviceLinks, phoneLinks, paymentLinks, bookingLinks] = await Promise.all([
      this.findSharedIPLinks(userId),
      this.findSharedDeviceLinks(userId),
      this.findSharedPhoneLinks(userId),
      this.findSharedPaymentLinks(userId),
      this.findBookingPatternLinks(userId),
    ]);

    links.push(...ipLinks, ...deviceLinks, ...phoneLinks, ...paymentLinks, ...bookingLinks);

    // Identify clusters using union-find
    const clusters = this.identifyClusters(links);

    // Find bridge users (users connecting different clusters)
    const bridgeUsers = this.findBridgeUsers(clusters, links);

    const strongLinks = links.filter((l) => l.weight >= 0.7).length;

    return {
      links,
      clusters,
      bridgeUsers,
      totalLinks: links.length,
      strongLinks,
    };
  }

  /**
   * Find users sharing IP addresses
   */
  private async findSharedIPLinks(userId: string): Promise<NetworkLink[]> {
    const user = await User.findById(userId).select('loginIP registrationIP');

    if (!user) return [];

    const links: NetworkLink[] = [];

    // Find users with same registration IP
    if (user.registrationIP) {
      const sharedUsers = await User.find({
        _id: { $ne: userId },
        registrationIP: user.registrationIP,
      }).select('_id');

      for (const sharedUser of sharedUsers) {
        links.push({
          sourceId: userId,
          targetId: sharedUser._id.toString(),
          linkType: 'ip',
          weight: 0.6,
          details: { ip: user.registrationIP, type: 'registration' },
        });
      }
    }

    // Find users with same login IP (multiple logins)
    if (user.loginIP) {
      const sharedLoginUsers = await User.find({
        _id: { $ne: userId },
        loginIP: user.loginIP,
      }).select('_id');

      for (const sharedUser of sharedLoginUsers) {
        const existingLink = links.find(
          (l) => l.targetId === sharedUser._id.toString()
        );
        if (existingLink) {
          existingLink.weight = Math.min(1, existingLink.weight + 0.2);
        } else {
          links.push({
            sourceId: userId,
            targetId: sharedUser._id.toString(),
            linkType: 'ip',
            weight: 0.5,
            details: { ip: user.loginIP, type: 'login' },
          });
        }
      }
    }

    return links;
  }

  /**
   * Find users sharing devices
   */
  private async findSharedDeviceLinks(userId: string): Promise<NetworkLink[]> {
    const user = await User.findById(userId).select('deviceFingerprints');

    if (!user?.deviceFingerprints?.length) return [];

    const deviceIds = user.deviceFingerprints.map((d: any) => d.fingerprint);
    const links: NetworkLink[] = [];

    // Find users sharing same device
    for (const deviceId of deviceIds) {
      const sharedUsers = await User.find({
        _id: { $ne: userId },
        'deviceFingerprints.fingerprint': deviceId,
      }).select('_id');

      for (const sharedUser of sharedUsers) {
        links.push({
          sourceId: userId,
          targetId: sharedUser._id.toString(),
          linkType: 'device',
          weight: 0.8, // Device sharing is strong indicator
          details: { deviceId },
        });
      }
    }

    return links;
  }

  /**
   * Find users sharing phone numbers
   */
  private async findSharedPhoneLinks(userId: string): Promise<NetworkLink[]> {
    const user = await User.findById(userId).select('phone');

    if (!user?.phone) return [];

    const links: NetworkLink[] = [];

    // Find users with same phone
    const sharedUsers = await User.find({
      _id: { $ne: userId },
      phone: user.phone,
    }).select('_id');

    for (const sharedUser of sharedUsers) {
      links.push({
        sourceId: userId,
        targetId: sharedUser._id.toString(),
        linkType: 'phone',
        weight: 0.9, // Phone sharing is very suspicious
        details: { phone: this.maskPhone(user.phone) },
      });
    }

    return links;
  }

  /**
   * Find users sharing payment methods
   */
  private async findSharedPaymentLinks(userId: string): Promise<NetworkLink[]> {
    // In production, would query payment accounts
    // For now, return empty
    return [];
  }

  /**
   * Find booking pattern links
   */
  private async findBookingPatternLinks(userId: string): Promise<NetworkLink[]> {
    const links: NetworkLink[] = [];

    // Get user's bookings
    const userBookings = await Booking.find({ customerId: userId })
      .select('scheduledDate providerId')
      .lean();

    if (userBookings.length < 2) return [];

    // Find other users with overlapping bookings
    for (const booking of userBookings) {
      if (!booking.scheduledDate) continue;

      const overlappingBookings = await Booking.find({
        _id: { $ne: booking._id },
        providerId: booking.providerId,
        scheduledDate: {
          $gte: new Date(booking.scheduledDate.getTime() - THRESHOLDS.bookingOverlapMinutes * 60 * 1000),
          $lte: new Date(booking.scheduledDate.getTime() + THRESHOLDS.bookingOverlapMinutes * 60 * 1000),
        },
      }).select('customerId');

      for (const overlap of overlappingBookings) {
        if (!overlap.customerId) continue;
        if (overlap.customerId.toString() !== userId) {
          links.push({
            sourceId: userId,
            targetId: overlap.customerId.toString(),
            linkType: 'booking_pattern',
            weight: 0.4,
            details: {
              providerId: booking.providerId.toString(),
              timestamp: booking.scheduledDate,
            },
          });
        }
      }
    }

    return links;
  }

  /**
   * Identify clusters using union-find
   */
  private identifyClusters(links: NetworkLink[]): string[][] {
    const parent: Map<string, string> = new Map();
    const rank: Map<string, number> = new Map();

    const find = (x: string): string => {
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: string, y: string): void => {
      const px = find(x);
      const py = find(y);

      if (px === py) return;

      const rankX = rank.get(x) || 0;
      const rankY = rank.get(y) || 0;

      if (rankX < rankY) {
        parent.set(px, py);
      } else if (rankX > rankY) {
        parent.set(py, px);
      } else {
        parent.set(py, px);
        rank.set(x, rankX + 1);
      }
    };

    // Initialize
    const allNodes = new Set<string>();
    for (const link of links) {
      allNodes.add(link.sourceId);
      allNodes.add(link.targetId);
    }

    // Convert to array for ES5 compatibility
    const nodesArray = Array.from(allNodes);
    for (const node of nodesArray) {
      if (!parent.has(node)) {
        parent.set(node, node);
        rank.set(node, 0);
      }
    }

    // Union connected nodes
    for (const link of links) {
      union(link.sourceId, link.targetId);
    }

    // Group by parent
    const clustersMap: Map<string, string[]> = new Map();
    for (const node of nodesArray) {
      const root = find(node);
      if (!clustersMap.has(root)) {
        clustersMap.set(root, []);
      }
      clustersMap.get(root)!.push(node);
    }

    return Array.from(clustersMap.values()).filter((c) => c.length >= 2);
  }

  /**
   * Find bridge users connecting different clusters
   */
  private findBridgeUsers(clusters: string[][], links: NetworkLink[]): string[] {
    const bridgeUsers: string[] = [];
    const clusterNodes = new Set(clusters.flat());
    const clusterNodesArray = Array.from(clusterNodes);

    for (const link of links) {
      // If link connects two different clusters, both users are bridges
      const sourceInCluster = clusterNodes.has(link.sourceId);
      const targetInCluster = clusterNodes.has(link.targetId);

      // If one is in a cluster and the other isn't, it's a bridge
      if (sourceInCluster !== targetInCluster) {
        if (sourceInCluster && !bridgeUsers.includes(link.sourceId)) {
          bridgeUsers.push(link.sourceId);
        }
        if (targetInCluster && !bridgeUsers.includes(link.targetId)) {
          bridgeUsers.push(link.targetId);
        }
      }
    }

    return bridgeUsers;
  }

  // ========================================
  // Referral Ring Detection
  // ========================================

  /**
   * Find referral ring connections
   */
  private async findReferralRing(userId: string): Promise<NetworkLink[]> {
    const user = await User.findById(userId).select('loyaltySystem.referredBy loyaltySystem.referralCode');

    if (!user?.loyaltySystem) return [];

    const links: NetworkLink[] = [];

    // Get referrer chain
    const referrerChain = await this.getReferrerChain(userId, 3);

    // Check for suspicious patterns
    if (referrerChain.length >= 2) {
      // Check if referrers share other connections
      const referrerIds = referrerChain.map((r) => r.userId);

      for (let i = 0; i < referrerIds.length; i++) {
        for (let j = i + 1; j < referrerIds.length; j++) {
          // Check if referrers share IP, device, etc.
          const sharedLinks = await this.findDirectLinks(referrerIds[i], referrerIds[j]);

          if (sharedLinks.length > 0) {
            links.push(...sharedLinks.map((l) => ({
              ...l,
              weight: Math.min(1, l.weight + 0.2), // Boost weight for referral + other links
            })));
          }
        }
      }
    }

    return links;
  }

  /**
   * Get referrer chain
   */
  private async getReferrerChain(
    userId: string,
    maxDepth: number
  ): Promise<Array<{ userId: string; depth: number }>> {
    const chain: Array<{ userId: string; depth: number }> = [];
    let currentId = userId;
    let depth = 0;

    while (depth < maxDepth) {
      const user = await User.findById(currentId).select('loyaltySystem.referredBy');

      if (!user?.loyaltySystem?.referredBy) break;

      chain.push({ userId: user.loyaltySystem.referredBy.toString(), depth });
      currentId = user.loyaltySystem.referredBy.toString();
      depth++;
    }

    return chain;
  }

  /**
   * Find direct links between two users
   */
  private async findDirectLinks(userId1: string, userId2: string): Promise<NetworkLink[]> {
    const links: NetworkLink[] = [];

    // Check IP sharing
    const [user1, user2] = await Promise.all([
      User.findById(userId1).select('registrationIP loginIP'),
      User.findById(userId2).select('registrationIP loginIP'),
    ]);

    if (!user1 || !user2) return [];

    if (user1.registrationIP && user1.registrationIP === user2.registrationIP) {
      links.push({
        sourceId: userId1,
        targetId: userId2,
        linkType: 'ip',
        weight: 0.7,
      });
    }

    if (user1.loginIP && user1.loginIP === user2.loginIP) {
      links.push({
        sourceId: userId1,
        targetId: userId2,
        linkType: 'ip',
        weight: 0.5,
      });
    }

    // Check phone sharing
    if (user1.phone && user1.phone === user2.phone) {
      links.push({
        sourceId: userId1,
        targetId: userId2,
        linkType: 'phone',
        weight: 0.9,
      });
    }

    return links;
  }

  // ========================================
  // Coordinated Activity Detection
  // ========================================

  /**
   * Check for coordinated booking activity
   */
  private async checkCoordinatedBookings(userId: string): Promise<CoordinatedActivity[]> {
    const activities: CoordinatedActivity[] = [];

    // Get user's recent bookings
    const userBookings = await Booking.find({
      customerId: userId,
      createdAt: { $gte: new Date(Date.now() - THRESHOLDS.burstWindowMinutes * 60 * 1000) },
    }).select('providerId scheduledDate createdAt');

    const validBookings = userBookings.filter((b) => b.scheduledDate);
    if (validBookings.length < 2) return [];

    // Find other users with bookings to same providers in similar time
    const providerIdsSet = new Set(validBookings.map((b) => b.providerId.toString()));
    const providerIds = Array.from(providerIdsSet);
    const serviceTimes = validBookings.map((b) => new Date(b.scheduledDate).getTime());

    for (const providerId of providerIds) {
      const nearbyBookings = await Booking.find({
        providerId,
        _id: { $nin: validBookings.map((b) => b._id) },
        scheduledDate: {
          $gte: new Date(Math.min(...serviceTimes) - 30 * 60 * 1000),
          $lte: new Date(Math.max(...serviceTimes) + 30 * 60 * 1000),
        },
      }).select('customerId createdAt');

      if (nearbyBookings.length >= THRESHOLDS.cancellationClusterSize) {
        activities.push({
          type: 'booking',
          timestamp: new Date(),
          participants: [userId, ...nearbyBookings.filter((b) => b.customerId).map((b) => b.customerId!.toString())],
          pattern: 'burst',
          confidence: Math.min(90, 50 + nearbyBookings.length * 10),
        });
      }
    }

    return activities;
  }

  /**
   * Check for coordinated cancellation activity
   */
  private async checkCoordinatedCancellations(userId: string): Promise<CoordinatedActivity[]> {
    const activities: CoordinatedActivity[] = [];

    // Get user's recent cancellations
    const userCancellations = await Booking.find({
      customerId: userId,
      status: 'cancelled',
      'cancellationDetails.cancelledAt': { $gte: new Date(Date.now() - THRESHOLDS.burstWindowMinutes * 60 * 1000) },
    }).select('providerId cancellationDetails.cancelledAt');

    if (userCancellations.length < 2) return [];

    // Find other users with cancellations to same providers
    const providerIds = [...new Set(userCancellations.map((b) => b.providerId.toString()))];

    for (const providerId of providerIds) {
      const nearbyCancellations = await Booking.find({
        providerId,
        status: 'cancelled',
        _id: { $nin: userCancellations.map((b) => b._id) },
        'cancellationDetails.cancelledAt': {
          $gte: new Date(Date.now() - THRESHOLDS.burstWindowMinutes * 60 * 1000),
        },
      }).select('customerId cancellationDetails.cancelledAt');

      if (nearbyCancellations.length >= THRESHOLDS.cancellationClusterSize) {
        activities.push({
          type: 'cancellation',
          timestamp: new Date(),
          participants: [userId, ...nearbyCancellations.filter((b) => b.customerId).map((b) => b.customerId!.toString())],
          pattern: 'burst',
          confidence: Math.min(90, 60 + nearbyCancellations.length * 10),
        });
      }
    }

    return activities;
  }

  // ========================================
  // Ring Management
  // ========================================

  /**
   * Create/update fraud ring record
   */
  async registerFraudRing(ring: FraudRing): Promise<void> {
    // In production, would store in a FraudRing model
    logger.warn('Fraud ring registered', {
      ringId: ring.ringId,
      memberCount: ring.members.length,
      confidence: ring.confidence,
      indicators: ring.suspiciousIndicators,
    });

    // Flag all members
    for (const member of ring.members) {
      await this.flagUserForRing(member.userId, ring.ringId, ring.confidence);
    }

    await createAuditLog({
      userId: 'SYSTEM',
      action: 'FRAUD_RING_REGISTERED',
      resource: 'ring_detection',
      resourceId: ring.ringId,
      details: {
        memberCount: ring.members.length,
        confidence: ring.confidence,
        type: ring.ringType,
      },
      status: 'success',
    });
  }

  /**
   * Flag user as ring member
   */
  private async flagUserForRing(userId: string, ringId: string, confidence: number): Promise<void> {
    const metrics = await CustomerMetrics.findOne({ userId });

    if (metrics) {
      if (!metrics.fraudFlags) metrics.fraudFlags = [];
      metrics.fraudFlags.push({
        type: 'fraud_ring',
        severity: confidence >= 70 ? 'high' : 'medium',
        description: `Identified as member of fraud ring ${ringId}`,
        detectedAt: new Date(),
        resolved: false,
      });
      await metrics.save();
    }

    logger.info('User flagged for fraud ring', { userId, ringId, confidence });
  }

  /**
   * Get all known fraud rings
   */
  async getKnownRings(): Promise<FraudRing[]> {
    // In production, would query FraudRing model
    return [];
  }

  /**
   * Get ring statistics
   */
  async getRingStats(): Promise<{
    totalRings: number;
    activeRings: number;
    totalMembers: number;
    estimatedLoss: number;
    byType: Record<string, number>;
  }> {
    return {
      totalRings: 0,
      activeRings: 0,
      totalMembers: 0,
      estimatedLoss: 0,
      byType: { customer: 0, provider: 0, mixed: 0 },
    };
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Mask phone number for logging
   */
  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2);
  }

  /**
   * Full network analysis for admin dashboard
   */
  async analyzeFullNetwork(userIds?: string[]): Promise<{
    totalUsersAnalyzed: number;
    ringsDetected: number;
    highRiskUsers: string[];
    strongLinks: number;
    clusters: number;
  }> {
    const usersToAnalyze = userIds || [];

    if (usersToAnalyze.length === 0) {
      // Analyze recent high-risk users
      const highRiskUsers = await CustomerMetrics.find({
        riskLevel: { $in: ['high', 'critical'] },
      }).select('userId').limit(100);

      usersToAnalyze.push(...highRiskUsers.map((u) => u.userId.toString()));
    }

    let ringsDetected = 0;
    let highRiskUsers: string[] = [];
    let strongLinks = 0;
    const allClusters: string[][] = [];

    for (const userId of usersToAnalyze) {
      const result = await this.detectRingMembership(userId);

      if (result.isPartOfRing) {
        ringsDetected++;
        highRiskUsers.push(userId);
      }

      const network = await this.analyzeNetworkLinks(userId);
      strongLinks += network.strongLinks;
      allClusters.push(...network.clusters);
    }

    return {
      totalUsersAnalyzed: usersToAnalyze.length,
      ringsDetected,
      highRiskUsers: Array.from(new Set(highRiskUsers)),
      strongLinks,
      clusters: allClusters.length,
    };
  }
}

// Export singleton instance
export const bookingRingDetectionService = new BookingRingDetectionService();
export default bookingRingDetectionService;
