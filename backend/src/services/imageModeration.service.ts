/**
 * AI Image Moderation Service
 * AWS Rekognition / Google Vision integration for content moderation
 */

import axios from 'axios';
import mongoose, { Types } from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import ProviderVerification from '../models/providerVerification.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface ModerationResult {
  safe: boolean;
  categories: ModerationCategory[];
  labels: ModerationLabel[];
  confidence: number;
  requiresReview: boolean;
  autoAction?: 'allow' | 'blur' | 'reject';
}

export interface ModerationCategory {
  name: string;
  confidence: number;
  subcategories?: string[];
}

export interface ModerationLabel {
  name: string;
  confidence: number;
  parent?: string;
  categories: string[];
}

export interface ImageModerationCheck {
  imageUrl: string;
  uploadedBy: string;
  result: ModerationResult;
  action: 'allow' | 'blur' | 'reject' | 'review';
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface ModerationStats {
  totalProcessed: number;
  totalFlagged: number;
  totalAutoRejected: number;
  totalHumanReviews: number;
  approvalRate: number;
  topCategories: Array<{ name: string; count: number }>;
}

export interface HumanReviewQueueItem {
  id: string;
  imageUrl: string;
  uploadedBy: string;
  result: ModerationResult;
  submittedAt: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

// ============================================
// Moderation Categories
// ============================================

const ADULT_CATEGORIES = [
  'Explicit Nudity',
  'Suggestive',
  'Nudity',
  'Adult Content',
  'Provocative',
];

const VIOLENT_CATEGORIES = [
  'Violence',
  'Gore',
  'Weapon Violence',
  'Death',
  'Blood',
  'Graphic Violence',
];

const SENSITIVE_CATEGORIES = [
  'Religious Content',
  'Political Content',
  'Hate Symbols',
  'Drug Use',
  'Alcohol Use',
  'Tobacco Use',
  'Weapons',
];

// Confidence thresholds
const THRESHOLDS = {
  autoReject: 0.85, // 85% confidence = auto reject
  autoBlur: 0.75,    // 75% confidence = auto blur
  requireReview: 0.60, // 60% confidence = human review
};

// ============================================
// ImageModerationService Class
// ============================================

export class ImageModerationService {
  // ========================================
  // Image Moderation
  // ========================================

