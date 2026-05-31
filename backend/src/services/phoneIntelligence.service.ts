/**
 * Phone Intelligence Service
 * Phone validation, carrier detection, line type identification
 */

import axios from 'axios';
import mongoose from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface PhoneIntelligenceResult {
  phone: string;
  formatted: string;
  countryCode: string;
  nationalNumber: string;
  isValid: boolean;
  lineType: 'mobile' | 'landline' | 'voip' | 'toll_free' | 'premium' | 'unknown';
  carrier?: string;
  carrierMCC?: string; // Mobile Country Code
  carrierMNC?: string; // Mobile Network Code
  country: string;
  isPrepaid: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  riskFactors: string[];
  checkedAt: Date;
}

export interface PhoneValidationResult {
  isValid: boolean;
  formatValid: boolean;
  lineTypeValid: boolean;
  intelligence: PhoneIntelligenceResult;
  canReceiveSMS: boolean;
  canReceiveCalls: boolean;
  isSuspicious: boolean;
  shouldBlock: boolean;
  recommendations: string[];
}

export interface CarrierInfo {
  name: string;
  mcc: string;
  mnc: string;
  country: string;
  type: 'mobile' | 'landline' | 'voip' | 'mvno';
  isPrepaid?: boolean;
}

// ============================================
// Country Phone Mappings
// ============================================

// Country code to country mapping
const COUNTRY_CODES: Record<string, string> = {
  '971': 'AE', // UAE
  '1': 'US',   // USA/Canada
  '44': 'GB',  // UK
  '49': 'DE',  // Germany
  '33': 'FR',  // France
  '91': 'IN',  // India
  '86': 'CN',  // China
  '81': 'JP',  // Japan
  '61': 'AU',  // Australia
  '55': 'BR',  // Brazil
  '7': 'RU',   // Russia
  '39': 'IT',  // Italy
  '34': 'ES',  // Spain
  '52': 'MX',  // Mexico
  '63': 'PH',  // Philippines
  '62': 'ID',  // Indonesia
  '60': 'MY',  // Malaysia
  '65': 'SG',  // Singapore
  '66': 'TH',  // Thailand
  '84': 'VN',  // Vietnam
  '90': 'TR',  // Turkey
  '964': 'IQ', // Iraq
  '962': 'JO', // Jordan
  '966': 'SA', // Saudi Arabia
  '20': 'EG',  // Egypt
  '212': 'MA', // Morocco
  '216': 'TN', // Tunisia
  '213': 'DZ', // Algeria
};

// Known VoIP providers (partial list)
const VOIP_PATTERNS = [
  'google voice', 'skype', 'whatsapp', 'viber', 'textnow',
  'textfree', 'pinger', 'freedompop', 'magicjack', 'vonage',
];

// High risk phone patterns
const HIGH_RISK_PATTERNS = [
  /^(555|555|555)/, // Fictional movie numbers
  /^(900|976)/, // Premium rate numbers
];

// ============================================
// PhoneIntelligenceService Class
// ============================================

export class PhoneIntelligenceService {
  // ========================================
  // Phone Analysis
  // ========================================

