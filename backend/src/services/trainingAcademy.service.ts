import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type CourseStatus = 'draft' | 'published' | 'archived';
export type ContentType = 'video' | 'article' | 'quiz' | 'assignment';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';
export type CertificationStatus = 'pending' | 'issued' | 'expired' | 'revoked';

export interface CourseContent {
  id: string;
  title: string;
  description: string;
  type: ContentType;
  duration?: number; // in minutes for video
  content: string; // URL for video, text for article
  order: number;
  isRequired: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface Course {
  _id?: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  content: CourseContent[];
  quizzes: QuizQuestion[];
  passingScore: number; // percentage
  estimatedDuration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  certification: {
    name: string;
    validityMonths: number;
  };
  isRequired: boolean;
  requiredForRoles: string[];
  status: CourseStatus;
  order: number;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CourseProgress {
  _id?: Types.ObjectId;
  courseId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: ProgressStatus;
  progressPercentage: number;
  currentContentIndex: number;
  completedContents: string[];
  quizScores: Array<{
    quizIndex: number;
    score: number;
    attempts: number;
    completedAt?: Date;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  lastAccessedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Certification {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  courseId: Types.ObjectId;
  courseName: string;
  certificateId: string;
  status: CertificationStatus;
  issuedAt: Date;
  expiresAt?: Date;
  score: number;
  verificationCode: string;
  createdAt?: Date;
}

export interface RequiredTraining {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  courseId: Types.ObjectId;
  dueDate: Date;
  status: 'pending' | 'completed' | 'overdue';
  reminderCount: number;
  createdAt?: Date;
}

// ============================================
// Mongoose Interfaces
// ============================================

interface ICourse extends Document, Omit<Course, '_id'> {}
interface ICourseProgress extends Document, Omit<CourseProgress, '_id'> {}
interface ICertification extends Document, Omit<Certification, '_id'> {}
interface IRequiredTraining extends Document, Omit<RequiredTraining, '_id'> {}

// ============================================
// Mongoose Schemas
// ============================================

const CourseContentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['video', 'article', 'quiz', 'assignment'], required: true },
  duration: { type: Number },
  content: { type: String, required: true },
  order: { type: Number, required: true },
  isRequired: { type: Boolean, default: true },
}, { _id: false });

const QuizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  explanation: { type: String },
}, { _id: false });

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  thumbnail: { type: String, required: true },
  content: { type: [CourseContentSchema], default: [] },
  quizzes: { type: [QuizQuestionSchema], default: [] },
  passingScore: { type: Number, default: 80, min: 0, max: 100 },
  estimatedDuration: { type: Number, default: 30 },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  certification: {
    name: { type: String, required: true },
    validityMonths: { type: Number, default: 12 },
  },
  isRequired: { type: Boolean, default: false },
  requiredForRoles: [{ type: String }],
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  order: { type: Number, default: 0 },
  tags: [{ type: String }],
}, {
  timestamps: true,
  collection: 'training_courses',
});

CourseSchema.index({ status: 1, order: 1 });
CourseSchema.index({ category: 1 });
CourseSchema.index({ isRequired: 1 });
CourseSchema.index({ tags: 1 });

const QuizScoreSchema = new mongoose.Schema({
  quizIndex: { type: Number, required: true },
  score: { type: Number, required: true },
  attempts: { type: Number, default: 1 },
  completedAt: { type: Date },
}, { _id: false });

const CourseProgressSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'failed'],
    default: 'not_started',
  },
  progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
  currentContentIndex: { type: Number, default: 0 },
  completedContents: [{ type: String }],
  quizScores: { type: [QuizScoreSchema], default: [] },
  startedAt: { type: Date },
  completedAt: { type: Date },
  lastAccessedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'course_progress',
});

CourseProgressSchema.index({ courseId: 1, providerId: 1 }, { unique: true });
CourseProgressSchema.index({ providerId: 1, status: 1 });
CourseProgressSchema.index({ providerId: 1, lastAccessedAt: -1 });

const CertificationSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  courseName: { type: String, required: true },
  certificateId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'issued', 'expired', 'revoked'],
    default: 'pending',
  },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  score: { type: Number, required: true },
  verificationCode: { type: String, required: true, unique: true },
}, {
  timestamps: true,
  collection: 'certifications',
});

CertificationSchema.index({ providerId: 1 });
CertificationSchema.index({ courseId: 1 });
CertificationSchema.index({ status: 1 });
CertificationSchema.index({ certificateId: 1 }, { unique: true });

const RequiredTrainingSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'completed', 'overdue'], default: 'pending' },
  reminderCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'required_training',
});

RequiredTrainingSchema.index({ providerId: 1, status: 1 });
RequiredTrainingSchema.index({ dueDate: 1 });

// ============================================
// Model Registration
// ============================================

export const TrainingCourseModel = mongoose.models.TrainingCourse ||
  mongoose.model<ICourse>('TrainingCourse', CourseSchema);
export const CourseProgressModel = mongoose.models.CourseProgress ||
  mongoose.model<ICourseProgress>('CourseProgress', CourseProgressSchema);
export const CertificationModel = mongoose.models.Certification ||
  mongoose.model<ICertification>('Certification', CertificationSchema);
export const RequiredTrainingModel = mongoose.models.RequiredTraining ||
  mongoose.model<IRequiredTraining>('RequiredTraining', RequiredTrainingSchema);

// ============================================
// Service Class
// ============================================

export class TrainingAcademyService {

  // ========================================
  // Course Management
  // ========================================

  /**
   * Create a new course
   */
  async createCourse(input: Omit<Course, '_id' | 'createdAt' | 'updatedAt'>): Promise<ICourse> {
    const course = new TrainingCourseModel(input);
    await course.save();

    logger.info('Training course created', {
      context: 'TrainingAcademyService',
      action: 'COURSE_CREATED',
      courseId: course._id.toString(),
      title: course.title,
    });

    eventBus.publish(EVENT_TYPES.TRAINING_COURSE_CREATED, {
      courseId: course._id,
      title: course.title,
    });

    return course;
  }

