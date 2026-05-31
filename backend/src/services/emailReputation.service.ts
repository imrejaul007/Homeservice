/**
 * Email Reputation Service
 * Email domain analysis, disposable email detection, breach checks
 */

import axios from 'axios';
import mongoose from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface EmailReputationResult {
  email: string;
  domain: string;
  isDisposable: boolean;
  isRoleBased: boolean;
  isFreeProvider: boolean;
  domainAge?: number; // days
  domainRisk: 'low' | 'medium' | 'high';
  riskScore: number;
  riskFactors: string[];
  mxRecords: MXRecord[];
  hasSPF: boolean;
  hasDKIM: boolean;
  hasDMARC: boolean;
  checkedAt: Date;
}

export interface MXRecord {
  exchange: string;
  priority: number;
}

export interface BreachCheckResult {
  email: string;
  foundInBreaches: boolean;
  breachCount: number;
  breaches: BreachInfo[];
  checkedAt: Date;
}

export interface BreachInfo {
  name: string;
  date: string;
  description: string;
  dataClasses: string[];
}

export interface EmailValidationResult {
  isValid: boolean;
  formatValid: boolean;
  domainValid: boolean;
  reputation: EmailReputationResult;
  breachStatus?: BreachCheckResult;
  isSuspicious: boolean;
  shouldBlock: boolean;
  recommendations: string[];
}

// ============================================
// Known Email Patterns
// ============================================

// Known disposable email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 'throwaway.email',
  '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
  'yopmail.com', 'getnada.com', 'maildrop.cc', 'dispostable.com',
  'mailnesia.com', 'tempail.com', 'sharklasers.com', 'spamgourmet.com',
  'mytrashmail.com', 'mailcatch.com', 'spambox.us', 'tempr.email',
  'discard.email', 'throwawaymail.com', 'burnermail.io', 'guerrillamailblock.com',
  'pokemail.net', 'spam4.me', 'mailforspam.com', 'incognitomail.com',
  'incognitomail.org', 'proxymail.eu', 'rcpt.at', 'tempomail.fr',
  'dropmail.me', 'fakemailgenerator.com', 'emailondeck.com', 'mintemail.com',
  'mohmal.com', 'emailfake.com', 'tempmailaddress.com', 'tempinbox.com',
  'fakeinbox.org', 'spamfree24.org', 'antispam.de', 'trash-mail.com',
]);

// Role-based email patterns
const ROLE_BASED_PATTERNS = [
  'admin', 'webmaster', 'info', 'support', 'sales', 'contact',
  'noreply', 'no-reply', 'postmaster', 'abuse', 'help',
  'feedback', 'enquiry', 'office', 'team', 'staff', 'billing',
  'accounts', 'finance', 'legal', 'hr', 'jobs', 'careers',
];

// Free email providers
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'mail.com', 'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru', 'zoho.com', 'inbox.com', 'mail.ru',
  'qq.com', '163.com', '126.com', ' Sina', 'rediffmail.com',
]);

// High risk TLDs
const HIGH_RISK_TLDS = [
  '.xyz', '.top', '.loan', '.work', '.click', '.link', '.date',
  '.faith', '.racing', '.review', '.accountant', '.cricket', '.download',
  '.stream', '.win', '.bid', '.trade', '.date', '.zip', '.cc',
];

// ============================================
// EmailReputationService Class
// ============================================

export class EmailReputationService {
  // ========================================
  // Email Analysis
  // ========================================

