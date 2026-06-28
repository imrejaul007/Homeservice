import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  Send,
  Upload,
  X,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

// Category enum mirrors backend CreateDisputeDTO.category
// (see backend/src/services/dispute.service.ts)
export type DisputeType =
  | 'service_quality'
  | 'no_show'
  | 'damage'
  | 'billing'
  | 'cancellation'
  | 'communication'
  | 'other';

export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'escalated';

export interface DisputeEvidence {
  id: string;
  type: 'image' | 'document';
  url: string;
  name: string;
  size: number;
  uploadedAt: Date;
}

export interface DisputeAppeal {
  bookingId: string;
  disputeType: DisputeType;
  reason: string;
  description: string;
  evidence: DisputeEvidence[];
  preferredResolution: 'refund' | 'partial_refund' | 'credit' | 'redo_service' | 'other';
  otherResolutionText?: string;
  requestedAmount?: number;
}

export interface DisputeAppealResponse {
  appealId: string;
  status: AppealStatus;
  message: string;
  referenceNumber: string;
  estimatedResponseTime?: string;
}

// ============================================
// Constants
// ============================================

const DISPUTE_TYPES: { value: DisputeType; label: string; description: string }[] = [
  { value: 'service_quality', label: 'Service Quality', description: 'Service did not meet expectations' },
  { value: 'no_show', label: 'Provider No-Show', description: 'Provider did not arrive' },
  { value: 'damage', label: 'Property Damage', description: 'Damage to property or belongings' },
  { value: 'billing', label: 'Billing Issue', description: 'Incorrect charges or unexpected fees' },
  { value: 'cancellation', label: 'Cancellation Problem', description: 'Issues with booking cancellation' },
  { value: 'communication', label: 'Communication Issue', description: 'Poor communication or responsiveness' },
  { value: 'other', label: 'Other', description: 'Other dispute not listed' },
];

const RESOLUTION_OPTIONS: { value: DisputeAppeal['preferredResolution']; label: string; description: string }[] = [
  { value: 'refund', label: 'Full Refund', description: 'Request a complete refund' },
  { value: 'partial_refund', label: 'Partial Refund', description: 'Request a partial refund' },
  { value: 'credit', label: 'Platform Credit', description: 'Receive credit for future bookings' },
  { value: 'redo_service', label: 'Redo Service', description: 'Request the service to be redone' },
  { value: 'other', label: 'Other', description: 'Specify your preferred resolution' },
];

// ============================================
// Component
// ============================================

interface DisputeAppealUIProps {
  bookingId: string;
  bookingAmount: number;
  serviceName: string;
  providerName: string;
  bookingDate: string;
  onSubmit: (appeal: DisputeAppeal) => Promise<DisputeAppealResponse>;
  onCancel?: () => void;
  existingAppeal?: DisputeAppealResponse;
  isLoading?: boolean;
  className?: string;
}

