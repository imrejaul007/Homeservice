import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Navigation, Clock, X, ChevronRight } from 'lucide-react';
import { useLocationStore, SUPPORTED_CITIES } from '@/stores/locationStore';
import { cn } from '@/lib/utils';

interface LocationAutocompleteProps {
  value?: string;
  onChange?: (location: string) => void;
  onSelect?: (location: string, city?: typeof SUPPORTED_CITIES[0]) => void;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'hero';
  showCurrentLocation?: boolean;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search location...',
  className,
  variant = 'default',
  showCurrentLocation = true,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { selectedCity, setSelectedCity, getCurrentLocation, currentLocation } = useLocationStore();

  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 1) {
        setIsOpen(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter cities based on query
  const filteredCities = SUPPORTED_CITIES.filter(city =>
    city.name.toLowerCase().includes(query.toLowerCase()) ||
    city.id.includes(query.toLowerCase()) ||
    city.state.toLowerCase().includes(query.toLowerCase())
  );

  // Get nearby locations based on current location
  const getNearbyLocations = useCallback(() => {
    if (!currentLocation) return [];

    return SUPPORTED_CITIES
      .map(city => {
        const distance = calculateDistance(
          currentLocation.coordinates.latitude,
          currentLocation.coordinates.longitude,
          city.coordinates.latitude,
          city.coordinates.longitude
        );
        return { ...city, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
  }, [currentLocation]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle city selection
  const handleSelect = (city: typeof SUPPORTED_CITIES[0]) => {
    setQuery(city.name);
    setSelectedCity(city);
    onSelect?.(city.name, city);
    onChange?.(city.name);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Handle current location
  const handleCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        // Find the nearest city from our supported cities
        const nearbyCities = getNearbyLocations();
        if (nearbyCities.length > 0) {
          const nearestCity = nearbyCities[0];
          setQuery(nearestCity.name);
          setSelectedCity(nearestCity);
          onSelect?.(nearestCity.name, nearestCity);
          onChange?.(nearestCity.name);
        }
      }
    } catch (error) {
      console.error('[LocationAutocomplete] Failed to get location:', error);
    } finally {
      setIsLoadingLocation(false);
      setIsOpen(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allItems = [
      ...(showCurrentLocation ? [{ type: 'current' as const, label: 'Use current location' }] : []),
      ...filteredCities.map(city => ({ type: 'city' as const, city })),
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allItems.length) {
          const item = allItems[selectedIndex];
          if (item.type === 'current') {
            handleCurrentLocation();
          } else if ('city' in item) {
            handleSelect(item.city);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const isHeroVariant = variant === 'hero';
  const isMinimalVariant = variant === 'minimal';

  const inputClasses = cn(
    'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 outline-none',
    isHeroVariant
      ? 'bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-white/40'
      : isMinimalVariant
        ? 'bg-nilin-blush/30 border-transparent text-nilin-charcoal placeholder:text-nilin-warmGray focus:border-nilin-coral/30'
        : 'bg-white border-nilin-border text-nilin-charcoal placeholder:text-nilin-warmGray focus:border-nilin-coral',
    className
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input */}
      <div className="relative">
        <MapPin className={cn(
          'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5',
          isHeroVariant ? 'text-white/70' : 'text-nilin-warmGray'
        )} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 1 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClasses}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              onChange?.('');
              inputRef.current?.focus();
            }}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors',
              isHeroVariant ? 'text-white/70 hover:text-white' : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className={cn(
          'absolute top-full left-0 right-0 z-50 mt-2 rounded-xl shadow-2xl overflow-hidden',
          isHeroVariant ? 'bg-nilin-charcoal/95 backdrop-blur-lg border border-white/10' : 'bg-white border border-nilin-border'
        )}>
          {/* Current Location Option */}
          {showCurrentLocation && (
            <button
              onClick={handleCurrentLocation}
              disabled={isLoadingLocation}
              className={cn(
                'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                selectedIndex === 0
                  ? isHeroVariant ? 'bg-white/10' : 'bg-nilin-coral/10'
                  : isHeroVariant ? 'hover:bg-white/5' : 'hover:bg-nilin-blush/50',
                isHeroVariant ? 'text-white' : 'text-nilin-charcoal'
              )}
            >
              {isLoadingLocation ? (
                <div className="w-5 h-5 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
              ) : (
                <Navigation className={cn('w-5 h-5', isHeroVariant ? 'text-white/70' : 'text-nilin-coral')} />
              )}
              <span className="flex-1 font-medium">
                {isLoadingLocation ? 'Getting location...' : 'Use current location'}
              </span>
              <span className={cn('text-xs', isHeroVariant ? 'text-white/50' : 'text-nilin-warmGray')}>
                GPS
              </span>
            </button>
          )}

          {/* Divider */}
          {showCurrentLocation && filteredCities.length > 0 && (
            <div className={cn('h-px', isHeroVariant ? 'bg-white/10' : 'bg-nilin-border/30')} />
          )}

          {/* Cities List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredCities.length > 0 ? (
              filteredCities.map((city, index) => {
                const itemIndex = (showCurrentLocation ? 1 : 0) + index;
                return (
                  <button
                    key={city.id}
                    onClick={() => handleSelect(city)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                      selectedIndex === itemIndex
                        ? isHeroVariant ? 'bg-white/10' : 'bg-nilin-coral/10'
                        : isHeroVariant ? 'hover:bg-white/5' : 'hover:bg-nilin-blush/50',
                      isHeroVariant ? 'text-white' : 'text-nilin-charcoal'
                    )}
                  >
                    <MapPin className={cn('w-5 h-5 flex-shrink-0', isHeroVariant ? 'text-white/50' : 'text-nilin-warmGray')} />
                    <div className="flex-1">
                      <span className="font-medium">{city.name}</span>
                      <span className={cn('text-xs ml-2', isHeroVariant ? 'text-white/50' : 'text-nilin-warmGray')}>
                        {city.state}, {city.country}
                      </span>
                    </div>
                    {selectedCity?.id === city.id && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        isHeroVariant ? 'bg-white/20 text-white/80' : 'bg-nilin-coral/20 text-nilin-coral'
                      )}>
                        Selected
                      </span>
                    )}
                    <ChevronRight className={cn('w-4 h-4', isHeroVariant ? 'text-white/50' : 'text-nilin-warmGray')} />
                  </button>
                );
              })
            ) : (
              <div className={cn('px-4 py-8 text-center', isHeroVariant ? 'text-white/70' : 'text-nilin-warmGray')}>
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No locations found for "{query}"</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            'px-4 py-3 border-t text-xs',
            isHeroVariant ? 'border-white/10 text-white/50' : 'border-nilin-border/30 text-nilin-warmGray'
          )}>
            {filteredCities.length} location{filteredCities.length !== 1 ? 's' : ''} found
          </div>
        </div>
      )}

      {/* Selected City Badge */}
      {selectedCity && !query && (
        <div className={cn(
          'absolute -top-2 right-0 px-2 py-0.5 rounded-full text-xs font-medium',
          isHeroVariant ? 'bg-nilin-coral text-white' : 'bg-nilin-coral text-white'
        )}>
          {selectedCity.name}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;