  /**
   * Moderate an image using AI services
   * Integrates with AWS Rekognition, Google Vision, or similar
   */
  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    try {
      // Step 1: Check with AWS Rekognition (if configured)
      const rekognitionResult = await this.checkWithRekognition(imageUrl);

      if (rekognitionResult) {
        return this.formatRekognitionResult(rekognitionResult);
      }

      // Step 2: Check with Google Vision (if configured)
      const visionResult = await this.checkWithVision(imageUrl);

      if (visionResult) {
        return this.formatVisionResult(visionResult);
      }

      // Step 3: Fallback to local analysis
      return await this.localModerationCheck(imageUrl);
    } catch (error) {
      logger.error('Image moderation failed', {
        imageUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return safe on error to avoid blocking legitimate content
      return {
        safe: true,
        categories: [],
        labels: [],
        confidence: 0,
        requiresReview: false,
        autoAction: 'allow',
      };
    }
  }

  /**
   * Check with AWS Rekognition
   */
  private async checkWithRekognition(imageUrl: string): Promise<any | null> {
    // In production, use AWS SDK:
    // const rekognition = new AWS.Rekognition();
    // const result = await rekognition.detectModerationLabels({
    //   Image: { S3Object: { Bucket, Name } } or { Url: imageUrl },
    //   MinConfidence: 50,
    // }).promise();

    // Check if AWS is configured
    if (!process.env.AWS_REKOGNITION_ENABLED) {
      return null;
    }

    try {
      // Simulated response
      return null; // Would return actual result
    } catch (error) {
      logger.warn('Rekognition check failed, falling back', { error });
      return null;
    }
  }

  /**
   * Check with Google Vision AI
   */
  private async checkWithVision(imageUrl: string): Promise<any | null> {
    // In production, use Google Cloud Vision:
    // const vision = new Vision.ImageAnnotatorClient();
    // const [result] = await vision.safeSearchDetection(imageUrl);

    if (!process.env.GOOGLE_VISION_ENABLED) {
      return null;
    }

    try {
      // Simulated response
      return null;
    } catch (error) {
      logger.warn('Vision check failed, falling back', { error });
      return null;
    }
  }

  /**
   * Local moderation check (fallback)
   */
  private async localModerationCheck(imageUrl: string): Promise<ModerationResult> {
    // In production, would use a local ML model or third-party API
    // For now, return safe result

    return {
      safe: true,
      categories: [],
      labels: [],
      confidence: 0,
      requiresReview: false,
      autoAction: 'allow',
    };
  }

  /**
   * Format Rekognition result
   */
  private formatRekognitionResult(result: any): ModerationResult {
    const categories: ModerationCategory[] = [];
    const labels: ModerationLabel[] = [];
    let maxConfidence = 0;

    for (const label of result.ModerationLabels || []) {
      const confidence = label.Confidence / 100;

      if (confidence > maxConfidence) {
        maxConfidence = confidence;
      }

      categories.push({
        name: label.ParentName || label.Name,
        confidence,
      });

      labels.push({
        name: label.Name,
        confidence,
        parent: label.ParentName,
        categories: [label.ParentName, label.Name],
      });
    }

    const safe = maxConfidence < THRESHOLDS.requireReview;
    const requiresReview = maxConfidence >= THRESHOLDS.requireReview && maxConfidence < THRESHOLDS.autoReject;

    let autoAction: 'allow' | 'blur' | 'reject' | undefined;
    if (maxConfidence >= THRESHOLDS.autoReject) {
      autoAction = 'reject';
    } else if (maxConfidence >= THRESHOLDS.autoBlur) {
      autoAction = 'blur';
    } else if (maxConfidence < THRESHOLDS.requireReview) {
      autoAction = 'allow';
    }

    return {
      safe,
      categories,
      labels,
      confidence: maxConfidence,
      requiresReview,
      autoAction,
    };
  }

  /**
   * Format Google Vision result
   */
  private formatVisionResult(result: any): ModerationResult {
    const categories: ModerationCategory[] = [];
    const labels: ModerationLabel[] = [];
    let maxConfidence = 0;

    const safeSearch = result.safeSearchAnnotation || {};

    // Map Vision likelihood to confidence
    const likelihoodMap: Record<string, number> = {
      UNKNOWN: 0,
      VERY_UNLIKELY: 0.1,
      UNLIKELY: 0.3,
      POSSIBLE: 0.5,
      LIKELY: 0.7,
      VERY_LIKELY: 0.9,
    };

    const checks = [
      { name: 'Adult', value: safeSearch.adult },
      { name: 'Violence', value: safeSearch.violence },
      { name: 'Racy', value: safeSearch.racy },
      { name: 'Spoof', value: safeSearch.spoof },
      { name: 'Medical', value: safeSearch.medical },
    ];

    for (const check of checks) {
      const confidence = likelihoodMap[check.value] || 0;

      if (confidence > maxConfidence) {
        maxConfidence = confidence;
      }

      if (confidence > 0.3) {
        categories.push({
          name: check.name,
          confidence,
        });

        labels.push({
          name: check.name,
          confidence,
          categories: [check.name],
        });
      }
    }

    const safe = maxConfidence < THRESHOLDS.requireReview;
    const requiresReview = maxConfidence >= THRESHOLDS.requireReview && maxConfidence < THRESHOLDS.autoReject;

    return {
      safe,
      categories,
      labels,
      confidence: maxConfidence,
      requiresReview,
    };
  }

  // ========================================
  // Upload Flow Integration
  // ========================================

  /**
   * Check image during upload
   */
  async checkUpload(
    imageUrl: string,
    uploadedBy: string
  ): Promise<ImageModerationCheck> {
    const result = await this.moderateImage(imageUrl);

    let action: ImageModerationCheck['action'] = 'allow';

    if (result.autoAction === 'reject' || result.confidence >= THRESHOLDS.autoReject) {
      action = 'reject';

      // Add to human review queue for confirmation
      await this.addToReviewQueue(imageUrl, uploadedBy, result);
    } else if (result.autoAction === 'blur' || result.confidence >= THRESHOLDS.autoBlur) {
      action = 'blur';
      await this.addToReviewQueue(imageUrl, uploadedBy, result);
    } else if (result.requiresReview || result.confidence >= THRESHOLDS.requireReview) {
      action = 'review';
      await this.addToReviewQueue(imageUrl, uploadedBy, result);
    }

    // Log the check
    await createAuditLog({
      userId: uploadedBy,
      action: action === 'allow' ? 'IMAGE_MODERATION_PASSED' : 'IMAGE_MODERATION_FLAGGED',
      resource: 'image_moderation',
      resourceId: imageUrl,
      details: {
        confidence: result.confidence,
        categories: result.categories.map((c) => c.name),
        action,
      },
      status: 'success',
    });

    return {
      imageUrl,
      uploadedBy,
      result,
      action,
    };
  }

  // ========================================
  // Human Review Queue
  // ========================================

  /**
   * Add image to human review queue
   */
  private async addToReviewQueue(
    imageUrl: string,
    uploadedBy: string,
    result: ModerationResult
  ): Promise<void> {
    // In production, create ReviewQueue model/document
    logger.info('Image added to review queue', {
      imageUrl,
      uploadedBy,
      confidence: result.confidence,
      categories: result.categories.map((c) => c.name),
    });
  }

  /**
   * Get pending review items
   */
  async getPendingReviews(options?: {
    limit?: number;
    priority?: HumanReviewQueueItem['priority'];
  }): Promise<HumanReviewQueueItem[]> {
    // In production, query ReviewQueue model
    // Filter by priority if specified
    return [];
  }

  /**
   * Submit human review decision
   */
  async submitReview(
    reviewId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string,
    notes?: string
  ): Promise<void> {
    // Update review queue item
    // Update provider verification if needed

    await createAuditLog({
      userId: reviewedBy,
      action: decision === 'approved' ? 'IMAGE_APPROVED' : 'IMAGE_REJECTED',
      resource: 'image_moderation',
      resourceId: reviewId,
      details: { notes },
      status: 'success',
    });

    logger.info('Image review submitted', {
      reviewId,
      decision,
      reviewedBy,
      notes,
    });
  }

  // ========================================
  // Provider Portfolio Moderation
  // ========================================

  /**
   * Moderate entire provider portfolio
   */
  async moderatePortfolio(providerId: string): Promise<{
    totalImages: number;
    flaggedImages: number;
    approvedImages: number;
    results: ImageModerationCheck[];
  }> {
    const provider = await ProviderProfile.findOne({ userId: providerId })
      .select('portfolioImages profileImages coverImage');

    if (!provider) {
      throw new Error('Provider not found');
    }

    const allImages: string[] = [];

    // Collect all images
    if (provider.portfolioImages) {
      allImages.push(...provider.portfolioImages.map((p: any) => p.url));
    }
    if (provider.profileImages) {
      allImages.push(...provider.profileImages.map((p: any) => p.url));
    }
    if (provider.coverImage) {
      allImages.push(provider.coverImage);
    }

    const results: ImageModerationCheck[] = [];
    let flaggedImages = 0;
    let approvedImages = 0;

    // Moderate each image
    for (const imageUrl of allImages) {
      const check = await this.checkUpload(imageUrl, providerId);

      results.push(check);

      if (check.action === 'allow') {
        approvedImages++;
      } else {
        flaggedImages++;
      }
    }

    // Flag provider if too many issues
    if (flaggedImages > allImages.length * 0.5) {
      await this.flagProvider(providerId, flaggedImages, allImages.length);
    }

    return {
      totalImages: allImages.length,
      flaggedImages,
      approvedImages,
      results,
    };
  }

  /**
   * Flag provider for content issues
   */
  private async flagProvider(
    providerId: string,
    flaggedCount: number,
    totalCount: number
  ): Promise<void> {
    let verification = await ProviderVerification.findOne({ providerId });

    if (verification) {
      verification.fraudFlags.push({
        type: 'inappropriate_content',
        severity: flaggedCount > totalCount * 0.8 ? 'high' : 'medium',
        description: `${flaggedCount}/${totalCount} images flagged by moderation`,
        detectedAt: new Date(),
        resolved: false,
      });
      await verification.save();
    } else {
      await ProviderVerification.create({
        providerId,
        status: 'pending',
        fraudFlags: [{
          type: 'inappropriate_content',
          severity: flaggedCount > totalCount * 0.8 ? 'high' : 'medium',
          description: `${flaggedCount}/${totalCount} images flagged by moderation`,
          detectedAt: new Date(),
          resolved: false,
        }],
      });
    }

    logger.warn('Provider flagged for content issues', {
      providerId,
      flaggedCount,
      totalCount,
    });
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get moderation statistics
   */
  async getStats(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<ModerationStats> {
    // In production, query moderation logs
    return {
      totalProcessed: 0,
      totalFlagged: 0,
      totalAutoRejected: 0,
      totalHumanReviews: 0,
      approvalRate: 100,
      topCategories: [],
    };
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(): Promise<Array<{
    category: string;
    count: number;
    avgConfidence: number;
  }>> {
    // In production, aggregate from moderation logs
    return [];
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Check if content is inappropriate
   */
  isAdultContent(categories: ModerationCategory[]): boolean {
    return categories.some((c) =>
      ADULT_CATEGORIES.some((ac) =>
        c.name.toLowerCase().includes(ac.toLowerCase())
      ) && c.confidence >= THRESHOLDS.requireReview
    );
  }

  /**
   * Check if content is violent
   */
  isViolentContent(categories: ModerationCategory[]): boolean {
    return categories.some((c) =>
      VIOLENT_CATEGORIES.some((vc) =>
        c.name.toLowerCase().includes(vc.toLowerCase())
      ) && c.confidence >= THRESHOLDS.requireReview
    );
  }

  /**
   * Check if content is sensitive
   */
  isSensitiveContent(categories: ModerationCategory[]): boolean {
    return categories.some((c) =>
      SENSITIVE_CATEGORIES.some((sc) =>
        c.name.toLowerCase().includes(sc.toLowerCase())
      ) && c.confidence >= THRESHOLDS.requireReview
    );
  }
}

// Export singleton instance
export const imageModerationService = new ImageModerationService();
export default imageModerationService;
