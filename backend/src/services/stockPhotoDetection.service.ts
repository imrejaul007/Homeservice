/**
 * Stock Photo Detection Service
 * Detects stock images, copied photos, and fake imagery
 */

import axios from 'axios';
import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import ProviderVerification from '../models/providerVerification.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface ImageAnalysisResult {
  isStock: boolean;
  isCopied: boolean;
  confidence: number;
  matchSource?: string;
  matchUrl?: string;
  detectedAt: Date;
}

export interface StockPhotoCheck {
  providerId: string;
  imageUrl: string;
  result: ImageAnalysisResult;
  action: 'allow' | 'warn' | 'flag' | 'remove';
}

export interface PortfolioAudit {
  providerId: string;
  totalImages: number;
  stockImages: number;
  copiedImages: number;
  originalImages: number;
  suspiciousScore: number;
  flaggedImages: Array<{
    imageUrl: string;
    reason: string;
    matchSource?: string;
  }>;
  recommendations: string[];
  auditedAt: Date;
}

export interface FakeImageIndicators {
  indicators: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  hasMetadata: boolean;
  hasEXIF: boolean;
  creationDate?: Date;
  software?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
}

// ============================================
// Stock Photo Database (Partial List)
// ============================================

const STOCK_PHOTO_PROVIDERS = [
  'shutterstock',
  'gettyimages',
  'istockphoto',
  'alamy',
  'dreamstime',
  'fotolia',
  'depositphotos',
  '123rf',
  'bigstockphoto',
  'canstockphoto',
  'pexels',
  'unsplash',
  'pixabay',
  'freepik',
  'adobe stock',
  '500px',
  '视觉中国',
  '全景网',
  '汇图网',
];

const STOCK_IMAGE_KEYWORDS = [
  'stock photo',
  'stock image',
  'royalty free',
  'getty images',
  'shutterstock',
  'istockphoto',
  'depositphotos',
];

// ============================================
// StockPhotoDetectionService Class
// ============================================

export class StockPhotoDetectionService {
  // ========================================
  // Image Analysis
  // ========================================

  /**
   * Analyze image for stock/copied detection
   */
  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    try {
      // Step 1: Extract and analyze metadata
      const metadata = await this.extractMetadata(imageUrl);

      // Step 2: Check for stock photo indicators
      const stockCheck = await this.checkStockDatabase(imageUrl);

      if (stockCheck.isStock) {
        return stockCheck;
      }

      // Step 3: Check for EXIF removal (indicates manipulation)
      if (this.checkEXIFRemoval(metadata)) {
        return {
          isStock: false,
          isCopied: true,
          confidence: 60,
          matchSource: 'exif_analysis',
          detectedAt: new Date(),
        };
      }

      // Step 4: Check for suspicious metadata patterns
      const metadataCheck = this.checkMetadataPatterns(metadata);
      if (metadataCheck.isSuspicious) {
        return {
          isStock: false,
          isCopied: true,
          confidence: metadataCheck.confidence,
          matchSource: 'metadata_analysis',
          detectedAt: new Date(),
        };
      }

      // Step 5: In production, use perceptual hashing
      // const phash = await this.calculatePerceptualHash(imageUrl);
      // const similarImages = await this.findSimilarImages(phash);

      return {
        isStock: false,
        isCopied: false,
        confidence: 0,
        detectedAt: new Date(),
      };
    } catch (error) {
      logger.error('Image analysis failed', {
        imageUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isStock: false,
        isCopied: false,
        confidence: 0,
        detectedAt: new Date(),
      };
    }
  }

  /**
   * Check image against stock photo providers
   */
  async checkStockDatabase(imageUrl: string): Promise<ImageAnalysisResult> {
    try {
      // Check URL patterns for known stock photo sites
      const urlLower = imageUrl.toLowerCase();

      for (const provider of STOCK_PHOTO_PROVIDERS) {
        if (urlLower.includes(provider.replace(/\s/g, ''))) {
          return {
            isStock: true,
            isCopied: false,
            confidence: 95,
            matchSource: provider,
            detectedAt: new Date(),
          };
        }
      }

      // In production, use reverse image search API:
      // Google Vision API
      // AWS Rekognition
      // TinEye API
      // Google Images reverse search

      return {
        isStock: false,
        isCopied: false,
        confidence: 0,
        detectedAt: new Date(),
      };
    } catch (error) {
      logger.error('Stock database check failed', { imageUrl });
      return {
        isStock: false,
        isCopied: false,
        confidence: 0,
        detectedAt: new Date(),
      };
    }
  }

  // ========================================
  // Metadata Analysis
  // ========================================

  /**
   * Extract image metadata
   */
  private async extractMetadata(imageUrl: string): Promise<ImageMetadata> {
    try {
      // In production, use sharp or exif-parser library
      // For now, return simulated metadata

      return {
        hasMetadata: true,
        hasEXIF: true,
        format: imageUrl.split('.').pop()?.toLowerCase() || 'jpg',
      };
    } catch (error) {
      return {
        hasMetadata: false,
        hasEXIF: false,
      };
    }
  }

