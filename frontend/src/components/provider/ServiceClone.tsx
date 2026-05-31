/**
 * ServiceClone - Clone/copy service feature
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Copy,
  Check,
  Loader2,
  Edit3,
  Calendar,
  DollarSign,
  Image,
  FileText,
  Tags,
  Clock,
  Layers,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServiceToClone {
  /** Unique service ID */
  id: string;
  /** Service name */
  name: string;
  /** Service description */
  description: string;
  /** Category name */
  category: string;
  /** Subcategory name */
  subcategory?: string;
  /** Base price */
  price: number;
  /** Currency code */
  currency?: string;
  /** Price type */
  priceType: 'fixed' | 'hourly' | 'custom';
  /** Duration in minutes */
  duration: number;
  /** Number of images */
  imageCount: number;
  /** Tags */
  tags: string[];
  /** Number of variants */
  variantCount: number;
  /** Is active/published */
  isActive: boolean;
  /** Booking stats */
  totalBookings: number;
  /** Rating */
  rating: number;
  /** Review count */
  reviewCount: number;
}

export interface ServiceCloneModalProps {
  /** Service to clone */
  service: ServiceToClone;
  /** Is modal open */
  isOpen: boolean;
  /** Is loading/submitting */
  isLoading?: boolean;
  /** Callback when clone is confirmed */
  onClone: (clonedData: Partial<ServiceToClone>) => Promise<void>;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when edit original service */
  onEditOriginal?: () => void;
}

export interface ServiceCloneProps {
  /** Services available to clone */
  services: ServiceToClone[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when service is selected for cloning */
  onSelectService: (service: ServiceToClone) => void;
  /** Callback when clone is confirmed */
  onClone: (serviceId: string, clonedData: Partial<ServiceToClone>) => Promise<void>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Clone Modal Component
// =============================================================================

export const ServiceCloneModal: React.FC<ServiceCloneModalProps> = ({
  service,
  isOpen,
  isLoading = false,
  onClone,
  onClose,
  onEditOriginal,
}) => {
  const [clonedName, setClonedName] = useState(`${service.name} (Copy)`);
  const [adjustments, setAdjustments] = useState<{
    price?: number;
    duration?: number;
    category?: string;
  }>({});
  const [includeImages, setIncludeImages] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [includeVariants, setIncludeVariants] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClone = async () => {
    if (!clonedName.trim()) return;

    setIsSubmitting(true);
    try {
      await onClone({
        ...service,
        name: clonedName,
        ...adjustments,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-nilin-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                  <Copy className="w-5 h-5 text-nilin-coral" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-nilin-charcoal">
                    Clone Service
                  </h2>
                  <p className="text-sm text-nilin-warmGray">
                    Create a copy of "{service.name}"
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-nilin-lightGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Cloned Service Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                New Service Name
              </label>
              <input
                type="text"
                value={clonedName}
                onChange={(e) => setClonedName(e.target.value)}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                placeholder="Enter service name"
              />
            </div>

            {/* Adjustments */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-nilin-charcoal mb-3">
                Adjustments (optional)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-nilin-warmGray mb-1">
                    Price Adjustment
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                      {service.currency || 'AED'}
                    </span>
                    <input
                      type="number"
                      value={adjustments.price ?? service.price}
                      onChange={(e) => setAdjustments({ ...adjustments, price: Number(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-nilin-warmGray mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={adjustments.duration ?? service.duration}
                    onChange={(e) => setAdjustments({ ...adjustments, duration: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>
              </div>
            </div>

            {/* Include Options */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-nilin-charcoal mb-3">
                Include in Clone
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-nilin-muted rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Image className="w-4 h-4 text-nilin-warmGray" />
                    <span className="text-sm text-nilin-charcoal">
                      Images ({service.imageCount})
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                    className="w-5 h-5 text-nilin-coral rounded focus:ring-nilin-coral"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-nilin-muted rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Tags className="w-4 h-4 text-nilin-warmGray" />
                    <span className="text-sm text-nilin-charcoal">
                      Tags ({service.tags.length})
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeTags}
                    onChange={(e) => setIncludeTags(e.target.checked)}
                    className="w-5 h-5 text-nilin-coral rounded focus:ring-nilin-coral"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-nilin-muted rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-nilin-warmGray" />
                    <span className="text-sm text-nilin-charcoal">
                      Variants ({service.variantCount})
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeVariants}
                    onChange={(e) => setIncludeVariants(e.target.checked)}
                    className="w-5 h-5 text-nilin-coral rounded focus:ring-nilin-coral"
                  />
                </label>
              </div>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700">
                The cloned service will be saved as a draft. You can edit it before publishing.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-nilin-border flex items-center justify-between">
            {onEditOriginal && (
              <button
                onClick={onEditOriginal}
                className="flex items-center gap-2 text-nilin-coral hover:text-nilin-rose transition-colors text-sm font-medium"
              >
                <Edit3 className="w-4 h-4" />
                Edit Original
              </button>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={!clonedName.trim() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Clone Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Service Card for Selection
// =============================================================================

interface ServiceSelectCardProps {
  service: ServiceToClone;
  isSelected: boolean;
  onSelect: () => void;
}

const ServiceSelectCard: React.FC<ServiceSelectCardProps> = ({
  service,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-4 rounded-xl border-2 cursor-pointer transition-all',
        isSelected
          ? 'border-nilin-coral bg-nilin-blush'
          : 'border-nilin-border bg-white hover:border-nilin-coral/50'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Image placeholder */}
          <div className="w-12 h-12 rounded-lg bg-nilin-muted flex items-center justify-center overflow-hidden">
            <Image className="w-5 h-5 text-nilin-lightGray" />
          </div>

          <div>
            <h4 className="font-semibold text-nilin-charcoal">{service.name}</h4>
            <p className="text-sm text-nilin-warmGray">{service.category}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-nilin-lightGray">
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {service.price}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {service.duration}m
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {service.totalBookings} bookings
              </span>
            </div>
          </div>
        </div>

        {/* Selection indicator */}
        <div
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'border-nilin-coral bg-nilin-coral'
              : 'border-nilin-lightGray'
          )}
        >
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ServiceClone: React.FC<ServiceCloneProps> = ({
  services,
  isLoading = false,
  onSelectService,
  onClone,
  className,
}) => {
  const [selectedService, setSelectedService] = useState<ServiceToClone | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleServiceSelect = (service: ServiceToClone) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleClone = async (serviceId: string, clonedData: Partial<ServiceToClone>) => {
    await onClone(serviceId, clonedData);
    setSelectedService(null);
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Clone Service
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Create a copy of an existing service
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
          <Copy className="w-5 h-5 text-nilin-coral" />
        </div>
      </div>

      {/* Services List */}
      {services.length > 0 ? (
        <div className="space-y-3">
          {services.map((service) => (
            <ServiceSelectCard
              key={service.id}
              service={service}
              isSelected={selectedService?.id === service.id}
              onSelect={() => handleServiceSelect(service)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Layers className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No services available to clone</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Create a service first to use this feature
          </p>
        </div>
      )}

      {/* Clone Modal */}
      {selectedService && (
        <ServiceCloneModal
          service={selectedService}
          isOpen={isModalOpen}
          onClone={(data) => handleClone(selectedService.id, data)}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedService(null);
          }}
        />
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ServiceClone;