  /**
   * Get course by ID
   */
  async getCourseById(courseId: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid course ID');
    }
    return TrainingCourseModel.findById(courseId);
  }

  /**
   * Get all published courses
   */
  async getAllCourses(filters?: {
    category?: string;
    difficulty?: Course['difficulty'];
    isRequired?: boolean;
    status?: CourseStatus;
  }): Promise<ICourse[]> {
    const query: Record<string, unknown> = {};

    if (filters?.status) {
      query.status = filters.status;
    } else {
      query.status = 'published';
    }

    if (filters?.category) query.category = filters.category;
    if (filters?.difficulty) query.difficulty = filters.difficulty;
    if (filters?.isRequired !== undefined) query.isRequired = filters.isRequired;

    return TrainingCourseModel.find(query).sort({ order: 1 });
  }

  /**
   * Update course
   */
  async updateCourse(courseId: string, updates: Partial<Course>): Promise<ICourse> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid course ID');
    }

    const course = await TrainingCourseModel.findByIdAndUpdate(
      courseId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!course) {
      throw ApiError.notFound('Course not found');
    }

    logger.info('Training course updated', {
      context: 'TrainingAcademyService',
      action: 'COURSE_UPDATED',
      courseId,
    });

    return course;
  }

  // ========================================
  // Progress Tracking
  // ========================================

  /**
   * Start or resume a course
   */
  async startCourse(providerId: string, courseId: string): Promise<ICourseProgress> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    // Check if course exists
    const course = await TrainingCourseModel.findById(courseId);
    if (!course || course.status !== 'published') {
      throw ApiError.notFound('Course not found');
    }

    // Check for existing progress
    let progress = await CourseProgressModel.findOne({
      courseId: new Types.ObjectId(courseId),
      providerId: new Types.ObjectId(providerId),
    });

    if (!progress) {
      progress = new CourseProgressModel({
        courseId: new Types.ObjectId(courseId),
        providerId: new Types.ObjectId(providerId),
        status: 'not_started',
        progressPercentage: 0,
        currentContentIndex: 0,
        completedContents: [],
        quizScores: [],
        startedAt: new Date(),
      });
      await progress.save();
    }

    if (progress.status === 'not_started') {
      progress.status = 'in_progress';
      progress.startedAt = new Date();
      await progress.save();
    }

    progress.lastAccessedAt = new Date();
    await progress.save();

    logger.info('Course started/resumed', {
      context: 'TrainingAcademyService',
      action: 'COURSE_STARTED',
      courseId,
      providerId,
    });

    return progress;
  }

  /**
   * Complete content within a course
   */
  async completeContent(
    providerId: string,
    courseId: string,
    contentId: string
  ): Promise<ICourseProgress> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const course = await TrainingCourseModel.findById(courseId);
    if (!course) {
      throw ApiError.notFound('Course not found');
    }

    let progress = await CourseProgressModel.findOne({
      courseId: new Types.ObjectId(courseId),
      providerId: new Types.ObjectId(providerId),
    });

    if (!progress) {
      progress = await this.startCourse(providerId, courseId);
    }

    // Add content to completed if not already
    if (!progress.completedContents.includes(contentId)) {
      progress.completedContents.push(contentId);
    }

    // Update progress percentage
    const requiredContents = course.content.filter((c: { isRequired?: boolean }) => c.isRequired);
    const completedRequired = requiredContents.filter((c: { id: string }) =>
      progress!.completedContents.includes(c.id)
    ).length;
    progress.progressPercentage = requiredContents.length > 0
      ? Math.round((completedRequired / requiredContents.length) * 100)
      : Math.round((progress.completedContents.length / course.content.length) * 100);

    // Find next content
    const currentIndex = course.content.findIndex((c: { id: string }) => c.id === contentId);
    if (currentIndex >= 0 && currentIndex < course.content.length - 1) {
      progress.currentContentIndex = currentIndex + 1;
    }

    // Check if course is completed
    const allRequiredCompleted = requiredContents.every((c: { id: string }) =>
      progress!.completedContents.includes(c.id)
    );

    if (allRequiredCompleted) {
      progress.status = 'completed';
      progress.completedAt = new Date();

      // Issue certification if applicable
      if (course.certification) {
        await this.issueCertification(providerId, courseId, 0); // Score would come from quiz
      }
    }

    progress.lastAccessedAt = new Date();
    await progress.save();

    logger.info('Content completed', {
      context: 'TrainingAcademyService',
      action: 'CONTENT_COMPLETED',
      courseId,
      providerId,
      contentId,
      progressPercentage: progress.progressPercentage,
    });

    return progress;
  }

  /**
   * Submit quiz answers and calculate score
   */
  async submitQuiz(
    providerId: string,
    courseId: string,
    quizIndex: number,
    answers: number[]
  ): Promise<{ score: number; passed: boolean; correctAnswers: number[] }> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const course = await TrainingCourseModel.findById(courseId);
    if (!course) {
      throw ApiError.notFound('Course not found');
    }

    if (quizIndex < 0 || quizIndex >= course.quizzes.length) {
      throw ApiError.badRequest('Invalid quiz index');
    }

    const quiz = course.quizzes[quizIndex];
    let correctCount = 0;
    const correctAnswers: number[] = [];

    for (let i = 0; i < quiz.options.length; i++) {
      correctAnswers.push(quiz.correctAnswer);
      if (answers[i] === quiz.correctAnswer) {
        correctCount++;
      }
    }

    const score = Math.round((correctCount / quiz.options.length) * 100);
    const passed = score >= course.passingScore;

    // Update progress
    let progress = await CourseProgressModel.findOne({
      courseId: new Types.ObjectId(courseId),
      providerId: new Types.ObjectId(providerId),
    });

    if (!progress) {
      progress = await this.startCourse(providerId, courseId);
    }

    // Update or add quiz score
    const existingQuizScore = progress.quizScores.find((qs: { quizIndex: number }) => qs.quizIndex === quizIndex);
    if (existingQuizScore) {
      existingQuizScore.attempts++;
      existingQuizScore.score = score;
      existingQuizScore.completedAt = new Date();
    } else {
      progress.quizScores.push({
        quizIndex,
        score,
        attempts: 1,
        completedAt: new Date(),
      });
    }

    // Check if all quizzes passed
    const allQuizzesPassed = course.quizzes.every((_: unknown, idx: number) => {
      const qs = progress!.quizScores.find((q: { quizIndex: number; score: number }) => q.quizIndex === idx);
      return qs && qs.score >= course.passingScore;
    });

    if (allQuizzesPassed) {
      const avgScore = progress.quizScores.reduce((sum: number, qs: { score: number }) => sum + qs.score, 0) / progress.quizScores.length;
      await this.issueCertification(providerId, courseId, avgScore);
    }

    progress.lastAccessedAt = new Date();
    await progress.save();

    logger.info('Quiz submitted', {
      context: 'TrainingAcademyService',
      action: 'QUIZ_SUBMITTED',
      courseId,
      providerId,
      quizIndex,
      score,
      passed,
    });

    return { score, passed, correctAnswers };
  }

  /**
   * Get provider's progress for a course
   */
  async getCourseProgress(providerId: string, courseId: string): Promise<ICourseProgress | null> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    return CourseProgressModel.findOne({
      courseId: new Types.ObjectId(courseId),
      providerId: new Types.ObjectId(providerId),
    });
  }

  /**
   * Get all courses with progress for a provider
   */
  async getProviderCoursesWithProgress(
    providerId: string
  ): Promise<Array<ICourse & { progress?: ICourseProgress }>> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const courses = await TrainingCourseModel.find({ status: 'published' })
      .sort({ order: 1 });

    const progressRecords = await CourseProgressModel.find({
      providerId: new Types.ObjectId(providerId),
    });

    const progressMap = new Map(
      progressRecords.map(p => [p.courseId.toString(), p])
    );

    return courses.map(course => ({
      ...course.toObject(),
      progress: progressMap.get(course._id.toString()),
    }));
  }

  // ========================================
  // Certifications
  // ========================================

  /**
   * Issue certification
   */
  async issueCertification(
    providerId: string,
    courseId: string,
    score: number
  ): Promise<ICertification> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const course = await TrainingCourseModel.findById(courseId);
    if (!course) {
      throw ApiError.notFound('Course not found');
    }

    // Check if certification already exists
    const existing = await CertificationModel.findOne({
      providerId: new Types.ObjectId(providerId),
      courseId: new Types.ObjectId(courseId),
      status: { $in: ['pending', 'issued'] },
    });

    if (existing) {
      // Update existing
      existing.status = 'issued';
      existing.score = score;
      existing.issuedAt = new Date();
      existing.expiresAt = course.certification.validityMonths
        ? new Date(Date.now() + course.certification.validityMonths * 30 * 24 * 60 * 60 * 1000)
        : undefined;
      await existing.save();
      return existing;
    }

    const certificateId = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const verificationCode = `VERIFY-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

    const certification = new CertificationModel({
      providerId: new Types.ObjectId(providerId),
      courseId: new Types.ObjectId(courseId),
      courseName: course.title,
      certificateId,
      status: 'issued',
      issuedAt: new Date(),
      expiresAt: course.certification.validityMonths
        ? new Date(Date.now() + course.certification.validityMonths * 30 * 24 * 60 * 60 * 1000)
        : undefined,
      score,
      verificationCode,
    });

    await certification.save();

    logger.info('Certification issued', {
      context: 'TrainingAcademyService',
      action: 'CERTIFICATION_ISSUED',
      certificateId,
      providerId,
      courseId,
    });

    eventBus.publish(EVENT_TYPES.CERTIFICATION_ISSUED, {
      certificationId: certification._id,
      certificateId,
      providerId,
      courseId,
    });

    return certification;
  }

  /**
   * Verify certification by code
   */
  async verifyCertification(verificationCode: string): Promise<ICertification | null> {
    return CertificationModel.findOne({ verificationCode })
      .populate('providerId', 'firstName lastName')
      .populate('courseId', 'title category');
  }

  /**
   * Get provider's certifications
   */
  async getProviderCertifications(providerId: string): Promise<ICertification[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    return CertificationModel.find({
      providerId: new Types.ObjectId(providerId),
      status: { $in: ['pending', 'issued'] },
    }).sort({ issuedAt: -1 });
  }

  // ========================================
  // Required Training
  // ========================================

  /**
   * Assign required training to a provider
   */
  async assignRequiredTraining(
    providerId: string,
    courseId: string,
    dueDate: Date
  ): Promise<IRequiredTraining> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    // Check if already assigned
    const existing = await RequiredTrainingModel.findOne({
      providerId: new Types.ObjectId(providerId),
      courseId: new Types.ObjectId(courseId),
      status: { $in: ['pending', 'overdue'] },
    });

    if (existing) {
      existing.dueDate = dueDate;
      await existing.save();
      return existing;
    }

    const required = new RequiredTrainingModel({
      providerId: new Types.ObjectId(providerId),
      courseId: new Types.ObjectId(courseId),
      dueDate,
      status: 'pending',
    });

    await required.save();

    logger.info('Required training assigned', {
      context: 'TrainingAcademyService',
      action: 'TRAINING_ASSIGNED',
      providerId,
      courseId,
      dueDate,
    });

    return required;
  }

  /**
   * Get provider's required training
   */
  async getRequiredTraining(providerId: string): Promise<IRequiredTraining[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    return RequiredTrainingModel.find({
      providerId: new Types.ObjectId(providerId),
    })
      .populate('courseId', 'title description thumbnail estimatedDuration')
      .sort({ dueDate: 1 });
  }

  /**
   * Mark required training as complete
   */
  async completeRequiredTraining(providerId: string, courseId: string): Promise<IRequiredTraining> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(courseId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const training = await RequiredTrainingModel.findOneAndUpdate(
      {
        providerId: new Types.ObjectId(providerId),
        courseId: new Types.ObjectId(courseId),
      },
      { status: 'completed' },
      { new: true }
    );

    if (!training) {
      throw ApiError.notFound('Required training not found');
    }

    logger.info('Required training completed', {
      context: 'TrainingAcademyService',
      action: 'REQUIRED_TRAINING_COMPLETED',
      providerId,
      courseId,
    });

    return training;
  }

  // ========================================
  // Analytics
  // ========================================

  /**
   * Get training statistics for a provider
   */
  async getProviderTrainingStats(providerId: string): Promise<{
    coursesCompleted: number;
    coursesInProgress: number;
    totalCertifications: number;
    activeCertifications: number;
    avgProgress: number;
    requiredPending: number;
    requiredOverdue: number;
  }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const providerObjectId = new Types.ObjectId(providerId);

    const [progressRecords, certifications, requiredTraining] = await Promise.all([
      CourseProgressModel.find({ providerId: providerObjectId }),
      CertificationModel.find({ providerId: providerObjectId }),
      RequiredTrainingModel.find({ providerId: providerObjectId }),
    ]);

    const completed = progressRecords.filter(p => p.status === 'completed').length;
    const inProgress = progressRecords.filter(p => p.status === 'in_progress').length;
    const avgProgress = progressRecords.length > 0
      ? Math.round(progressRecords.reduce((sum, p) => sum + p.progressPercentage, 0) / progressRecords.length)
      : 0;

    const now = new Date();
    const overdue = requiredTraining.filter(t =>
      t.status === 'pending' && t.dueDate < now
    );

    return {
      coursesCompleted: completed,
      coursesInProgress: inProgress,
      totalCertifications: certifications.length,
      activeCertifications: certifications.filter(c => c.status === 'issued').length,
      avgProgress,
      requiredPending: requiredTraining.filter(t => t.status === 'pending').length,
      requiredOverdue: overdue.length,
    };
  }
}

// ============================================
// Export Singleton
// ============================================

export const trainingAcademyService = new TrainingAcademyService();
export default trainingAcademyService;
