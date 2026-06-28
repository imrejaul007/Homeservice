import React, { useState, useEffect } from 'react';
import { X, Filter, SlidersHorizontal, MapPin, Clock, Star, ChevronDown, Navigation } from 'lucide-react';
import { searchApi } from '../../services/searchApi';
import { useLocationStore } from '../../stores/locationStore';

export interface AdvancedFilterOptions {
  // Location filters
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  city?: string;

  // Time filters
  availableDays?: string[];
  timeSlot?: 'morning' | 'afternoon' | 'evening' | 'night';

  // Provider filters
  providerRating?: number;
  providerVerified?: boolean;
  providerTier?: 'elite' | 'premium' | 'standard';

  // Service filters
  instantBook?: boolean;
  freeCancellation?: boolean;
  hasDiscount?: boolean;

  // Sort options
  sortBy?: 'relevance' | 'rating' | 'price_asc' | 'price_desc' | 'distance' | 'popularity';
}

interface AdvancedBookingFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedFilterOptions) => void;
  onClear: () => void;
  currentFilters?: AdvancedFilterOptions;
  maxPriceLimit?: number;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (6AM - 12PM)', icon: '🌅' },
  { value: 'afternoon', label: 'Afternoon (12PM - 5PM)', icon: '☀️' },
  { value: 'evening', label: 'Evening (5PM - 9PM)', icon: '🌆' },
  { value: 'night', label: 'Night (9PM - 6AM)', icon: '🌙' },
];

const PROVIDER_TIERS: Array<{ value: 'elite' | 'premium' | 'standard'; label: string; color: string }> = [
  { value: 'elite', label: 'Elite', color: 'bg-gradient-to-r from-amber-500 to-yellow-500' },
  { value: 'premium', label: 'Premium', color: 'bg-gradient-to-r from-violet-500 to-purple-500' },
  { value: 'standard', label: 'Standard', color: 'bg-gray-500' },
];

