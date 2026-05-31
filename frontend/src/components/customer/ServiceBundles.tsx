import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  Star,
  X,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import authService from '../../services/AuthService';

// =============================================================================
// NILIN Customer Dashboard - Service Bundles Component
// Browse, view details, and book service bundles
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface BundleService {
  serviceId: string;
  serviceName: string;
  serviceImage?: string;
  quantity: number;
  originalPrice: number;
  description?: string;
}

export interface Bundle {
  _id: string;
  name: string;
  description: string;
  services: BundleService[];
  originalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercentage: number;
  validFrom: string;
  validUntil: string;
  maxRedemptions?: number;
  redemptionsUsed?: number;
  category?: {
    _id: string;
    name: string;
  };
  isActive: boolean;
  image?: string;
  tags?: string[];
  rating?: {
    average: number;
    count: number;
  };
  providerCount?: number;
}

export interface ServiceBundlesProps {
  /** Initial category filter */
  categoryId?: string;
  /** Limit number of bundles shown */
  limit?: number;
  /** Show compact grid */
  compact?: boolean;
  /** Callback when bundle is booked */
  onBundleBook?: (bundleId: string) => void;
  /** Callback when bundle is clicked */
  onBundleClick?: (bundle: Bundle) => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Bundle Card Component
// =============================================================================

interface BundleCardProps {
  bundle: Bundle;
  compact?: boolean;
  onViewDetails: (bundle: Bundle) => void;
  onBookNow: (bundle: Bundle) => void;
}

const BundleCard: React.FC<BundleCardProps> = ({
  bundle,
  compact,
  onViewDetails,
  onBookNow,
}) => {
  const [imageError, setImageError] = useState(false);
  const isExpired = new Date(bundle.validUntil) < new Date();
  const isNotYetValid = new Date(bundle.validFrom) > new Date();
  const isAvailable = bundle.isActive && !isExpired && !isNotYetValid;
  const spotsLeft = bundle.maxRedemptions
    ? bundle.maxRedemptions - (bundle.redemptionsUsed || 0)
    : null;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30',
        'hover:shadow-nilin-warm transition-all duration-200 hover:-translate-y-1',
        compact ? 'flex gap-4 p-4' : 'flex flex-col'
      )}
    >
      {/* Bundle Image */}
      {!compact && (
        <div className="relative h-40 bg-gradient-to-br from-nilin-coral/10 to-rose-100">
          {bundle.image && !imageError ? (
            <img
              src={bundle.image}
              alt={bundle.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-nilin-coral/40" />
            </div>
          )}

          {/* Savings Badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="success" size="sm" pill>
              <Sparkles className="h-3 w-3 mr-1" />
              Save {bundle.savingsPercentage}%
            </Badge>
          </div>

          {/* Expiring Soon */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-nilin-charcoal/60 flex items-center justify-center">
              <Badge variant="error" size="sm" pill>
                {isExpired ? 'Expired' : isNotYetValid ? 'Coming Soon' : 'Unavailable'}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Bundle Info */}
      <div className={cn('flex flex-col', compact ? 'flex-1' : 'p-4 flex-1')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={cn(
              'font-semibold text-nilin-charcoal',
              compact ? 'text-base' : 'text-lg'
            )}>
              {bundle.name}
            </h3>
            {bundle.category && (
              <p className="text-xs text-nilin-warmGray mt-0.5">
                {bundle.category.name}
              </p>
            )}
          </div>

          {bundle.rating && bundle.rating.count > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="font-medium text-nilin-charcoal">
                {bundle.rating.average.toFixed(1)}
              </span>
              <span className="text-nilin-warmGray text-xs">
                ({bundle.rating.count})
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {!compact && (
          <p className="text-sm text-nilin-warmGray mt-2 line-clamp-2">
            {bundle.description}
          </p>
        )}

        {/* Services List */}
        <div className={cn(
          'mt-3 space-y-1.5',
          compact ? '' : ''
        )}>
          {bundle.services.slice(0, compact ? 3 : 4).map((service, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-nilin-charcoal truncate">
                {service.quantity > 1 && (
                  <span className="font-medium">{service.quantity}x</span>
                )}{' '}
                {service.serviceName}
              </span>
            </div>
          ))}
          {!compact && bundle.services.length > 4 && (
            <p className="text-xs text-nilin-warmGray pl-6">
              +{bundle.services.length - 4} more services
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={cn('flex items-end justify-between mt-auto pt-4', compact ? '' : '')}>
          {/* Pricing */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-nilin-coral">
              {formatPrice(bundle.bundlePrice)}
            </span>
            <span className="text-sm text-nilin-warmGray line-through">
              {formatPrice(bundle.originalPrice)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(bundle)}
            >
              Details
            </Button>
            {isAvailable && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onBookNow(bundle)}
              >
                Book
              </Button>
            )}
          </div>
        </div>

        {/* Valid Until */}
        {!compact && (
          <div className="flex items-center gap-1 mt-3 text-xs text-nilin-warmGray">
            <Clock className="h-3 w-3" />
            <span>Valid until {new Date(bundle.validUntil).toLocaleDateString('en-AE', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}</span>
            {spotsLeft !== null && spotsLeft <= 5 && spotsLeft > 0 && (
              <Badge variant="warning" size="sm" className="ml-2">
                {spotsLeft} spots left
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Bundle Details Modal
// =============================================================================

interface BundleDetailsModalProps {
  bundle: Bundle | null;
  open: boolean;
  onClose: () => void;
  onBookNow: (bundle: Bundle) => void;
}

const BundleDetailsModal: React.FC<BundleDetailsModalProps> = ({
  bundle,
  open,
  onClose,
  onBookNow,
}) => {
  if (!bundle) return null;

  const isExpired = new Date(bundle.validUntil) < new Date();
  const isNotYetValid = new Date(bundle.validFrom) > new Date();
  const isAvailable = bundle.isActive && !isExpired && !isNotYetValid;

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title={bundle.name}
      size="lg"
    >
      <div className="space-y-6">
        {/* Hero Image */}
        {bundle.image && (
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img
              src={bundle.image}
              alt={bundle.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <Badge variant="success" size="md" pill>
                <Sparkles className="h-4 w-4 mr-1" />
                Save {formatPrice(bundle.savingsAmount)} ({bundle.savingsPercentage}% off)
              </Badge>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <h4 className="text-sm font-semibold text-nilin-charcoal mb-1">About this bundle</h4>
          <p className="text-sm text-nilin-warmGray">{bundle.description}</p>
        </div>

        {/* Included Services */}
        <div>
          <h4 className="text-sm font-semibold text-nilin-charcoal mb-3">What's included</h4>
          <div className="space-y-3">
            {bundle.services.map((service, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 bg-nilin-blush/20 rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-nilin-charcoal">
                      {service.quantity > 1 && (
                        <span className="text-nilin-coral font-bold">{service.quantity}x</span>
                      )}{' '}
                      {service.serviceName}
                    </h5>
                    <span className="text-sm text-nilin-warmGray line-through">
                      {formatPrice(service.originalPrice * service.quantity)}
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-xs text-nilin-warmGray mt-1">
                      {service.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="bg-gradient-to-r from-nilin-coral/5 to-rose-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-nilin-warmGray">Original Total</span>
            <span className="text-nilin-charcoal line-through">
              {formatPrice(bundle.originalPrice)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-green-600">
            <span>Your Savings</span>
            <span>-{formatPrice(bundle.savingsAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg pt-2 border-t border-nilin-blush/30">
            <span className="text-nilin-charcoal">Bundle Price</span>
            <span className="text-nilin-coral">{formatPrice(bundle.bundlePrice)}</span>
          </div>
        </div>

        {/* Validity */}
        <div className="flex items-center gap-4 text-sm text-nilin-warmGray">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Valid: {new Date(bundle.validFrom).toLocaleDateString('en-AE')} - {new Date(bundle.validUntil).toLocaleDateString('en-AE')}</span>
          </div>
        </div>

        {/* Tags */}
        {bundle.tags && bundle.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bundle.tags.map((tag) => (
              <Badge key={tag} variant="default" size="sm">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onBookNow(bundle)}
          disabled={!isAvailable}
          leftIcon={<ArrowRight className="h-4 w-4" />}
        >
          {isAvailable ? 'Book Bundle Now' : 'Currently Unavailable'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// =============================================================================
// Bundle Booking Flow Modal
// =============================================================================

interface BundleBookingModalProps {
  bundle: Bundle | null;
  open: boolean;
  onClose: () => void;
  onConfirmBooking: (bundleId: string, date: string, notes: string) => Promise<void>;
  isBooking?: boolean;
}

const BundleBookingModal: React.FC<BundleBookingModalProps> = ({
  bundle,
  open,
  onClose,
  onConfirmBooking,
  isBooking = false,
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const maxDate = bundle ? new Date(bundle.validUntil) : new Date();

  const handleSubmit = async () => {
    if (!bundle || !selectedDate) {
      setError('Please select a date for your first service');
      return;
    }

    try {
      setError(null);
      await onConfirmBooking(bundle._id, selectedDate, notes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book bundle');
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedDate('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  if (!bundle) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title="Book Service Bundle"
      size="md"
    >
      <div className="space-y-6">
        {/* Bundle Summary */}
        <div className="bg-nilin-blush/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Package className="h-10 w-10 text-nilin-coral" />
            <div>
              <h4 className="font-semibold text-nilin-charcoal">{bundle.name}</h4>
              <p className="text-sm text-nilin-warmGray">
                {bundle.services.length} services included
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-lg font-bold text-nilin-coral">
                {formatPrice(bundle.bundlePrice)}
              </p>
              <p className="text-xs text-nilin-warmGray">
                Save {formatPrice(bundle.savingsAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Select start date for first service
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={minDate.toISOString().split('T')[0]}
            max={maxDate.toISOString().split('T')[0]}
            className={cn(
              'w-full px-4 py-3 rounded-xl border border-nilin-blush/50',
              'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral',
              'text-nilin-charcoal'
            )}
          />
          <p className="text-xs text-nilin-warmGray mt-1">
            Subsequent services will be scheduled based on provider availability
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Special requests (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions or preferences..."
            rows={3}
            className={cn(
              'w-full px-4 py-3 rounded-xl border border-nilin-blush/50',
              'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral',
              'text-nilin-charcoal resize-none'
            )}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Terms */}
        <p className="text-xs text-nilin-warmGray">
          By booking, you agree to the bundle terms. All services must be completed before {new Date(bundle.validUntil).toLocaleDateString('en-AE')}.
        </p>
      </div>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={isBooking}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isBooking}
          disabled={!selectedDate}
        >
          Confirm Booking
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// =============================================================================
// Bundle Comparison Component
// =============================================================================

interface BundleComparisonProps {
  bundles: Bundle[];
  onSelectBundle: (bundle: Bundle) => void;
}

const BundleComparison: React.FC<BundleComparisonProps> = ({
  bundles,
  onSelectBundle,
}) => {
  if (bundles.length < 2) return null;

  // Get all unique services
  const allServices = Array.from(
    new Set(bundles.flatMap((b) => b.services.map((s) => s.serviceName)))
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left p-4 text-sm font-semibold text-nilin-charcoal">
              Service
            </th>
            {bundles.map((bundle) => (
              <th key={bundle._id} className="p-4 text-center min-w-[200px]">
                <div className="space-y-2">
                  <h4 className="font-semibold text-nilin-charcoal">{bundle.name}</h4>
                  <p className="text-xl font-bold text-nilin-coral">
                    {formatPrice(bundle.bundlePrice)}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onSelectBundle(bundle)}
                  >
                    Select
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allServices.map((serviceName) => (
            <tr key={serviceName} className="border-t border-nilin-blush/30">
              <td className="p-4 text-sm text-nilin-charcoal">{serviceName}</td>
              {bundles.map((bundle) => {
                const hasService = bundle.services.some(
                  (s) => s.serviceName === serviceName
                );
                return (
                  <td key={bundle._id} className="p-4 text-center">
                    {hasService ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-nilin-blush/30 bg-nilin-blush/10">
            <td className="p-4 text-sm font-semibold text-nilin-charcoal">Total Value</td>
            {bundles.map((bundle) => (
              <td key={bundle._id} className="p-4 text-center">
                <span className="text-sm text-nilin-warmGray line-through">
                  {formatPrice(bundle.originalPrice)}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <td className="p-4 text-sm font-semibold text-nilin-charcoal">Savings</td>
            {bundles.map((bundle) => (
              <td key={bundle._id} className="p-4 text-center">
                <Badge variant="success" size="sm">
                  Save {bundle.savingsPercentage}%
                </Badge>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ServiceBundles: React.FC<ServiceBundlesProps> = ({
  categoryId,
  limit,
  compact = false,
  onBundleBook,
  onBundleClick,
  className,
}) => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Fetch bundles from API
  const fetchBundles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (categoryId) params.append('categoryId', categoryId);
      params.append('status', 'active');
      params.append('limit', String(limit || 20));

      const response = await authService.get<{ success: boolean; data?: { bundles?: unknown[] } }>(`/api/bundles?${params.toString()}`);

      if (response.success && response.data?.bundles) {
        setBundles((response.data.bundles ?? []) as Bundle[]);
      } else {
        // Fallback to mock data for development
        setBundles(getMockBundles());
      }
    } catch (err) {
      console.error('Error fetching bundles:', err);
      // Use mock data as fallback
      setBundles(getMockBundles());
      setError('Failed to load bundles. Showing demo data.');
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, limit]);

  useEffect(() => {
    fetchBundles();
  }, [fetchBundles]);

  const handleViewDetails = useCallback((bundle: Bundle) => {
    setSelectedBundle(bundle);
    setShowDetailsModal(true);
    onBundleClick?.(bundle);
  }, [onBundleClick]);

  const handleBookNow = useCallback((bundle: Bundle) => {
    setSelectedBundle(bundle);
    setShowDetailsModal(false);
    setShowBookingModal(true);
  }, []);

  const handleConfirmBooking = useCallback(async (
    bundleId: string,
    date: string,
    notes: string
  ) => {
    try {
      setIsBooking(true);

      // Call API to book bundle
      await authService.post('/api/bundles/book', {
        bundleId,
        scheduledDate: date,
        notes,
      });

      onBundleBook?.(bundleId);
    } finally {
      setIsBooking(false);
    }
  }, [onBundleBook]);

  // Loading State
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error && bundles.length === 0) {
    return (
      <div className={cn(
        'bg-white rounded-2xl p-8 text-center shadow-sm border border-nilin-blush/30',
        className
      )}>
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <h3 className="font-semibold text-nilin-charcoal mb-2">
          Unable to load bundles
        </h3>
        <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
        <Button variant="primary" onClick={fetchBundles}>
          Try Again
        </Button>
      </div>
    );
  }

  // Empty State
  if (bundles.length === 0) {
    return (
      <div className={cn(
        'bg-white rounded-2xl p-8 text-center shadow-sm border border-nilin-blush/30',
        className
      )}>
        <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h3 className="font-semibold text-nilin-charcoal mb-2">
          No bundles available
        </h3>
        <p className="text-sm text-nilin-warmGray">
          Check back later for exciting service bundles!
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal flex items-center gap-2">
            <Package className="h-6 w-6 text-nilin-coral" />
            Service Bundles
          </h2>
          <p className="text-sm text-nilin-warmGray mt-1">
            Save up to {Math.max(...bundles.map(b => b.savingsPercentage))}% with bundled services
          </p>
        </div>

        {/* Compare Toggle */}
        {bundles.length >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? 'Hide Compare' : 'Compare Bundles'}
          </Button>
        )}
      </div>

      {/* Comparison View */}
      {showComparison && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-nilin-blush/30">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
            Compare Bundles
          </h3>
          <BundleComparison
            bundles={bundles.slice(0, 3)}
            onSelectBundle={handleBookNow}
          />
        </div>
      )}

      {/* Bundle Grid */}
      <div className={cn(
        compact
          ? 'flex gap-4 overflow-x-auto pb-2'
          : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
      )}>
        {bundles.map((bundle) => (
          <BundleCard
            key={bundle._id}
            bundle={bundle}
            compact={compact}
            onViewDetails={handleViewDetails}
            onBookNow={handleBookNow}
          />
        ))}
      </div>

      {/* Bundle Details Modal */}
      <BundleDetailsModal
        bundle={selectedBundle}
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        onBookNow={handleBookNow}
      />

      {/* Bundle Booking Modal */}
      <BundleBookingModal
        bundle={selectedBundle}
        open={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onConfirmBooking={handleConfirmBooking}
        isBooking={isBooking}
      />
    </div>
  );
};

// =============================================================================
// Mock Data for Development
// =============================================================================

function getMockBundles(): Bundle[] {
  return [
    {
      _id: 'bundle-1',
      name: 'Complete Home Clean',
      description: 'Deep cleaning package including all rooms, kitchen, and bathrooms with premium eco-friendly products.',
      services: [
        { serviceId: 's1', serviceName: 'Living Room Deep Clean', quantity: 1, originalPrice: 150 },
        { serviceId: 's2', serviceName: 'Kitchen Deep Clean', quantity: 1, originalPrice: 120 },
        { serviceId: 's3', serviceName: 'Bathroom Sanitization', quantity: 2, originalPrice: 80 },
        { serviceId: 's4', serviceName: 'Bedroom Dusting', quantity: 2, originalPrice: 60 },
      ],
      originalPrice: 490,
      bundlePrice: 349,
      savingsAmount: 141,
      savingsPercentage: 29,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      maxRedemptions: 50,
      redemptionsUsed: 23,
      isActive: true,
      rating: { average: 4.8, count: 156 },
      tags: ['Popular', 'Best Value'],
    },
    {
      _id: 'bundle-2',
      name: 'Spa Day Package',
      description: 'Full relaxation experience with massage, facial, and aromatherapy treatment.',
      services: [
        { serviceId: 's5', serviceName: 'Swedish Massage (60 min)', quantity: 1, originalPrice: 200 },
        { serviceId: 's6', serviceName: 'Signature Facial', quantity: 1, originalPrice: 180 },
        { serviceId: 's7', serviceName: 'Aromatherapy Session', quantity: 1, originalPrice: 100 },
      ],
      originalPrice: 480,
      bundlePrice: 359,
      savingsAmount: 121,
      savingsPercentage: 25,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      rating: { average: 4.9, count: 89 },
      tags: ['Wellness', 'Premium'],
    },
    {
      _id: 'bundle-3',
      name: 'Beauty Essentials',
      description: 'Complete beauty grooming package for hair, nails, and makeup.',
      services: [
        { serviceId: 's8', serviceName: 'Hair Styling', quantity: 1, originalPrice: 120 },
        { serviceId: 's9', serviceName: 'Manicure & Pedicure', quantity: 1, originalPrice: 150 },
        { serviceId: 's10', serviceName: 'Makeup Application', quantity: 1, originalPrice: 200 },
      ],
      originalPrice: 470,
      bundlePrice: 329,
      savingsAmount: 141,
      savingsPercentage: 30,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      maxRedemptions: 30,
      redemptionsUsed: 28,
      rating: { average: 4.7, count: 234 },
      tags: ['Beauty', 'Grooming'],
    },
  ];
}

// =============================================================================
// Exports
// =============================================================================

export default ServiceBundles;
