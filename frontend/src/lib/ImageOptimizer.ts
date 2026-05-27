/**
 * ImageOptimizer.ts - Image compression and optimization for NILIN app
 * Compresses images before upload, supports JPEG, PNG, WebP
 */

export interface CompressionOptions {
  /** Maximum width in pixels (default: 1920) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 1920) */
  maxHeight?: number;
  /** Maximum file size in bytes (default: 1MB = 1024 * 1024) */
  maxSize?: number;
  /** Output format: 'jpeg' | 'png' | 'webp' | 'auto' (default: 'auto') */
  format?: 'jpeg' | 'png' | 'webp' | 'auto';
  /** Quality for lossy compression (0-1, default: 0.8 for photos, 0.9 for UI) */
  quality?: number;
  /** Image type: 'photo' | 'ui' (affects default quality) */
  type?: 'photo' | 'ui';
  /** Maintain aspect ratio (default: true) */
  maintainAspectRatio?: boolean;
}

export interface OptimizationResult {
  /** Compressed blob */
  blob: Blob;
  /** Original file size */
  originalSize: number;
  /** Compressed file size */
  compressedSize: number;
  /** Compression ratio (0-1, lower is better) */
  compressionRatio: number;
  /** Original dimensions */
  originalWidth: number;
  originalHeight: number;
  /** Compressed dimensions */
  width: number;
  height: number;
  /** Output format used */
  format: string;
  /** Number of iterations needed to reach target size */
  iterations: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'format' | 'type'>> & {
  format: NonNullable<CompressionOptions['format']>;
  type: NonNullable<CompressionOptions['type']>;
} = {
  maxWidth: 1920,
  maxHeight: 1920,
  maxSize: 1024 * 1024, // 1MB
  format: 'auto',
  quality: 0.8,
  type: 'photo',
  maintainAspectRatio: true,
};

class ImageOptimizerService {
  private static instance: ImageOptimizerService;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private options: Required<Omit<CompressionOptions, 'format' | 'type'>> & {
    format: NonNullable<CompressionOptions['format']>;
    type: NonNullable<CompressionOptions['type']>;
  };

  private constructor(options: CompressionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: CompressionOptions): ImageOptimizerService {
    if (!ImageOptimizerService.instance) {
      ImageOptimizerService.instance = new ImageOptimizerService(options);
    }
    return ImageOptimizerService.instance;
  }

  /**
   * Reset singleton instance
   */
  public static resetInstance(): void {
    ImageOptimizerService.instance = undefined as unknown as ImageOptimizerService;
  }

  /**
   * Compress an image file
   */
  public async compress(file: File, options?: CompressionOptions): Promise<OptimizationResult> {
    // Merge options
    const opts = this.mergeOptions(options);

    // Validate file type
    if (!this.isValidImageType(file)) {
      throw new Error(`Unsupported image type: ${file.type}. Supported: JPEG, PNG, WebP`);
    }

    // Get image dimensions
    const originalDimensions = await this.getImageDimensions(file);

    // Calculate target dimensions
    const targetDimensions = this.calculateDimensions(
      originalDimensions,
      opts.maxWidth,
      opts.maxHeight,
      opts.maintainAspectRatio
    );

    // Set canvas size
    this.canvas.width = targetDimensions.width;
    this.canvas.height = targetDimensions.height;

    // Load image
    const img = await this.loadImage(file);

    // Clear and draw
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(
        img,
        0,
        0,
        targetDimensions.width,
        targetDimensions.height
      );
    }

    // Determine output format
    const outputFormat = this.getOutputFormat(file, opts.format);

    // Determine quality
    const quality = opts.type === 'ui' ? 0.9 : 0.8;

    // Compress with iterative approach to meet size constraint
    let compressedBlob = await this.blobFromCanvas(outputFormat, quality);
    let iterations = 1;

    // Iteratively reduce quality until we meet size constraint
    while (compressedBlob.size > opts.maxSize && quality > 0.1) {
      const newQuality = quality - 0.1;
      compressedBlob = await this.blobFromCanvas(outputFormat, newQuality);
      iterations++;

      // Prevent infinite loop
      if (iterations > 20) {
        break;
      }
    }

    // If still too large and dimensions are large, resize
    if (compressedBlob.size > opts.maxSize) {
      let scaleFactor = 0.9;
      let tempWidth = targetDimensions.width;
      let tempHeight = targetDimensions.height;

      while (compressedBlob.size > opts.maxSize && scaleFactor > 0.1) {
        tempWidth = Math.round(tempWidth * scaleFactor);
        tempHeight = Math.round(tempHeight * scaleFactor);

        this.canvas.width = tempWidth;
        this.canvas.height = tempHeight;

        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.drawImage(img, 0, 0, tempWidth, tempHeight);
        }

        compressedBlob = await this.blobFromCanvas(outputFormat, quality);
        iterations++;
        scaleFactor -= 0.1;

        if (iterations > 30) {
          break;
        }
      }

