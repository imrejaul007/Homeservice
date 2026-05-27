import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ServiceLocationValue } from '../../utils/providerProfile';

interface OpenCageSearchResult {
  label: string;
  formattedAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lat: number;
  lng: number;
}

interface ServiceAreaLocationPickerProps {
  value: string;
  location: ServiceLocationValue | null;
  onChange: (display: string, location: ServiceLocationValue | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

function toServiceLocation(result: OpenCageSearchResult): ServiceLocationValue {
  return {
    label: result.label,
    formattedAddress: result.formattedAddress,
    street: result.street,
    city: result.city,
    state: result.state,
    zipCode: result.zipCode,
    country: result.country,
    lat: result.lat,
    lng: result.lng,
  };
}

const ServiceAreaLocationPicker: React.FC<ServiceAreaLocationPickerProps> = ({
  value,
  location,
  onChange,
  disabled = false,
  placeholder = 'Search for your service area (e.g. Dubai Marina)',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<OpenCageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = 'location-suggestions';

  const searchPlaces = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await api.get('/location/search', {
        params: { q: query.trim(), limit: 6 },
      });

      if (response.data?.success) {
        setSuggestions(response.data.results || []);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setSearchError(response.data?.message || 'Location search unavailable');
      }
    } catch (err: unknown) {
      setSuggestions([]);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not search locations. Check that OPENCAGE_API_KEY is set on the server.';
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text, null);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(text), 350);
  };

  const handleSelect = (result: OpenCageSearchResult) => {
    const loc = toServiceLocation(result);
    onChange(loc.label, loc);
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchError(null);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const showConfirmed = Boolean(location?.lat != null && location?.lng != null);

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray pointer-events-none z-10" />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray animate-spin" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim().length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={selectedIndex >= 0 ? `location-option-${selectedIndex}` : undefined}
        />

        {showSuggestions && suggestions.length > 0 && !disabled && (
          <ul
            id={listboxId}
            className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-nilin border border-nilin-border bg-white shadow-lg"
            role="listbox"
            aria-label="Location suggestions"
          >
            {suggestions.map((result, index) => (
              <li
                key={`${result.lat}-${result.lng}-${index}`}
                id={`location-option-${index}`}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <button
                  type="button"
                  className={`w-full px-4 py-3 text-left text-sm transition-colors border-b border-nilin-border/50 last:border-0 ${
                    selectedIndex === index ? 'bg-nilin-coral/10' : 'hover:bg-nilin-muted'
                  }`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="font-medium text-nilin-charcoal block">{result.label}</span>
                  {result.formattedAddress && result.formattedAddress !== result.label && (
                    <span className="text-xs text-nilin-warmGray mt-0.5 block truncate">
                      {result.formattedAddress}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showConfirmed && (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Location set: {location?.label}
          {location?.formattedAddress && location.formattedAddress !== location.label
            ? ` — ${location.formattedAddress}`
            : ''}
        </p>
      )}

      {searchError && (
        <p className="flex items-start gap-2 text-xs text-amber-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {searchError}
        </p>
      )}

      {isSearching && (
        <p className="sr-only" role="status" aria-live="polite">
          Searching for locations...
        </p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <p className="sr-only" role="status" aria-live="polite">
          {suggestions.length} location{suggestions.length !== 1 ? 's' : ''} found
        </p>
      )}

      {!disabled && !showConfirmed && !searchError && (
        <p className="text-xs text-nilin-warmGray">
          Type at least 2 characters and pick a place from the list — powered by OpenCage.
        </p>
      )}
    </div>
  );
};

export default ServiceAreaLocationPicker;