  /**
   * Analyze phone number intelligence
   */
  async analyzePhone(phone: string, countryCode: string = '971'): Promise<PhoneIntelligenceResult> {
    const normalized = this.normalizePhone(phone, countryCode);

    const result: PhoneIntelligenceResult = {
      phone: normalized.raw,
      formatted: normalized.formatted || normalized.raw,
      countryCode: normalized.countryCode,
      nationalNumber: normalized.nationalNumber,
      isValid: false,
      lineType: 'unknown',
      country: COUNTRY_CODES[normalized.countryCode] || 'Unknown',
      riskLevel: 'low',
      riskScore: 0,
      riskFactors: [],
      isPrepaid: false,
      checkedAt: new Date(),
    };

    // 1. Basic validation
    if (!this.isValidFormat(normalized.nationalNumber, normalized.countryCode)) {
      result.riskFactors.push('Invalid phone number format');
      result.riskScore += 30;
      return result;
    }

    result.isValid = true;

    // 2. Check for premium/high-risk numbers
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(normalized.nationalNumber)) {
        result.riskFactors.push('Premium or high-risk phone number');
        result.riskScore += 50;
        result.lineType = 'premium';
        break;
      }
    }

    // 3. Detect line type
    const lineTypeResult = await this.detectLineType(normalized);
    result.lineType = lineTypeResult.lineType;
    result.carrier = lineTypeResult.carrier;
    result.carrierMCC = lineTypeResult.mcc;
    result.carrierMNC = lineTypeResult.mnc;
    result.isPrepaid = lineTypeResult.isPrepaid || false;

    // Add risk factors based on line type
    if (lineTypeResult.lineType === 'voip') {
      result.riskFactors.push('VOIP/Telecom number detected');
      result.riskScore += 15;
    } else if (lineTypeResult.lineType === 'toll_free') {
      result.riskFactors.push('Toll-free number');
      result.riskScore += 10;
    }

    // 4. Check carrier risk
    if (lineTypeResult.carrier) {
      const carrierRisk = this.checkCarrierRisk(lineTypeResult.carrier);
      result.riskScore += carrierRisk;
    }

    // 5. Determine risk level
    if (result.riskScore >= 50) {
      result.riskLevel = 'high';
    } else if (result.riskScore >= 25) {
      result.riskLevel = 'medium';
    } else {
      result.riskLevel = 'low';
    }

    return result;
  }

  /**
   * Normalize phone number to standard format
   */
  private normalizePhone(phone: string, defaultCountryCode: string = '971'): {
    raw: string;
    formatted?: string;
    countryCode: string;
    nationalNumber: string;
  } {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Extract country code
    let countryCode = defaultCountryCode;
    let nationalNumber = cleaned;

    if (cleaned.startsWith('+')) {
      // Extract country code
      if (cleaned.startsWith('+971')) {
        countryCode = '971';
        nationalNumber = cleaned.substring(4);
      } else if (cleaned.startsWith('+1')) {
        countryCode = '1';
        nationalNumber = cleaned.substring(2);
      } else if (cleaned.startsWith('+44')) {
        countryCode = '44';
        nationalNumber = cleaned.substring(3);
      } else if (cleaned.length >= 3) {
        // Try to extract 1-3 digit country code
        const potentialCC = cleaned.substring(1, 4);
        if (COUNTRY_CODES[potentialCC]) {
          countryCode = potentialCC;
          nationalNumber = cleaned.substring(1 + potentialCC.length);
        } else {
          const twoDigit = cleaned.substring(1, 3);
          if (COUNTRY_CODES[twoDigit]) {
            countryCode = twoDigit;
            nationalNumber = cleaned.substring(1 + twoDigit.length);
          }
        }
      }
    } else if (cleaned.length > 9 && !cleaned.startsWith('0')) {
      // Assume 10-digit number with country code
      nationalNumber = cleaned;
    } else if (cleaned.startsWith('0')) {
      // Remove leading zero and prepend country code
      nationalNumber = cleaned.substring(1);
    }

    return {
      raw: phone,
      formatted: this.formatPhone(nationalNumber, countryCode),
      countryCode,
      nationalNumber,
    };
  }

  /**
   * Format phone number for display
   */
  private formatPhone(nationalNumber: string, countryCode: string): string {
    // UAE format: +971 XX XXX XXXX
    if (countryCode === '971') {
      if (nationalNumber.length === 9) {
        return `+${countryCode} ${nationalNumber.substring(0, 2)} ${nationalNumber.substring(2, 5)} ${nationalNumber.substring(5)}`;
      }
    }

    // US format: +1 (XXX) XXX-XXXX
    if (countryCode === '1' && nationalNumber.length === 10) {
      return `+${countryCode} (${nationalNumber.substring(0, 3)}) ${nationalNumber.substring(3, 6)}-${nationalNumber.substring(6)}`;
    }

    return `+${countryCode} ${nationalNumber}`;
  }

  /**
   * Validate phone number format
   */
  private isValidFormat(nationalNumber: string, countryCode: string): boolean {
    // UAE: 9 digits starting with 5
    if (countryCode === '971') {
      return /^5\d{8}$/.test(nationalNumber);
    }

    // US: 10 digits
    if (countryCode === '1') {
      return /^\d{10}$/.test(nationalNumber);
    }

    // Generic: 7-15 digits
    return /^\d{7,15}$/.test(nationalNumber);
  }

  /**
   * Detect line type (mobile, landline, VOIP)
   */
  private async detectLineType(phone: {
    countryCode: string;
    nationalNumber: string;
  }): Promise<{
    lineType: PhoneIntelligenceResult['lineType'];
    carrier?: string;
    mcc?: string;
    mnc?: string;
    isPrepaid?: boolean;
  }> {
    const result: {
      lineType: PhoneIntelligenceResult['lineType'];
      carrier?: string;
      mcc?: string;
      mnc?: string;
      isPrepaid?: boolean;
    } = {
      lineType: 'unknown' as PhoneIntelligenceResult['lineType'],
    };

    // UAE mobile prefixes
    if (phone.countryCode === '971') {
      const prefix = phone.nationalNumber.substring(0, 2);

      const UAE_PREFIXES: Record<string, { carrier: string; type: string; mcc: string; mnc: string }> = {
        '50': { carrier: 'Etisalat', type: 'mobile', mcc: '424', mnc: '02' },
        '52': { carrier: 'Du', type: 'mobile', mcc: '424', mnc: '03' },
        '54': { carrier: 'Virgin Mobile (Etisalat)', type: 'mobile', mcc: '424', mnc: '02' },
        '55': { carrier: 'Swype (Du)', type: 'mobile', mcc: '424', mnc: '03' },
        '56': { carrier: 'Du', type: 'mobile', mcc: '424', mnc: '03' },
      };

      const uaeInfo = UAE_PREFIXES[prefix];
      if (uaeInfo) {
        result.lineType = 'mobile';
        result.carrier = uaeInfo.carrier;
        result.mcc = uaeInfo.mcc;
        result.mnc = uaeInfo.mnc;
        return result;
      }
    }

    // US line type detection (simplified)
    if (phone.countryCode === '1') {
      const areaCode = phone.nationalNumber.substring(0, 3);

      // Toll-free
      if (['800', '888', '877', '866', '855', '844', '833', '822'].includes(areaCode)) {
        result.lineType = 'toll_free';
        return result;
      }

      // Premium
      if (['900', '976'].includes(areaCode)) {
        result.lineType = 'premium';
        return result;
      }

      // Default to mobile (simplified)
      result.lineType = 'mobile';
      return result;
    }

    return result;
  }

  /**
   * Check carrier risk level
   */
  private checkCarrierRisk(carrier: string): number {
    const carrierLower = carrier.toLowerCase();

    // Check for VOIP carriers
    for (const voip of VOIP_PATTERNS) {
      if (carrierLower.includes(voip)) {
        return 15;
      }
    }

    return 0;
  }

  // ========================================
  // Comprehensive Validation
  // ========================================

  /**
   * Validate phone number with full intelligence check
   */
  async validatePhone(
    phone: string,
    options?: {
      userId?: string;
      action?: 'registration' | 'login' | 'verification';
      requireSMS?: boolean;
    }
  ): Promise<PhoneValidationResult> {
    const recommendations: string[] = [];

    // 1. Analyze phone
    const intelligence = await this.analyzePhone(phone);

    // 2. Basic validation
    if (!intelligence.isValid) {
      recommendations.push('Invalid phone number format');
    }

    // 3. Check line type validity
    let lineTypeValid = true;

    if (options?.requireSMS && intelligence.lineType === 'landline') {
      lineTypeValid = false;
      recommendations.push('Landline numbers cannot receive SMS verification');
    }

    if (options?.requireSMS && intelligence.lineType === 'voip') {
      recommendations.push('VOIP numbers may have issues receiving SMS codes');
    }

    // 4. Determine SMS/call capability
    const canReceiveSMS = intelligence.lineType === 'mobile' || intelligence.lineType === 'voip';
    const canReceiveCalls = intelligence.lineType !== 'unknown';

    // 5. Determine if suspicious
    let isSuspicious = intelligence.riskScore >= 25;
    let shouldBlock = intelligence.riskScore >= 50;

    if (!intelligence.isValid) {
      shouldBlock = true;
      isSuspicious = true;
    }

    // 6. Audit log
    if ((isSuspicious || shouldBlock) && options?.userId) {
      await createAuditLog({
        userId: options.userId,
        action: shouldBlock ? 'PHONE_BLOCKED' : 'PHONE_FLAGGED',
        resource: 'phone_intelligence',
        resourceId: phone,
        details: {
          riskScore: intelligence.riskScore,
          lineType: intelligence.lineType,
          carrier: intelligence.carrier,
          riskFactors: intelligence.riskFactors,
        },
        status: 'success',
      });

      logger.info('Phone flagged', {
        userId: options.userId,
        phone: this.maskPhone(phone),
        riskScore: intelligence.riskScore,
        action: options.action,
      });
    }

    return {
      isValid: intelligence.isValid && lineTypeValid,
      formatValid: intelligence.isValid,
      lineTypeValid,
      intelligence,
      canReceiveSMS,
      canReceiveCalls,
      isSuspicious,
      shouldBlock,
      recommendations,
    };
  }

  /**
   * Mask phone number for logging
   */
  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2);
  }

  // ========================================
  // Risk Assessment
  // ========================================

  /**
   * Assess risk for a phone number
   */
  async assessRisk(phone: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    riskScore: number;
    factors: string[];
    recommendation: 'allow' | 'review' | 'block';
  }> {
    const intelligence = await this.analyzePhone(phone);

    // Determine recommendation
    let recommendation: 'allow' | 'review' | 'block' = 'allow';
    if (intelligence.riskScore >= 60) recommendation = 'block';
    else if (intelligence.riskScore >= 30) recommendation = 'review';

    return {
      riskLevel: intelligence.riskLevel,
      riskScore: intelligence.riskScore,
      factors: intelligence.riskFactors,
      recommendation,
    };
  }

  // ========================================
  // Phone Verification (OTP)
  // ========================================

  /**
   * Generate OTP for phone verification
   */
  async generateOTP(userId: string, phone: string): Promise<{
    success: boolean;
    expiresAt: Date;
    method: 'sms' | 'call';
  }> {
    const intelligence = await this.analyzePhone(phone);

    // Determine best delivery method
    const method: 'sms' | 'call' = (intelligence.lineType === 'mobile' || intelligence.lineType === 'voip') ? 'sms' : 'call';

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Calculate expiry (5 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Store OTP (in production, use Redis with TTL)
    // For now, we'll just return success
    logger.info('OTP generated', {
      userId,
      phone: this.maskPhone(phone),
      method,
      expiresAt,
    });

    // In production, send the OTP via SMS or call
    // await sendSMS(phone, `Your verification code is: ${otp}`);

    return {
      success: true,
      expiresAt,
      method,
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(userId: string, phone: string, otp: string): Promise<{
    success: boolean;
    attemptsRemaining: number;
  }> {
    // In production, retrieve and verify from Redis
    // For now, simulate validation

    const MAX_ATTEMPTS = 3;
    let attemptsRemaining = MAX_ATTEMPTS;

    // Simulate validation
    const isValid = otp.length === 6 && /^\d+$/.test(otp);

    if (isValid) {
      logger.info('OTP verified', { userId, phone: this.maskPhone(phone) });
      return { success: true, attemptsRemaining };
    }

    attemptsRemaining--;
    logger.warn('OTP verification failed', {
      userId,
      phone: this.maskPhone(phone),
      attemptsRemaining,
    });

    return { success: false, attemptsRemaining };
  }

  // ========================================
  // User Phone History
  // ========================================

  /**
   * Track phone number usage for a user
   */
  async trackPhoneUsage(userId: string, phone: string, action: string): Promise<void> {
    const user = await User.findById(userId);

    if (!user) return;

    // Initialize phone history if needed
    if (!user.phoneHistory) {
      user.phoneHistory = [];
    }

    // Add entry
    user.phoneHistory.push({
      phone: this.maskPhone(phone),
      action,
      timestamp: new Date(),
      isVerified: user.isPhoneVerified,
    });

    // Keep last 20 entries
    if (user.phoneHistory.length > 20) {
      user.phoneHistory = user.phoneHistory.slice(-20);
    }

    await user.save({ validateBeforeSave: false });
  }

  /**
   * Check if phone number is associated with multiple accounts
   */
  async checkPhoneSharing(phone: string, excludeUserId?: string): Promise<{
    shared: boolean;
    count: number;
    accounts: Array<{ userId: string; createdAt: Date }>;
  }> {
    const query: any = { phone };

    if (excludeUserId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
    }

    const users = await User.find(query)
      .select('_id createdAt')
      .lean();

    return {
      shared: users.length > 0,
      count: users.length,
      accounts: users.map((u) => ({
        userId: u._id.toString(),
        createdAt: u.createdAt,
      })),
    };
  }
}

// Export singleton instance
export const phoneIntelligenceService = new PhoneIntelligenceService();
export default phoneIntelligenceService;
