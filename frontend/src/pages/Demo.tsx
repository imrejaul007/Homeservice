
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle,
  Clock,
  Users,
  Star,
  Calendar,
  DollarSign,
  TrendingUp,
  Zap,
  Shield,
  BarChart3,
  Loader2,
  AlertCircle,
  SkipForward,
  Pause,
  RotateCcw,
  Eye,
  Sparkles,
  Rocket,
  Building2,
  Newspaper,
  HeartHandshake,
} from 'lucide-react';
import { demoApi, type DemoAccount, type DemoScenario, type DemoStep } from '../services/demoApi';
import { useAuthStore } from '../stores/authStore';

// ============================================
// Types
// ============================================

interface DemoSession {
  id: string;
  scenarioId: string;
  scenarioName: string;
  startedAt: Date;
  currentStep: number;
  completedSteps: number[];
  account?: DemoAccount;
}

// ============================================
// Role Selection Card Component
// ============================================

const RoleCard: React.FC<{
  role: 'customer' | 'provider' | 'admin';
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  onSelect: () => void;
  isLoading: boolean;
}> = ({ role, title, description, icon, features, onSelect, isLoading }) => (
  <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02]">
    <div className={`absolute top-0 left-0 right-0 h-1 ${
      role === 'customer' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
      role === 'provider' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
      'bg-gradient-to-r from-purple-500 to-pink-500'
    }`} />

    <div className="p-6">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
        role === 'customer' ? 'bg-blue-100 dark:bg-blue-900/30' :
        role === 'provider' ? 'bg-amber-100 dark:bg-amber-900/30' :
        'bg-purple-100 dark:bg-purple-900/30'
      }`}>
        {icon}
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{description}</p>

      <ul className="space-y-2 mb-6">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={isLoading}
        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
          role === 'customer'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : role === 'provider'
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Start Demo
            <Play className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  </div>
);

// ============================================
// Scenario Card Component
// ============================================

const ScenarioCard: React.FC<{
  scenario: DemoScenario;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ scenario, isSelected, onSelect }) => {
  const audienceIcons = {
    investor: <TrendingUp className="w-4 h-4" />,
    enterprise: <Building2 className="w-4 h-4" />,
    press: <Newspaper className="w-4 h-4" />,
    partner: <HeartHandshake className="w-4 h-4" />,
  };

  const audienceColors = {
    investor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    enterprise: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    press: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    partner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{scenario.name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{scenario.description}</p>
        </div>
        {isSelected && <CheckCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${audienceColors[scenario.targetAudience]}`}>
          {audienceIcons[scenario.targetAudience]}
          {scenario.targetAudience}
        </span>
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          {scenario.estimatedDuration} min
        </span>
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Sparkles className="w-4 h-4" />
          {scenario.steps.length} steps
        </span>
      </div>
    </button>
  );
};

// ============================================
// Guided Tour Overlay Component
// ============================================

