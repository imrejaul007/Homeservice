import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Home, Building, Briefcase, Check, Loader2 } from 'lucide-react';
import { customerApi, type Address } from '../../../services/customerApi';
import toast from 'react-hot-toast';

interface SavedAddressSelectorProps {
  selectedAddressId: string | null;
  onSelect: (address: Address | null) => void;
  onManageAddresses?: () => void;
}

const SavedAddressSelector: React.FC<SavedAddressSelectorProps> = ({
  selectedAddressId,
  onSelect,
  onManageAddresses,
}) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await customerApi.getAddresses();
      setAddresses(response.data.addresses);
      // Auto-select default address if nothing selected yet
      if (!selectedAddressId && response.data.addresses.length > 0) {
        const defaultAddr = response.data.addresses.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          onSelect(defaultAddr);
        } else {
          // Select first address by default
          onSelect(response.data.addresses[0]);
        }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load saved addresses';
      setError(message);
      console.error('[SavedAddressSelector] Error fetching addresses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (address: Address | null) => {
    onSelect(address);
    setShowNewForm(address === null);
  };

  const getLabelIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('home')) return <Home className="w-5 h-5" />;
    if (lowerLabel.includes('work') || lowerLabel.includes('office')) return <Briefcase className="w-5 h-5" />;
    if (lowerLabel.includes('business')) return <Building className="w-5 h-5" />;
    return <MapPin className="w-5 h-5" />;
  };

  const formatAddress = (address: Address) => {
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-nilin-coral" />
        <span className="ml-2 text-nilin-warmGray">Loading saved addresses...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button
          onClick={fetchAddresses}
          className="text-nilin-coral text-sm hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-nilin-charcoal">
          Select a saved address
        </label>
        {onManageAddresses && (
          <button
            onClick={onManageAddresses}
            className="text-xs text-nilin-coral hover:underline"
          >
            Manage addresses
          </button>
        )}
      </div>

      {/* Saved Addresses */}
      {addresses.length > 0 ? (
        <div className="space-y-2">
          {addresses.map((address) => {
            const isSelected = selectedAddressId === address._id;
            return (
              <button
                key={address._id}
                type="button"
                onClick={() => handleSelect(address)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-br from-nilin-coral/10 to-nilin-peach/10 border-nilin-coral shadow-nilin-warm'
                    : 'bg-white/80 border-nilin-border/30 hover:border-nilin-coral/50 hover:bg-nilin-blush/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-nilin-coral/20' : 'bg-nilin-muted'
                  }`}>
                    <span className={isSelected ? 'text-nilin-coral' : 'text-nilin-warmGray'}>
                      {getLabelIcon(address.label)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-nilin-charcoal">{address.label}</span>
                      {address.isDefault && (
                        <span className="px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-nilin-warmGray truncate">
                      {formatAddress(address)}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? 'bg-nilin-coral border-nilin-coral'
                      : 'border-nilin-border'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Enter new address option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              selectedAddressId === null && !showNewForm
                ? 'bg-gradient-to-br from-nilin-coral/10 to-nilin-peach/10 border-nilin-coral shadow-nilin-warm'
                : showNewForm
                ? 'bg-gradient-to-br from-nilin-coral/10 to-nilin-peach/10 border-nilin-coral shadow-nilin-warm'
                : 'bg-white/80 border-nilin-border/30 hover:border-nilin-coral/50 hover:bg-nilin-blush/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                selectedAddressId === null || showNewForm
                  ? 'bg-nilin-coral/20'
                  : 'bg-nilin-muted'
              }`}>
                <span className={selectedAddressId === null || showNewForm ? 'text-nilin-coral' : 'text-nilin-warmGray'}>
                  <Plus className="w-5 h-5" />
                </span>
              </div>
              <div className="flex-1">
                <span className="font-medium text-nilin-charcoal">Enter a new address</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedAddressId === null || showNewForm
                  ? 'bg-nilin-coral border-nilin-coral'
                  : 'border-nilin-border'
              }`}>
                {(selectedAddressId === null || showNewForm) && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          </button>
        </div>
      ) : (
        /* No saved addresses - show only new address option */
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="w-full text-left p-4 rounded-xl border-2 border-nilin-coral bg-gradient-to-br from-nilin-coral/10 to-nilin-peach/10 shadow-nilin-warm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-nilin-coral" />
              </div>
              <div className="flex-1">
                <span className="font-medium text-nilin-charcoal">Enter your address</span>
                <p className="text-xs text-nilin-warmGray">No saved addresses yet</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-nilin-coral flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default SavedAddressSelector;