const AdvancedBookingFilters: React.FC<AdvancedBookingFiltersProps> = ({
  isOpen,
  onClose,
  onApply,
  onClear,
  currentFilters = {},
  maxPriceLimit = 10000,
}) => {
  const [filters, setFilters] = useState<AdvancedFilterOptions>(currentFilters);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { currentLocation, fetchCurrentLocation } = useLocationStore();

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  const handleUseMyLocation = async () => {
    setIsGettingLocation(true);
    try {
      const location = await fetchCurrentLocation();
      if (location?.coordinates) {
        setFilters(prev => ({
          ...prev,
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude,
        }));
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleClearLocation = () => {
    setFilters(prev => ({
      ...prev,
      latitude: undefined,
      longitude: undefined,
      radiusKm: undefined,
    }));
  };

  if (!isOpen) return null;

  const handleDayToggle = (day: string) => {
    const currentDays = filters.availableDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setFilters({ ...filters, availableDays: newDays.length > 0 ? newDays : undefined });
  };

  const handleTimeSlotChange = (slot: string) => {
    setFilters({ ...filters, timeSlot: filters.timeSlot === slot ? undefined : slot as any });
  };

  const handleRatingChange = (rating: number) => {
    setFilters({ ...filters, providerRating: filters.providerRating === rating ? undefined : rating });
  };

  const handleTierToggle = (tier: 'elite' | 'premium' | 'standard') => {
    const currentTiers = filters.providerTier ? [filters.providerTier] : [];
    const newTiers = currentTiers.includes(tier)
      ? currentTiers.filter(t => t !== tier)
      : [...currentTiers, tier];
    setFilters({ ...filters, providerTier: newTiers[0] });
  };

  const handleBooleanToggle = (key: keyof AdvancedBookingOptions) => {
    setFilters({ ...filters, [key]: !filters[key] });
  };

  const handleSortChange = (sort: string) => {
    setFilters({ ...filters, sortBy: sort as any });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    setFilters({});
    onClear();
    onClose();
  };

  const sections = [
    {
      id: 'location',
      label: 'Location',
      icon: MapPin,
      content: (
        <div className="space-y-4">
          {/* Use My Location Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUseMyLocation}
              disabled={isGettingLocation}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-nilin-coral text-white rounded-lg text-sm font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 ${isGettingLocation ? 'animate-pulse' : ''}`} />
              {isGettingLocation ? 'Getting location...' : 'Use my location'}
            </button>
            {filters.latitude && filters.longitude && (
              <button
                onClick={handleClearLocation}
                className="px-3 py-2 text-sm text-nilin-warmGray hover:text-nilin-charcoal"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {filters.latitude && filters.longitude && (
            <p className="text-xs text-nilin-warmGray">
              Location set: {filters.latitude.toFixed(4)}, {filters.longitude.toFixed(4)}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Radius
            </label>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 25, 50, 100].map(radius => (
                <button
                  key={radius}
                  onClick={() => setFilters({ ...filters, radiusKm: radius })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.radiusKm === radius
                      ? 'bg-nilin-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {radius} km
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'time',
      label: 'Availability',
      icon: Clock,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Time Slot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot.value}
                  onClick={() => handleTimeSlotChange(slot.value)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-2 ${
                    filters.timeSlot === slot.value
                      ? 'bg-nilin-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{slot.icon}</span>
                  <span>{slot.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Days
            </label>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.value}
                  onClick={() => handleDayToggle(day.value)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                    filters.availableDays?.includes(day.value)
                      ? 'bg-nilin-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'provider',
      label: 'Provider',
      icon: Star,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Rating
            </label>
            <div className="flex gap-2">
              {[5, 4, 3, 2, 1].map(rating => (
                <button
                  key={rating}
                  onClick={() => handleRatingChange(rating)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.providerRating === rating
                      ? 'bg-nilin-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Star className={`w-4 h-4 ${filters.providerRating === rating ? 'fill-current' : 'fill-amber-400 text-amber-400'}`} />
                  <span>{rating}+</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider Tier
            </label>
            <div className="flex gap-2">
              {PROVIDER_TIERS.map(tier => (
                <button
                  key={tier.value}
                  onClick={() => handleTierToggle(tier.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                    filters.providerTier === tier.value
                      ? tier.color
                      : 'bg-gray-200'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.providerVerified || false}
                onChange={() => handleBooleanToggle('providerVerified')}
                className="w-4 h-4 rounded border-gray-300 text-nilin-primary focus:ring-nilin-primary"
              />
              <span className="text-sm text-gray-700">Verified providers only</span>
            </label>
          </div>
        </div>
      ),
    },
    {
      id: 'service',
      label: 'Service Options',
      icon: SlidersHorizontal,
      content: (
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.instantBook || false}
              onChange={() => handleBooleanToggle('instantBook')}
              className="w-4 h-4 rounded border-gray-300 text-nilin-primary focus:ring-nilin-primary"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Instant Booking</span>
              <p className="text-xs text-gray-500">Book immediately without approval</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.freeCancellation || false}
              onChange={() => handleBooleanToggle('freeCancellation')}
              className="w-4 h-4 rounded border-gray-300 text-nilin-primary focus:ring-nilin-primary"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Free Cancellation</span>
              <p className="text-xs text-gray-500">Cancel for free up to 24 hours before</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.hasDiscount || false}
              onChange={() => handleBooleanToggle('hasDiscount')}
              className="w-4 h-4 rounded border-gray-300 text-nilin-primary focus:ring-nilin-primary"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Special Offers</span>
              <p className="text-xs text-gray-500">Show only discounted services</p>
            </div>
          </label>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-nilin-primary" />
            <h2 className="text-lg font-bold text-gray-900">Advanced Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {sections.map(section => (
              <div key={section.id}>
                <button
                  onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-900">{section.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      activeSection === section.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {activeSection === section.id && (
                  <div className="px-4 pb-4">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleClear}
              className="flex-1 py-3 px-4 border border-gray-200 rounded-full font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-3 px-4 bg-nilin-primary text-white rounded-full font-semibold hover:bg-nilin-primary/90 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedBookingFilters;

// Type alias for the boolean toggle keys
type AdvancedBookingOptions = Pick<
  AdvancedFilterOptions,
  'providerVerified' | 'instantBook' | 'freeCancellation' | 'hasDiscount'
>;

export { AdvancedBookingFilters };
