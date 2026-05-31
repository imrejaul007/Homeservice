/**
 * Onboarding Checklist Automation
 *
 * Tracks and guides new users through onboarding tasks:
 * - Profile completion checklist
 * - Document upload tasks
 * - Training completion
 * - First booking guidance
 * - Progress tracking
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IOnboardingChecklist extends Document {
  userId: mongoose.Types.ObjectId;
  role: 'customer' | 'provider';
  tasks: Array<{
    taskId: string;
    title: string;
    description: string;
    category: 'profile' | 'document' | 'training' | 'booking' | 'payment';
    priority: 'required' | 'optional';
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    completedAt?: Date;
    completedData?: Record<string, unknown>;
    order: number;
  }>;
  startedAt: Date;
  completedAt?: Date;
  progressPercentage: number;
  currentStep: number;
  totalSteps: number;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingChecklistSchema = new Schema<IOnboardingChecklist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['customer', 'provider'],
      required: true,
    },
    tasks: [{
      taskId: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
      category: {
        type: String,
        enum: ['profile', 'document', 'training', 'booking', 'payment'],
        required: true,
      },
      priority: {
        type: String,
        enum: ['required', 'optional'],
        default: 'optional',
      },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'skipped'],
        default: 'pending',
      },
      completedAt: Date,
      completedData: {
        type: Schema.Types.Mixed,
      },
      order: {
        type: Number,
        required: true,
      },
    }],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStep: {
      type: Number,
      default: 0,
    },
    totalSteps: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
onboardingChecklistSchema.index({ role: 1, progressPercentage: 1 });
onboardingChecklistSchema.index({ completedAt: 1 });
onboardingChecklistSchema.index({ 'tasks.status': 1 });

const OnboardingChecklist = mongoose.model<IOnboardingChecklist>('OnboardingChecklist', onboardingChecklistSchema);

// Task definitions
const CUSTOMER_TASKS = [
  {
    taskId: 'profile_photo',
    title: 'Add Profile Photo',
    description: 'Upload a clear photo of yourself to help providers recognize you',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 1,
  },
  {
    taskId: 'profile_phone',
    title: 'Verify Phone Number',
    description: 'Add and verify your phone number for booking notifications',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 2,
  },
  {
    taskId: 'profile_address',
    title: 'Add Your Address',
    description: 'Add your home address for at-home services',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 3,
  },
  {
    taskId: 'payment_setup',
    title: 'Set Up Payment Method',
    description: 'Add a credit card or payment method for seamless bookings',
    category: 'payment' as const,
    priority: 'required' as const,
    order: 4,
  },
  {
    taskId: 'first_search',
    title: 'Search for a Service',
    description: 'Explore available services and providers in your area',
    category: 'booking' as const,
    priority: 'optional' as const,
    order: 5,
  },
  {
    taskId: 'first_booking',
    title: 'Complete Your First Booking',
    description: 'Book your first home service and experience NILIN',
    category: 'booking' as const,
    priority: 'optional' as const,
    order: 6,
  },
  {
    taskId: 'enable_notifications',
    title: 'Enable Notifications',
    description: 'Turn on push notifications for booking updates and reminders',
    category: 'profile' as const,
    priority: 'optional' as const,
    order: 7,
  },
  {
    taskId: 'add_preferences',
    title: 'Set Service Preferences',
    description: 'Tell us your preferred service types and time slots',
    category: 'profile' as const,
    priority: 'optional' as const,
    order: 8,
  },
];

const PROVIDER_TASKS = [
  {
    taskId: 'profile_photo',
    title: 'Add Professional Photo',
    description: 'Upload a professional photo to build trust with customers',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 1,
  },
  {
    taskId: 'profile_bio',
    title: 'Complete Your Bio',
    description: 'Write a professional bio describing your experience and services',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 2,
  },
  {
    taskId: 'document_id',
    title: 'Upload ID Verification',
    description: 'Upload a government-issued ID for identity verification',
    category: 'document' as const,
    priority: 'required' as const,
    order: 3,
  },
  {
    taskId: 'document_license',
    title: 'Upload Business License',
    description: 'Upload your business license or professional certifications',
    category: 'document' as const,
    priority: 'required' as const,
    order: 4,
  },
  {
    taskId: 'service_setup',
    title: 'Set Up Your Services',
    description: 'Add the services you offer with pricing and descriptions',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 5,
  },
  {
    taskId: 'availability_setup',
    title: 'Set Your Availability',
    description: 'Define your working hours and days',
    category: 'profile' as const,
    priority: 'required' as const,
    order: 6,
  },
  {
    taskId: 'training_basics',
    title: 'Complete Basic Training',
    description: 'Learn about NILIN platform policies and best practices',
    category: 'training' as const,
    priority: 'required' as const,
    order: 7,
  },
  {
    taskId: 'training_safety',
    title: 'Complete Safety Training',
    description: 'Learn about safety protocols and customer service standards',
    category: 'training' as const,
    priority: 'required' as const,
    order: 8,
  },
  {
    taskId: 'payment_setup',
    title: 'Set Up Payout Method',
    description: 'Configure your bank account or wallet for receiving payments',
    category: 'payment' as const,
    priority: 'required' as const,
    order: 9,
  },
  {
    taskId: 'first_service',
    title: 'Complete Your First Service',
    description: 'Accept and complete your first booking to go live',
    category: 'booking' as const,
    priority: 'optional' as const,
    order: 10,
  },
];

/**
 * Create onboarding checklist for a new user
 */