      targetDimensions.width = tempWidth;
      targetDimensions.height = tempHeight;
    }

    return {
      blob: compressedBlob,
      originalSize: file.size,
      compressedSize: compressedBlob.size,
      compressionRatio: compressedBlob.size / file.size,
      originalWidth: originalDimensions.width,
      originalHeight: originalDimensions.height,
      width: targetDimensions.width,
      height: targetDimensions.height,
      format: outputFormat,
      iterations,
    };
  }

  /**
   * Compress and return as data URL
   */
  public async compressToDataURL(file: File, options?: CompressionOptions): Promise<string> {
    const result = await this.compress(file, options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(result.blob);
    });
  }

  /**
   * Compress and return as base64
   */
  public async compressToBase64(file: File, options?: CompressionOptions): Promise<string> {
    const dataURL = await this.compressToDataURL(file, options);
    return dataURL.split(',')[1];
  }

  /**
   * Get optimal size recommendations for an image
   */
  public async getOptimalSize(image: File | HTMLImageElement | string): Promise<{
    recommendedWidth: number;
    recommendedHeight: number;
    estimatedOriginalSize: number;
    recommendedSize: number;
  }> {
    let dimensions: ImageDimensions;
    let originalSize: number;

    if (typeof image === 'string') {
      // URL or data URL
      dimensions = await this.getImageDimensionsFromURL(image);
      originalSize = 0; // Unknown
    } else if (image instanceof File) {
      dimensions = await this.getImageDimensions(image);
      originalSize = image.size;
    } else {
      dimensions = { width: image.width, height: image.height };
      originalSize = 0; // Unknown
    }

    // Calculate recommended dimensions based on common use cases
    const useCaseWidths = [320, 640, 1024, 1920];
    let recommendedWidth = dimensions.width;

    for (const width of useCaseWidths) {
      if (dimensions.width > width) {
        recommendedWidth = width;
      } else {
        break;
      }
    }

    // Maintain aspect ratio
    const aspectRatio = dimensions.height / dimensions.width;
    const recommendedHeight = Math.round(recommendedWidth * aspectRatio);

    // Estimated recommended size (rough calculation)
    // Assuming 80% compression and average bits per pixel
    const recommendedSize = Math.round(
      recommendedWidth * recommendedHeight * aspectRatio * 0.5
    );

    return {
      recommendedWidth,
      recommendedHeight,
      estimatedOriginalSize: originalSize,
      recommendedSize,
    };
  }

  /**
   * Check if image needs compression
   */
  public needsCompression(file: File, options?: CompressionOptions): {
    needsCompression: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Check file size
    if (file.size > (options?.maxSize ?? DEFAULT_OPTIONS.maxSize)) {
      reasons.push(`File size (${this.formatBytes(file.size)}) exceeds limit (${this.formatBytes(options?.maxSize ?? DEFAULT_OPTIONS.maxSize)})`);
    }

    // Check dimensions
    if (options?.maxWidth || options?.maxHeight) {
      // We can't check dimensions without loading the image synchronously
      // This is just a preliminary check
      reasons.push('Dimensions may exceed limits');
    }

    return {
      needsCompression: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Resize image to specific dimensions
   */
  public async resize(file: File, width: number, height: number): Promise<Blob> {
    const img = await this.loadImage(file);

    this.canvas.width = width;
    this.canvas.height = height;

    if (this.ctx) {
      this.ctx.clearRect(0, 0, width, height);
      this.ctx.drawImage(img, 0, 0, width, height);
    }

    return this.blobFromCanvas('png', 1);
  }

  /**
   * Create thumbnail from image
   */
  public async createThumbnail(
    file: File,
    maxSize: number = 150
  ): Promise<Blob> {
    const dimensions = await this.getImageDimensions(file);

    // Calculate thumbnail dimensions
    let thumbWidth: number;
    let thumbHeight: number;

    if (dimensions.width > dimensions.height) {
      thumbWidth = Math.min(maxSize, dimensions.width);
      thumbHeight = Math.round((dimensions.height / dimensions.width) * thumbWidth);
    } else {
      thumbHeight = Math.min(maxSize, dimensions.height);
      thumbWidth = Math.round((dimensions.width / dimensions.height) * thumbHeight);
    }

    return this.resize(file, thumbWidth, thumbHeight);
  }

  /**
   * Validate image type
   */
  private isValidImageType(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    return validTypes.includes(file.type);
  }

  /**
   * Get image dimensions from file
   */
  private getImageDimensions(file: File): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Get image dimensions from URL
   */
  private getImageDimensionsFromURL(url: string): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Load image from file
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Calculate dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    original: ImageDimensions,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean
  ): ImageDimensions {
    if (!maintainAspectRatio) {
      return { width: maxWidth, height: maxHeight };
    }

    let width = original.width;
    let height = original.height;

    // Scale down if necessary
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    return { width, height };
  }

  /**
   * Determine output format
   */
  private getOutputFormat(file: File, preferredFormat: string): string {
    if (preferredFormat !== 'auto') {
      // Map to MIME type
      const mimeTypes: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      return mimeTypes[preferredFormat] || file.type;
    }

    // Auto: prefer WebP if supported, otherwise use original
    if (this.isWebPSupported()) {
      return 'image/webp';
    }

    return file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  /**
   * Check if WebP is supported
   */
  private isWebPSupported(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Create blob from canvas
   */
  private blobFromCanvas(format: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        format as BlobPropertyBag['type'],
        quality
      );
    });
  }

  /**
   * Merge options with defaults
   */
  private mergeOptions(options?: CompressionOptions): Required<CompressionOptions> {
    const opts = { ...this.options, ...options };

    // Set type-based quality if specified
    if (options?.type) {
      opts.quality = options.type === 'ui' ? 0.9 : 0.8;
    }

    return opts as Required<CompressionOptions>;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const imageOptimizer = ImageOptimizerService.getInstance();

// Export class
export { ImageOptimizerService };

// Default export
export default imageOptimizer;

// ============================================================================
// CDN Image Optimization Utilities (for Cloudinary URLs)
// ============================================================================

// Adaptive quality based on image size
const getQuality = (width: number): number => {
  if (width <= 400) return 0.8;  // Small: higher quality
  if (width <= 800) return 0.7;  // Medium
  return 0.6;                     // Large: lower quality for savings
};

// Generate responsive image URL for Cloudinary
// Note: Requires cloudinary.ts from backend to be ported or used via API
// This uses the transformation string format compatible with Cloudinary
export const generateResponsiveUrl = (
  publicId: string,
  baseUrl: string,
  width: number
): string => {
  const quality = getQuality(width);
  // Cloudinary transformation URL format
  const transformation = `w_${width},c_fill,q_${Math.round(quality * 100)},f_auto`;

  // Parse base URL to inject transformation
  // Expected format: https://res.cloudinary.com/{cloud}/image/upload/{publicId}
  const parts = baseUrl.split('/upload/');
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformation}/${parts[1]}`;
  }

  // Fallback: return original URL if format doesn't match
  return baseUrl;
};

// Generate srcset for responsive images
export const generateSrcSet = (
  publicId: string,
  baseUrl: string
): string => {
  const widths = [200, 400, 600, 800, 1200];
  return widths
    .map(w => `${generateResponsiveUrl(publicId, baseUrl, w)} ${w}w`)
    .join(', ');
};

// Generate picture source for art direction with different crops
export const generatePictureSources = (
  publicId: string,
  baseUrl: string,
  options: {
    mobileWidth?: number;
    tabletWidth?: number;
    desktopWidth?: number;
  } = {}
): { media: string; srcset: string }[] => {
  const { mobileWidth = 400, tabletWidth = 800, desktopWidth = 1200 } = options;

  return [
    {
      media: '(max-width: 480px)',
      srcset: generateResponsiveUrl(publicId, baseUrl, mobileWidth),
    },
    {
      media: '(max-width: 768px)',
      srcset: generateResponsiveUrl(publicId, baseUrl, tabletWidth),
    },
    {
      media: '(min-width: 769px)',
      srcset: generateResponsiveUrl(publicId, baseUrl, desktopWidth),
    },
  ];
};

// Lazy loading helper - generates low-quality placeholder URL
export const generatePlaceholderUrl = (
  baseUrl: string,
  placeholderWidth: number = 50
): string => {
  const transformation = `w_${placeholderWidth},c_fill,q_10,f_auto,fl_blur`;
  const parts = baseUrl.split('/upload/');
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformation}/${parts[1]}`;
  }
  return baseUrl;
};

// Video thumbnail URL generator
export const generateVideoThumbnail = (
  publicId: string,
  baseUrl: string,
  time: number = 1
): string => {
  const transformation = `so_${time},w_800,c_fill,q_auto,f_jpg`;
  const parts = baseUrl.split('/upload/');
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformation}/${parts[1]}`;
  }
  return baseUrl;
};

// Get optimized URL based on device pixel ratio
export const getOptimizedUrlForDPR = (
  baseUrl: string,
  baseWidth: number,
  dpr: number = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
): string => {
  const optimizedWidth = Math.round(baseWidth * Math.min(dpr, 2)); // Cap at 2x
  return generateResponsiveUrl('', baseUrl, optimizedWidth);
};
