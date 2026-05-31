/**
 * ServicePackages - Service bundles/packages
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  DollarSign,
  Clock,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Star,
  Sparkles,
  Copy,
  ToggleLeft,
  ToggleRight,
  Link,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServicePackageItem {
  /** Service ID */
  serviceId: string;
  /** Service name */
  serviceName: string;
  /** Original price of individual service */
  originalPrice: number;
  /** Quantity included */
  quantity: number;
}

export interface ServicePackage {
  /** Unique package ID */
  id: string;
  /** Package name */
  name: string;
  /** Package description */
  description: string;
  /** Services included in package */
  items: ServicePackageItem[];
  /** Package price */
  price: number;
  /** Original total price */
  originalPrice: number;
  /** Discount percentage */
  discountPercent: number;
  /** Duration in minutes */
  duration: number;
  /** Is package active */
  isActive: boolean;
  /** Number of times purchased */
  purchaseCount: number;
  /** Package rating */
  rating: number;
  /** Creation date */
  createdAt: string;
  /** Number of bookings with this package */
  totalBookings: number;
}

export interface ServicePackagesProps {
  /** Available packages */
  packages: ServicePackage[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when creating new package */
  onCreate: () => void;
  /** Callback when editing package */
  onEdit: (packageId: string) => void;
  /** Callback when deleting package */
  onDelete: (packageId: string) => Promise<void>;
  /** Callback when toggling package active status */
  onToggleActive: (packageId: string) => Promise<void>;
  /** Callback when duplicating package */
  onDuplicate?: (packageId: string) => Promise<void>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Package Card Component
// =============================================================================

interface PackageCardProps {
  pkg: ServicePackage;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onToggleActive: () => Promise<void>;
  onDuplicate?: () => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const PackageCard: React.FC<PackageCardProps> = ({
  pkg,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
  isExpanded,
  onToggleExpand,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      await onToggleActive();
    } finally {
      setIsToggling(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-nilin-sm overflow-hidden transition-all',
        pkg.isActive ? 'border-nilin-border' : 'border-gray-200 opacity-75'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {/* Package Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                pkg.isActive ? 'bg-nilin-coral/10' : 'bg-gray-100'
              )}
            >
              <Package
                className={cn(
                  'w-6 h-6',
                  pkg.isActive ? 'text-nilin-coral' : 'text-gray-400'
                )}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-nilin-charcoal">{pkg.name}</h4>
                {pkg.discountPercent >= 20 && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Popular
                  </span>
                )}
              </div>
              <p className="text-sm text-nilin-warmGray mt-1 line-clamp-2">
                {pkg.description}
              </p>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-lg font-bold text-nilin-charcoal">
              {formatPrice(pkg.price)}
            </p>
            <p className="text-sm text-nilin-lightGray line-through">
              {formatPrice(pkg.originalPrice)}
            </p>
            <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              -{pkg.discountPercent}%
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-sm text-nilin-warmGray mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {pkg.duration} min
          </span>
          <span className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            {pkg.items.length} services
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            {pkg.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            {pkg.totalBookings} bookings
          </span>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
        >
          {isExpanded ? (
            <>
              <span>Hide details</span>
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>View details</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-nilin-border">
            {/* Included Services */}
            <h5 className="text-sm font-medium text-nilin-charcoal mb-2">
              Included Services
            </h5>
            <div className="space-y-2 mb-4">
              {pkg.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-nilin-muted rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-nilin-charcoal">
                      {item.serviceName}
                      {item.quantity > 1 && (
                        <span className="text-nilin-lightGray"> x{item.quantity}</span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm text-nilin-lightGray line-through">
                    {formatPrice(item.originalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* Created Date */}
            <p className="text-xs text-nilin-lightGray">
              Created {formatDate(pkg.createdAt)}
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-nilin-muted/50 border-t border-nilin-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Toggle Active */}
          <button
            onClick={handleToggleActive}
            disabled={isToggling}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              pkg.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              isToggling && 'opacity-50'
            )}
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : pkg.isActive ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            {pkg.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-2 text-nilin-warmGray hover:text-nilin-charcoal hover:bg-white rounded-lg transition-colors"
              title="Duplicate package"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors"
            title="Edit package"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-nilin-warmGray hover:text-red-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
            title="Delete package"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Create/Edit Package Modal
// =============================================================================

export interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (packageData: Partial<ServicePackage>) => Promise<void>;
  initialData?: Partial<ServicePackage>;
  availableServices?: Array<{
    id: string;
    name: string;
    price: number;
    duration: number;
  }>;
}

export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  availableServices = [],
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [price, setPrice] = useState(initialData?.price?.toString() || '');
  const [selectedServices, setSelectedServices] = useState<ServicePackageItem[]>(
    initialData?.items || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const originalTotal = selectedServices.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0
  );
  const discountPercent =
    originalTotal > 0 && price ? Math.round(((originalTotal - Number(price)) / originalTotal) * 100) : 0;

  const handleAddService = (service: typeof availableServices[0]) => {
    if (!selectedServices.find((s) => s.serviceId === service.id)) {
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.id,
          serviceName: service.name,
          originalPrice: service.price,
          quantity: 1,
        },
      ]);
    }
  };

  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter((s) => s.serviceId !== serviceId));
  };

  const handleQuantityChange = (serviceId: string, quantity: number) => {
    setSelectedServices(
      selectedServices.map((s) =>
        s.serviceId === serviceId ? { ...s, quantity: Math.max(1, quantity) } : s
      )
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price || selectedServices.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name,
        description,
        price: Number(price),
        items: selectedServices,
        originalPrice: originalTotal,
        discountPercent,
        duration: selectedServices.reduce((sum, s) => sum + 30 * s.quantity, 0), // Simplified
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-nilin-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-nilin-coral" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-nilin-charcoal">
                    {initialData ? 'Edit Package' : 'Create Package'}
                  </h2>
                  <p className="text-sm text-nilin-warmGray">
                    Bundle services for a discounted price
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
          <div className="p-6 overflow-y-auto flex-1">
            {/* Package Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Package Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                placeholder="e.g., Complete Home Cleaning Package"
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 resize-none"
                placeholder="Describe what's included in this package..."
              />
            </div>

            {/* Price */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Package Price (AED) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                  AED
                </span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  placeholder="0"
                />
              </div>
              {originalTotal > 0 && price && (
                <p className="text-sm text-green-600 mt-1">
                  Discount: {discountPercent}% (Original: AED {originalTotal})
                </p>
              )}
            </div>

            {/* Services */}
            <div>
              <h4 className="text-sm font-medium text-nilin-charcoal mb-2">
                Included Services
              </h4>

              {/* Selected Services */}
              {selectedServices.length > 0 && (
                <div className="space-y-2 mb-4">
                  {selectedServices.map((service) => (
                    <div
                      key={service.serviceId}
                      className="flex items-center justify-between p-3 bg-nilin-muted rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-nilin-charcoal">
                          {service.serviceName}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleQuantityChange(service.serviceId, service.quantity - 1)}
                            className="w-6 h-6 rounded bg-white flex items-center justify-center text-sm font-medium"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm">{service.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(service.serviceId, service.quantity + 1)}
                            className="w-6 h-6 rounded bg-white flex items-center justify-center text-sm font-medium"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-nilin-lightGray">
                          AED {service.originalPrice * service.quantity}
                        </span>
                        <button
                          onClick={() => handleRemoveService(service.serviceId)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Services */}
              <div className="border border-dashed border-nilin-border rounded-xl p-4">
                <p className="text-sm text-nilin-warmGray mb-2">Add services:</p>
                <div className="flex flex-wrap gap-2">
                  {availableServices
                    .filter((s) => !selectedServices.find((sel) => sel.serviceId === s.id))
                    .map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleAddService(service)}
                        className="px-3 py-1.5 bg-white border border-nilin-border rounded-lg text-sm text-nilin-charcoal hover:bg-nilin-blush transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {service.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-nilin-border flex-shrink-0 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || !price || selectedServices.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {initialData ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ServicePackages: React.FC<ServicePackagesProps> = ({
  packages,
  isLoading = false,
  onCreate,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
  className,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-nilin-muted rounded-xl" />
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
            Service Packages
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Bundle services for better value
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Package
        </button>
      </div>

      {/* Packages List */}
      {packages.length > 0 ? (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => onEdit(pkg.id)}
              onDelete={() => onDelete(pkg.id)}
              onToggleActive={() => onToggleActive(pkg.id)}
              onDuplicate={onDuplicate ? () => onDuplicate(pkg.id) : undefined}
              isExpanded={expandedId === pkg.id}
              onToggleExpand={() => setExpandedId(expandedId === pkg.id ? null : pkg.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-nilin-lightGray mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
            No packages yet
          </h3>
          <p className="text-sm text-nilin-warmGray mb-6">
            Create service bundles to offer better value to customers
          </p>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Package
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ServicePackages;
