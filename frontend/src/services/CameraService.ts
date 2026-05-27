import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { ImageOptions } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
// FIX #12: Import ImageOptimizer for compression
import { imageOptimizer, type CompressionOptions } from '../lib/ImageOptimizer';

/**
 * Configuration options for camera operations
 */
export interface CameraOptions {
  /** Image quality (0-100) */
  quality?: number;
  /** Maximum width in pixels */
  width?: number;
  /** Maximum height in pixels */
  height?: number;
  /** Whether to preserve aspect ratio */
  preserveAspectRatio?: boolean;
  /** Whether to compress the image (default: true) */
  compress?: boolean;
  /** Compression options */
  compressionOptions?: CompressionOptions;
}

/**
 * Result of a camera operation
 */
export interface CameraResult {
  /** Base64 encoded image data */
  base64Data?: string;
  /** File path to the saved image (if saved to filesystem) */
  filePath?: string;
  /** MIME type of the image */
  mimeType: string;
  /** Original filename */
  filename: string;
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Service for handling camera and photo library operations.
 * Works on both native (Android/iOS) and web platforms.
 */
class CameraService {
  private readonly DEFAULT_QUALITY = 85;
  private readonly DEFAULT_WIDTH = 1920;
  private readonly DEFAULT_HEIGHT = 1080;

  /**
   * Take a photo using the device camera.
   * @param options - Optional camera configuration
   * @returns Promise resolving to the captured image data
   * @throws Error if camera is not available or permission denied
   */
  async takePhoto(options: CameraOptions = {}): Promise<CameraResult> {
    const {
      quality = this.DEFAULT_QUALITY,
      width = this.DEFAULT_WIDTH,
      height = this.DEFAULT_HEIGHT,
      compress = true,
      compressionOptions
    } = options;

    if (!Capacitor.isNativePlatform()) {
      return this.takePhotoWeb(options);
    }

    try {
      const imageOptions: ImageOptions = {
        quality,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
        width,
        height,
      };

      const photo = await Camera.getPhoto(imageOptions);

      let base64Data = photo.base64String;

      // FIX #12: Compress the image if enabled
      if (compress && base64Data) {
        try {
          // Convert base64 to blob for compression
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: `image/${photo.format || 'jpeg'}` });
          const file = new File([blob], `photo_${Date.now()}.${photo.format || 'jpg'}`, {
            type: `image/${photo.format || 'jpeg'}`,
          });

          // Compress using ImageOptimizer
          const optimized = await imageOptimizer.compressToBase64(file, {
            maxWidth: width,
            maxHeight: height,
            maxSize: (compressionOptions?.maxSize) || (1 * 1024 * 1024), // 1MB default
            quality: compressionOptions?.quality || 0.8,
            type: 'photo',
            ...compressionOptions,
          });

          base64Data = optimized;
          console.log('[CameraService] Image compressed successfully');
        } catch (compressionError) {
          // If compression fails, use original - don't fail the photo capture
          console.warn('[CameraService] Image compression failed, using original:', compressionError);
        }
      }