  /**
   * Analyze email reputation
   */
  async analyzeEmail(email: string): Promise<EmailReputationResult> {
    const domain = this.extractDomain(email);
    const localPart = this.extractLocalPart(email);

    const result: EmailReputationResult = {
      email,
      domain,
      isDisposable: false,
      isRoleBased: false,
      isFreeProvider: false,
      domainRisk: 'low',
      riskScore: 0,
      riskFactors: [],
      mxRecords: [],
      hasSPF: false,
      hasDKIM: false,
      hasDMARC: false,
      checkedAt: new Date(),
    };

    // 1. Check if disposable email
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain.toLowerCase())) {
      result.isDisposable = true;
      result.riskScore += 50;
      result.riskFactors.push('Disposable email domain detected');
    }

    // 2. Check if role-based email
    if (this.isRoleBasedEmail(localPart)) {
      result.isRoleBased = true;
      result.riskFactors.push('Role-based email address');
    }

    // 3. Check if free email provider
    if (FREE_EMAIL_PROVIDERS.has(domain.toLowerCase())) {
      result.isFreeProvider = true;
      result.riskScore += 5; // Minor risk increase
      result.riskFactors.push('Free email provider');
    }

    // 4. Check TLD risk
    const tldRisk = this.checkTldRisk(domain);
    if (tldRisk.isHighRisk) {
      result.riskScore += tldRisk.riskScore;
      result.riskFactors.push(...tldRisk.reasons);
    }

    // 5. Check MX records
    try {
      const mxCheck = await this.checkMXRecords(domain);
      result.mxRecords = mxCheck.records;
      if (!mxCheck.hasValidMX) {
        result.riskScore += 15;
        result.riskFactors.push('No valid MX records found');
      }
      result.hasSPF = mxCheck.hasSPF;
      result.hasDKIM = mxCheck.hasDKIM;
      result.hasDMARC = mxCheck.hasDMARC;
    } catch (error) {
      result.riskScore += 10;
      result.riskFactors.push('Could not verify email domain');
    }

    // 6. Check domain age (simplified - would use WHOIS in production)
    result.domainAge = await this.checkDomainAge(domain);
    if (result.domainAge !== undefined && result.domainAge < 30) {
      result.riskScore += 20;
      result.riskFactors.push(`Domain is less than 30 days old (${result.domainAge} days)`);
    }

    // Determine domain risk level
    if (result.riskScore >= 50) {
      result.domainRisk = 'high';
    } else if (result.riskScore >= 25) {
      result.domainRisk = 'medium';
    } else {
      result.domainRisk = 'low';
    }

    return result;
  }

  /**
   * Extract domain from email
   */
  private extractDomain(email: string): string {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : '';
  }

  /**
   * Extract local part (before @)
   */
  private extractLocalPart(email: string): string {
    const parts = email.split('@');
    return parts.length === 2 ? parts[0].toLowerCase() : '';
  }

  /**
   * Check if email is role-based
   */
  private isRoleBasedEmail(localPart: string): boolean {
    const lowerLocal = localPart.toLowerCase();
    return ROLE_BASED_PATTERNS.some((pattern) => lowerLocal.includes(pattern));
  }

  /**
   * Check TLD risk
   */
  private checkTldRisk(domain: string): { isHighRisk: boolean; riskScore: number; reasons: string[] } {
    const reasons: string[] = [];
    let riskScore = 0;
    let isHighRisk = false;

    for (const tld of HIGH_RISK_TLDS) {
      if (domain.endsWith(tld)) {
        isHighRisk = true;
        riskScore += 15;
        reasons.push(`High-risk TLD: ${tld}`);
        break;
      }
    }

    return { isHighRisk, riskScore, reasons };
  }

  /**
   * Check MX records for domain
   */
  private async checkMXRecords(domain: string): Promise<{
    records: MXRecord[];
    hasValidMX: boolean;
    hasSPF: boolean;
    hasDKIM: boolean;
    hasDMARC: boolean;
  }> {
    // In production, use DNS lookup
    // For now, return placeholder data

    return {
      records: [],
      hasValidMX: true, // Assume valid
      hasSPF: false,
      hasDKIM: false,
      hasDMARC: false,
    };
  }

  /**
   * Check domain age (simplified)
   */
  private async checkDomainAge(domain: string): Promise<number | undefined> {
    // In production, use WHOIS lookup
    // For now, return undefined (unknown)
    return undefined;
  }

  // ========================================
  // Breach Check (HaveIBeenPwned)
  // ========================================

  /**
   * Check if email appears in data breaches
   */
  async checkBreaches(email: string): Promise<BreachCheckResult> {
    const result: BreachCheckResult = {
      email,
      foundInBreaches: false,
      breachCount: 0,
      breaches: [],
      checkedAt: new Date(),
    };

    try {
      // In production, use HaveIBeenPwned API
      // const response = await axios.get(
      //   `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
      //   {
      //     headers: { 'hibp-api-key': process.env.HIBP_API_KEY },
      //     timeout: 5000,
      //   }
      // );

      // For now, return empty result (no breaches)
      // Real implementation would parse the response

    } catch (error: any) {
      if (error.response?.status === 404) {
        // 404 means no breaches found
        return result;
      }

      logger.warn('Breach check failed', { email, error: error.message });
    }

    return result;
  }

  // ========================================
  // Comprehensive Validation
  // ========================================

  /**
   * Validate email with full reputation check
   */
  async validateEmail(email: string, options?: {
    checkBreaches?: boolean;
    userId?: string;
    action?: 'registration' | 'login' | 'password_reset';
  }): Promise<EmailValidationResult> {
    const recommendations: string[] = [];

    // 1. Basic format validation
    const formatValid = this.isValidEmailFormat(email);
    if (!formatValid) {
      return {
        isValid: false,
        formatValid: false,
        domainValid: false,
        reputation: await this.analyzeEmail(email),
        isSuspicious: true,
        shouldBlock: true,
        recommendations: ['Invalid email format'],
      };
    }

    // 2. Domain validation
    const domain = this.extractDomain(email);
    const domainValid = await this.isDomainValid(domain);

    if (!domainValid) {
      recommendations.push('Email domain could not be verified');
    }

    // 3. Get email reputation
    const reputation = await this.analyzeEmail(email);

    // 4. Check breaches if requested
    let breachStatus: BreachCheckResult | undefined;
    if (options?.checkBreaches) {
      breachStatus = await this.checkBreaches(email);

      if (breachStatus.foundInBreaches) {
        reputation.riskScore += 25;
        reputation.riskFactors.push(`Found in ${breachStatus.breachCount} data breach(es)`);
        recommendations.push('Email found in data breaches - consider using a different email');
      }
    }

    // 5. Determine overall validity and action
    let isSuspicious = false;
    let shouldBlock = false;

    if (reputation.isDisposable) {
      isSuspicious = true;
      shouldBlock = true;
      recommendations.push('Disposable emails are not allowed');
    }

    if (reputation.riskScore >= 50) {
      isSuspicious = true;
      if (options?.action === 'registration') {
        shouldBlock = true;
      }
      recommendations.push('Email domain has high risk score');
    }

    if (breachStatus?.foundInBreaches) {
      isSuspicious = true;
      if (options?.action === 'login') {
        // Flag for review rather than block
        recommendations.push('Email found in breaches - please verify your identity');
      }
    }

    // Audit log for suspicious emails
    if ((isSuspicious || shouldBlock) && options?.userId) {
      await createAuditLog({
        userId: options.userId,
        action: shouldBlock ? 'EMAIL_BLOCKED' : 'EMAIL_FLAGGED',
        resource: 'email_reputation',
        resourceId: email,
        details: {
          riskScore: reputation.riskScore,
          isDisposable: reputation.isDisposable,
          riskFactors: reputation.riskFactors,
          breachCount: breachStatus?.breachCount,
        },
        status: 'success',
      });
    }

    return {
      isValid: formatValid && domainValid && !shouldBlock,
      formatValid,
      domainValid,
      reputation,
      breachStatus,
      isSuspicious,
      shouldBlock,
      recommendations,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmailFormat(email: string): boolean {
    // RFC 5322 simplified email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Check if domain is valid (has DNS records)
   */
  private async isDomainValid(domain: string): Promise<boolean> {
    // In production, perform DNS lookup
    // For now, assume valid if it has a dot
    return domain.includes('.') && domain.split('.').pop()!.length >= 2;
  }

  // ========================================
  // Risk Assessment
  // ========================================

  /**
   * Get risk assessment for email
   */
  async assessRisk(email: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    riskScore: number;
    factors: string[];
    recommendation: 'allow' | 'review' | 'block';
  }> {
    const reputation = await this.analyzeEmail(email);
    const breachCheck = await this.checkBreaches(email);

    let riskScore = reputation.riskScore;

    // Add breach risk
    if (breachCheck.foundInBreaches) {
      riskScore += 20;
    }

    // Cap at 100
    riskScore = Math.min(100, riskScore);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 25) riskLevel = 'medium';

    // Determine recommendation
    let recommendation: 'allow' | 'review' | 'block' = 'allow';
    if (riskScore >= 70) recommendation = 'block';
    else if (riskScore >= 40) recommendation = 'review';

    return {
      riskLevel,
      riskScore,
      factors: [...reputation.riskFactors, ...(breachCheck.foundInBreaches ? ['Found in data breaches'] : [])],
      recommendation,
    };
  }
}

// Export singleton instance
export const emailReputationService = new EmailReputationService();
export default emailReputationService;
