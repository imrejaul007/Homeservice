import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Zap, Clock, Star, MapPin, ChevronRight, X, AlertCircle, Loader2 } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';
import { Modal } from '../common/Modal';

// =============================================================================
// NILIN Customer Dashboard - Saved Providers Quick Book Component
// Saved providers with one-click booking functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface SavedProvider {
  id: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  location?: {
    city?: string;
    state?: string;
  };
  distance?: number;
  specializations?: string[];
  services?: Array<{
    _id: string;
    name: string;
    price: number;
    duration: number;
  }>;
  savedAt: Date;
  notes?: string;
}

export interface SavedProvidersQuickBookProps {
  /** Limit number of providers shown */
  limit?: number;
  /** Show quick book button */
  showQuickBook?: boolean;
  /** Callback when provider is clicked */
  onProviderClick?: (provider: SavedProvider) => void;
  /** Callback when booking is made */
  onBookingComplete?: (providerId: string, serviceId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Provider Card Component
// =============================================================================

interface ProviderCardProps {
  provider: SavedProvider;
  onProviderClick?: (provider: SavedProvider) => void;
  onQuickBook?: (provider: SavedProvider) => void;
  onRemove?: (providerId: string) => void;
  isQuickBooking?: boolean;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onProviderClick,
  onQuickBook,
  onRemove,
  isQuickBooking = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onProviderClick?.(provider);
  };

  const handleQuickBook = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickBook?.(provider);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(provider.id);
  };

