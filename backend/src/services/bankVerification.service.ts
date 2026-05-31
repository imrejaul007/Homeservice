/**
 * Bank Account Verification Service
 * Plaid/Stripe integration for account verification and payout routing
 */

import axios from 'axios';
import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface BankAccount {
  accountId: string;
  bankName: string;
  accountType: 'checking' | 'savings';
  accountNumberMasked: string;
  routingNumberMasked: string;
  isVerified: boolean;
  isPrimary: boolean;
  verificationStatus: 'pending' | 'verified' | 'failed';
  verificationDate?: Date;
  balance?: BankBalance;
  limits?: AccountLimits;
}

export interface BankBalance {
  available: number;
  current: number;
  currency: string;
  lastUpdated: Date;
}

export interface AccountLimits {
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
}

export interface VerificationResult {
  success: boolean;
  account: BankAccount;
  verificationMethod: 'microdeposits' | 'instant' | 'manual';
  message: string;
}

export interface PayoutRoute {
  accountId: string;
  bankName: string;
  isDefault: boolean;
  estimatedArrival: 'instant' | 'same_day' | '1_2_days' | '3_5_days';
  fees: {
    amount: number;
    currency: string;
    type: 'fixed' | 'percentage' | 'none';
    minAmount?: number;
    maxAmount?: number;
  };
}

export interface InstantPayoutEligibility {
  eligible: boolean;
  reason?: string;
  maxAmount: number;
  availableBalance: number;
}

export interface StripePayoutAccount {
  stripeAccountId: string;
  bankAccountId: string;
  last4: string;
  bankName: string;
  isVerified: boolean;
  payoutsEnabled: boolean;
}

export interface BankLinkToken {
  linkToken: string;
  expiration: Date;
  accountId?: string;
}

// ============================================
// Configuration
// ============================================

const PAYOUT_FEES = {
  instant: { amount: 0.015, currency: 'AED', type: 'percentage' as const, minAmount: 5, maxAmount: 50 },
  same_day: { amount: 2, currency: 'AED', type: 'fixed' as const },
  standard: { amount: 0, currency: 'AED', type: 'none' as const },
};

const DAILY_INSTANT_PAYOUT_LIMIT = 10000; // AED
const MONTHLY_INSTANT_PAYOUT_LIMIT = 100000; // AED

// ============================================
// BankVerificationService Class
// ============================================

export class BankVerificationService {
  // ========================================
  // Plaid Integration
  // ========================================