  /**
   * Check for EXIF data removal (suspicious)
   */
  private checkEXIFRemoval(metadata: ImageMetadata): boolean {
    // If image has metadata but no EXIF, it may have been processed
    // to remove identifying information
    if (metadata.hasMetadata && !metadata.hasEXIF) {
      return true;
    }

    // Check for specific EXIF removal software
    if (metadata.software && /exiftool|imagew|exifpurge/i.test(metadata.software)) {
      return true;
    }

    return false;
  }

  /**
   * Check metadata patterns for suspicious indicators
   */
  private checkMetadataPatterns(metadata: ImageMetadata): {
    isSuspicious: boolean;
    confidence: number;
  } {
    // Very old creation date combined with new file = suspicious
    if (metadata.creationDate) {
      const age = Date.now() - metadata.creationDate.getTime();
      const oneYear = 365 * 24 * 60 * 60 * 1000;

      // If creation date is more than a year old, it's less suspicious
      // New photos from old dates might indicate fraud
      if (age > oneYear * 5) {
        return { isSuspicious: true, confidence: 40 };
      }
    }

    // Check for professional software (might indicate stock)
    if (metadata.software) {
      const professionalSoftware = [
        'adobe', 'photoshop', 'lightroom', 'capture one',
        'phase one', 'affinity', 'gimp', 'paint.net',
      ];

      for (const sw of professionalSoftware) {
        if (metadata.software.toLowerCase().includes(sw)) {
          return { isSuspicious: true, confidence: 20 };
        }
      }
    }

    return { isSuspicious: false, confidence: 0 };
  }

  // ========================================
  // Perceptual Hashing
  // ========================================

  /**
   * Calculate perceptual hash for image similarity
   * In production, use pHash or AWS Rekognition
   */
  async calculatePerceptualHash(imageUrl: string): Promise<string> {
    // In production:
    // 1. Download image
    // 2. Resize to small dimension (8x8)
    // 3. Convert to grayscale
    // 4. Calculate average color
    // 5. Create bit string
    // 6. Convert to hex hash

    // Simulated hash
    const hash = crypto.createHash('sha256')
      .update(imageUrl + Date.now())
      .digest('hex')
      .substring(0, 16);

    return hash;
  }

  /**
   * Find similar images using perceptual hash
   */
  async findSimilarImages(phash: string): Promise<Array<{
    imageUrl: string;
    similarity: number;
  }>> {
    // In production, query image database using pHash comparison
    // Hamming distance between hashes

    return [];
  }

  // ========================================
  // Portfolio Audit
  // ========================================

  /**
   * Audit provider's image portfolio
   */
  async auditPortfolio(providerId: string): Promise<PortfolioAudit> {
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

    const flaggedImages: PortfolioAudit['flaggedImages'] = [];
    let stockImages = 0;
    let copiedImages = 0;

    // Analyze each image
    for (const imageUrl of allImages) {
      const result = await this.analyzeImage(imageUrl);

      if (result.isStock) {
        stockImages++;
        flaggedImages.push({
          imageUrl,
          reason: `Stock photo detected from ${result.matchSource}`,
          matchSource: result.matchSource,
        });
      }

      if (result.isCopied) {
        copiedImages++;
        flaggedImages.push({
          imageUrl,
          reason: `Copied/image manipulation detected (${result.confidence}% confidence)`,
          matchSource: result.matchSource,
        });
      }
    }

    // Calculate suspicious score
    const totalImages = allImages.length;
    const suspiciousScore = totalImages > 0
      ? ((stockImages + copiedImages) / totalImages) * 100
      : 0;

    // Generate recommendations
    const recommendations: string[] = [];

    if (stockImages > 0) {
      recommendations.push(`${stockImages} stock photo(s) detected. Replace with genuine images of your work.`);
    }

    if (copiedImages > 0) {
      recommendations.push(`${copiedImages} potentially copied/manipulated image(s) detected.`);
    }

    if (suspiciousScore > 50) {
      recommendations.push('HIGH ALERT: Majority of portfolio appears suspicious. Manual review required.');
    } else if (suspiciousScore > 25) {
      recommendations.push('Several images flagged. Consider replacing with original photos.');
    }

    if (totalImages < 3) {
      recommendations.push('Add more images to demonstrate your work authentically.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfolio looks authentic. Continue building with original images.');
    }

    // Update provider verification record
    if (flaggedImages.length > 0) {
      await this.flagProviderPortfolio(providerId, flaggedImages, suspiciousScore);
    }

    return {
      providerId,
      totalImages,
      stockImages,
      copiedImages,
      originalImages: totalImages - stockImages - copiedImages,
      suspiciousScore: Math.round(suspiciousScore),
      flaggedImages,
      recommendations,
      auditedAt: new Date(),
    };
  }