  const displayName = provider.businessName || `${provider.firstName} ${provider.lastName}`;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <article
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30 hover:shadow-lg hover:border-pink-200 transition-all duration-300 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Saved provider: ${displayName}`}
    >
      {/* Remove Button */}
      <button
        onClick={handleRemove}
        className={cn(
          'absolute top-3 right-3 z-10 p-1.5 rounded-full transition-all duration-200',
          isHovered
            ? 'bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-100'
            : 'bg-white/70 text-transparent opacity-0'
        )}
        aria-label="Remove from saved providers"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Cover/Header */}
      <div className="relative h-20 bg-gradient-to-br from-pink-100 via-rose-50 to-red-50">
        {/* Status Indicator */}
        <div className="absolute bottom-2 left-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Available
          </span>
        </div>
      </div>

      {/* Profile Image */}
      <div className="relative px-4 -mt-8">
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-nilin-coral to-rose-500 p-0.5">
          {provider.avatar && !imageError ? (
            <img
              src={provider.avatar}
              alt={displayName}
              className="w-full h-full rounded-full object-cover bg-white"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <span className="text-lg font-bold text-nilin-coral">{initial}</span>
            </div>
          )}
          {/* Online Indicator */}
          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-2">
        <h3 className="font-semibold text-nilin-charcoal line-clamp-1 group-hover:text-nilin-coral transition-colors">
          {displayName}
        </h3>

        {/* Location */}
        {provider.location && (
          <div className="flex items-center gap-1 mt-1 text-xs text-nilin-warmGray">
            <MapPin className="h-3 w-3" />
            <span>{provider.location.city || 'Unknown location'}</span>
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium text-nilin-charcoal">
              {provider.rating?.toFixed(1) || '0.0'}
            </span>
          </div>
          <span className="text-xs text-nilin-warmGray">
            ({provider.reviewCount || 0} reviews)
          </span>
        </div>

        {/* Specializations */}
        {provider.specializations && provider.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {provider.specializations.slice(0, 2).map((spec, index) => (
              <span
                key={index}
                className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-xs"
              >
                {spec}
              </span>
            ))}
            {provider.specializations.length > 2 && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                +{provider.specializations.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Popular Service */}
        {provider.services && provider.services.length > 0 && (
          <div className="mt-3 pt-3 border-t border-nilin-blush/30">
            <p className="text-xs text-nilin-warmGray mb-1">Popular service</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-nilin-charcoal">
                {provider.services[0].name}
              </span>
              <span className="text-sm font-bold text-nilin-coral">
                {formatPrice(provider.services[0].price)}
              </span>
            </div>
          </div>
        )}

        {/* Quick Book Button */}
        <Button
          variant="primary"
          size="sm"
          fullWidth
          className="mt-4"
          onClick={handleQuickBook}
          loading={isQuickBooking}
          leftIcon={<Zap className="h-4 w-4" />}
        >
          Quick Book
        </Button>
      </div>
    </article>
  );
};

// =============================================================================
// Quick Book Modal
// =============================================================================

interface QuickBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: SavedProvider | null;
  onConfirm: (serviceId: string, date: string, time: string) => Promise<void>;
}

const QuickBookModal: React.FC<QuickBookModalProps> = ({
  open,
  onOpenChange,
  provider,
  onConfirm,
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = provider?.businessName || provider ? `${provider.firstName} ${provider.lastName}` : '';

  // Generate available dates (next 7 days)
  const availableDates = React.useMemo(() => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayName: date.toLocaleDateString('en-AE', { weekday: 'short' }),
      });
    }

    return dates;
  }, []);

  // Generate available time slots
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ];

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      setError('Please select a service, date, and time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(selectedService, selectedDate, selectedTime);
      onOpenChange(false);
      // Reset state
      setSelectedService(null);
      setSelectedDate('');
      setSelectedTime('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!provider) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Book"
      description={`Book with ${displayName}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Provider Info */}
        <div className="flex items-center gap-3 p-3 bg-nilin-blush/20 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <span className="text-sm font-bold text-nilin-coral">
              {displayName.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-nilin-charcoal">{displayName}</p>
            <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span>{provider.rating?.toFixed(1)} ({provider.reviewCount} reviews)</span>
            </div>
          </div>
        </div>

        {/* Service Selection */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Select Service
          </label>
          <div className="space-y-2">
            {provider.services?.map((service) => (
              <button
                key={service._id}
                onClick={() => setSelectedService(service._id)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all',
                  selectedService === service._id
                    ? 'border-nilin-coral bg-nilin-coral/5'
                    : 'border-nilin-blush/30 hover:border-nilin-coral/30'
                )}
              >
                <div className="text-left">
                  <p className="font-medium text-nilin-charcoal">{service.name}</p>
                  <p className="text-xs text-nilin-warmGray flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {service.duration} min
                  </p>
                </div>
                <span className="font-bold text-nilin-coral">
                  {formatPrice(service.price)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Select Date
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {availableDates.map((date) => (
              <button
                key={date.value}
                onClick={() => setSelectedDate(date.value)}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border-2 transition-all',
                  selectedDate === date.value
                    ? 'border-nilin-coral bg-nilin-coral/5'
                    : 'border-nilin-blush/30 hover:border-nilin-coral/30'
                )}
              >
                <span className="text-xs text-nilin-warmGray">{date.dayName}</span>
                <span className="text-sm font-medium text-nilin-charcoal">{date.label.split(', ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Select Time
          </label>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={cn(
                  'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                  selectedTime === time
                    ? 'border-nilin-coral bg-nilin-coral text-white'
                    : 'border-nilin-blush/30 text-nilin-charcoal hover:border-nilin-coral/30'
                )}
              >
                {time}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <Modal.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={!selectedService || !selectedDate || !selectedTime}
          leftIcon={<Zap className="h-4 w-4" />}
        >
          Confirm Booking
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const SavedProvidersQuickBook: React.FC<SavedProvidersQuickBookProps> = ({
  limit = 6,
  showQuickBook = true,
  onProviderClick,
  onBookingComplete,
  className,
}) => {
  const navigate = useNavigate();
  const [savedProviders, setSavedProviders] = useState<SavedProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickBookProvider, setQuickBookProvider] = useState<SavedProvider | null>(null);
  const [quickBookModalOpen, setQuickBookModalOpen] = useState(false);

  const customerProfile = useAuthStore((state) => state.customerProfile);

  // Load saved providers
  React.useEffect(() => {
    const loadSavedProviders = async () => {
      setIsLoading(true);

      try {
        // In real app, this would fetch from API
        // For demo, use mock data or profile favorites
        const mockProviders: SavedProvider[] = [
          {
            id: 'provider-1',
            firstName: 'Sarah',
            lastName: 'Johnson',
            businessName: 'Sarah\'s Cleaning Services',
            rating: 4.9,
            reviewCount: 127,
            location: { city: 'Dubai', state: 'Dubai' },
            specializations: ['Deep Cleaning', 'Move-in/Move-out'],
            services: [
              { _id: 's1', name: 'Deep Cleaning', price: 299, duration: 180 },
              { _id: 's2', name: 'Standard Cleaning', price: 149, duration: 120 },
            ],
            savedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          {
            id: 'provider-2',
            firstName: 'Ahmed',
            lastName: 'Khalid',
            rating: 4.7,
            reviewCount: 89,
            location: { city: 'Abu Dhabi', state: 'Abu Dhabi' },
            specializations: ['Plumbing', 'Electrical'],
            services: [
              { _id: 's3', name: 'Pipe Repair', price: 199, duration: 60 },
              { _id: 's4', name: 'Full Inspection', price: 99, duration: 45 },
            ],
            savedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
          {
            id: 'provider-3',
            firstName: 'Fatima',
            lastName: 'Ali',
            businessName: 'Beauty by Fatima',
            rating: 4.8,
            reviewCount: 203,
            location: { city: 'Dubai', state: 'Dubai' },
            specializations: ['Hair Styling', 'Makeup', 'Facials'],
            services: [
              { _id: 's5', name: 'Hair Styling', price: 250, duration: 90 },
              { _id: 's6', name: 'Full Makeup', price: 350, duration: 120 },
            ],
            savedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          },
        ];

        // Filter by favorites from profile if available
        const favorites = customerProfile?.favoriteProviders || [];
        if (favorites.length > 0) {
          setSavedProviders(mockProviders.filter(p => favorites.includes(p.id)));
        } else {
          setSavedProviders(mockProviders);
        }
      } catch (error) {
        console.error('Failed to load saved providers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedProviders();
  }, [customerProfile]);

  const handleProviderClick = useCallback((provider: SavedProvider) => {
    if (onProviderClick) {
      onProviderClick(provider);
    } else {
      navigate(`/provider/${provider.id}`);
    }
  }, [navigate, onProviderClick]);

  const handleQuickBook = useCallback((provider: SavedProvider) => {
    setQuickBookProvider(provider);
    setQuickBookModalOpen(true);
  }, []);

  const handleRemove = useCallback((providerId: string) => {
    setSavedProviders((prev) => prev.filter((p) => p.id !== providerId));

    // In real app, also update the backend
    try {
      const favorites = customerProfile?.favoriteProviders || [];
      const updated = favorites.filter((id: string) => id !== providerId);
      // Would call API to update favorites
    } catch (error) {
      console.error('Failed to remove provider from favorites');
    }
  }, [customerProfile]);

  const handleQuickBookConfirm = async (serviceId: string, date: string, time: string) => {
    if (!quickBookProvider) return;

    // In real app, create booking via API
    // For demo, just simulate success
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onBookingComplete?.(quickBookProvider.id, serviceId);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100">
              <Heart className="h-5 w-5 text-pink-600" />
            </div>
            <Skeleton className="h-7 w-44" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <Skeleton className="w-full h-20" />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-16 h-16 rounded-full -mt-8" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full mt-4 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty State
  if (savedProviders.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100">
              <Heart className="h-5 w-5 text-pink-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Saved Providers
            </h2>
          </div>
        </div>

        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="No saved providers yet"
          description="Save your favorite providers to book them quickly in the future."
          action={{
            label: 'Browse Providers',
            onClick: () => navigate('/providers'),
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100">
            <Heart className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Saved Providers
            </h2>
            <p className="text-sm text-nilin-warmGray">
              Quick access to your favorites
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          rightIcon={<ChevronRight className="h-4 w-4" />}
          onClick={() => navigate('/saved-providers')}
        >
          View All
        </Button>
      </div>

      {/* Providers Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        role="feed"
        aria-label="Saved providers"
      >
        {savedProviders.slice(0, limit).map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onProviderClick={handleProviderClick}
            onQuickBook={showQuickBook ? handleQuickBook : undefined}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Quick Book Modal */}
      <QuickBookModal
        open={quickBookModalOpen}
        onOpenChange={setQuickBookModalOpen}
        provider={quickBookProvider}
        onConfirm={handleQuickBookConfirm}
      />
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default SavedProvidersQuickBook;
