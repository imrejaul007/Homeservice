import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type RecoveryStatus = 'pending' | 'in_progress' | 'verification_pending' | 'approved' | 'rejected' | 'completed' | 'expired';
export type VerificationMethod = 'email' | 'phone' | 'document' | 'security_questions' | 'manual_review';
export type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'utility_bill' | 'bank_statement';
export type EscalationLevel = 'tier1' | 'tier2' | 'tier3' | 'supervisor';

export interface IdentityDocument {
  type: DocumentType;
  documentNumber?: string;
  frontImage: string;
  backImage?: string;
  expiryDate?: Date;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface VerificationStep {
  method: VerificationMethod;
  status: 'pending' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  completedAt?: Date;
  verificationCode?: string;
  expiresAt?: Date;
}

export interface RecoveryRequest {
  _id?: Types.ObjectId;
  requestId: string;
  userId?: Types.ObjectId;
  email: string;
  phone?: string;
  reason: string;
  status: RecoveryStatus;
  currentStep: number;
  verificationSteps: VerificationStep[];
  identityDocuments: IdentityDocument[];
  securityQuestions?: Array<{
    question: string;
    answer: string;
    verified: boolean;
  }>;
  alternativeContacts?: Array<{
    name: string;
    email: string;
    phone: string;
    relationship: string;
    verified: boolean;
  }>;
  escalationLevel: EscalationLevel;
  escalatedBy?: Types.ObjectId;
  escalatedAt?: Date;
  escalationNotes?: string;
  notes: Array<{
    author: Types.ObjectId;
    content: string;
    createdAt: Date;
  }>;
  timeline: Array<{
    status: RecoveryStatus;
    description: string;
    timestamp: Date;
    actor?: Types.ObjectId;
  }>;
  expiresAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateRecoveryRequestInput {
  email: string;
  phone?: string;
  reason: string;
  preferredVerificationMethod?: VerificationMethod;
}

export interface RecoveryTimeline {
  requestId: string;
  estimatedDuration: string;
  nextSteps: string[];
  completedSteps: string[];
}

// ============================================
// Mongoose Interface
// ============================================

interface IRecoveryRequest extends Document, Omit<RecoveryRequest, '_id'> {}

// ============================================
// Mongoose Schema
// ============================================

const IdentityDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['passport', 'drivers_license', 'national_id', 'utility_bill', 'bank_statement'],
    required: true,
  },
  documentNumber: { type: String },
  frontImage: { type: String, required: true },
  backImage: { type: String },
  expiryDate: { type: Date },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: String },
}, { _id: false });

const VerificationStepSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['email', 'phone', 'document', 'security_questions', 'manual_review'],
    required: true,
  },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  completedAt: { type: Date },
  verificationCode: { type: String },
  expiresAt: { type: Date },
}, { _id: false });

const SecurityQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  verified: { type: Boolean, default: false },
}, { _id: false });

const AlternativeContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  relationship: { type: String, required: true },
  verified: { type: Boolean, default: false },
}, { _id: false });

const NoteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const TimelineEventSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'verification_pending', 'approved', 'rejected', 'completed', 'expired'],
    required: true,
  },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const RecoveryRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true },
  phone: { type: String },
  reason: { type: String, required: true, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'verification_pending', 'approved', 'rejected', 'completed', 'expired'],
    default: 'pending',
  },
  currentStep: { type: Number, default: 0 },
  verificationSteps: { type: [VerificationStepSchema], default: [] },
  identityDocuments: { type: [IdentityDocumentSchema], default: [] },
  securityQuestions: { type: [SecurityQuestionSchema] },
  alternativeContacts: { type: [AlternativeContactSchema] },
  escalationLevel: {
    type: String,
    enum: ['tier1', 'tier2', 'tier3', 'supervisor'],
    default: 'tier1',
  },
  escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  escalatedAt: { type: Date },
  escalationNotes: { type: String },
  notes: { type: [NoteSchema], default: [] },
  timeline: { type: [TimelineEventSchema], default: [] },
  expiresAt: { type: Date },
  completedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'account_recovery_requests',
});

RecoveryRequestSchema.index({ requestId: 1 }, { unique: true });
RecoveryRequestSchema.index({ email: 1 });
RecoveryRequestSchema.index({ userId: 1 });
RecoveryRequestSchema.index({ status: 1 });
RecoveryRequestSchema.index({ createdAt: -1 });

// ============================================
// Model Registration
// ============================================