  /**
   * Flag provider's portfolio in verification record
   */
  private async flagProviderPortfolio(
    providerId: string,
    flaggedImages: PortfolioAudit['flaggedImages'],
    suspiciousScore: number
  ): Promise<void> {
    let verification = await ProviderVerification.findOne({ providerId });

    if (verification) {
      verification.fraudFlags.push({
        type: 'fake_portfolio',
        severity: suspiciousScore > 50 ? 'high' : 'medium',
        description: `Stock/copied images detected: ${flaggedImages.length} flagged`,
        detectedAt: new Date(),
        resolved: false,
      });
      await verification.save();
    } else {
      await ProviderVerification.create({
        providerId,
        status: 'pending',
        fraudFlags: [{
          type: 'fake_portfolio',
          severity: suspiciousScore > 50 ? 'high' : 'medium',
          description: `Stock/copied images detected: ${flaggedImages.length} flagged`,
          detectedAt: new Date(),
          resolved: false,
        }],
      });
    }

    // Audit log
    await createAuditLog({
      userId: providerId,
      action: 'PORTFOLIO_FLAGGED',
      resource: 'stock_photo_detection',
      resourceId: providerId,
      details: {
        flaggedCount: flaggedImages.length,
        suspiciousScore,
      },
      status: 'success',
    });
  }

  // ========================================
  // Single Image Check
  // ========================================

  /**
   * Check single image for provider
   */
  async checkProviderImage(
    providerId: string,
    imageUrl: string
  ): Promise<StockPhotoCheck> {
    const result = await this.analyzeImage(imageUrl);

    let action: StockPhotoCheck['action'] = 'allow';

    if (result.isStock && result.confidence >= 80) {
      action = 'flag';
    } else if (result.isCopied && result.confidence >= 70) {
      action = 'warn';
    } else if (result.isStock || result.isCopied) {
      action = 'warn';
    }

    // Log if flagged
    if (action === 'flag' || action === 'warn') {
      await createAuditLog({
        userId: providerId,
        action: result.isStock ? 'STOCK_PHOTO_DETECTED' : 'COPIED_IMAGE_DETECTED',
        resource: 'stock_photo_detection',
        resourceId: imageUrl,
        details: {
          confidence: result.confidence,
          matchSource: result.matchSource,
          action,
        },
        status: 'success',
      });
    }

    return {
      providerId,
      imageUrl,
      result,
      action,
    };
  }

  // ========================================
  // Real-time Upload Check
  // ========================================

  /**
   * Pre-check image before allowing upload
   */
  async preUploadCheck(imageBuffer: Buffer): Promise<{
    allowed: boolean;
    warning?: string;
    severity: 'none' | 'low' | 'medium' | 'high';
  }> {
    try {
      // In production, analyze the buffer directly
      // Check file signature/magic bytes
      const signatures = {
        jpeg: [0xFF, 0xD8, 0xFF],
        png: [0x89, 0x50, 0x4E, 0x47],
        gif: [0x47, 0x49, 0x46],
      };

      const header = Array.from(imageBuffer.slice(0, 4));

      let format = 'unknown';
      for (const [name, sig] of Object.entries(signatures)) {
        if (sig.every((byte, i) => header[i] === byte)) {
          format = name;
          break;
        }
      }

      if (format === 'unknown') {
        return {
          allowed: false,
          severity: 'high',
        };
      }

      // Check file size
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return {
          allowed: false,
          warning: 'Image too large (max 10MB)',
          severity: 'medium',
        };
      }

      // Basic check passed
      return {
        allowed: true,
        severity: 'none',
      };
    } catch (error) {
      logger.error('Pre-upload check failed', { error });
      return {
        allowed: true, // Allow on error, do full check later
        severity: 'none',
      };
    }
  }

  // ========================================
  // Batch Processing
  // ========================================

  /**
   * Batch check multiple images
   */
  async batchCheckImages(
    images: Array<{ providerId: string; imageUrl: string }>
  ): Promise<Array<StockPhotoCheck>> {
    const results: Array<StockPhotoCheck> = [];

    for (const { providerId, imageUrl } of images) {
      const result = await this.checkProviderImage(providerId, imageUrl);
      results.push(result);
    }

    return results;
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(): Promise<{
    totalAudits: number;
    totalFlagged: number;
    averageSuspiciousScore: number;
    topFlaggedProviders: Array<{ providerId: string; score: number }>;
  }> {
    // In production, query verification records
    return {
      totalAudits: 0,
      totalFlagged: 0,
      averageSuspiciousScore: 0,
      topFlaggedProviders: [],
    };
  }
}

// Export singleton instance
export const stockPhotoDetectionService = new StockPhotoDetectionService();
export default stockPhotoDetectionService;