  /**
   * Create Plaid link token for bank connection
   */
  async createLinkToken(userId: string, clientName: string = 'Rez Homeservice'): Promise<BankLinkToken> {
    try {
      // In production, call Plaid API:
      // const response = await plaidClient.linkTokenCreate({
      //   user: { client_user_id: userId },
      //   client_name: clientName,
      //   products: ['auth', 'transactions', 'identity'],
      //   country_codes: ['AE', 'US', 'GB'],
      //   language: 'en',
      // });

      // Simulated response
      const linkToken = `link-sandbox-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const expiration = new Date();
      expiration.setHours(expiration.getHours() + 4);

      logger.info('Bank link token created', {
        userId,
        linkToken: linkToken.substring(0, 20) + '...',
        expiration,
      });

      return {
        linkToken,
        expiration,
      };
    } catch (error) {
      logger.error('Failed to create link token', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to create bank link token');
    }
  }

  /**
   * Exchange public token for access token
   */
  async exchangePublicToken(publicToken: string, userId: string): Promise<{
    success: boolean;
    accountId: string;
  }> {
    try {
      // In production:
      // const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      //   public_token: publicToken,
      // });
      // const accessToken = exchangeResponse.data.access_token;

      // Simulated exchange
      const accountId = `acc-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Store in user model
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            payoutAccounts: {
              accountId,
              accessToken: `access-sandbox-${Date.now()}`, // In production, store encrypted
              itemId: `item-${Date.now()}`,
              institutionId: 'ins_1',
              institutionName: 'Demo Bank',
              createdAt: new Date(),
            },
          },
        }
      );

      await createAuditLog({
        userId,
        action: 'BANK_ACCOUNT_LINKED',
        resource: 'bank_verification',
        resourceId: accountId,
        details: { institutionId: 'ins_1' },
        status: 'success',
      });

      return {
        success: true,
        accountId,
      };
    } catch (error) {
      logger.error('Failed to exchange public token', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to link bank account');
    }
  }

  /**
   * Get linked bank accounts for a user
   */
  async getLinkedAccounts(userId: string): Promise<BankAccount[]> {
    const user = await User.findById(userId).select('payoutAccounts');

    if (!user?.payoutAccounts || user.payoutAccounts.length === 0) {
      return [];
    }

    // In production, would query Plaid for account details
    return user.payoutAccounts.map((account: any) => ({
      accountId: account.accountId,
      bankName: account.institutionName || 'Unknown Bank',
      accountType: 'checking' as const,
      accountNumberMasked: '****1234', // Would come from Plaid
      routingNumberMasked: '****5678',
      isVerified: account.verified || false,
      isPrimary: account.isDefault || false,
      verificationStatus: account.verified ? 'verified' as const : 'pending' as const,
      verificationDate: account.verifiedAt,
    }));
  }

  /**
   * Verify bank account using microdeposits
   */
  async verifyWithMicrodeposits(
    userId: string,
    accountId: string,
    amounts: [number, number]
  ): Promise<VerificationResult> {
    try {
      // In production:
      // const response = await plaidClient.authGet({ access_token: accessToken });
      // Verify amounts match

      // Simulated verification
      const isValid = amounts[0] > 0 && amounts[1] > 0 && amounts[0] !== amounts[1];

      if (isValid) {
        await User.updateOne(
          { _id: userId, 'payoutAccounts.accountId': accountId },
          {
            $set: {
              'payoutAccounts.$.verified': true,
              'payoutAccounts.$.verifiedAt': new Date(),
              'payoutAccounts.$.verificationStatus': 'verified',
            },
          }
        );

        await createAuditLog({
          userId,
          action: 'BANK_ACCOUNT_VERIFIED',
          resource: 'bank_verification',
          resourceId: accountId,
          details: { method: 'microdeposits' },
          status: 'success',
        });

        return {
          success: true,
          account: {
            accountId,
            bankName: 'Demo Bank',
            accountType: 'checking',
            accountNumberMasked: '****1234',
            routingNumberMasked: '****5678',
            isVerified: true,
            isPrimary: false,
            verificationStatus: 'verified',
            verificationDate: new Date(),
          },
          verificationMethod: 'microdeposits',
          message: 'Bank account verified successfully',
        };
      }

      return {
        success: false,
        account: {
          accountId,
          bankName: 'Demo Bank',
          accountType: 'checking',
          accountNumberMasked: '****1234',
          routingNumberMasked: '****5678',
          isVerified: false,
          isPrimary: false,
          verificationStatus: 'failed',
        },
        verificationMethod: 'microdeposits',
        message: 'Verification amounts do not match. Please try again.',
      };
    } catch (error) {
      logger.error('Microdeposit verification failed', {
        userId,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to verify bank account');
    }
  }

  // ========================================
  // Balance Checking
  // ========================================

  /**
   * Get account balance
   */
  async getAccountBalance(userId: string, accountId: string): Promise<BankBalance | null> {
    try {
      // In production:
      // const balance = await plaidClient.accountsBalanceGet({ access_token });

      // Simulated balance
      return {
        available: 0, // Would show actual balance
        current: 0,
        currency: 'AED',
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get account balance', { userId, accountId });
      return null;
    }
  }

  // ========================================
  // Stripe Payout Integration
  // ========================================

  /**
   * Create Stripe Connect account for payouts
   */
  async createStripePayoutAccount(
    userId: string,
    type: 'individual' | 'company' = 'individual'
  ): Promise<StripePayoutAccount> {
    try {
      // In production:
      // const account = await stripe.accounts.create({
      //   type: 'custom',
      //   country: 'AE',
      //   email: user.email,
      //   capabilities: {
      //     transfers: { requested: true },
      //   },
      // });

      const stripeAccountId = `acct_${Date.now()}${Math.random().toString(36).substring(7)}`;

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            stripeAccountId,
            stripeAccountType: type,
            stripeAccountCreatedAt: new Date(),
          },
        }
      );

      logger.info('Stripe payout account created', {
        userId,
        stripeAccountId,
        type,
      });

      return {
        stripeAccountId,
        bankAccountId: '',
        last4: '',
        bankName: '',
        isVerified: false,
        payoutsEnabled: false,
      };
    } catch (error) {
      logger.error('Failed to create Stripe account', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to create payout account');
    }
  }

  /**
   * Add bank account to Stripe for payouts
   */
  async addStripeBankAccount(
    userId: string,
    stripeAccountId: string,
    bankAccountToken: string
  ): Promise<{ success: boolean; bankAccountId: string; last4: string }> {
    try {
      // In production:
      // const bankAccount = await stripe.accounts.createExternalAccount(
      //   stripeAccountId,
      //   { external_account: bankAccountToken }
      // );

      const bankAccountId = `ba_${Date.now()}`;
      const last4 = '6789';

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            stripeBankAccountId: bankAccountId,
            stripeBankLast4: last4,
          },
        }
      );

      return {
        success: true,
        bankAccountId,
        last4,
      };
    } catch (error) {
      logger.error('Failed to add Stripe bank account', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to add bank account');
    }
  }

  /**
   * Get Stripe account status
   */
  async getStripeAccountStatus(stripeAccountId: string): Promise<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    verificationStatus: 'pending' | 'verified' | 'restricted';
    requirements?: string[];
  }> {
    try {
      // In production:
      // const account = await stripe.accounts.retrieve(stripeAccountId);

      // Simulated response
      return {
        chargesEnabled: true,
        payoutsEnabled: true,
        verificationStatus: 'verified',
        requirements: [],
      };
    } catch (error) {
      logger.error('Failed to get Stripe account status', { stripeAccountId });
      throw new Error('Failed to get account status');
    }
  }

  // ========================================
  // Payout Routing
  // ========================================

  /**
   * Get available payout routes for a user
   */
  async getPayoutRoutes(userId: string): Promise<PayoutRoute[]> {
    const routes: PayoutRoute[] = [];

    // Get linked bank accounts
    const accounts = await this.getLinkedAccounts(userId);

    for (const account of accounts) {
      if (!account.isVerified) continue;

      routes.push({
        accountId: account.accountId,
        bankName: account.bankName,
        isDefault: account.isPrimary,
        estimatedArrival: '1_2_days',
        fees: PAYOUT_FEES.standard,
      });
    }

    // Add Stripe instant option if available
    const user = await User.findById(userId).select('stripeAccountId');
    if (user?.stripeAccountId) {
      const eligibility = await this.checkInstantPayoutEligibility(userId);
      if (eligibility.eligible) {
        routes.push({
          accountId: 'stripe_instant',
          bankName: 'Stripe Instant',
          isDefault: false,
          estimatedArrival: 'instant',
          fees: PAYOUT_FEES.instant,
        });
      }
    }

    return routes;
  }

  /**
   * Check instant payout eligibility
   */
  async checkInstantPayoutEligibility(userId: string): Promise<InstantPayoutEligibility> {
    // Check daily/monthly limits
    const user = await User.findById(userId).select('instantPayoutStats');

    if (!user) {
      return {
        eligible: false,
        reason: 'User not found',
        maxAmount: 0,
        availableBalance: 0,
      };
    }

    const stats: {
      dailyUsed: number;
      monthlyUsed: number;
      lastReset: Date;
    } = (user.instantPayoutStats as {
      dailyUsed: number;
      monthlyUsed: number;
      lastReset: Date;
    } | undefined) ?? {
      dailyUsed: 0,
      monthlyUsed: 0,
      lastReset: new Date(),
    };

    // Reset daily if needed
    const now = new Date();
    const lastReset = new Date(stats.lastReset as Date);
    const isNewDay = now.getDate() !== lastReset.getDate();
    const isNewMonth = now.getMonth() !== lastReset.getMonth();

    if (isNewDay) {
      stats.dailyUsed = 0;
      stats.lastReset = now;
    }

    if (isNewMonth) {
      stats.monthlyUsed = 0;
    }

    const dailyRemaining = DAILY_INSTANT_PAYOUT_LIMIT - stats.dailyUsed;
    const monthlyRemaining = MONTHLY_INSTANT_PAYOUT_LIMIT - stats.monthlyUsed;
    const maxAllowed = Math.min(dailyRemaining, monthlyRemaining);

    if (maxAllowed <= 0) {
      return {
        eligible: false,
        reason: 'Daily or monthly limit reached',
        maxAmount: 0,
        availableBalance: maxAllowed,
      };
    }

    // Check Stripe balance
    const balance = await this.getStripeBalance(userId);

    if (!balance || balance < 10) {
      return {
        eligible: false,
        availableBalance: balance || 0,
        maxAmount: Math.min(maxAllowed, balance || 0),
        reason: 'Insufficient Stripe balance',
      };
    }

    return {
      eligible: true,
      maxAmount: Math.min(maxAllowed, balance),
      availableBalance: balance,
    };
  }

  /**
   * Get Stripe balance
   */
  private async getStripeBalance(userId: string): Promise<number> {
    // In production:
    // const balance = await stripe.balance.retrieve({
    //   stripeAccount: user.stripeAccountId,
    // });
    return 0; // Simulated
  }

  /**
   * Process payout
   */
  async processPayout(
    userId: string,
    amount: number,
    routeId: string
  ): Promise<{
    success: boolean;
    payoutId?: string;
    estimatedArrival: Date;
    fee: number;
    netAmount: number;
  }> {
    const routes = await this.getPayoutRoutes(userId);
    const route = routes.find((r) => r.accountId === routeId);

    if (!route) {
      throw new Error('Invalid payout route');
    }

    if (amount <= 0) {
      throw new Error('Invalid payout amount');
    }

    // Calculate fee
    let fee = 0;
    if (route.fees.type === 'percentage') {
      fee = amount * route.fees.amount;
      fee = Math.max(fee, route.fees.minAmount || 0);
      fee = Math.min(fee, route.fees.maxAmount || Infinity);
    } else if (route.fees.type === 'fixed') {
      fee = route.fees.amount;
    }

    const netAmount = amount - fee;

    // Check balance
    const eligibility = await this.checkInstantPayoutEligibility(userId);
    if (netAmount > eligibility.availableBalance) {
      throw new Error('Insufficient balance for payout');
    }

    // In production, process via Stripe/Plaid
    const payoutId = `po_${Date.now()}${Math.random().toString(36).substring(7)}`;

    // Calculate estimated arrival
    let estimatedArrival = new Date();
    if (route.estimatedArrival === 'instant') {
      // Instant
    } else if (route.estimatedArrival === 'same_day') {
      estimatedArrival.setDate(estimatedArrival.getDate());
    } else if (route.estimatedArrival === '1_2_days') {
      estimatedArrival.setDate(estimatedArrival.getDate() + 2);
    } else {
      estimatedArrival.setDate(estimatedArrival.getDate() + 5);
    }

    // Update stats
    if (route.estimatedArrival === 'instant') {
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            'instantPayoutStats.dailyUsed': (user: any) => user.instantPayoutStats?.dailyUsed || 0 + amount,
            'instantPayoutStats.monthlyUsed': (user: any) => user.instantPayoutStats?.monthlyUsed || 0 + amount,
            'instantPayoutStats.lastReset': new Date(),
          },
        }
      );
    }

    await createAuditLog({
      userId,
      action: 'PAYOUT_INITIATED',
      resource: 'bank_verification',
      resourceId: payoutId,
      details: { amount, fee, netAmount, routeId },
      status: 'success',
    });

    logger.info('Payout processed', {
      userId,
      amount,
      fee,
      netAmount,
      payoutId,
      estimatedArrival,
    });

    return {
      success: true,
      payoutId,
      estimatedArrival,
      fee,
      netAmount,
    };
  }

  // ========================================
  // Account Management
  // ========================================

  /**
   * Set primary payout account
   */
  async setPrimaryAccount(userId: string, accountId: string): Promise<void> {
    // Unset all as primary
    await User.updateOne(
      { _id: userId },
      { $set: { 'payoutAccounts.$[].isDefault': false } }
    );

    // Set specified account as primary
    await User.updateOne(
      { _id: userId, 'payoutAccounts.accountId': accountId },
      { $set: { 'payoutAccounts.$.isDefault': true } }
    );

    await createAuditLog({
      userId,
      action: 'PRIMARY_ACCOUNT_CHANGED',
      resource: 'bank_verification',
      resourceId: accountId,
      status: 'success',
    });
  }

  /**
   * Remove bank account
   */
  async removeBankAccount(userId: string, accountId: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      { $pull: { payoutAccounts: { accountId } } }
    );

    await createAuditLog({
      userId,
      action: 'BANK_ACCOUNT_REMOVED',
      resource: 'bank_verification',
      resourceId: accountId,
      status: 'success',
    });

    logger.info('Bank account removed', { userId, accountId });
  }

  /**
   * Verify identity (KYC)
   */
  async initiateIdentityVerification(userId: string): Promise<{
    success: boolean;
    verificationUrl?: string;
    expiresAt?: Date;
  }> {
    const user = await User.findById(userId).select('email');

    if (!user) {
      throw new Error('User not found');
    }

    // In production, create Stripe identity verification session
    // const verificationSession = await stripe.identity.verificationSessions.create({
    //   type: 'document',
    //   metadata: { userId },
    // });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    logger.info('Identity verification initiated', { userId });

    return {
      success: true,
      verificationUrl: `https://verify.stripe.com/setup/${Date.now()}`,
      expiresAt,
    };
  }

  // ========================================
  // Security & Fraud Prevention
  // ========================================

  /**
   * Check for suspicious bank account activity
   */
  async checkForSuspiciousActivity(userId: string): Promise<{
    suspicious: boolean;
    reasons: string[];
    recommendedAction: 'allow' | 'review' | 'block';
  }> {
    const reasons: string[] = [];
    let suspicious = false;

    // Check for multiple accounts from same institution
    const user = await User.findById(userId).select('payoutAccounts');
    const accounts = user?.payoutAccounts || [];

    const institutionCounts: Record<string, number> = {};
    for (const account of accounts) {
      const instId = String(account.institutionId ?? 'unknown');
      institutionCounts[instId] = (institutionCounts[instId] || 0) + 1;
      if (institutionCounts[instId] > 3) {
        reasons.push('Multiple accounts from same institution');
        suspicious = true;
      }
    }

    // Check for rapid account changes
    if (accounts.length > 5) {
      reasons.push('High number of linked accounts');
      suspicious = true;
    }

    return {
      suspicious,
      reasons,
      recommendedAction: suspicious ? 'review' : 'allow',
    };
  }
}

// Export singleton instance
export const bankVerificationService = new BankVerificationService();
export default bankVerificationService;