const GuidedTourOverlay: React.FC<{
  step: DemoStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onComplete: () => void;
  isLoading: boolean;
}> = ({ step, stepIndex, totalSteps, onNext, onPrevious, onSkip, onComplete, isLoading }) => (
  <div className="fixed inset-0 z-50 pointer-events-none">
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

    {/* Highlight Area */}
    {step.highlight && (
      <div
        className="absolute border-4 border-indigo-500 rounded-lg shadow-lg shadow-indigo-500/50 pointer-events-none animate-pulse"
        data-highlight={step.highlight}
      />
    )}

    {/* Tour Card */}
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg mx-auto px-4 pointer-events-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <span className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
              Guided Tour
            </span>
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-3">
              {stepIndex > 0 && (
                <button
                  onClick={onPrevious}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              <button
                onClick={stepIndex === totalSteps - 1 ? onComplete : onNext}
                disabled={isLoading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : stepIndex === totalSteps - 1 ? (
                  <>
                    Complete
                    <CheckCircle className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// Demo Mode Interface
// ============================================

const Demo: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  // State
  const [view, setView] = useState<'landing' | 'role-select' | 'scenario-select' | 'tour' | 'demo'>('landing');
  const [selectedRole, setSelectedRole] = useState<'customer' | 'provider' | 'admin' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(null);
  const [currentSession, setCurrentSession] = useState<DemoSession | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch scenarios on mount
  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const data = await demoApi.getScenarios();
      setScenarios(data);
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    }
  };

  // Generate demo account
  const generateDemoAccount = async (role: 'customer' | 'provider' | 'admin') => {
    setIsGenerating(true);
    setError(null);

    try {
      const account = await demoApi.generateAccount(role);
      setSelectedRole(role);
      setCurrentSession({
        id: `session_${Date.now()}`,
        scenarioId: '',
        scenarioName: '',
        startedAt: new Date(),
        currentStep: 0,
        completedSteps: [],
        account,
      });

      // Auto-login with demo account
      await login({ email: account.email, password: account.password });

      // Move to scenario selection
      setView('scenario-select');
    } catch (err) {
      setError(err.message || 'Failed to generate demo account. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Start scenario tour
  const startScenarioTour = async (scenario: DemoScenario) => {
    if (!currentSession) return;

    setSelectedScenario(scenario);
    setCurrentStepIndex(0);
    setCurrentSession({
      ...currentSession,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      currentStep: 0,
    });

    setView('tour');
  };

  // Handle tour navigation
  const handleNextStep = async () => {
    if (!currentSession || !selectedScenario) return;

    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= selectedScenario.steps.length) {
      // Tour complete
      handleCompleteTour();
      return;
    }

    setIsProcessing(true);
    try {
      await demoApi.completeStep(currentSession.id, currentStepIndex);
      setCurrentSession({
        ...currentSession,
        completedSteps: [...currentSession.completedSteps, currentStepIndex],
        currentStep: nextIndex,
      });
      setCurrentStepIndex(nextIndex);
    } catch (err) {
      console.error('Failed to complete step:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleCompleteTour = async () => {
    if (!currentSession) return;

    try {
      const result = await demoApi.endSession(currentSession.id);
      console.log('Tour completed:', result);
    } catch (err) {
      console.error('Failed to end session:', err);
    }

    setView('demo');
  };

  const handleSkipTour = () => {
    setView('demo');
  };

  // Navigate to dashboard
  const goToDashboard = () => {
    if (selectedRole === 'admin') {
      navigate('/admin/dashboard');
    } else if (selectedRole === 'provider') {
      navigate('/provider/dashboard');
    } else {
      navigate('/customer/dashboard');
    }
  };

  // ============================================
  // Render Landing View
  // ============================================

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Investor Demo Experience
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Experience NILIN
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
              Explore our full-featured beauty services marketplace with a guided demo.
              See how we're transforming the home service industry.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => setView('role-select')}
                className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg"
              >
                <Rocket className="w-5 h-5" />
                Start Interactive Demo
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-8 py-4 border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
              >
                View Live Site
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: <Users className="w-5 h-5" />, label: 'Active Users', value: '10,000+' },
              { icon: <Star className="w-5 h-5" />, label: 'App Rating', value: '4.9' },
              { icon: <Calendar className="w-5 h-5" />, label: 'Bookings/Month', value: '50,000+' },
              { icon: <DollarSign className="w-5 h-5" />, label: 'Revenue Processed', value: '$2M+' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-white/60 mb-2 flex justify-center">{stat.icon}</div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render Role Selection View
  // ============================================

  if (view === 'role-select') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Choose Your Demo Experience
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Select a role to explore the platform from that perspective
            </p>
          </div>

          {error && (
            <div className="max-w-5xl mx-auto mb-6">
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            <RoleCard
              role="customer"
              title="Customer"
              description="Experience the booking flow from a customer's perspective"
              icon={<Users className="w-7 h-7 text-blue-600" />}
              features={[
                'Browse and search services',
                'Book appointments',
                'Track bookings in real-time',
                'Leave reviews and ratings',
              ]}
              onSelect={() => generateDemoAccount('customer')}
              isLoading={isGenerating && selectedRole === 'customer'}
            />

            <RoleCard
              role="provider"
              title="Provider"
              description="Manage your beauty business as a service provider"
              icon={<Zap className="w-7 h-7 text-amber-600" />}
              features={[
                'Dashboard with analytics',
                'Manage bookings',
                'Set availability',
                'Track earnings',
              ]}
              onSelect={() => generateDemoAccount('provider')}
              isLoading={isGenerating && selectedRole === 'provider'}
            />

            <RoleCard
              role="admin"
              title="Admin"
              description="Oversee platform operations and management"
              icon={<Shield className="w-7 h-7 text-purple-600" />}
              features={[
                'Platform analytics',
                'Provider verification',
                'Anomaly detection',
                'Launch dashboard',
              ]}
              onSelect={() => generateDemoAccount('admin')}
              isLoading={isGenerating && selectedRole === 'admin'}
            />
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => setView('landing')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2 mx-auto"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render Scenario Selection View
  // ============================================

  if (view === 'scenario-select') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm mb-4">
              <CheckCircle className="w-4 h-4" />
              Demo account created
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Choose a Demo Scenario
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Select a guided tour to explore specific features
            </p>
          </div>

          <div className="space-y-4">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={selectedScenario?.id === scenario.id}
                onSelect={() => setSelectedScenario(scenario)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setView('role-select')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Change role
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSkipTour}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Skip to Dashboard
              </button>
              <button
                onClick={() => selectedScenario && startScenarioTour(selectedScenario)}
                disabled={!selectedScenario}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Guided Tour
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render Guided Tour View
  // ============================================

  if (view === 'tour' && selectedScenario && currentSession) {
    const currentStep = selectedScenario.steps[currentStepIndex];

    return (
      <>
        {/* Navigation Header */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-gray-900 dark:text-white">{selectedScenario.name}</span>
            </div>
            <button
              onClick={handleSkipTour}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content Area - Navigate to the action */}
        <div className="pt-16">
          {/* Action Hint */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 p-4">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <Eye className="w-5 h-5 text-indigo-600" />
              <p className="text-indigo-700 dark:text-indigo-300">
                {currentStep.action ? (
                  <>
                    Action: <code className="bg-indigo-100 dark:bg-indigo-800 px-2 py-0.5 rounded">{currentStep.action}</code>
                  </>
                ) : (
                  'Explore the interface and click Next when ready'
                )}
              </p>
            </div>
          </div>

          {/* Demo Content Area - Shows relevant page */}
          <div className="p-4">
            <div className="max-w-7xl mx-auto">
              {/* Mock dashboard preview based on role */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 min-h-[600px]">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {selectedRole === 'admin' ? 'Admin Dashboard' : selectedRole === 'provider' ? 'Provider Dashboard' : 'Customer Dashboard'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Explore the dashboard and follow the guided tour prompts
                  </p>
                  <button
                    onClick={goToDashboard}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium"
                  >
                    Open Full Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Guided Tour Overlay */}
        <GuidedTourOverlay
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={selectedScenario.steps.length}
          onNext={handleNextStep}
          onPrevious={handlePreviousStep}
          onSkip={handleSkipTour}
          onComplete={handleCompleteTour}
          isLoading={isProcessing}
        />
      </>
    );
  }

  // ============================================
  // Render Demo View (after tour)
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Demo Ready!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Your demo account is set up and ready to explore.
          Click below to start using the platform.
        </p>
        <button
          onClick={goToDashboard}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium flex items-center justify-center gap-2"
        >
          Go to Dashboard
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setView('scenario-select')}
          className="w-full mt-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Take Another Tour
        </button>
      </div>
    </div>
  );
};

export default Demo;
