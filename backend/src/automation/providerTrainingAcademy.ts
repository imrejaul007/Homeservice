/**
 * Provider Training Academy Automation
 *
 * Manages provider training programs:
 * - Training modules
 * - Progress tracking
 * - Completion certificates
 * - Mandatory vs optional modules
 * - Quiz/assessment system
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface ITrainingModule extends Document {
  moduleId: string;
  title: string;
  description: string;
  content: string; // Markdown or HTML content
  category: 'orientation' | 'safety' | 'customer_service' | 'technical' | 'compliance' | 'marketing';
  type: 'video' | 'article' | 'quiz' | 'interactive';
  duration: number; // Estimated minutes
  order: number;
  isMandatory: boolean;
  passingScore?: number; // For quizzes
  prerequisites?: string[]; // Module IDs that must be completed first
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrainingProgress extends Document {
  userId: mongoose.Types.ObjectId;
  moduleId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  attempts: number; // Number of quiz attempts
  bestScore?: number; // Best quiz score
  quizAnswers?: Record<string, unknown>; // Stored quiz answers
  certificateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrainingCertificate extends Document {
  certificateId: string;
  userId: mongoose.Types.ObjectId;
  moduleId: string;
  moduleTitle: string;
  issuedAt: Date;
  expiresAt?: Date;
  status: 'valid' | 'expired' | 'revoked';
  verificationCode: string;
  createdAt: Date;
}

// Module Schema
const trainingModuleSchema = new Schema<ITrainingModule>(
  {
    moduleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['orientation', 'safety', 'customer_service', 'technical', 'compliance', 'marketing'],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['video', 'article', 'quiz', 'interactive'],
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    order: {
      type: Number,
      required: true,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    prerequisites: [{
      type: String,
    }],
  },
  { timestamps: true }
);

// Progress Schema
const trainingProgressSchema = new Schema<ITrainingProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    moduleId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'failed'],
      default: 'not_started',
    },
    startedAt: Date,
    completedAt: Date,
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    bestScore: {
      type: Number,
    },
    quizAnswers: {
      type: Schema.Types.Mixed,
    },
    certificateId: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
trainingProgressSchema.index({ userId: 1, moduleId: 1 }, { unique: true });
trainingProgressSchema.index({ userId: 1, status: 1 });
trainingProgressSchema.index({ moduleId: 1, status: 1 });

// Certificate Schema
const trainingCertificateSchema = new Schema<ITrainingCertificate>(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    moduleId: {
      type: String,
      required: true,
    },
    moduleTitle: {
      type: String,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date,
    status: {
      type: String,
      enum: ['valid', 'expired', 'revoked'],
      default: 'valid',
    },
    verificationCode: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

// Models
const TrainingModule = mongoose.model<ITrainingModule>('TrainingModule', trainingModuleSchema);
const TrainingProgress = mongoose.model<ITrainingProgress>('TrainingProgress', trainingProgressSchema);
const TrainingCertificate = mongoose.model<ITrainingCertificate>('TrainingCertificate', trainingCertificateSchema);

// Default training modules
const DEFAULT_MODULES = [
  {
    moduleId: 'orientation_platform',
    title: 'NILIN Platform Orientation',
    description: 'Learn how to use the NILIN platform effectively',
    content: '# Welcome to NILIN\n\nThis module covers...',
    category: 'orientation' as const,
    type: 'article' as const,
    duration: 15,
    order: 1,
    isMandatory: true,
  },
  {
    moduleId: 'orientation_policies',
    title: 'Platform Policies and Guidelines',
    description: 'Understand NILIN\'s rules and regulations',
    content: '# Platform Policies\n\nPlease read carefully...',
    category: 'orientation' as const,
    type: 'article' as const,
    duration: 20,
    order: 2,
    isMandatory: true,
    prerequisites: ['orientation_platform'],
  },
  {
    moduleId: 'safety_protocols',
    title: 'Safety Protocols',
    description: 'Essential safety guidelines for home services',
    content: '# Safety First\n\nWhen working in homes...',
    category: 'safety' as const,
    type: 'video' as const,
    duration: 25,
    order: 3,
    isMandatory: true,
  },
  {
    moduleId: 'safety_assessment',
    title: 'Safety Knowledge Assessment',
    description: 'Test your understanding of safety protocols',
    content: JSON.stringify({
      questions: [
        { id: 'q1', text: 'What should you do if you feel unsafe?', options: ['Leave immediately', 'Call support', 'Both A and B'], correctAnswer: 2 },
      ],
    }),
    category: 'safety' as const,
    type: 'quiz' as const,
    duration: 10,
    order: 4,
    isMandatory: true,
    passingScore: 80,
    prerequisites: ['safety_protocols'],
  },
  {
    moduleId: 'customer_service_excellence',
    title: 'Customer Service Excellence',
    description: 'Delivering exceptional customer experiences',
    content: '# Customer Service\n\nCreating memorable experiences...',
    category: 'customer_service' as const,
    type: 'video' as const,
    duration: 30,
    order: 5,
    isMandatory: true,
  },
  {
    moduleId: 'service_standards',
    title: 'Service Quality Standards',
    description: 'Understanding and meeting NILIN\'s quality standards',
    content: '# Quality Standards\n\nOur commitment to excellence...',
    category: 'customer_service' as const,
    type: 'article' as const,
    duration: 20,
    order: 6,
    isMandatory: true,
  },
  {
    moduleId: 'pricing_guidelines',
    title: 'Pricing and Billing Guidelines',
    description: 'How to set prices and handle billing',
    content: '# Pricing\n\nSetting competitive prices...',
    category: 'marketing' as const,
    type: 'article' as const,
    duration: 15,
    order: 7,
    isMandatory: false,
  },
  {
    moduleId: 'compliance_data_protection',
    title: 'Data Protection Compliance',
    description: 'GDPR and data protection requirements',
    content: '# Data Protection\n\nProtecting customer data...',
    category: 'compliance' as const,
    type: 'article' as const,
    duration: 20,
    order: 8,
    isMandatory: true,
  },
];

/**
 * Initialize default training modules
 */
