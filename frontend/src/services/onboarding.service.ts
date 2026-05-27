import { create } from 'zustand';
import { providerOpsApiService, OnboardingStatus } from './providerOpsApi';

// ============================================
// Onboarding Service Types
// ============================================

export type OnboardingStage =
  | 'registration'
  | 'document_upload'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: string;
  actionLabel: string;
  required: boolean;
  category: 'profile' | 'payment' | 'booking' | 'document';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reward?: { type: 'coins'; amount: number };
}

export interface ProviderOnboardingProgress {
  providerId: string;
  currentStage: OnboardingStage;
  completedStages: string[];
  pendingStages: string[];
  steps: OnboardingStep[];
  progress: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
}

// ============================================
// Onboarding Steps Configuration
// ============================================

export const PROVIDER_ONBOARDING_STEPS: Omit<OnboardingStep, 'status'>[] = [
  // Profile & Registration
  {
    id: 'complete_profile',
    title: 'Complete Your Profile',
    description: 'Add your business name, description, and profile picture',
    icon: '👤',
    action: '/provider/profile',
    actionLabel: 'Complete Profile',
    required: true,
    category: 'profile',
  },
  {
    id: 'add_services',
    title: 'Add Your Services',
    description: 'Create and list the services you offer',
    icon: '🛠️',
    action: '/provider/services',
    actionLabel: 'Add Services',
    required: true,
    category: 'booking',
  },
  // Document Verification
  {
    id: 'upload_id',
    title: 'Upload ID Document',
    description: 'Upload your Emirates ID or passport for identity verification',
    icon: '🪪',
    action: '/provider/verification',
    actionLabel: 'Upload ID',
    required: true,
    category: 'document',
  },
  {
    id: 'upload_business',
    title: 'Upload Business Documents',
    description: 'Upload trade license or business registration',
    icon: '📄',
    action: '/provider/verification',
    actionLabel: 'Upload Documents',
    required: false,
    category: 'document',
  },
  // Availability
  {
    id: 'set_availability',
    title: 'Set Your Availability',
    description: 'Define when you are available to take bookings',
    icon: '📅',
    action: '/provider/availability',
    actionLabel: 'Set Schedule',
    required: true,
    category: 'booking',
  },
  // Payment Setup
  {
    id: 'setup_payout',
    title: 'Setup Payout Method',
    description: 'Add your bank account or payment details for payouts',
    icon: '💳',
    action: '/provider/earnings',
    actionLabel: 'Add Payout',
    required: true,
    category: 'payment',
  },
  // Review
  {
    id: 'submit_verification',
    title: 'Submit for Review',
    description: 'Submit your documents for platform verification',
    icon: '✅',
    action: '/provider/verification',
    actionLabel: 'Submit',
    required: true,
    category: 'document',
  },
];

// ============================================
// Onboarding Store
// ============================================

interface OnboardingState {
  // State
  providerId: string | null;
  onboardingStatus: OnboardingStatus | null;
  currentStepIndex: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;

  // Actions
  fetchOnboardingStatus: (providerId: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  completeStep: (stepId: string) => void;
  setCurrentStep: (stepIndex: number) => void;
  resetOnboarding: () => void;
  clearError: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  // Initial state
  providerId: null,
  onboardingStatus: null,
  currentStepIndex: 0,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  // Fetch onboarding status from API
  fetchOnboardingStatus: async (providerId: string) => {
    set({ isLoading: true, error: null, providerId });
    try {
      const response = await providerOpsApiService.getOnboardingStatus(providerId);
      if (response.success && response.data) {
        const status = response.data;

        // Calculate current step based on stage
        let currentStepIndex = 0;
        const stageOrder: OnboardingStage[] = [
          'registration',
          'document_upload',
          'under_review',
          'approved',
        ];
        const currentStageIndex = stageOrder.indexOf(status.currentStage);
        currentStepIndex = Math.max(0, currentStageIndex);

        set({
          onboardingStatus: status,
          currentStepIndex,
          isLoading: false,
          lastFetchedAt: new Date(),
        });
      }
    } catch (error: any) {
      console.error('Error fetching onboarding status:', error);
      set({
        error: error?.response?.data?.message || 'Failed to fetch onboarding status',
        isLoading: false,
      });
    }
  },

  // Refresh status
  refreshStatus: async () => {
    const { providerId } = get();
    if (providerId) {
      await get().fetchOnboardingStatus(providerId);
    }
  },

  // Mark a step as completed locally
  completeStep: (stepId: string) => {
    const { onboardingStatus } = get();
    if (!onboardingStatus) return;

    // Update pending/completed stages
    const updatedPending = onboardingStatus.pendingStages.filter((s) => s !== stepId);
    const updatedCompleted = [...onboardingStatus.completedStages, stepId];

    set({
      onboardingStatus: {
        ...onboardingStatus,
        pendingStages: updatedPending,
        completedStages: updatedCompleted,
      },
    });
  },

  // Set current step
  setCurrentStep: (stepIndex: number) => {
    set({ currentStepIndex: stepIndex });
  },

  // Reset onboarding
  resetOnboarding: () => {
    set({
      providerId: null,
      onboardingStatus: null,
      currentStepIndex: 0,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

// ============================================
// Onboarding Helper Functions
// ============================================

/**
 * Get the onboarding progress percentage
 */
export const calculateOnboardingProgress = (
  completedStages: string[],
  totalStages: string[]
): number => {
  if (totalStages.length === 0) return 0;
  return Math.round((completedStages.length / totalStages.length) * 100);
};

/**
 * Get the next required step that needs to be completed
 */
export const getNextRequiredStep = (
  onboardingStatus: OnboardingStatus | null,
  steps: Omit<OnboardingStep, 'status'>[]
): Omit<OnboardingStep, 'status'> | null => {
  if (!onboardingStatus) return steps.find((s) => s.required) || null;

  const pendingRequired = steps.filter(
    (s) =>
      s.required &&
      !onboardingStatus.completedStages.includes(s.id) &&
      s.category === 'document'
  );

  return pendingRequired[0] || null;
};

/**
 * Check if onboarding is complete
 */
export const isOnboardingComplete = (
  onboardingStatus: OnboardingStatus | null
): boolean => {
  if (!onboardingStatus) return false;
  return (
    onboardingStatus.currentStage === 'approved' ||
    onboardingStatus.currentStage === 'rejected' ||
    onboardingStatus.currentStage === 'suspended'
  );
};

/**
 * Format time estimate for completion
 */
export const formatCompletionTime = (minutes?: number): string => {
  if (!minutes) return 'Varies';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
};

export default useOnboardingStore;