export const RecoveryRequestModel = mongoose.models.RecoveryRequest ||
  mongoose.model<IRecoveryRequest>('RecoveryRequest', RecoveryRequestSchema);

// ============================================
// Service Class
// ============================================

export class EnhancedAccountRecoveryService {

  // Verification settings
  private readonly EMAIL_VERIFICATION_EXPIRY = 15 * 60 * 1000; // 15 minutes
  private readonly PHONE_VERIFICATION_EXPIRY = 10 * 60 * 1000; // 10 minutes
  private readonly REQUEST_EXPIRY_DAYS = 7;

  // ========================================
  // Recovery Request Creation
  // ========================================

  /**
   * Create a new recovery request
   */
  async createRecoveryRequest(input: CreateRecoveryRequestInput): Promise<IRecoveryRequest> {
    const { email, phone, reason, preferredVerificationMethod } = input;

    // Check for existing pending request
    const existing = await RecoveryRequestModel.findOne({
      email: email.toLowerCase(),
      status: { $in: ['pending', 'in_progress', 'verification_pending'] },
    });

    if (existing) {
      throw ApiError.conflict('A recovery request already exists for this email');
    }

    const requestId = `REC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Set up verification steps based on preferred method
    const verificationSteps = this.getVerificationSteps(preferredVerificationMethod);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REQUEST_EXPIRY_DAYS);

    const recoveryRequest = new RecoveryRequestModel({
      requestId,
      email: email.toLowerCase(),
      phone,
      reason,
      status: 'pending',
      currentStep: 0,
      verificationSteps,
      timeline: [{
        status: 'pending',
        description: 'Recovery request created',
        timestamp: new Date(),
      }],
      expiresAt,
    });

    await recoveryRequest.save();

    logger.info('Recovery request created', {
      context: 'EnhancedAccountRecoveryService',
      action: 'RECOVERY_REQUEST_CREATED',
      requestId,
      email,
    });

    eventBus.publish(EVENT_TYPES.ACCOUNT_RECOVERY_REQUESTED, {
      requestId,
      email,
    });

    return recoveryRequest;
  }

  /**
   * Get verification steps based on preferred method
   */
  private getVerificationSteps(preferredMethod?: VerificationMethod): VerificationStep[] {
    const steps: VerificationStep[] = [];

    // Always start with email verification
    steps.push({
      method: 'email',
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
    });

    // Add secondary verification based on preference
    if (preferredMethod === 'phone') {
      steps.push({
        method: 'phone',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      });
    } else if (preferredMethod === 'document') {
      steps.push({
        method: 'document',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      });
    } else if (preferredMethod === 'security_questions') {
      steps.push({
        method: 'security_questions',
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
      });
    }

    return steps;
  }

  /**
   * Get recovery request by ID
   */
  async getRequestById(requestId: string): Promise<IRecoveryRequest | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      // Try by requestId string
      return RecoveryRequestModel.findOne({ requestId });
    }
    return RecoveryRequestModel.findById(requestId)
      .populate('notes.author', 'firstName lastName');
  }

  /**
   * Get recovery request by request ID string
   */
  async getRequestByRequestId(requestId: string): Promise<IRecoveryRequest | null> {
    return RecoveryRequestModel.findOne({ requestId })
      .populate('notes.author', 'firstName lastName');
  }

  // ========================================
  // Verification Methods
  // ========================================

  /**
   * Send email verification code
   */
  async sendEmailVerification(requestId: string): Promise<{ codeSent: boolean; expiresIn: number }> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    const emailStep = request.verificationSteps.find(s => s.method === 'email');
    if (!emailStep) {
      throw ApiError.badRequest('Email verification not required');
    }

    // Generate verification code
    const code = this.generateVerificationCode(6);
    const expiresAt = new Date(Date.now() + this.EMAIL_VERIFICATION_EXPIRY);

    // Update step
    emailStep.verificationCode = code;
    emailStep.expiresAt = expiresAt;
    await request.save();

    // In production, send email here
    logger.info('Email verification code sent', {
      context: 'EnhancedAccountRecoveryService',
      action: 'EMAIL_CODE_SENT',
      requestId,
    });

    return {
      codeSent: true,
      expiresIn: this.EMAIL_VERIFICATION_EXPIRY / 1000,
    };
  }

  /**
   * Verify email code
   */
  async verifyEmailCode(requestId: string, code: string): Promise<{ verified: boolean; remainingAttempts: number }> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    const emailStep = request.verificationSteps.find(s => s.method === 'email');
    if (!emailStep) {
      throw ApiError.badRequest('Email verification not required');
    }

    if (emailStep.status === 'completed') {
      return { verified: true, remainingAttempts: emailStep.maxAttempts - emailStep.attempts };
    }

    // Check attempts
    if (emailStep.attempts >= emailStep.maxAttempts) {
      throw ApiError.badRequest('Maximum verification attempts reached');
    }

    // Check expiry
    if (emailStep.expiresAt && emailStep.expiresAt < new Date()) {
      throw ApiError.badRequest('Verification code has expired');
    }

    // Verify code
    if (emailStep.verificationCode === code) {
      emailStep.status = 'completed';
      emailStep.completedAt = new Date();
      emailStep.attempts += 1;

      request.status = 'in_progress';
      request.currentStep = 1;
      request.timeline.push({
        status: 'in_progress',
        description: 'Email verified successfully',
        timestamp: new Date(),
      });

      await request.save();

      return { verified: true, remainingAttempts: emailStep.maxAttempts - emailStep.attempts };
    }

    emailStep.attempts += 1;
    await request.save();

    return {
      verified: false,
      remainingAttempts: emailStep.maxAttempts - emailStep.attempts,
    };
  }

  /**
   * Send phone verification
   */
  async sendPhoneVerification(requestId: string): Promise<{ codeSent: boolean; expiresIn: number }> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    const phoneStep = request.verificationSteps.find(s => s.method === 'phone');
    if (!phoneStep) {
      throw ApiError.badRequest('Phone verification not required');
    }

    const code = this.generateVerificationCode(6);
    const expiresAt = new Date(Date.now() + this.PHONE_VERIFICATION_EXPIRY);

    phoneStep.verificationCode = code;
    phoneStep.expiresAt = expiresAt;
    await request.save();

    // In production, send SMS here
    logger.info('Phone verification code sent', {
      context: 'EnhancedAccountRecoveryService',
      action: 'PHONE_CODE_SENT',
      requestId,
    });

    return {
      codeSent: true,
      expiresIn: this.PHONE_VERIFICATION_EXPIRY / 1000,
    };
  }

  /**
   * Verify phone code
   */
  async verifyPhoneCode(requestId: string, code: string): Promise<{ verified: boolean; remainingAttempts: number }> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    const phoneStep = request.verificationSteps.find(s => s.method === 'phone');
    if (!phoneStep) {
      throw ApiError.badRequest('Phone verification not required');
    }

    if (phoneStep.status === 'completed') {
      return { verified: true, remainingAttempts: phoneStep.maxAttempts - phoneStep.attempts };
    }

    if (phoneStep.attempts >= phoneStep.maxAttempts) {
      throw ApiError.badRequest('Maximum verification attempts reached');
    }

    if (phoneStep.expiresAt && phoneStep.expiresAt < new Date()) {
      throw ApiError.badRequest('Verification code has expired');
    }

    if (phoneStep.verificationCode === code) {
      phoneStep.status = 'completed';
      phoneStep.completedAt = new Date();
      phoneStep.attempts += 1;

      request.currentStep = Math.max(request.currentStep, 2);
      request.timeline.push({
        status: 'in_progress',
        description: 'Phone verified successfully',
        timestamp: new Date(),
      });

      await request.save();
      return { verified: true, remainingAttempts: phoneStep.maxAttempts - phoneStep.attempts };
    }

    phoneStep.attempts += 1;
    await request.save();

    return {
      verified: false,
      remainingAttempts: phoneStep.maxAttempts - phoneStep.attempts,
    };
  }

  /**
   * Submit identity documents
   */
  async submitIdentityDocuments(
    requestId: string,
    documents: IdentityDocument[]
  ): Promise<IRecoveryRequest> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    const documentStep = request.verificationSteps.find(s => s.method === 'document');
    if (!documentStep) {
      throw ApiError.badRequest('Document verification not required');
    }

    // Validate documents
    for (const doc of documents) {
      if (!doc.frontImage) {
        throw ApiError.badRequest('Document front image is required');
      }
    }

    request.identityDocuments = documents;
    documentStep.status = 'pending';
    request.status = 'verification_pending';
    request.timeline.push({
      status: 'verification_pending',
      description: 'Identity documents submitted for review',
      timestamp: new Date(),
    });

    await request.save();

    logger.info('Identity documents submitted', {
      context: 'EnhancedAccountRecoveryService',
      action: 'DOCUMENTS_SUBMITTED',
      requestId,
    });

    return request;
  }

  /**
   * Set security questions
   */
  async setSecurityQuestions(
    requestId: string,
    questions: Array<{ question: string; answer: string }>
  ): Promise<IRecoveryRequest> {
    if (questions.length < 3) {
      throw ApiError.badRequest('At least 3 security questions are required');
    }

    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    const securityStep = request.verificationSteps.find(s => s.method === 'security_questions');
    if (!securityStep) {
      throw ApiError.badRequest('Security questions not required');
    }

    request.securityQuestions = questions.map(q => ({
      question: q.question,
      answer: q.answer.toLowerCase().trim(),
      verified: false,
    }));

    await request.save();

    return request;
  }

  /**
   * Verify security question answer
   */
  async verifySecurityQuestion(
    requestId: string,
    questionIndex: number,
    answer: string
  ): Promise<{ verified: boolean; remainingQuestions: number }> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    if (!request.securityQuestions || request.securityQuestions.length === 0) {
      throw ApiError.badRequest('No security questions set');
    }

    if (questionIndex < 0 || questionIndex >= request.securityQuestions.length) {
      throw ApiError.badRequest('Invalid question index');
    }

    const question = request.securityQuestions[questionIndex];

    if (question.verified) {
      return {
        verified: true,
        remainingQuestions: request.securityQuestions.filter(q => !q.verified).length,
      };
    }

    if (question.answer === answer.toLowerCase().trim()) {
      question.verified = true;

      const allVerified = request.securityQuestions.every(q => q.verified);
      if (allVerified) {
        const securityStep = request.verificationSteps.find(s => s.method === 'security_questions');
        if (securityStep) {
          securityStep.status = 'completed';
          securityStep.completedAt = new Date();
        }
        request.currentStep = Math.max(request.currentStep, 2);
        request.timeline.push({
          status: 'in_progress',
          description: 'Security questions verified',
          timestamp: new Date(),
        });
      }

      await request.save();

      return {
        verified: true,
        remainingQuestions: request.securityQuestions.filter(q => !q.verified).length,
      };
    }

    const securityStep = request.verificationSteps.find(s => s.method === 'security_questions');
    if (securityStep) {
      securityStep.attempts += 1;
      if (securityStep.attempts >= securityStep.maxAttempts) {
        securityStep.status = 'failed';
        await request.save();
        throw ApiError.badRequest('Maximum verification attempts reached');
      }
    }

    await request.save();

    return {
      verified: false,
      remainingQuestions: request.securityQuestions.filter(q => !q.verified).length,
    };
  }

  // ========================================
  // Support Escalation
  // ========================================

  /**
   * Escalate to higher tier support
   */
  async escalateRequest(
    requestId: string,
    escalatedBy: string,
    escalationLevel: EscalationLevel,
    notes?: string
  ): Promise<IRecoveryRequest> {
    if (!Types.ObjectId.isValid(escalatedBy)) {
      throw ApiError.badRequest('Invalid staff ID');
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    request.escalationLevel = escalationLevel;
    request.escalatedBy = new Types.ObjectId(escalatedBy);
    request.escalatedAt = new Date();
    request.escalationNotes = notes;

    request.timeline.push({
      status: request.status,
      description: `Escalated to ${escalationLevel}`,
      timestamp: new Date(),
      actor: new Types.ObjectId(escalatedBy),
    });

    await request.save();

    logger.info('Recovery request escalated', {
      context: 'EnhancedAccountRecoveryService',
      action: 'REQUEST_ESCALATED',
      requestId,
      escalationLevel,
      escalatedBy,
    });

    eventBus.publish(EVENT_TYPES.ACCOUNT_RECOVERY_ESCALATED, {
      requestId,
      escalationLevel,
    });

    return request;
  }

  /**
   * Add note to recovery request
   */
  async addNote(requestId: string, authorId: string, content: string): Promise<IRecoveryRequest> {
    if (!Types.ObjectId.isValid(authorId)) {
      throw ApiError.badRequest('Invalid author ID');
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    request.notes.push({
      author: new Types.ObjectId(authorId),
      content,
      createdAt: new Date(),
    });

    await request.save();

    return request;
  }

  // ========================================
  // Verification Processing
  // ========================================

  /**
   * Approve document verification (admin)
   */
  async approveDocumentVerification(
    requestId: string,
    documentIndex: number,
    verifiedBy: string,
    notes?: string
  ): Promise<IRecoveryRequest> {
    if (!Types.ObjectId.isValid(verifiedBy)) {
      throw ApiError.badRequest('Invalid staff ID');
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    if (documentIndex < 0 || documentIndex >= request.identityDocuments.length) {
      throw ApiError.badRequest('Invalid document index');
    }

    request.identityDocuments[documentIndex].verified = true;
    request.identityDocuments[documentIndex].verifiedAt = new Date();
    request.identityDocuments[documentIndex].verifiedBy = verifiedBy;

    // Check if all documents verified
    const allVerified = request.identityDocuments.every(d => d.verified);
    if (allVerified) {
      const documentStep = request.verificationSteps.find(s => s.method === 'document');
      if (documentStep) {
        documentStep.status = 'completed';
        documentStep.completedAt = new Date();
      }
      request.currentStep = Math.max(request.currentStep, 2);
    }

    request.timeline.push({
      status: request.status,
      description: `Document ${documentIndex + 1} verified by support`,
      timestamp: new Date(),
      actor: new Types.ObjectId(verifiedBy),
    });

    await request.save();

    return request;
  }

  /**
   * Reject document verification (admin)
   */
  async rejectDocumentVerification(
    requestId: string,
    documentIndex: number,
    rejectedBy: string,
    reason: string
  ): Promise<IRecoveryRequest> {
    if (!Types.ObjectId.isValid(rejectedBy)) {
      throw ApiError.badRequest('Invalid staff ID');
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    if (documentIndex < 0 || documentIndex >= request.identityDocuments.length) {
      throw ApiError.badRequest('Invalid document index');
    }

    // Mark document as not verified
    request.identityDocuments[documentIndex].verified = false;

    // Add rejection note
    request.notes.push({
      author: new Types.ObjectId(rejectedBy),
      content: `Document verification rejected: ${reason}`,
      createdAt: new Date(),
    });

    await request.save();

    return request;
  }

  // ========================================
  // Request Resolution
  // ========================================

  /**
   * Approve recovery request
   */
  async approveRequest(requestId: string, approvedBy: string): Promise<IRecoveryRequest> {
    if (!Types.ObjectId.isValid(approvedBy)) {
      throw ApiError.badRequest('Invalid staff ID');
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    if (request.status === 'completed') {
      throw ApiError.badRequest('Request already completed');
    }

    request.status = 'approved';
    request.timeline.push({
      status: 'approved',
      description: 'Recovery request approved',
      timestamp: new Date(),
      actor: new Types.ObjectId(approvedBy),
    });

    await request.save();

    logger.info('Recovery request approved', {
      context: 'EnhancedAccountRecoveryService',
      action: 'REQUEST_APPROVED',
      requestId,
      approvedBy,
    });

    return request;
  }

  /**
   * Reject recovery request
   */
  async rejectRequest(requestId: string, rejectedBy: string, reason: string): Promise<IRecoveryRequest> {
    if (!Types.ObjectId.isValid(rejectedBy)) {
      throw ApiError.badRequest('Invalid staff ID');
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    request.status = 'rejected';
    request.notes.push({
      author: new Types.ObjectId(rejectedBy),
      content: `Request rejected: ${reason}`,
      createdAt: new Date(),
    });
    request.timeline.push({
      status: 'rejected',
      description: `Recovery request rejected: ${reason}`,
      timestamp: new Date(),
      actor: new Types.ObjectId(rejectedBy),
    });

    await request.save();

    logger.info('Recovery request rejected', {
      context: 'EnhancedAccountRecoveryService',
      action: 'REQUEST_REJECTED',
      requestId,
      rejectedBy,
      reason,
    });

    return request;
  }

  /**
   * Complete recovery request
   */
  async completeRequest(requestId: string): Promise<IRecoveryRequest> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw ApiError.notFound('Recovery request not found');
    }

    if (request.status !== 'approved') {
      throw ApiError.badRequest('Request must be approved before completion');
    }

    request.status = 'completed';
    request.completedAt = new Date();
    request.timeline.push({
      status: 'completed',
      description: 'Account recovery completed',
      timestamp: new Date(),
    });

    await request.save();

    logger.info('Recovery request completed', {
      context: 'EnhancedAccountRecoveryService',
      action: 'REQUEST_COMPLETED',
      requestId,
    });

    eventBus.publish(EVENT_TYPES.ACCOUNT_RECOVERY_COMPLETED, {
      requestId,
      userId: request.userId?.toString(),
    });

    return request;
  }

  // ========================================
  // Queries
  // ========================================

  /**
   * Get requests by status (admin)
   */
  async getRequestsByStatus(
    status: RecoveryStatus,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ requests: IRecoveryRequest[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      RecoveryRequestModel.find({ status })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      RecoveryRequestModel.countDocuments({ status }),
    ]);

    return {
      requests,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get requests for support agent
   */
  async getAgentRequests(
    agentId: string,
    options: {
      status?: RecoveryStatus;
      escalationLevel?: EscalationLevel;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ requests: IRecoveryRequest[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(agentId)) {
      throw ApiError.badRequest('Invalid agent ID');
    }

    const { status, escalationLevel, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    // Filter by accessible escalation levels based on agent's level
    // This is simplified - in production, you'd check the agent's actual level
    if (escalationLevel) {
      query.escalationLevel = escalationLevel;
    }

    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['pending', 'in_progress', 'verification_pending'] };
    }

    const [requests, total] = await Promise.all([
      RecoveryRequestModel.find(query)
        .sort({ createdAt: 1, escalationLevel: -1 })
        .skip(skip)
        .limit(limit),
      RecoveryRequestModel.countDocuments(query),
    ]);

    return {
      requests,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get recovery timeline
   */
  async getRecoveryTimeline(requestId: string): Promise<RecoveryTimeline | null> {
    const request = await this.getRequestByRequestId(requestId);
    if (!request) {
      return null;
    }

    const completedSteps: string[] = [];
    const nextSteps: string[] = [];

    const stepNames: Record<VerificationMethod, string> = {
      email: 'Email Verification',
      phone: 'Phone Verification',
      document: 'Document Verification',
      security_questions: 'Security Questions',
      manual_review: 'Manual Review',
    };

    for (const step of request.verificationSteps) {
      if (step.status === 'completed') {
        completedSteps.push(stepNames[step.method]);
      } else if (step.status === 'pending') {
        nextSteps.push(stepNames[step.method]);
      }
    }

    if (request.status === 'approved' || request.status === 'completed') {
      completedSteps.push('Final Approval');
      nextSteps.push('Account Recovery');
    }

    // Estimate duration based on current step
    let estimatedDuration = '1-2 business days';
    if (request.identityDocuments.length > 0 && !request.identityDocuments.every(d => d.verified)) {
      estimatedDuration = '3-5 business days';
    }

    return {
      requestId: request.requestId,
      estimatedDuration,
      completedSteps,
      nextSteps,
    };
  }

  // ========================================
  // Helpers
  // ========================================

  /**
   * Generate verification code
   */
  private generateVerificationCode(length: number): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
  }

  // ========================================
  // Analytics
  // ========================================

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<{
    totalRequests: number;
    pendingRequests: number;
    avgResolutionTime: number; // in hours
    approvalRate: number;
    rejectionRate: number;
    requestsByStatus: Record<RecoveryStatus, number>;
    escalationDistribution: Record<EscalationLevel, number>;
  }> {
    const [statusCounts, resolutionTimes, escalationCounts] = await Promise.all([
      RecoveryRequestModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      RecoveryRequestModel.aggregate([
        {
          $match: {
            status: 'completed',
            completedAt: { $exists: true },
          },
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ['$completedAt', '$createdAt'] },
                3600000, // Convert to hours
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$resolutionTime' },
          },
        },
      ]),
      RecoveryRequestModel.aggregate([
        { $group: { _id: '$escalationLevel', count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const s of statusCounts) {
      statusMap[s._id] = s.count;
      total += s.count;
    }

    const escalationMap: Record<string, number> = {};
    for (const e of escalationCounts) {
      escalationMap[e._id] = e.count;
    }

    const approved = statusMap['approved'] || 0;
    const rejected = statusMap['rejected'] || 0;
    const completed = approved + rejected;

    return {
      totalRequests: total,
      pendingRequests: (statusMap['pending'] || 0) + (statusMap['in_progress'] || 0) + (statusMap['verification_pending'] || 0),
      avgResolutionTime: Math.round((resolutionTimes[0]?.avgTime || 0) * 100) / 100,
      approvalRate: completed > 0 ? Math.round((approved / completed) * 100 * 100) / 100 : 0,
      rejectionRate: completed > 0 ? Math.round((rejected / completed) * 100 * 100) / 100 : 0,
      requestsByStatus: statusMap as Record<RecoveryStatus, number>,
      escalationDistribution: escalationMap as Record<EscalationLevel, number>,
    };
  }
}

// ============================================
// Export Singleton
// ============================================

export const enhancedAccountRecoveryService = new EnhancedAccountRecoveryService();
export default enhancedAccountRecoveryService;
