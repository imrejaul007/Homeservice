import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Navigation, Check } from 'lucide-react';
import { useLocationStore, SUPPORTED_CITIES } from '@/stores/locationStore';
import type { SupportedCity } from '@/types/location.types';

interface LocationDropdownProps {
  variant?: 'desktop' | 'mobile';
  /** Light styling for transparent hero header */
  overlay?: boolean;
}

const LocationDropdown: React.FC<LocationDropdownProps> = ({ variant = 'desktop', overlay = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    currentLocation,
    selectedCity,
    isLoading,
    error,
    requestLocationPermission,
    setSelectedCity,
    getCurrentLocation,
  } = useLocationStore();

  const currentCity = selectedCity || SUPPORTED_CITIES[0];
  const displayLocation = selectedCity?.name || currentLocation?.address.city || currentCity.name;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCitySelect = (city: SupportedCity) => {
    setSelectedCity(city);
    setIsOpen(false);
  };

  const handleUseMyLocation = async () => {
    setIsOpen(false);
    const granted = await requestLocationPermission();
    if (granted) {
      await getCurrentLocation();
    }
  };

  if (variant === 'mobile') {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1 text-sm transition-colors duration-200 ${
          overlay
            ? 'text-white/90 hover:text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]'
            : 'text-nilin-warmGray hover:text-nilin-charcoal'
        }`}
      >
        <MapPin className="h-4 w-4" />
        <span className="text-xs font-medium">{displayLocation}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-nilin transition-all duration-200 ${
          overlay
            ? 'text-white/95 hover:text-white hover:bg-white/15 [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]'
            : 'text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/50 shadow-nilin-warm hover:shadow-lg'
        }`}
      >
        <MapPin className="h-4 w-4" />
        <span>{displayLocation}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-72 bg-nilin-surface rounded-nilin shadow-xl border border-nilin-border py-2 z-50 animate-fade-in">
            <button
              onClick={handleUseMyLocation}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 transition-all duration-200"
            >
              <Navigation className="h-4 w-4 text-nilin-coral" />
              <span className="font-medium">Use my current location</span>
              {isLoading && (
                <span className="ml-auto text-xs text-nilin-warmGray">Locating...</span>
              )}
            </button>

            <div className="border-t border-nilin-border my-2" />

            <div className="px-4 py-2">
              <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-2">
                Select a city
              </p>
              <div className="space-y-1">
                {SUPPORTED_CITIES.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleCitySelect(city)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                      currentCity.id === city.id
                        ? 'bg-nilin-blush/70 text-nilin-charcoal font-medium'
                        : 'text-nilin-warmGray hover:bg-nilin-blush/50 hover:text-nilin-charcoal'
                    }`}
                  >
                    <span>{city.name}, {city.state}</span>
                    {currentCity.id === city.id && (
                      <Check className="h-4 w-4 text-nilin-coral" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="px-4 py-2 border-t border-nilin-border">
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LocationDropdown;
