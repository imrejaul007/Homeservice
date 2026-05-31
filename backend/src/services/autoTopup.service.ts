import AutoTopup, { IAutoTopup, AutoTopupLog } from '../models/autoTopup.model';
import Wallet from '../models/wallet.model';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getTenantId, getTenantIdOptional } from '../utils/tenantFilter';
import { creditWallet } from './wallet.service';

export interface AutoTopupConfig {
  enabled: boolean;
  thresholdAmount: number;
  topupAmount: number;
  paymentMethodId: string;
  paymentMethodType: 'card' | 'bank_account' | 'wallet';
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  maxAutoTopupsPerMonth: number;
  maxAutoTopupAmount: number;
}

export interface AutoTopupLogEntry {
  id: string;
  topupAmount: number;
  triggerBalance: number;
  status: string;
  failureReason?: string;
  triggeredAt: Date;
  completedAt?: Date;
}

/**
 * Get or create auto-topup configuration for user
 */
export const getAutoTopupConfig = async (
  userId: string,
  req?: Request
): Promise<AutoTopupConfig | null> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;

  const query: Record<string, unknown> = { userId };
  if (tenantId) {
    query.tenantId = tenantId;
  }

  const autoTopup = await AutoTopup.findOne(query);

  if (!autoTopup) {
    return null;
  }

  return {
    enabled: autoTopup.enabled,
    thresholdAmount: autoTopup.thresholdAmount,
    topupAmount: autoTopup.topupAmount,
    paymentMethodId: autoTopup.paymentMethodId,
    paymentMethodType: autoTopup.paymentMethodType,
    paymentMethodLast4: autoTopup.paymentMethodLast4,
    paymentMethodBrand: autoTopup.paymentMethodBrand,
    maxAutoTopupsPerMonth: autoTopup.maxAutoTopupsPerMonth,
    maxAutoTopupAmount: autoTopup.maxAutoTopupAmount,
  };
};

/**
 * Configure auto-topup settings
 */
