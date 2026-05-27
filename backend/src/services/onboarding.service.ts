import User from '../models/user.model';
import logger from '../utils/logger';

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
  }> {
    const user = await User.findById(userId);

    const completed = (user as any)?.onboardingProgress?.completedSteps || [];
    const completedSet = new Set(completed);

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

    return {
      steps: applicableSteps,
      completed,
      currentStep,
      progress: applicableSteps.length > 0
        ? Math.round((completed.length / applicableSteps.length) * 100)
        : 100,
      totalReward,
      earnedReward,
    };
  }

  async completeStep(userId: string, stepId: string): Promise<{ success: boolean; reward?: number; completed: boolean }> {
    const step = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (!step) {
      return { success: false, completed: false };
    }

    const user = await User.findById(userId);
    const completed = (user as any)?.onboardingProgress?.completedSteps || [];

    if (completed.includes(stepId)) {
      return { success: true, completed: false };
    }

    // Mark step as completed
    await User.findByIdAndUpdate(userId, {
      $push: { 'onboardingProgress.completedSteps': stepId },
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
    const isComplete = progress.currentStep >= progress.steps.length;

    if (isComplete) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'onboardingProgress.completedAt': new Date() },
      });
    }

    logger.info('Onboarding step completed', { userId, stepId, reward });

    return { success: true, reward, completed: isComplete };
  }

  async isOnboardingComplete(userId: string): Promise<boolean> {
    const progress = await this.getOnboardingProgress(userId);
    return progress.currentStep >= progress.steps.length;
  }

  async getOnboardingSteps(): Promise<OnboardingStep[]> {
    return ONBOARDING_STEPS;
  }
}

export const onboardingService = new OnboardingService();