export async function createOnboardingChecklist(userId: mongoose.Types.ObjectId): Promise<IOnboardingChecklist> {
  try {
    // Check if checklist already exists
    const existing = await OnboardingChecklist.findOne({ userId });
    if (existing) {
      logger.debug('createOnboardingChecklist: Checklist already exists', { userId: userId.toString() });
      return existing;
    }

    // Get user to determine role
    const user = await User.findById(userId).select('role');
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const tasks = user.role === 'provider' ? PROVIDER_TASKS : CUSTOMER_TASKS;

    const checklist = await OnboardingChecklist.create({
      userId,
      role: user.role,
      tasks,
      totalSteps: tasks.length,
      progressPercentage: 0,
    });

    logger.info('createOnboardingChecklist: Checklist created', {
      userId: userId.toString(),
      role: user.role,
      totalSteps: tasks.length,
    });

    // Send welcome notification
    await addJob('notification-queue', 'send_notification', {
      userId: userId.toString(),
      type: 'onboarding_started',
      title: 'Welcome to NILIN!',
      message: 'Let\'s get you set up. Complete your profile to start booking services.',
      data: {
        checklistId: checklist._id.toString(),
        totalSteps: tasks.length,
      },
    });

    return checklist;
  } catch (error) {
    logger.error('createOnboardingChecklist: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Mark a task as completed
 */
export async function completeTask(
  userId: mongoose.Types.ObjectId,
  taskId: string,
  completedData?: Record<string, unknown>
): Promise<{ checklist: IOnboardingChecklist; isCompleted: boolean }> {
  try {
    const checklist = await OnboardingChecklist.findOne({ userId });
    if (!checklist) {
      throw new Error(`Checklist not found for user: ${userId}`);
    }

    const taskIndex = checklist.tasks.findIndex(t => t.taskId === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check if already completed
    if (checklist.tasks[taskIndex].status === 'completed') {
      return { checklist, isCompleted: checklist.progressPercentage === 100 };
    }

    // Update task
    checklist.tasks[taskIndex].status = 'completed';
    checklist.tasks[taskIndex].completedAt = new Date();
    if (completedData) {
      checklist.tasks[taskIndex].completedData = completedData;
    }

    // Recalculate progress
    const completedCount = checklist.tasks.filter(t => t.status === 'completed').length;
    checklist.progressPercentage = Math.round((completedCount / checklist.totalSteps) * 100);
    checklist.currentStep = Math.min(completedCount + 1, checklist.totalSteps);

    // Check if fully completed
    if (checklist.progressPercentage === 100 && !checklist.completedAt) {
      checklist.completedAt = new Date();
    }

    await checklist.save();

    logger.info('completeTask: Task completed', {
      userId: userId.toString(),
      taskId,
      progressPercentage: checklist.progressPercentage,
    });

    // Send progress notification
    if (checklist.progressPercentage < 100) {
      const nextTask = checklist.tasks.find(t => t.status === 'pending');
      if (nextTask) {
        await addJob('notification-queue', 'send_notification', {
          userId: userId.toString(),
          type: 'onboarding_progress',
          title: 'Great Progress!',
          message: `${checklist.progressPercentage}% complete. Next: ${nextTask.title}`,
          data: {
            progressPercentage: checklist.progressPercentage,
            nextTaskId: nextTask.taskId,
          },
        });
      }
    } else {
      // Onboarding completed
      await addJob('notification-queue', 'send_notification', {
        userId: userId.toString(),
        type: 'onboarding_completed',
        title: 'Onboarding Complete!',
        message: 'Congratulations! You\'re all set to use NILIN.',
        data: {
          checklistId: checklist._id.toString(),
        },
      });

      // Award bonus points for completing onboarding
      await addJob('loyalty-queue', 'award_onboarding_bonus', {
        userId: userId.toString(),
        bonusPoints: 50,
        description: 'Onboarding completion bonus',
      });
    }

    return { checklist, isCompleted: checklist.progressPercentage === 100 };
  } catch (error) {
    logger.error('completeTask: Failed', {
      userId: userId.toString(),
      taskId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get user's onboarding checklist
 */
export async function getUserChecklist(userId: mongoose.Types.ObjectId): Promise<IOnboardingChecklist | null> {
  return OnboardingChecklist.findOne({ userId });
}

/**
 * Get next recommended task for user
 */
export async function getNextRecommendedTask(userId: mongoose.Types.ObjectId): Promise<IOnboardingChecklist['tasks'][0] | null> {
  const checklist = await OnboardingChecklist.findOne({ userId });
  if (!checklist) return null;

  // Find first pending task (prioritize required tasks)
  const pendingTasks = checklist.tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => {
      // Prioritize required tasks
      if (a.priority === 'required' && b.priority === 'optional') return -1;
      if (a.priority === 'optional' && b.priority === 'required') return 1;
      // Then sort by order
      return a.order - b.order;
    });

  return pendingTasks[0] || null;
}

/**
 * Check if user has completed all required tasks
 */
export async function hasCompletedRequiredTasks(userId: mongoose.Types.ObjectId): Promise<boolean> {
  const checklist = await OnboardingChecklist.findOne({ userId });
  if (!checklist) return false;

  const requiredTasks = checklist.tasks.filter(t => t.priority === 'required');
  return requiredTasks.every(t => t.status === 'completed');
}

/**
 * Get onboarding statistics for admin dashboard
 */
export async function getOnboardingStats(): Promise<{
  totalUsers: number;
  completedUsers: number;
  averageProgress: number;
  taskCompletionRates: Record<string, { completed: number; total: number; rate: number }>;
}> {
  const [stats, taskStats] = await Promise.all([
    OnboardingChecklist.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          completedUsers: {
            $sum: { $cond: [{ $ne: ['$completedAt', null] }, 1, 0] },
          },
          averageProgress: { $avg: '$progressPercentage' },
        },
      },
    ]),
    OnboardingChecklist.aggregate([
      { $unwind: '$tasks' },
      {
        $group: {
          _id: '$tasks.taskId',
          completed: {
            $sum: { $cond: [{ $eq: ['$tasks.status', 'completed'] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const taskCompletionRates: Record<string, { completed: number; total: number; rate: number }> = {};
  for (const stat of taskStats) {
    taskCompletionRates[stat._id] = {
      completed: stat.completed,
      total: stat.total,
      rate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
    };
  }

  return {
    totalUsers: stats[0]?.totalUsers || 0,
    completedUsers: stats[0]?.completedUsers || 0,
    averageProgress: Math.round(stats[0]?.averageProgress || 0),
    taskCompletionRates,
  };
}

/**
 * Send reminder for incomplete onboarding
 * Called by scheduled job daily
 */
export async function sendOnboardingReminders(): Promise<number> {
  try {
    // Find users with incomplete onboarding who haven't been reminded in 24 hours
    const reminderThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const incompleteChecklists = await OnboardingChecklist.find({
      completedAt: null,
      progressPercentage: { $lt: 100 },
      updatedAt: { $lt: reminderThreshold },
    }).limit(100);

    for (const checklist of incompleteChecklists) {
      const nextTask = checklist.tasks.find(t => t.status === 'pending');
      if (!nextTask) continue;

      // Check user communication preferences
      const user = await User.findById(checklist.userId).select('communicationPreferences');
      if (!user?.communicationPreferences?.email?.marketing) continue;

      await addJob('notification-queue', 'send_notification', {
        userId: checklist.userId.toString(),
        type: 'onboarding_reminder',
        title: 'Complete Your Profile',
        message: `You\'re ${checklist.progressPercentage}% done! ${nextTask.title} - just a few more steps.`,
        data: {
          checklistId: checklist._id.toString(),
          nextTaskId: nextTask.taskId,
          progressPercentage: checklist.progressPercentage,
        },
      });

      await checklist.updateOne({ updatedAt: new Date() });
    }

    logger.info('sendOnboardingReminders: Sent reminders', {
      count: incompleteChecklists.length,
    });

    return incompleteChecklists.length;
  } catch (error) {
    logger.error('sendOnboardingReminders: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Run the onboarding checklist processor
 * Wrapper function for scheduler integration
 */
export async function runOnboardingChecklist(): Promise<{
  checklistsProcessed: number;
  remindersSent: number;
}> {
  try {
    logger.info('Running onboarding checklist via scheduler');

    // Send reminders for incomplete onboarding
    const remindersSent = await sendOnboardingReminders();

    logger.info('Onboarding checklist completed via scheduler', { remindersSent });

    return {
      checklistsProcessed: remindersSent,
      remindersSent,
    };
  } catch (error) {
    logger.error('Onboarding checklist failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  createOnboardingChecklist,
  completeTask,
  getUserChecklist,
  getNextRecommendedTask,
  hasCompletedRequiredTasks,
  getOnboardingStats,
  sendOnboardingReminders,
  runOnboardingChecklist,
  OnboardingChecklist,
};