      return {
        base64Data,
        mimeType: photo.format || 'jpeg',
        filename: `photo_${Date.now()}.${photo.format || 'jpg'}`,
        dimensions: photo.exif
          ? { width: photo.exif.WidthPixel || width, height: photo.exif.HeightPixel || height }
          : undefined,
      };
    } catch (error) {
      console.error('[CameraService] takePhoto failed:', error);
      throw this.handleCameraError(error);
    }
  }

  /**
   * Pick an image from the device's photo library/gallery.
   * @param options - Optional camera configuration
   * @returns Promise resolving to the selected image data
   * @throws Error if photo library is not available or permission denied
   */
  async pickFromGallery(options: CameraOptions = {}): Promise<CameraResult> {
    const {
      quality = this.DEFAULT_QUALITY,
      width = this.DEFAULT_WIDTH,
      height = this.DEFAULT_HEIGHT,
      compress = true,
      compressionOptions
    } = options;

    if (!Capacitor.isNativePlatform()) {
      return this.pickFromGalleryWeb(options);
    }

    try {
      const imageOptions: ImageOptions = {
        quality,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        correctOrientation: true,
        width,
        height,
      };

      const photo = await Camera.getPhoto(imageOptions);

      let base64Data = photo.base64String;

      // FIX #12: Compress the image if enabled
      if (compress && base64Data) {
        try {
          // Convert base64 to blob for compression
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: `image/${photo.format || 'jpeg'}` });
          const file = new File([blob], `gallery_${Date.now()}.${photo.format || 'jpg'}`, {
            type: `image/${photo.format || 'jpeg'}`,
          });

          // Compress using ImageOptimizer
          const optimized = await imageOptimizer.compressToBase64(file, {
            maxWidth: width,
            maxHeight: height,
            maxSize: (compressionOptions?.maxSize) || (1 * 1024 * 1024), // 1MB default
            quality: compressionOptions?.quality || 0.8,
            type: 'photo',
            ...compressionOptions,
          });

          base64Data = optimized;
          console.log('[CameraService] Image compressed successfully');
        } catch (compressionError) {
          // If compression fails, use original - don't fail the photo capture
          console.warn('[CameraService] Image compression failed, using original:', compressionError);
        }
      }

      return {
        base64Data,
        mimeType: photo.format || 'jpeg',
        filename: `gallery_${Date.now()}.${photo.format || 'jpg'}`,
        dimensions: photo.exif
          ? { width: photo.exif.WidthPixel || width, height: photo.exif.HeightPixel || height }
          : undefined,
      };
    } catch (error) {
      console.error('[CameraService] pickFromGallery failed:', error);
      throw this.handleCameraError(error);
    }
  }

  /**
   * Save an image to the device's app-specific directory.
   * @param base64Data - Base64 encoded image data
   * @param filename - Name for the saved file
   * @returns Promise resolving to the file path
   */
  async saveToAppDirectory(base64Data: string, filename: string): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
      // Web: store in IndexedDB or localStorage (limited)
      const dataUrl = `data:image/jpeg;base64,${base64Data}`;
      localStorage.setItem(`photo_${filename}`, dataUrl);
      return dataUrl;
    }

    try {
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Data,
      });

      return savedFile.uri;
    } catch (error) {
      console.error('[CameraService] saveToAppDirectory failed:', error);
      throw new Error('Failed to save image to app directory');
    }
  }

  /**
   * Read an image from the app directory.
   * @param filepath - Path to the image file
   * @returns Promise resolving to base64 encoded image data
   */
  async readFromAppDirectory(filepath: string): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
      // Web: retrieve from localStorage
      const dataUrl = localStorage.getItem(`photo_${filepath}`);
      if (dataUrl) {
        return dataUrl.replace(/^data:image\/\w+;base64,/, '');
      }
      throw new Error('Image not found in local storage');
    }

    try {
      const contents = await Filesystem.readFile({
        path: filepath,
        directory: Directory.Data,
      });

      // Filesystem.readFile returns base64 string data
      const data = contents.data as string;
      return data;
    } catch (error) {
      console.error('[CameraService] readFromAppDirectory failed:', error);
      throw new Error('Failed to read image from app directory');
    }
  }

  /**
   * Delete an image from the app directory.
   * @param filepath - Path to the image file
   */
  async deleteFromAppDirectory(filepath: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      localStorage.removeItem(`photo_${filepath}`);
      return;
    }

    try {
      await Filesystem.deleteFile({
        path: filepath,
        directory: Directory.Data,
      });
    } catch (error) {
      console.error('[CameraService] deleteFromAppDirectory failed:', error);
      throw new Error('Failed to delete image from app directory');
    }
  }

  /**
   * Check if the camera is available on this device.
   */
  async isCameraAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    try {
      const status = await Camera.checkPermissions();
      return status.camera !== 'denied';
    } catch {
      return false;
    }
  }

  /**
   * Check if photo library access is available on this device.
   */
  async isPhotoLibraryAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    try {
      const status = await Camera.checkPermissions();
      return status.photos !== 'denied';
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Web Platform Fallbacks
  // =========================================================================

  private async takePhotoWeb(options: CameraOptions): Promise<CameraResult> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const base64 = await this.fileToBase64(file);
          const dimensions = await this.getImageDimensions(file);

          resolve({
            base64Data: base64,
            mimeType: file.type || 'image/jpeg',
            filename: file.name || `photo_${Date.now()}.jpg`,
            dimensions,
          });
        } catch (error) {
          reject(error);
        }
      };

      input.oncancel = () => {
        reject(new Error('User cancelled photo capture'));
      };

      input.click();
    });
  }

  private async pickFromGalleryWeb(options: CameraOptions): Promise<CameraResult> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const base64 = await this.fileToBase64(file);
          const dimensions = await this.getImageDimensions(file);

          resolve({
            base64Data: base64,
            mimeType: file.type || 'image/jpeg',
            filename: file.name || `gallery_${Date.now()}.jpg`,
            dimensions,
          });
        } catch (error) {
          reject(error);
        }
      };

      input.oncancel = () => {
        reject(new Error('User cancelled gallery selection'));
      };

      input.click();
    });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get pure base64
        const base64 = result.replace(/^data:image\/\w+;base64,/, '');
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  // =========================================================================
  // Error Handling
  // =========================================================================

  private handleCameraError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('permission') || message.includes('denied')) {
        return new Error('Camera permission denied. Please enable camera access in settings.');
      }
      if (message.includes('cancelled') || message.includes('cancel')) {
        return new Error('Photo capture was cancelled');
      }
      if (message.includes('not available')) {
        return new Error('Camera is not available on this device');
      }

      return error;
    }

    return new Error('An unexpected error occurred while capturing the photo');
  }
}

// Export singleton instance
export const cameraService = new CameraService();
export default cameraService;
