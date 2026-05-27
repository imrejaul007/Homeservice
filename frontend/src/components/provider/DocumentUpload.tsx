import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  Image,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
} from 'lucide-react';

export type DocumentType =
  | 'id_card'
  | 'passport'
  | 'business_license'
  | 'address_proof'
  | 'tax_certificate'
  | 'insurance';

export interface UploadedDocument {
  id: string;
  type: DocumentType;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
  verifiedAt?: Date;
  rejectionReason?: string;
}

export interface DocumentUploadConfig {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  acceptedTypes: string[];
  maxSizeMB: number;
}

export const DOCUMENT_CONFIGS: DocumentUploadConfig[] = [
  {
    type: 'id_card',
    label: 'ID Card / Emirates ID',
    description: 'Upload a clear photo of your government-issued ID card',
    required: true,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'passport',
    label: 'Passport',
    description: 'Upload a clear photo of your passport (front page)',
    required: true,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'business_license',
    label: 'Business License',
    description: 'Upload your trade license or business registration certificate',
    required: false,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'address_proof',
    label: 'Address Proof',
    description: 'Utility bill, Ejari, or DEWA bill showing your address',
    required: false,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'tax_certificate',
    label: 'Tax Certificate',
    description: 'VAT registration certificate (if applicable)',
    required: false,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 10,
  },
  {
    type: 'insurance',
    label: 'Insurance Certificate',
    description: 'Professional liability insurance (if applicable)',
    required: false,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 10,
  },
];

interface DocumentUploadProps {
  config: DocumentUploadConfig;
  document?: UploadedDocument;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  onPreview?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  config,
  document,
  onUpload,
  onRemove,
  onPreview,
  disabled = false,
  compact = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  React.useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!config.acceptedTypes.includes(file.type)) {
      return `Invalid file type. Allowed: ${config.acceptedTypes
        .map((t) => t.split('/')[1]?.toUpperCase() || t)
        .join(', ')}`;
    }

    // Check file size
    const maxSizeBytes = config.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${config.maxSizeMB}MB`;
    }

    // Check for empty file
    if (file.size === 0) {
      return 'File is empty. Please select a valid file.';
    }

    return null;
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      // Clear any existing interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // Start progress simulation
      progressIntervalRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            return prev;
          }
          return prev + 15;
        });
      }, 200);

      try {
        await onUpload(file);

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setUploadProgress(100);
      } catch (err) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setError(message);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [onUpload, config]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [disabled, isUploading, handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      // Reset input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileSelect]
  );

  const handleRemove = useCallback(async () => {
    if (!onRemove || disabled) return;

    try {
      await onRemove();
    } catch (err) {
      setError('Failed to remove document. Please try again.');
    }
  }, [onRemove, disabled]);

  const getStatusBadge = () => {
    if (!document) return null;

    switch (document.status) {
      case 'approved':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending Review
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getFileIcon = () => {
    if (!document?.mimeType) return <FileText className="h-5 w-5 text-nilin-warmGray" />;
    if (document.mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-nilin-warmGray" />;
    }
    return <FileText className="h-5 w-5 text-nilin-warmGray" />;
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-nilin-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg">{getFileIcon()}</div>
          <div>
            <p className="text-sm font-medium text-nilin-charcoal">{config.label}</p>
            {document && (
              <p className="text-xs text-nilin-warmGray">
                {document.fileName || 'Document uploaded'}
                {document.fileSize && ` (${formatFileSize(document.fileSize)})`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {document?.status === 'approved' && onPreview && (
            <button
              onClick={onPreview}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              title="View document"
              aria-label="View document"
            >
              <Eye className="h-4 w-4 text-nilin-warmGray" />
            </button>
          )}
          {document && onRemove && !disabled && (
            <button
              onClick={handleRemove}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove document"
              aria-label="Remove document"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
          {!document && !disabled && (
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept={config.acceptedTypes.join(',')}
                onChange={handleInputChange}
                className="hidden"
                disabled={isUploading || disabled}
              />
              <span className="px-3 py-1.5 bg-nilin-coral text-white text-sm font-medium rounded-lg hover:bg-nilin-rose transition-colors flex items-center gap-1">
                {isUploading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3" />
                    Upload
                  </>
                )}
              </span>
            </label>
          )}
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <div
      className={`rounded-xl border-2 border-dashed p-6 transition-all ${
        isDragging
          ? 'border-nilin-coral bg-nilin-coral/5'
          : 'border-gray-200 hover:border-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => {
        if (!disabled && !isUploading && !document && fileInputRef.current) {
          fileInputRef.current.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={config.acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={isUploading || disabled}
      />

      {document ? (
        // Document uploaded view
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-nilin-muted rounded-xl">
                {getFileIcon()}
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">{config.label}</p>
                <p className="text-sm text-nilin-warmGray mt-0.5">
                  {document.fileName || 'Document uploaded'}
                </p>
                {document.fileSize && (
                  <p className="text-xs text-nilin-warmGray">
                    {formatFileSize(document.fileSize)}
                  </p>
                )}
                {document.uploadedAt && (
                  <p className="text-xs text-nilin-warmGray mt-1">
                    Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {document.status === 'approved' && onPreview && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview();
                  }}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title="View document"
                >
                  <Eye className="h-4 w-4 text-nilin-warmGray" />
                </button>
              )}
              {onRemove && !disabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove document"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              )}
            </div>
          </div>

          {document.status === 'rejected' && document.rejectionReason && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Rejection reason:</strong> {document.rejectionReason}
              </p>
            </div>
          )}
        </div>
      ) : (
        // Upload area view
        <div className="text-center space-y-3">
          {isUploading ? (
            <>
              <div className="w-16 h-16 mx-auto bg-nilin-coral/10 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
              </div>
              <p className="text-sm font-medium text-nilin-charcoal">Uploading...</p>
              <div className="max-w-xs mx-auto">
                <div className="h-2 bg-nilin-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-nilin-coral rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto bg-nilin-coral/10 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-nilin-coral" />
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">{config.label}</p>
                <p className="text-sm text-nilin-warmGray mt-1">{config.description}</p>
              </div>
              <p className="text-xs text-nilin-warmGray">
                Click or drag to upload. Max {config.maxSizeMB}MB.
              </p>
              <p className="text-xs text-nilin-warmGray">
                Accepted: {config.acceptedTypes.map((t) => t.split('/')[1]?.toUpperCase() || t).join(', ')}
              </p>
              {config.required && (
                <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  Required
                </span>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