export async function initializeTrainingModules(): Promise<number> {
  try {
    let created = 0;

    for (const moduleData of DEFAULT_MODULES) {
      const existing = await TrainingModule.findOne({ moduleId: moduleData.moduleId });
      if (!existing) {
        await TrainingModule.create(moduleData);
        created++;
      }
    }

    logger.info('initializeTrainingModules: Created modules', { count: created });
    return created;
  } catch (error) {
    logger.error('initializeTrainingModules: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get all training modules
 */
export async function getTrainingModules(): Promise<ITrainingModule[]> {
  return TrainingModule.find().sort({ order: 1 });
}

/**
 * Get module by ID
 */
export async function getModuleById(moduleId: string): Promise<ITrainingModule | null> {
  return TrainingModule.findOne({ moduleId });
}

/**
 * Get user's training progress for all modules
 */
export async function getUserTrainingProgress(userId: mongoose.Types.ObjectId): Promise<{
  modules: ITrainingModule[];
  progress: Map<string, ITrainingProgress>;
  completedCount: number;
  totalMandatory: number;
  completionPercentage: number;
}> {
  const modules = await TrainingModule.find().sort({ order: 1 });
  const progressRecords = await TrainingProgress.find({ userId });

  const progressMap = new Map<string, ITrainingProgress>();
  for (const p of progressRecords) {
    progressMap.set(p.moduleId, p);
  }

  const completedCount = progressRecords.filter(p => p.status === 'completed').length;
  const totalMandatory = modules.filter(m => m.isMandatory).length;
  const completionPercentage = totalMandatory > 0
    ? Math.round((progressRecords.filter(p => p.status === 'completed' && modules.find(m => m.moduleId === p.moduleId)?.isMandatory).length / totalMandatory) * 100)
    : 0;

  return {
    modules,
    progress: progressMap,
    completedCount,
    totalMandatory,
    completionPercentage,
  };
}

/**
 * Start a training module
 */
export async function startModule(
  userId: mongoose.Types.ObjectId,
  moduleId: string
): Promise<ITrainingProgress> {
  try {
    const module = await TrainingModule.findOne({ moduleId });
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    // Check prerequisites
    if (module.prerequisites && module.prerequisites.length > 0) {
      const completedProgress = await TrainingProgress.find({
        userId,
        moduleId: { $in: module.prerequisites },
        status: 'completed',
      });

      const missingPrereqs = module.prerequisites.filter(
        prereq => !completedProgress.find(p => p.moduleId === prereq)
      );

      if (missingPrereqs.length > 0) {
        throw new Error(`Missing prerequisites: ${missingPrereqs.join(', ')}`);
      }
    }

    // Find or create progress record
    let progress = await TrainingProgress.findOne({ userId, moduleId });

    if (!progress) {
      progress = await TrainingProgress.create({
        userId,
        moduleId,
        status: 'in_progress',
        startedAt: new Date(),
        progress: 0,
        attempts: 0,
      });

      logger.info('startModule: Module started', {
        userId: userId.toString(),
        moduleId,
      });
    } else if (progress.status === 'not_started') {
      progress.status = 'in_progress';
      progress.startedAt = new Date();
      await progress.save();
    }

    return progress;
  } catch (error) {
    logger.error('startModule: Failed', {
      userId: userId.toString(),
      moduleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Update module progress
 */
export async function updateModuleProgress(
  userId: mongoose.Types.ObjectId,
  moduleId: string,
  progressValue: number,
  quizAnswers?: Record<string, unknown>
): Promise<ITrainingProgress> {
  try {
    let progress = await TrainingProgress.findOne({ userId, moduleId });

    if (!progress) {
      await startModule(userId, moduleId);
      progress = await TrainingProgress.findOne({ userId, moduleId });
    }

    if (!progress) {
      throw new Error(`Failed to start module: ${moduleId}`);
    }

    progress.progress = Math.min(100, Math.max(0, progressValue));

    if (quizAnswers) {
      progress.quizAnswers = quizAnswers;
      progress.attempts += 1;
    }

    await progress.save();
    return progress;
  } catch (error) {
    logger.error('updateModuleProgress: Failed', {
      userId: userId.toString(),
      moduleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Complete a training module
 */
export async function completeModule(
  userId: mongoose.Types.ObjectId,
  moduleId: string,
  score?: number
): Promise<{ progress: ITrainingProgress; certificate?: ITrainingCertificate }> {
  try {
    const module = await TrainingModule.findOne({ moduleId });
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    // Check if quiz module and validate passing score
    if (module.type === 'quiz' && module.passingScore !== undefined && score !== undefined) {
      if (score < module.passingScore) {
        const progress = await TrainingProgress.findOneAndUpdate(
          { userId, moduleId },
          {
            status: 'failed',
            bestScore: Math.max(score, 0),
            progress: score,
          },
          { new: true }
        );

        logger.info('completeModule: Quiz failed', {
          userId: userId.toString(),
          moduleId,
          score,
          passingScore: module.passingScore,
        });

        return { progress: progress!, certificate: undefined };
      }
    }

    // Complete the module
    const progress = await TrainingProgress.findOneAndUpdate(
      { userId, moduleId },
      {
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
        bestScore: score,
      },
      { new: true }
    );

    let certificate: ITrainingCertificate | undefined;

    // Generate certificate for mandatory modules
    if (module.isMandatory) {
      certificate = await generateCertificate(userId, module);
    }

    logger.info('completeModule: Module completed', {
      userId: userId.toString(),
      moduleId,
      hasCertificate: !!certificate,
    });

    // Check if all mandatory modules are completed
    await checkMandatoryModulesCompletion(userId);

    return { progress: progress!, certificate };
  } catch (error) {
    logger.error('completeModule: Failed', {
      userId: userId.toString(),
      moduleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate a training certificate
 */
export async function generateCertificate(
  userId: mongoose.Types.ObjectId,
  module: ITrainingModule
): Promise<ITrainingCertificate> {
  const certificateId = `CERT-${module.moduleId}-${Date.now().toString(36).toUpperCase()}`;
  const verificationCode = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

  const certificate = await TrainingCertificate.create({
    certificateId,
    userId,
    moduleId: module.moduleId,
    moduleTitle: module.title,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
    status: 'valid',
    verificationCode,
  });

  // Update progress record with certificate ID
  await TrainingProgress.findOneAndUpdate(
    { userId, moduleId: module.moduleId },
    { certificateId: certificate.certificateId }
  );

  // Send certificate notification
  await addJob('notification-queue', 'send_notification', {
    userId: userId.toString(),
    type: 'certificate_earned',
    title: 'Certificate Earned!',
    message: `Congratulations! You earned a certificate for "${module.title}"`,
    data: {
      certificateId: certificate.certificateId,
      moduleId: module.moduleId,
    },
  });

  return certificate;
}

/**
 * Check if all mandatory modules are completed
 */
async function checkMandatoryModulesCompletion(userId: mongoose.Types.ObjectId): Promise<void> {
  const mandatoryModules = await TrainingModule.find({ isMandatory: true });
  const completedProgress = await TrainingProgress.find({
    userId,
    moduleId: { $in: mandatoryModules.map(m => m.moduleId) },
    status: 'completed',
  });

  if (completedProgress.length === mandatoryModules.length) {
    // All mandatory modules completed
    await addJob('notification-queue', 'send_notification', {
      userId: userId.toString(),
      type: 'training_completed',
      title: 'Training Academy Complete!',
      message: 'You\'ve completed all mandatory training modules. You\'re ready to accept bookings!',
    });

    // Award bonus
    await addJob('loyalty-queue', 'award_training_bonus', {
      userId: userId.toString(),
      bonusPoints: 100,
      description: 'Training Academy completion bonus',
    });

    logger.info('checkMandatoryModulesCompletion: All mandatory modules completed', {
      userId: userId.toString(),
    });
  }
}

/**
 * Verify a certificate
 */
export async function verifyCertificate(verificationCode: string): Promise<{
  valid: boolean;
  certificate?: ITrainingCertificate;
  user?: { firstName: string; lastName: string };
}> {
  const certificate = await TrainingCertificate.findOne({ verificationCode })
    .populate('userId', 'firstName lastName');

  if (!certificate) {
    return { valid: false };
  }

  const isValid = certificate.status === 'valid' &&
    (!certificate.expiresAt || certificate.expiresAt > new Date());

  const user = certificate.userId as unknown as { firstName: string; lastName: string };

  return {
    valid: isValid,
    certificate: isValid ? certificate : undefined,
    user: isValid ? user : undefined,
  };
}

/**
 * Get training statistics for admin dashboard
 */
export async function getTrainingStats(): Promise<{
  totalProviders: number;
  completedCount: number;
  averageProgress: number;
  moduleCompletionRates: Record<string, { completed: number; total: number; rate: number }>;
  overdueModules: Array<{ userId: string; moduleId: string; daysSinceStart: number }>;
}> {
  const [progressStats, moduleStats, providers] = await Promise.all([
    TrainingProgress.aggregate([
      {
        $group: {
          _id: { userId: '$userId' },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          avgProgress: { $avg: '$progress' },
        },
      },
    ]),
    TrainingProgress.aggregate([
      {
        $group: {
          _id: '$moduleId',
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
          },
        },
      },
    ]),
    User.countDocuments({ role: 'provider', isActive: true }),
  ]);

  const mandatoryModules = await TrainingModule.find({ isMandatory: true });
  const completedProviders = progressStats.filter(p =>
    p.completedCount >= mandatoryModules.length
  ).length;

  const moduleCompletionRates: Record<string, { completed: number; total: number; rate: number }> = {};
  for (const stat of moduleStats) {
    const total = stat.completed + stat.inProgress;
    moduleCompletionRates[stat._id] = {
      completed: stat.completed,
      total,
      rate: total > 0 ? Math.round((stat.completed / total) * 100) : 0,
    };
  }

  // Find overdue modules (in progress for more than 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const overdueProgress = await TrainingProgress.find({
    status: 'in_progress',
    startedAt: { $lt: sevenDaysAgo },
  }).select('userId moduleId startedAt');

  const overdueModules = overdueProgress.map(p => ({
    userId: p.userId.toString(),
    moduleId: p.moduleId,
    daysSinceStart: Math.floor((Date.now() - p.startedAt!.getTime()) / (24 * 60 * 60 * 1000)),
  }));

  return {
    totalProviders: providers,
    completedCount: completedProviders,
    averageProgress: Math.round(
      progressStats.reduce((sum: number, p: { avgProgress?: number }) => sum + (p.avgProgress || 0), 0) / (progressStats.length || 1)
    ),
    moduleCompletionRates,
    overdueModules,
  };
}

/**
 * Send reminders for incomplete training
 */
export async function sendTrainingReminders(): Promise<number> {
  try {
    const mandatoryModules = await TrainingModule.find({ isMandatory: true });
    const mandatoryModuleIds = mandatoryModules.map(m => m.moduleId);

    // Find providers with incomplete mandatory training
    const incompleteProgress = await TrainingProgress.find({
      moduleId: { $in: mandatoryModuleIds },
      status: { $ne: 'completed' },
    }).populate('userId', 'email firstName communicationPreferences');

    let remindersSent = 0;

    for (const progress of incompleteProgress) {
      const user = progress.userId as unknown as {
        _id: mongoose.Types.ObjectId;
        firstName: string;
        communicationPreferences?: { email?: { marketing?: boolean } };
      };

      if (!user?.communicationPreferences?.email?.marketing) continue;

      // Check if reminder was sent recently
      const module = mandatoryModules.find(m => m.moduleId === progress.moduleId);
      if (!module) continue;

      await addJob('notification-queue', 'send_notification', {
        userId: user._id.toString(),
        type: 'training_reminder',
        title: 'Complete Your Training',
        message: `Don't forget to complete "${module.title}" to start accepting bookings.`,
        data: {
          moduleId: module.moduleId,
          moduleTitle: module.title,
        },
      });

      remindersSent++;
    }

    logger.info('sendTrainingReminders: Sent reminders', { count: remindersSent });
    return remindersSent;
  } catch (error) {
    logger.error('sendTrainingReminders: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Run the provider training check processor
 * Wrapper function for scheduler integration
 */
export async function runProviderTrainingCheck(): Promise<{
  remindersSent: number;
}> {
  try {
    logger.info('Running provider training check via scheduler');

    // Send training reminders
    const remindersSent = await sendTrainingReminders();

    logger.info('Provider training check completed via scheduler', { remindersSent });

    return {
      remindersSent,
    };
  } catch (error) {
    logger.error('Provider training check failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  initializeTrainingModules,
  getTrainingModules,
  getModuleById,
  getUserTrainingProgress,
  startModule,
  updateModuleProgress,
  completeModule,
  generateCertificate,
  verifyCertificate,
  getTrainingStats,
  sendTrainingReminders,
  runProviderTrainingCheck,
  TrainingModule,
  TrainingProgress,
  TrainingCertificate,
};
