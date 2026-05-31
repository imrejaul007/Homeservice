import mongoose from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: string;
  actionLabel: string;
  icon: string;
  reward?: { type: 'coins'; amount: number };
  required: boolean;
  category: 'profile' | 'payment' | 'booking' | 'social';
}

export interface UserOnboardingProgress {
  userId: string;
  completedSteps: string[];
  currentStep: number;
  startedAt: Date;
  completedAt?: Date;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // Profile steps
  {
    id: 'complete_profile',
    title: 'Complete Your Profile',
    description: 'Add your name, phone number, and profile picture',
    action: '/profile/edit',
    actionLabel: 'Complete Profile',
    icon: '👤',
    reward: { type: 'coins', amount: 5 },
    required: true,
    category: 'profile',
  },
  {
    id: 'add_address',
    title: 'Add Your Address',
    description: 'Save your home or work address for faster bookings',
    action: '/profile/addresses',
    actionLabel: 'Add Address',
    icon: '📍',
    reward: { type: 'coins', amount: 5 },
    required: true,
    category: 'profile',
  },
  {
    id: 'verify_email',
    title: 'Verify Your Email',
    description: 'Check your inbox for a verification link',
    action: '/verify-email',
    actionLabel: 'Verify Email',
    icon: '✉️',
    reward: { type: 'coins', amount: 10 },
    required: true,
    category: 'profile',
  },

  // Payment steps
  {
    id: 'add_payment',
    title: 'Add Payment Method',
    description: 'Add a card or wallet for quick payments',
    action: '/wallet/add',
    actionLabel: 'Add Payment',
    icon: '💳',
    reward: { type: 'coins', amount: 15 },
    required: false,
    category: 'payment',
  },

  // Booking steps
  {
    id: 'first_booking',
    title: 'Make Your First Booking',
    description: 'Book any service to get started',
    action: '/services',
    actionLabel: 'Browse Services',
    icon: '🎯',
    reward: { type: 'coins', amount: 25 },
    required: true,
    category: 'booking',
  },
  {
    id: 'leave_review',
    title: 'Leave a Review',
    description: 'Share your experience to help others',
    action: '/bookings',
    actionLabel: 'View Bookings',
    icon: '⭐',
    reward: { type: 'coins', amount: 10 },
    required: false,
    category: 'booking',
  },

  // Social steps
  {
    id: 'share_referral',
    title: 'Share Your Referral Code',
    description: 'Invite friends and earn coins',
    action: '/referrals',
    actionLabel: 'Share Code',
    icon: '🤝',
    reward: { type: 'coins', amount: 50 },
    required: false,
    category: 'social',
  },
];

class OnboardingService {
  async getOnboardingProgress(userId: string): Promise<{
    steps: OnboardingStep[];
    completed: string[];
    currentStep: number;
    progress: number;
    totalReward: number;
    earnedReward: number;
    startedAt?: Date;
    completedAt?: Date;
  }> {
    // FIX: Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID format');
    }

    const user = await User.findById(userId);

    // FIX: Return clear error if user not found
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const completed = (user as any)?.onboardingProgress?.completedSteps || [];
    const completedSet = new Set(completed);
    const startedAt = (user as any)?.onboardingProgress?.startedAt;

    // Calculate which steps are applicable
    const applicableSteps = ONBOARDING_STEPS.filter(step => {
      if (step.id === 'verify_email' && user?.isEmailVerified) return false;
      if (step.id === 'add_address' && user?.address) return false;
      return true;
    });

    // Find current step (first uncompleted required step)
    let currentStep = applicableSteps.findIndex(
      s => s.required && !completedSet.has(s.id)
    );
    if (currentStep === -1) {
      currentStep = applicableSteps.findIndex(s => !completedSet.has(s.id));
    }
    if (currentStep === -1) currentStep = applicableSteps.length;

    const totalReward = applicableSteps.reduce((sum, s) => sum + (s.reward?.amount || 0), 0);
    const earnedReward = applicableSteps
      .filter(s => completedSet.has(s.id))
      .reduce((sum, s) => sum + (s.reward?.amount || 0), 0);

    // FIX: Check if onboarding was completed (not just current step)
    const isComplete = completedSet.size >= applicableSteps.length &&
      applicableSteps.every(s => completedSet.has(s.id));

    return {
      steps: applicableSteps,
      completed,
      currentStep,
      progress: applicableSteps.length > 0
        ? Math.round((completed.length / applicableSteps.length) * 100)
        : 100,
      totalReward,
      earnedReward,
      startedAt,
      completedAt: (user as any)?.onboardingProgress?.completedAt,
    };
  }

  async completeStep(userId: string, stepId: string): Promise<{ success: boolean; reward?: number; completed: boolean }> {
    // FIX: Validate inputs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID format');
    }

    if (!stepId || typeof stepId !== 'string') {
      throw new ApiError(400, 'Step ID is required');
    }

    const step = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (!step) {
      throw new ApiError(404, 'Onboarding step not found');
    }

    const user = await User.findById(userId);
    // FIX: Check user exists before proceeding
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const completed = (user as any)?.onboardingProgress?.completedSteps || [];

    if (completed.includes(stepId)) {
      return { success: true, completed: false };
    }

    // FIX: Initialize onboardingProgress if it doesn't exist
    const updates: any = {};

    // Mark step as completed
    updates['onboardingProgress.completedSteps'] = stepId;
    updates['onboardingProgress.currentStep'] = (user as any)?.onboardingProgress?.currentStep || 0;

    // FIX: Set startedAt on first step completion
    if (!((user as any)?.onboardingProgress?.startedAt)) {
      updates['onboardingProgress.startedAt'] = new Date();
    }

    await User.findByIdAndUpdate(userId, {
      $push: { 'onboardingProgress.completedSteps': stepId },
      $set: {
        ...updates,
      },
    });

    // Award reward
    let reward = 0;
    if (step.reward?.type === 'coins' && step.reward.amount) {
      reward = step.reward.amount;
      await User.findByIdAndUpdate(userId, {
        $inc: { 'loyaltySystem.coins': reward },
      });
    }

    // Check if onboarding is complete
    const progress = await this.getOnboardingProgress(userId);
    // FIX: Check all required steps are completed, not just current step
    const allRequiredCompleted = progress.steps
      .filter(s => s.required)
      .every(s => progress.completed.includes(s.id));

    if (allRequiredCompleted) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'onboardingProgress.completedAt': new Date() },
      });
      logger.info('Onboarding completed', { userId });
    }

    logger.info('Onboarding step completed', { userId, stepId, reward });

    return { success: true, reward, completed: allRequiredCompleted };
  }

  async isOnboardingComplete(userId: string): Promise<boolean> {
    const progress = await this.getOnboardingProgress(userId);
    // FIX: Check all required steps are completed
    return progress.steps
      .filter(s => s.required)
      .every(s => progress.completed.includes(s.id));
  }

  async getOnboardingSteps(): Promise<OnboardingStep[]> {
    return ONBOARDING_STEPS;
  }
}

export const onboardingService = new OnboardingService();
