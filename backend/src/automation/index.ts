/**
 * Automation Module Index
 *
 * Central export for all automation services
 */

export * from './welcomeEmailSequence';
export * from './onboardingChecklist';
export * from './firstBookingDiscount';
export * from './providerTrainingAcademy';
export * from './reviewRequestTiming';
export * from './negativeReviewRecovery';
export * from './winBackCampaign';
export * from './tierUpgradeCelebration';
export * from './birthdayReward';
export * from './autoRefundThreshold';
export * from './mediationAutoAssign';
export * from './referralGamification';
export * from './offPeakPromotion';

import * as welcomeEmailSequence from './welcomeEmailSequence';
import * as onboardingChecklist from './onboardingChecklist';
import * as firstBookingDiscount from './firstBookingDiscount';
import * as providerTrainingAcademy from './providerTrainingAcademy';
import * as reviewRequestTiming from './reviewRequestTiming';
import * as negativeReviewRecovery from './negativeReviewRecovery';
import * as winBackCampaign from './winBackCampaign';
import * as tierUpgradeCelebration from './tierUpgradeCelebration';
import * as birthdayReward from './birthdayReward';
import * as autoRefundThreshold from './autoRefundThreshold';
import * as mediationAutoAssign from './mediationAutoAssign';
import * as referralGamification from './referralGamification';
import * as offPeakPromotion from './offPeakPromotion';

import logger from '../utils/logger';

/**
 * Initialize all automation systems
 * Called on application startup
 */
export async function initializeAutomation(): Promise<void> {
  logger.info('Initializing automation systems...');

  try {
    // Initialize training modules
    await providerTrainingAcademy.initializeTrainingModules();

    logger.info('Automation systems initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize automation systems', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  initializeAutomation,

  // Re-export all automation functions
  welcomeEmailSequence,
  onboardingChecklist,
  firstBookingDiscount,
  providerTrainingAcademy,
  reviewRequestTiming,
  negativeReviewRecovery,
  winBackCampaign,
  tierUpgradeCelebration,
  birthdayReward,
  autoRefundThreshold,
  mediationAutoAssign,
  referralGamification,
  offPeakPromotion,
};
