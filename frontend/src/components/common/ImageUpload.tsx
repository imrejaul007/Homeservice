import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import authService from '../../services/AuthService';

interface UploadedImage {
  url: string;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

interface ImageUploadProps {
  /** Current images array (URLs of already uploaded images) */
  images: string[];
  /** Callback when images are added or removed */
  onImagesChange: (images: string[]) => void;
  /** Maximum number of images allowed (default: 5) */
  maxImages?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** API endpoint for uploading images */
  uploadEndpoint?: string;
  /** Service ID for appending to URL (e.g., for delete operations) */
  serviceId?: string;
  /** Label text for the upload area */
  label?: string;
  /** Help text below the upload area */
  helpText?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  disabled = false,
  uploadEndpoint,
  serviceId,
  label = 'Service Images',
  helpText = 'Upload up to 5 images showcasing your service (JPEG, PNG, WebP)'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, and WebP images are allowed';
    }
    if (file.size > maxFileSize) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled || !uploadEndpoint) return;

    const filesArray = Array.from(files);
    const remainingSlots = maxImages - images.length;

    if (remainingSlots <= 0) {
      setUploadErrors(prev => ({ ...prev, 'global': `Maximum ${maxImages} images allowed` }));
      return;
    }

    // Limit to remaining slots
    const filesToUpload = filesArray.slice(0, remainingSlots);

    // Validate all files first
    for (const file of filesToUpload) {
      const error = validateFile(file);
      if (error) {
        setUploadErrors(prev => ({ ...prev, [file.name]: error }));
        return;
      }
    }

    setIsUploading(true);
    setUploadErrors({});

    try {
      const newImageUrls: string[] = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('images', file);

        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        try {
          const response = await authService.uploadFile<{ success: boolean; data: string[] }>(
            uploadEndpoint,
            formData,
            (progress) => {
              setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            }
          );

          if (response.success && response.data && response.data.length > 0) {
            newImageUrls.push(...response.data);
          }
        } catch (error) {
          setUploadErrors(prev => ({
            ...prev,
            [file.name]: error instanceof Error ? error.message : 'Upload failed'
          }));
        }
      }

      if (newImageUrls.length > 0) {
        onImagesChange([...images, ...newImageUrls]);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  }, [images, maxImages, disabled, uploadEndpoint, onImagesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFiles(files);
  }, [disabled, handleFiles]);

  const handleRemoveImage = useCallback(async (imageUrl: string, index: number) => {
    if (disabled) return;

    // If we have a serviceId and the image is a URL (not a local blob), try to delete from backend
    if (serviceId && uploadEndpoint && imageUrl.startsWith('http')) {
      try {
        const encodedUrl = encodeURIComponent(imageUrl);
        await authService.delete(`${uploadEndpoint.replace('/images', '')}/images/${encodedUrl}`);
      } catch (error) {
        // Log but continue - the image may have already been removed from backend
        console.warn('Failed to remove image from backend:', error);
      }
    }

    onImagesChange(images.filter((_, i) => i !== index));
  }, [images, serviceId, uploadEndpoint, disabled, onImagesChange]);

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const canAddMore = images.length < maxImages && !disabled;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          {label}
          {maxImages && (
            <span className="text-nilin-warmGray font-normal ml-1">
              ({images.length}/{maxImages})
            </span>
          )}
        </label>
        <p id="upload-help-text" className="text-xs text-nilin-warmGray mb-3">{helpText}</p>
      </div>

      {/* Global error message */}
      {uploadErrors['global'] && (
        <div role="alert" className="flex items-center p-3 rounded-nilin-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-600">{uploadErrors['global']}</p>
        </div>
      )}

      {/* Screen reader status */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isUploading ? `Uploading ${Object.keys(uploadProgress).length} image(s)...` : ''}
      </div>

      {/* Upload dropzone */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload images. ${images.length} of ${maxImages} images uploaded.`}
          aria-describedby="upload-help-text"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-nilin-lg p-8 text-center transition-all cursor-pointer
            ${isDragging
              ? 'border-nilin-coral bg-nilin-coral/5'
              : 'border-nilin-border hover:border-nilin-coral/50 hover:bg-nilin-muted/30'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            disabled={disabled}
          />

          <div className="flex flex-col items-center">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center mb-3
              ${isDragging ? 'bg-nilin-coral/10' : 'bg-nilin-muted'}
            `}>
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
              ) : (
                <Upload className={`w-6 h-6 ${isDragging ? 'text-nilin-coral' : 'text-nilin-warmGray'}`} />
              )}
            </div>

            <p className="text-sm font-medium text-nilin-charcoal mb-1">
              {isDragging ? 'Drop images here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-nilin-warmGray">
              JPEG, PNG, WebP up to 10MB each
            </p>
          </div>
        </div>
      )}

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {images.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="relative group aspect-square rounded-nilin-lg overflow-hidden bg-nilin-muted border border-nilin-border"
            >
              <img
                src={imageUrl}
                alt={`Service image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder on error
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                }}
              />

              {/* Upload progress overlay */}
              {uploadProgress[imageUrl] !== undefined && uploadProgress[imageUrl] < 100 && (
                <div className="absolute inset-0 bg-nilin-charcoal/50 flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
                  <p className="text-sm text-white font-medium">{uploadProgress[imageUrl]}%</p>
                </div>
              )}

              {/* Error overlay */}
              {uploadErrors[imageUrl] && (
                <div className="absolute inset-0 bg-red-500/50 flex flex-col items-center justify-center p-2">
                  <AlertCircle className="w-6 h-6 text-white mb-1" />
                  <p className="text-xs text-white text-center">{uploadErrors[imageUrl]}</p>
                </div>
              )}

              {/* Delete button */}
              {!disabled && !uploadProgress[imageUrl] && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(imageUrl, index)}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Image number badge */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-nilin-charcoal/70 text-white text-xs font-medium">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload status summary */}
      {isUploading && (
        <div className="flex items-center text-sm text-nilin-warmGray">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Uploading images...
        </div>
      )}

      {/* Max images reached message */}
      {!canAddMore && images.length > 0 && (
        <p className="text-sm text-nilin-warmGray">
          Maximum {maxImages} images reached. Remove an image to add more.
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