export const configureAutoTopup = async (
  userId: string,
  config: AutoTopupConfig,
  req?: Request
): Promise<{ success: boolean; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    // Validate configuration
    if (config.topupAmount > config.maxAutoTopupAmount) {
      return { success: false, error: `Topup amount exceeds maximum of ${config.maxAutoTopupAmount}` };
    }

    if (config.topupAmount <= 0) {
      return { success: false, error: 'Topup amount must be positive' };
    }

    if (config.thresholdAmount < 0) {
      return { success: false, error: 'Threshold amount cannot be negative' };
    }

    const updateData: Record<string, unknown> = {
      ...config,
      status: config.enabled ? 'active' : 'disabled',
      nextCheckAt: new Date(),
    };

    if (tenantId) {
      updateData.tenantId = tenantId;
    }

    await AutoTopup.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    logger.info('Auto-topup configured', {
      userId,
      enabled: config.enabled,
      threshold: config.thresholdAmount,
      amount: config.topupAmount,
      action: 'AUTOTOPUP_CONFIGURED',
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to configure auto-topup', {
      userId,
      error: error.message,
      action: 'AUTOTOPUP_CONFIG_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Enable/disable auto-topup
 */
export const toggleAutoTopup = async (
  userId: string,
  enabled: boolean,
  req?: Request
): Promise<{ success: boolean; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    const query: Record<string, unknown> = { userId };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const autoTopup = await AutoTopup.findOne(query);

    if (!autoTopup) {
      return { success: false, error: 'Auto-topup not configured. Please set up auto-topup first.' };
    }

    autoTopup.enabled = enabled;
    autoTopup.status = enabled ? 'active' : 'paused';
    autoTopup.nextCheckAt = new Date();
    await autoTopup.save();

    logger.info('Auto-topup toggled', {
      userId,
      enabled,
      action: 'AUTOTOPUP_TOGGLED',
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to toggle auto-topup', {
      userId,
      error: error.message,
      action: 'AUTOTOPUP_TOGGLE_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Monitor wallet balance and trigger auto-topup if needed
 */
export const monitorWalletBalance = async (userId: string): Promise<{
  triggered: boolean;
  topupAmount?: number;
  newBalance?: number;
  error?: string;
}> => {
  try {
    const autoTopup = await AutoTopup.findOne({ userId, enabled: true, status: 'active' });

    if (!autoTopup) {
      return { triggered: false };
    }

    // Check monthly limit
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (autoTopup.autoTopupsThisMonth >= autoTopup.maxAutoTopupsPerMonth) {
      logger.info('Auto-topup skipped - monthly limit reached', {
        userId,
        topupsThisMonth: autoTopup.autoTopupsThisMonth,
        limit: autoTopup.maxAutoTopupsPerMonth,
        action: 'AUTOTOPUP_SKIPPED_MONTHLY_LIMIT',
      });
      return { triggered: false, error: 'Monthly auto-topup limit reached' };
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return { triggered: false, error: 'Wallet not found' };
    }

    // Check if balance is below threshold
    if (wallet.balance >= autoTopup.thresholdAmount) {
      return { triggered: false };
    }

    // Trigger auto-topup
    const topupAmount = autoTopup.topupAmount;

    // Process the topup
    const result = await processAutoTopup(userId, autoTopup, wallet.balance, topupAmount);

    if (result.success) {
      return {
        triggered: true,
        topupAmount,
        newBalance: result.newBalance,
      };
    } else {
      return {
        triggered: false,
        error: result.error,
      };
    }
  } catch (error: any) {
    logger.error('Failed to monitor wallet balance', {
      userId,
      error: error.message,
      action: 'AUTOTOPUP_MONITOR_ERROR',
    });
    return { triggered: false, error: error.message };
  }
};

/**
 * Process auto-topup payment
 */
const processAutoTopup = async (
  userId: string,
  autoTopup: IAutoTopup,
  triggerBalance: number,
  topupAmount: number
): Promise<{ success: boolean; newBalance?: number; transactionId?: string; error?: string }> => {
  const tenantId = autoTopup.tenantId?.toString();

  // Create log entry
  const logData: Record<string, unknown> = {
    autoTopupId: autoTopup._id,
    userId,
    triggerBalance,
    topupAmount,
    status: 'success',
    triggeredAt: new Date(),
  };

  if (tenantId) {
    logData.tenantId = tenantId;
  }

  try {
    // Process payment (simulated - in production, integrate with payment gateway)
    const paymentResult = await processPayment(autoTopup.paymentMethodId, topupAmount);

    if (!paymentResult.success) {
      // Log failed attempt
      logData.status = 'failed';
      logData.failureReason = paymentResult.error;
      await AutoTopupLog.create(logData);

      // Update failure tracking
      autoTopup.consecutiveFailures += 1;
      autoTopup.lastFailureReason = paymentResult.error;

      if (autoTopup.consecutiveFailures >= 3) {
        autoTopup.status = 'failed';
        autoTopup.enabled = false;
      }

      await autoTopup.save();

      return { success: false, error: paymentResult.error };
    }

    // Credit wallet
    const walletResult = await creditWallet(
      {
        userId,
        type: 'credit',
        amount: topupAmount,
        description: 'Auto-topup',
        reference: paymentResult.transactionId || `auto_${randomUUID()}`,
        referenceType: 'topup',
        metadata: {
          source: 'auto_topup',
          paymentMethodId: autoTopup.paymentMethodId,
          triggerBalance,
        },
      }
    );

    if (!walletResult.success) {
      // Log failed attempt
      logData.status = 'failed';
      logData.failureReason = walletResult.error;
      logData.transactionId = paymentResult.transactionId;
      await AutoTopupLog.create(logData);

      return { success: false, error: walletResult.error };
    }

    // Success - update log
    logData.status = 'success';
    logData.transactionId = walletResult.transactionId;
    logData.completedAt = new Date();
    await AutoTopupLog.create(logData);

    // Update auto-topup stats
    autoTopup.autoTopupsThisMonth += 1;
    autoTopup.lastAutoTopupAt = new Date();
    autoTopup.lastAutoTopupAmount = topupAmount;
    autoTopup.lastAutoTopupStatus = 'success';
    autoTopup.consecutiveFailures = 0;
    autoTopup.lastFailureReason = undefined;
    autoTopup.nextCheckAt = new Date();
    await autoTopup.save();

    logger.info('Auto-topup processed', {
      userId,
      topupAmount,
      newBalance: walletResult.newBalance,
      transactionId: walletResult.transactionId,
      topupsThisMonth: autoTopup.autoTopupsThisMonth,
      action: 'AUTOTOPUP_PROCESSED',
    });

    return {
      success: true,
      newBalance: walletResult.newBalance,
      transactionId: walletResult.transactionId,
    };
  } catch (error: any) {
    logger.error('Auto-topup processing failed', {
      userId,
      error: error.message,
      action: 'AUTOTOPUP_PROCESS_ERROR',
    });

    // Log failed attempt
    logData.status = 'failed';
    logData.failureReason = error.message;
    try {
      await AutoTopupLog.create(logData);
    } catch (logError) {
      logger.error('Failed to create auto-topup log', { userId });
    }

    return { success: false, error: error.message };
  }
};

/**
 * Simulated payment processing
 * In production, integrate with Stripe/Payment gateway
 */
const processPayment = async (
  paymentMethodId: string,
  amount: number
): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  // Simulate payment processing
  // In production: const result = await stripe.charges.create({ ... });

  return {
    success: true,
    transactionId: `pay_${randomUUID()}`,
  };
};

/**
 * Get auto-topup transaction history
 */
export const getAutoTopupHistory = async (
  userId: string,
  req?: Request,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: AutoTopupLogEntry[]; total: number }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    const query: Record<string, unknown> = { userId };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const total = await AutoTopupLog.countDocuments(query);
    const logs = await AutoTopupLog.find(query)
      .sort({ triggeredAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 20);

    return {
      logs: logs.map((l) => ({
        id: l._id.toString(),
        topupAmount: l.topupAmount,
        triggerBalance: l.triggerBalance,
        status: l.status,
        failureReason: l.failureReason,
        triggeredAt: l.triggeredAt,
        completedAt: l.completedAt,
      })),
      total,
    };
  } catch (error: any) {
    logger.error('Failed to get auto-topup history', {
      userId,
      error: error.message,
      action: 'AUTOTOPUP_HISTORY_ERROR',
    });
    return { logs: [], total: 0 };
  }
};

/**
 * Preview next auto-topup (if triggered now)
 */
export const previewNextTopup = async (
  userId: string,
  req?: Request
): Promise<{
  willTrigger: boolean;
  currentBalance: number;
  thresholdAmount: number;
  topupAmount: number;
  projectedBalance: number;
  reason?: string;
}> => {
  const config = await getAutoTopupConfig(userId, req);

  if (!config || !config.enabled) {
    return {
      willTrigger: false,
      currentBalance: 0,
      thresholdAmount: 0,
      topupAmount: 0,
      projectedBalance: 0,
      reason: 'Auto-topup is not enabled',
    };
  }

  const wallet = await Wallet.findOne({ userId });
  const currentBalance = wallet?.balance || 0;

  if (currentBalance >= config.thresholdAmount) {
    return {
      willTrigger: false,
      currentBalance,
      thresholdAmount: config.thresholdAmount,
      topupAmount: config.topupAmount,
      projectedBalance: currentBalance,
      reason: 'Balance is above threshold',
    };
  }

  return {
    willTrigger: true,
    currentBalance,
    thresholdAmount: config.thresholdAmount,
    topupAmount: config.topupAmount,
    projectedBalance: currentBalance + config.topupAmount,
  };
};

/**
 * Reset monthly counter (to be called by scheduled job)
 */
export const resetMonthlyCounter = async (): Promise<number> => {
  const result = await AutoTopup.updateMany(
    { enabled: true },
    {
      $set: { autoTopupsThisMonth: 0 },
    }
  );

  return result.modifiedCount;
};

export default {
  getAutoTopupConfig,
  configureAutoTopup,
  toggleAutoTopup,
  monitorWalletBalance,
  getAutoTopupHistory,
  previewNextTopup,
  resetMonthlyCounter,
};
