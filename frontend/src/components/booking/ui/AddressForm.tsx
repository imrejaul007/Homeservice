import React from 'react';

interface AddressFormData {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface AddressFormProps {
  address: AddressFormData;
  onChange: (address: AddressFormData) => void;
  showCountry?: boolean;
}

const AddressForm: React.FC<AddressFormProps> = ({
  address,
  onChange,
  showCountry = false,
}) => {
  const handleChange = (field: keyof AddressFormData, value: string) => {
    onChange({
      ...address,
      [field]: value,
    });
  };

  return (
    <div className="space-y-3">
      {/* Street Address */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
          Street Address
        </label>
        <input
          type="text"
          value={address.street}
          onChange={(e) => handleChange('street', e.target.value)}
          placeholder="Building Name, Street, Area"
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
        />
      </div>

      {/* City and State */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
            City
          </label>
          <input
            type="text"
            value={address.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="Dubai"
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
            State
          </label>
          <input
            type="text"
            value={address.state}
            onChange={(e) => handleChange('state', e.target.value)}
            placeholder="Dubai"
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
          />
        </div>
      </div>

      {/* ZIP Code */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
          Postal Code
        </label>
        <input
          type="text"
          value={address.zipCode}
          onChange={(e) => handleChange('zipCode', e.target.value)}
          placeholder="12345"
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
        />
      </div>

      {/* Country (optional, default UAE) */}
      {showCountry && (
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
            Country
          </label>
          <input
            type="text"
            value={address.country || 'UAE'}
            onChange={(e) => handleChange('country', e.target.value)}
            placeholder="UAE"
            disabled
            className="w-full px-4 py-3 rounded-xl focus:outline-none font-sans border-2 border-nilin-border bg-nilin-muted/50 text-nilin-warmGray transition-all duration-300"
          />
        </div>
      )}
    </div>
  );
};

export default AddressForm;
