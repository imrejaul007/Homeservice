import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Minus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  Tag,
  Calendar,
  DollarSign
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  images?: string[];
}

interface BundleService {
  service: Service;
  quantity: number;
}

interface BundleBuilderProps {
  services: Service[];
  onBundleCreate: (bundle: {
    name: string;
    description: string;
    serviceIds: string[];
    discountPercentage: number;
  }) => Promise<void>;
  maxServices?: number;
  minServices?: number;
  currency?: string;
}

const BundleBuilder: React.FC<BundleBuilderProps> = ({
  services,
  onBundleCreate,
  maxServices = 10,
  minServices = 2,
  currency = 'AED',
}) => {
  const [selectedServices, setSelectedServices] = useState<BundleService[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate totals
  const originalTotal = selectedServices.reduce(
    (sum, item) => sum + item.service.price * item.quantity,
    0
  );
  const discountAmount = originalTotal * (discountPercentage / 100);
  const bundlePrice = originalTotal - discountAmount;
  const savingsPercentage = originalTotal > 0
    ? Math.round((discountAmount / originalTotal) * 100)
    : 0;

  const addService = (service: Service) => {
    if (selectedServices.length >= maxServices) {
      setError(`Maximum ${maxServices} services allowed in a bundle`);
      return;
    }

    const existing = selectedServices.find(
      (item) => item.service._id === service._id
    );

    if (existing) {
      setSelectedServices(
        selectedServices.map((item) =>
          item.service._id === service._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setSelectedServices([...selectedServices, { service, quantity: 1 }]);
    }
    setError(null);
  };

  const removeService = (serviceId: string) => {
    const service = selectedServices.find((item) => item.service._id === serviceId);
    if (service && service.quantity > 1) {
      setSelectedServices(
        selectedServices.map((item) =>
          item.service._id === serviceId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      );
    } else {
      setSelectedServices(
        selectedServices.filter((item) => item.service._id !== serviceId)
      );
    }
  };

  const deleteService = (serviceId: string) => {
    setSelectedServices(
      selectedServices.filter((item) => item.service._id !== serviceId)
    );
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some((item) => item.service._id === serviceId);
  };

  const handleCreateBundle = async () => {
    setError(null);
    setSuccess(false);

    // Validation
    if (selectedServices.length < minServices) {
      setError(`At least ${minServices} services are required`);
      return;
    }

    if (!bundleName.trim()) {
      setError('Please enter a bundle name');
      return;
    }

    if (!bundleDescription.trim()) {
      setError('Please enter a bundle description');
      return;
    }

    if (discountPercentage < 0 || discountPercentage > 90) {
      setError('Discount must be between 0% and 90%');
      return;
    }

    try {
      setIsCreating(true);
      await onBundleCreate({
        name: bundleName.trim(),
        description: bundleDescription.trim(),
        serviceIds: selectedServices.map((item) => item.service._id),
        discountPercentage,
      });
      setSuccess(true);

      // Reset form
      setSelectedServices([]);
      setBundleName('');
      setBundleDescription('');
      setDiscountPercentage(10);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bundle');
    } finally {
      setIsCreating(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-lg">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-nilin-charcoal">
              Create Service Bundle
            </h2>
            <p className="text-sm text-nilin-gray">
              Combine multiple services at a discounted price
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal">
                Select Services
              </h3>
              <span className="text-sm text-nilin-gray">
                {selectedServices.length}/{maxServices} selected
              </span>
            </div>

            {/* Service Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((service) => (
                <div
                  key={service._id}
                  className={cn(
                    'relative border rounded-lg p-4 transition-all cursor-pointer',
                    isServiceSelected(service._id)
                      ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  )}
                  onClick={() => addService(service)}
                >
                  {isServiceSelected(service._id) && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-nilin-charcoal truncate">
                        {service.name}
                      </h4>
                      <p className="text-sm text-nilin-gray line-clamp-2">
                        {service.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-semibold text-nilin-coral">
                          {formatPrice(service.price)}
                        </span>
                        <span className="text-xs text-nilin-gray">
                          {service.duration} min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {services.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-nilin-gray">No services available</p>
              </div>
            )}
          </div>
        </div>

        {/* Bundle Preview */}
        <div className="space-y-4">
          {/* Selected Services */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
              Your Bundle
            </h3>

            {selectedServices.length === 0 ? (
              <div className="text-center py-6 text-nilin-gray">
                <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Select services to create your bundle</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedServices.map((item) => (
                  <div
                    key={item.service._id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-nilin-charcoal truncate">
                        {item.service.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-nilin-gray">
                        <button
                          onClick={() => removeService(item.service._id)}
                          className="p-1 hover:bg-gray-100 rounded"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-medium">{item.quantity}</span>
                        <button
                          onClick={() => addService(item.service)}
                          className="p-1 hover:bg-gray-100 rounded"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-medium">
                        {formatPrice(item.service.price * item.quantity)}
                      </p>
                      <button
                        onClick={() => deleteService(item.service._id)}
                        className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {/* Bundle Totals */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-nilin-gray">
                    <span>Original Total</span>
                    <span className="line-through">{formatPrice(originalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-nilin-success font-medium">
                    <span>Your Savings</span>
                    <span>-{formatPrice(discountAmount)} ({savingsPercentage}%)</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-nilin-charcoal pt-2">
                    <span>Bundle Price</span>
                    <span>{formatPrice(bundlePrice)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bundle Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
              Bundle Details
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Bundle Name *
                </label>
                <input
                  type="text"
                  value={bundleName}
                  onChange={(e) => setBundleName(e.target.value)}
                  placeholder="e.g., Home Deep Clean Package"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Description *
                </label>
                <textarea
                  value={bundleDescription}
                  onChange={(e) => setBundleDescription(e.target.value)}
                  placeholder="Describe what's included in this bundle..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition resize-none"
                />
              </div>

              {/* Discount Slider */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Discount: {discountPercentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                  className="w-full accent-nilin-coral"
                />
                <div className="flex justify-between text-xs text-nilin-gray mt-1">
                  <span>0%</span>
                  <span>50%</span>
                </div>
              </div>

              {/* Quick Discount Buttons */}
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((discount) => (
                  <button
                    key={discount}
                    onClick={() => setDiscountPercentage(discount)}
                    className={cn(
                      'flex-1 py-1.5 text-sm font-medium rounded-lg transition',
                      discountPercentage === discount
                        ? 'bg-nilin-coral text-white'
                        : 'bg-gray-100 text-nilin-gray hover:bg-gray-200'
                    )}
                  >
                    {discount}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check className="h-4 w-4 flex-shrink-0" />
              Bundle created successfully!
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreateBundle}
            disabled={
              isCreating ||
              selectedServices.length < minServices ||
              !bundleName.trim() ||
              !bundleDescription.trim()
            }
            className={cn(
              'w-full py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
              isCreating || selectedServices.length < minServices
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            {isCreating ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Create Bundle
              </>
            )}
          </button>

          {selectedServices.length < minServices && (
            <p className="text-xs text-center text-nilin-gray">
              Select at least {minServices} services to create a bundle
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BundleBuilder;
