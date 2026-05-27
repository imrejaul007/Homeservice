import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, MapPin, Bell, Star } from 'lucide-react';
import { useRetentionStore } from '../../services/product/RetentionService';

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'location',
    icon: <MapPin size={24} />,
    title: 'Enable Location',
    description: 'Get personalized service recommendations based on your area',
    action: 'Enable Location',
  },
  {
    id: 'notifications',
    icon: <Bell size={24} />,
    title: 'Stay Updated',
    description: 'Get notified about booking updates and exclusive offers',
    action: 'Enable Notifications',
  },
  {
    id: 'preferences',
    icon: <Star size={24} />,
    title: 'Set Preferences',
    description: 'Tell us your favorite services for better recommendations',
    action: 'Continue',
  },
];

interface SmartOnboardingProps {
  onComplete: () => void;
}

export function SmartOnboarding({ onComplete }: SmartOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const { engagement } = useRetentionStore();

  // Check if user should see onboarding
  const shouldShowOnboarding = engagement.visitCount <= 3 && !engagement.lastBooking;

  const handleStepComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId]);
    }

    if (currentStep < onboardingSteps.length - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), 300);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!shouldShowOnboarding) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full bg-white rounded-t-3xl p-6 pb-8"
        >
          {/* Progress */}
          <div className="flex justify-center gap-2 mb-6">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`w-8 h-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-nilin-coral' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center mb-8"
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-2xl bg-nilin-blush flex items-center justify-center mx-auto mb-4 text-nilin-coral"
              >
                {onboardingSteps[currentStep].icon}
              </motion.div>

              {/* Title */}
              <h2 className="text-xl font-semibold text-nilin-charcoal mb-2">
                {onboardingSteps[currentStep].title}
              </h2>

              {/* Description */}
              <p className="text-nilin-warmGray">
                {onboardingSteps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <div className="space-y-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleStepComplete(onboardingSteps[currentStep].id)}
              className="w-full py-4 bg-nilin-coral text-white rounded-xl font-semibold"
            >
              {onboardingSteps[currentStep].action}
            </motion.button>

            <button
              onClick={handleSkip}
              className="w-full py-3 text-nilin-warmGray font-medium"
            >
              Skip for now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Progress indicator for app readiness
interface AppReadinessProps {
  isAuthenticated: boolean;
  hasLocation: boolean;
  hasNotifications: boolean;
  hasPaymentMethod: boolean;
}

export function AppReadinessChecklist({
  isAuthenticated,
  hasLocation,
  hasNotifications,
  hasPaymentMethod,
}: AppReadinessProps) {
  const items = [
    { label: 'Sign in to your account', done: isAuthenticated },
    { label: 'Enable location services', done: hasLocation },
    { label: 'Enable notifications', done: hasNotifications },
    { label: 'Add payment method', done: hasPaymentMethod },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-aaa-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-nilin-charcoal">Complete your profile</h3>
        <span className="text-sm text-nilin-warmGray">{completedCount}/{items.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-nilin-coral rounded-full"
        />
      </div>

      {/* Checklist */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                item.done ? 'bg-green-500' : 'bg-gray-200'
              }`}
            >
              {item.done && <CheckCircle size={12} className="text-white" />}
            </div>
            <span className={`text-sm ${item.done ? 'text-nilin-warmGray line-through' : 'text-nilin-charcoal'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SmartOnboarding;
