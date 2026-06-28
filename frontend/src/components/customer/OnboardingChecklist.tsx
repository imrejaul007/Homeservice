import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  Gift,
  User,
  CreditCard,
  Search,
  Bell,
  FileText,
  Calendar,
  Settings,
  BookOpen,
  Shield,
  Zap,
  Home,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface ChecklistTask {
  taskId: string;
  title: string;
  description: string;
  category: 'profile' | 'document' | 'training' | 'booking' | 'payment';
  priority: 'required' | 'optional';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  order: number;
}

interface OnboardingChecklist {
  _id: string;
  userId: string;
  role: 'customer' | 'provider';
  tasks: ChecklistTask[];
  progressPercentage: number;
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  completedAt?: string;
}

interface OnboardingChecklistProps {
  embedded?: boolean;
  onComplete?: () => void;
  onTaskComplete?: (taskId: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  profile: User,
  document: FileText,
  training: BookOpen,
  booking: Calendar,
  payment: CreditCard,
  default: CheckCircle2,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  profile: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  document: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  training: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  booking: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  payment: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
};

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  embedded = false,
  onComplete,
  onTaskComplete,
}) => {
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/customer/onboarding/checklist');

      if (response.data?.success) {
        setChecklist(response.data.data);
      } else {
        setError('Failed to load your onboarding checklist');
      }
    } catch (err) {
      console.error('Error fetching checklist:', err);
      setError('Failed to load your onboarding checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchChecklist();
    setIsRefreshing(false);
  };

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTask(taskId);
    try {
      const response = await api.post(`/customer/onboarding/checklist/${taskId}/complete`);

      if (response.data?.success) {
        // Update local state
        setChecklist(prev => {
          if (!prev) return prev;

          const updatedTasks = prev.tasks.map(task =>
            task.taskId === taskId
              ? { ...task, status: 'completed' as const, completedAt: new Date().toISOString() }
              : task
          );

          const completedCount = updatedTasks.filter(t => t.status === 'completed').length;
          const progressPercentage = Math.round((completedCount / prev.totalSteps) * 100);
          const isCompleted = progressPercentage === 100;

          if (isCompleted && !prev.completedAt) {
            onComplete?.();
          }

          return {
            ...prev,
            tasks: updatedTasks,
            progressPercentage,
            currentStep: Math.min(completedCount + 1, prev.totalSteps),
            completedAt: isCompleted ? new Date().toISOString() : undefined,
          };
        });

        onTaskComplete?.(taskId);
      }
    } catch (err) {
      console.error('Error completing task:', err);
    } finally {
      setCompletingTask(null);
    }
  };

  const handleSkipTask = async (taskId: string) => {
    try {
      await api.post(`/customer/onboarding/checklist/${taskId}/skip`);

      setChecklist(prev => {
        if (!prev) return prev;

        const updatedTasks = prev.tasks.map(task =>
          task.taskId === taskId
            ? { ...task, status: 'skipped' as const }
            : task
        );

        const completedCount = updatedTasks.filter(
          t => t.status === 'completed' || t.status === 'skipped'
        ).length;
        const progressPercentage = Math.round((completedCount / prev.totalSteps) * 100);

        return {
          ...prev,
          tasks: updatedTasks,
          progressPercentage,
          currentStep: Math.min(completedCount + 1, prev.totalSteps),
        };
      });
    } catch (err) {
      console.error('Error skipping task:', err);
    }
  };

  const getTaskIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
    return Icon;
  };

  const groupedTasks = checklist?.tasks.reduce((acc, task) => {
    const category = task.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(task);
    return acc;
  }, {} as Record<string, ChecklistTask[]>);

  const completedCount = checklist?.tasks.filter(t => t.status === 'completed').length || 0;
  const pendingCount = checklist?.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length || 0;
  const requiredRemaining = checklist?.tasks.filter(
    t => t.priority === 'required' && t.status !== 'completed'
  ).length || 0;

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-2xl mx-auto p-6')}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/2"></div>
          <div className="h-4 bg-nilin-blush/30 rounded w-full"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-nilin-blush/30 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-2xl mx-auto')}>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Checklist</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!checklist) return null;

  const isCompleted = checklist.progressPercentage === 100;

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-2xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nilin-rose/20 to-nilin-coral/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-nilin-coral" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-nilin-charcoal">Get Started</h2>
            <p className="text-sm text-nilin-warmGray">
              {isCompleted
                ? 'All tasks completed!'
                : `${completedCount} of ${checklist.totalSteps} tasks completed`}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
        >
          <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-nilin-charcoal">Progress</span>
          <span className="text-sm font-bold text-nilin-coral">{checklist.progressPercentage}%</span>
        </div>
        <div className="h-3 bg-nilin-blush/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-nilin-rose to-nilin-coral rounded-full transition-all duration-500"
            style={{ width: `${checklist.progressPercentage}%` }}
          />
        </div>
        {requiredRemaining > 0 && (
          <p className="text-xs text-nilin-warmGray mt-2">
            {requiredRemaining} required task{requiredRemaining > 1 ? 's' : ''} remaining
          </p>
        )}
      </div>

      {/* Completion Banner */}
      {isCompleted && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Gift className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-800">Onboarding Complete!</p>
              <p className="text-sm text-green-600">
                You've earned 50 bonus points. Start booking services now!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tasks by Category */}
      <div className="space-y-6">
        {Object.entries(groupedTasks || {}).map(([category, tasks]) => {
          const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.profile;
          const Icon = getTaskIcon(category);
          const completedInCategory = tasks.filter(t => t.status === 'completed').length;
          const totalInCategory = tasks.length;

          return (
            <div key={category}>
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colors.bg)}>
                  <Icon className={cn('w-4 h-4', colors.text)} />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal capitalize">{category}</span>
                <span className="text-xs text-nilin-warmGray">
                  {completedInCategory}/{totalInCategory}
                </span>
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                {tasks
                  .sort((a, b) => {
                    // Prioritize required and in-progress tasks
                    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                    if (a.priority === 'required' && b.priority === 'optional') return -1;
                    if (b.priority === 'required' && a.priority === 'optional') return 1;
                    return a.order - b.order;
                  })
                  .map(task => {
                    const isCompleted = task.status === 'completed';
                    const isSkipped = task.status === 'skipped';
                    const isPending = task.status === 'pending' || task.status === 'in_progress';
                    const isExpanded = expandedTask === task.taskId;
                    const isCompleting = completingTask === task.taskId;
                    const colors = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.profile;

                    return (
                      <div
                        key={task.taskId}
                        className={cn(
                          'rounded-xl border transition-all',
                          isCompleted
                            ? 'bg-green-50/50 border-green-200'
                            : isSkipped
                            ? 'bg-gray-50/50 border-gray-200 opacity-60'
                            : isPending
                            ? 'bg-white border-nilin-border hover:border-nilin-coral/50'
                            : 'bg-white border-nilin-border'
                        )}
                      >
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer"
                          onClick={() => setExpandedTask(isExpanded ? null : task.taskId)}
                        >
                          {/* Status Icon */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (isPending) handleCompleteTask(task.taskId);
                            }}
                            disabled={completingTask !== null}
                            className={cn(
                              'flex-shrink-0 transition-all',
                              isCompleted && 'text-green-500',
                              isSkipped && 'text-gray-400',
                              isPending && !completingTask && 'hover:scale-110 cursor-pointer'
                            )}
                          >
                            {isCompleting ? (
                              <Loader2 className="w-5 h-5 animate-spin text-nilin-coral" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isSkipped ? (
                              <Circle className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5 text-nilin-warmGray" />
                            )}
                          </button>

                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'font-medium text-sm',
                                  isCompleted
                                    ? 'text-green-700'
                                    : isSkipped
                                    ? 'text-gray-500 line-through'
                                    : 'text-nilin-charcoal'
                                )}
                              >
                                {task.title}
                              </span>
                              {task.priority === 'required' && !isCompleted && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 rounded">
                                  Required
                                </span>
                              )}
                              {task.status === 'in_progress' && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600 rounded flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  In Progress
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          </div>

                          {/* Expand/Action */}
                          <div className="flex items-center gap-2">
                            {!isCompleted && !isSkipped && isPending && (
                              <>
                                {task.priority === 'optional' && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleSkipTask(task.taskId);
                                    }}
                                    className="text-xs text-nilin-warmGray hover:text-nilin-coral transition-colors"
                                  >
                                    Skip
                                  </button>
                                )}
                                <ChevronRight
                                  className={cn(
                                    'w-4 h-4 text-nilin-warmGray transition-transform',
                                    isExpanded && 'rotate-90'
                                  )}
                                />
                              </>
                            )}
                            {isCompleted && task.completedAt && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Done
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && !isCompleted && !isSkipped && (
                          <div className="px-4 pb-4 pt-2 border-t border-nilin-border/50">
                            <p className="text-sm text-nilin-warmGray mb-4">{task.description}</p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleCompleteTask(task.taskId)}
                                disabled={completingTask !== null}
                                className={cn(
                                  'flex-1 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2',
                                  'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white',
                                  'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                                  completingTask && 'opacity-50 cursor-not-allowed'
                                )}
                              >
                                {completingTask === task.taskId ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Completing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Mark Complete
                                  </>
                                )}
                              </button>
                              {task.priority === 'optional' && (
                                <button
                                  onClick={() => handleSkipTask(task.taskId)}
                                  className="px-4 py-2.5 rounded-xl font-medium text-sm border border-nilin-border text-nilin-warmGray hover:bg-nilin-blush/30 transition-colors"
                                >
                                  Skip
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {!isCompleted && pendingCount > 0 && (
        <div className="mt-6 p-4 bg-nilin-blush/20 rounded-xl border border-nilin-blush/30">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-nilin-coral flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-nilin-charcoal">
                {pendingCount} task{pendingCount > 1 ? 's' : ''} remaining
              </p>
              <p className="text-xs text-nilin-warmGray">
                Complete your profile to unlock all features
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingChecklist;