const DisputeAppealUI: React.FC<DisputeAppealUIProps> = ({
  bookingId,
  bookingAmount,
  serviceName,
  providerName,
  bookingDate,
  onSubmit,
  onCancel,
  existingAppeal,
  isLoading = false,
  className,
}) => {
  const [step, setStep] = useState<'form' | 'success'>(existingAppeal ? 'success' : 'form');
  const [expandedType, setExpandedType] = useState<DisputeType | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState<DisputeAppeal>({
    bookingId,
    disputeType: 'other',
    reason: '',
    description: '',
    evidence: [],
    preferredResolution: 'refund',
    requestedAmount: bookingAmount,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle input changes
  const handleChange = useCallback((
    field: keyof DisputeAppeal,
    value: DisputeAppeal[keyof DisputeAppeal]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (files.length + newFiles.length > maxFiles) {
      setErrors(prev => ({ ...prev, evidence: `Maximum ${maxFiles} files allowed` }));
      return;
    }

    for (const file of newFiles) {
      if (file.size > maxSize) {
        setErrors(prev => ({ ...prev, evidence: `File ${file.name} exceeds 10MB limit` }));
        continue;
      }

      // Simulate upload progress
      const fileId = `${file.name}-${Date.now()}`;
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

      // Simulate upload
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      }

      setFiles(prev => [...prev, file]);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    }
  }, [files]);

  // Remove file
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.disputeType) {
      newErrors.disputeType = 'Please select a dispute type';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a brief reason';
    }

    if (formData.description.length < 20) {
      newErrors.description = 'Please provide more details (at least 20 characters)';
    }

    if (formData.preferredResolution === 'other' && !formData.otherResolutionText?.trim()) {
      newErrors.otherResolutionText = 'Please describe your preferred resolution';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const response = await onSubmit(formData);
      setStep('success');
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to submit appeal',
      });
    }
  };

  // Success state
  if (step === 'success' && existingAppeal) {
    return (
      <div className={cn('bg-white rounded-2xl p-8 text-center', className)}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>

        <h3 className="text-xl font-bold text-nilin-charcoal mb-2">
          {existingAppeal.status === 'pending' ? 'Appeal Submitted' : 'Appeal Updated'}
        </h3>

        <p className="text-nilin-warmGray mb-6">
          {existingAppeal.message}
        </p>

        <div className="bg-nilin-blush/30 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-nilin-coral" />
            <span className="text-sm font-medium text-nilin-charcoal">Reference Number</span>
          </div>
          <p className="text-lg font-bold text-nilin-charcoal font-mono">
            {existingAppeal.referenceNumber}
          </p>
        </div>

        {existingAppeal.estimatedResponseTime && (
          <div className="flex items-center justify-center gap-2 text-nilin-warmGray mb-6">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Estimated response: {existingAppeal.estimatedResponseTime}
            </span>
          </div>
        )}

        <button
          onClick={onCancel}
          className="px-6 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-nilin-rose/10 to-nilin-coral/10 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-nilin-charcoal">Dispute Appeal</h2>
        </div>

        {/* Booking Summary */}
        <div className="bg-white/80 rounded-xl p-4 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-nilin-warmGray">Service</span>
              <p className="font-medium text-nilin-charcoal">{serviceName}</p>
            </div>
            <div>
              <span className="text-nilin-warmGray">Provider</span>
              <p className="font-medium text-nilin-charcoal">{providerName}</p>
            </div>
            <div>
              <span className="text-nilin-warmGray">Date</span>
              <p className="font-medium text-nilin-charcoal">{bookingDate}</p>
            </div>
            <div>
              <span className="text-nilin-warmGray">Amount</span>
              <p className="font-medium text-nilin-charcoal">AED {bookingAmount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Error Alert */}
        {errors.general && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errors.general}</p>
          </div>
        )}

        {/* Dispute Type Selection */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-3">
            What type of issue are you experiencing?
          </label>
          <div className="space-y-2">
            {DISPUTE_TYPES.map(type => (
              <div key={type.value}>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedType(expandedType === type.value ? null : type.value);
                    handleChange('disputeType', type.value);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all',
                    formData.disputeType === type.value
                      ? 'border-nilin-coral bg-nilin-coral/5'
                      : 'border-nilin-border hover:border-nilin-coral/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      formData.disputeType === type.value
                        ? 'border-nilin-coral bg-nilin-coral'
                        : 'border-nilin-border'
                    )}>
                      {formData.disputeType === type.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-nilin-charcoal">{type.label}</span>
                      <span className="text-sm text-nilin-warmGray ml-2">{type.description}</span>
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    'h-5 w-5 text-nilin-warmGray transition-transform',
                    expandedType === type.value && 'rotate-180'
                  )} />
                </button>
              </div>
            ))}
          </div>
          {errors.disputeType && (
            <p className="text-sm text-red-500 mt-1">{errors.disputeType}</p>
          )}
        </div>

        {/* Brief Reason */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Brief reason for appeal
          </label>
          <input
            type="text"
            value={formData.reason}
            onChange={e => handleChange('reason', e.target.value)}
            placeholder="e.g., Service was not completed properly"
            className={cn(
              'w-full px-4 py-3 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
              errors.reason ? 'border-red-500' : 'border-nilin-border focus:border-nilin-coral'
            )}
          />
          {errors.reason && (
            <p className="text-sm text-red-500 mt-1">{errors.reason}</p>
          )}
        </div>

        {/* Detailed Description */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Detailed description
          </label>
          <textarea
            value={formData.description}
            onChange={e => handleChange('description', e.target.value)}
            placeholder="Please describe what happened in detail..."
            rows={4}
            className={cn(
              'w-full px-4 py-3 border rounded-xl transition-all resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
              errors.description ? 'border-red-500' : 'border-nilin-border focus:border-nilin-coral'
            )}
          />
          <div className="flex justify-between mt-1">
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
            <span className="text-xs text-nilin-warmGray ml-auto">
              {formData.description.length}/2000
            </span>
          </div>
        </div>

        {/* Preferred Resolution */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-3">
            Preferred resolution
          </label>
          <div className="grid grid-cols-2 gap-3">
            {RESOLUTION_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange('preferredResolution', option.value)}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all',
                  formData.preferredResolution === option.value
                    ? 'border-nilin-coral bg-nilin-coral/5'
                    : 'border-nilin-border hover:border-nilin-coral/50'
                )}
              >
                <span className="font-medium text-nilin-charcoal block">{option.label}</span>
                <span className="text-xs text-nilin-warmGray">{option.description}</span>
              </button>
            ))}
          </div>

          {formData.preferredResolution === 'partial_refund' && (
            <div className="mt-3">
              <label className="block text-sm text-nilin-warmGray mb-2">
                Requested amount (AED)
              </label>
              <input
                type="number"
                value={formData.requestedAmount}
                onChange={e => handleChange('requestedAmount', parseFloat(e.target.value) || 0)}
                min={0}
                max={bookingAmount}
                className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>
          )}

          {formData.preferredResolution === 'other' && (
            <div className="mt-3">
              <label className="block text-sm text-nilin-warmGray mb-2">
                Describe your preferred resolution
              </label>
              <textarea
                value={formData.otherResolutionText || ''}
                onChange={e => handleChange('otherResolutionText', e.target.value)}
                placeholder="Please describe what resolution would satisfy your appeal..."
                rows={2}
                className="w-full px-4 py-3 border border-nilin-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              />
              {errors.otherResolutionText && (
                <p className="text-sm text-red-500 mt-1">{errors.otherResolutionText}</p>
              )}
            </div>
          )}
        </div>

        {/* Evidence Upload */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Upload evidence (optional)
          </label>
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
              errors.evidence
                ? 'border-red-500 bg-red-50'
                : 'border-nilin-border hover:border-nilin-coral/50'
            )}
          >
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              id="evidence-upload"
            />
            <label htmlFor="evidence-upload" className="cursor-pointer">
              <Upload className="h-8 w-8 text-nilin-warmGray mx-auto mb-2" />
              <p className="text-sm text-nilin-charcoal font-medium">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-nilin-warmGray mt-1">
                Images, PDFs up to 10MB (max 5 files)
              </p>
            </label>
          </div>
          {errors.evidence && (
            <p className="text-sm text-red-500 mt-1">{errors.evidence}</p>
          )}

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-nilin-blush/30 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-nilin-coral" />
                    <div>
                      <p className="text-sm font-medium text-nilin-charcoal">{file.name}</p>
                      <p className="text-xs text-nilin-warmGray">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-nilin-error/10 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4 text-nilin-error" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-nilin-border">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border border-nilin-border rounded-xl text-nilin-charcoal font-medium hover:bg-nilin-blush/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Appeal
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DisputeAppealUI;
