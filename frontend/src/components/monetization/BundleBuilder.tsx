import React, { useState, useEffect, useCallback } from 'react';
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
  DollarSign,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { useToast } from '../common/Toast/ToastContext';

// =============================================================================
// Types
// =============================================================================

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  images?: string[];
  status?: string;
}

interface BundleService {
  service: Service;
  quantity: number;
}

interface Bundle {
  _id: string;
  name: string;
  description: string;
  services: Array<{
    serviceId: Service;
    serviceName: string;
    quantity: number;
    originalPrice: number;
  }>;
  originalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercentage: number;
  validFrom: string;
  validUntil: string;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
}

interface BundleBuilderProps {
  bundle?: Bundle;
  onSuccess?: (bundle?: Bundle) => void;
  onCancel?: () => void;
  maxServices?: number;
  minServices?: number;
  currency?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

// =============================================================================
// Component
// =============================================================================

const BundleBuilder: React.FC<BundleBuilderProps> = ({
  bundle,
  onSuccess,
  onCancel,
  maxServices = 10,
  minServices = 1,
  currency = 'AED',
}) => {
  // Toast notifications
  const { addToast } = useToast();

  // State
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<BundleService[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Check if we're editing an existing bundle
  const isEditMode = !!bundle?._id;

  // Fetch provider's services
  const fetchProviderServices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get('/provider/services');
      const data = response.data?.data || response.data || [];

      // Filter only active/approved services
      const activeServices = Array.isArray(data)
        ? data.filter((s: Service) => s.status === 'active' || !s.status)
        : [];

      setServices(activeServices);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load services';
      setError(errorMessage);
      console.error('Error fetching services:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize from existing bundle or set defaults
  useEffect(() => {
    fetchProviderServices();

    if (bundle?._id) {
      // Edit mode - populate form with existing bundle data
      setIsEditing(true);
      setBundleName(bundle.name || '');
      setBundleDescription(bundle.description || '');
      setDiscountPercentage(bundle.savingsPercentage || 10);

      if (bundle.validFrom) {
        setValidFrom(new Date(bundle.validFrom).toISOString().split('T')[0]);
      }
      if (bundle.validUntil) {
        setValidUntil(new Date(bundle.validUntil).toISOString().split('T')[0]);
      }

      // Map existing services
      if (bundle.services && bundle.services.length > 0) {
        const mappedServices: BundleService[] = bundle.services
          .filter(s => s.serviceId)
          .map(s => ({
            service: s.serviceId as unknown as Service,
            quantity: s.quantity || 1
          }));
        setSelectedServices(mappedServices);
      }
    } else {
      // Set default validity dates
      const today = new Date();
      const threeMonthsLater = new Date(today);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      setValidFrom(today.toISOString().split('T')[0]);
      setValidUntil(threeMonthsLater.toISOString().split('T')[0]);
    }
  }, [bundle, fetchProviderServices]);

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

  // Validation
  const validateForm = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Name validation
    if (!bundleName.trim()) {
      errors.push({ field: 'name', message: 'Bundle name is required' });
    } else if (bundleName.length < 3) {
      errors.push({ field: 'name', message: 'Bundle name must be at least 3 characters' });
    } else if (bundleName.length > 200) {
      errors.push({ field: 'name', message: 'Bundle name cannot exceed 200 characters' });
    }

    // Description validation
    if (!bundleDescription.trim()) {
      errors.push({ field: 'description', message: 'Description is required' });
    } else if (bundleDescription.length < 10) {
      errors.push({ field: 'description', message: 'Description must be at least 10 characters' });
    } else if (bundleDescription.length > 2000) {
      errors.push({ field: 'description', message: 'Description cannot exceed 2000 characters' });
    }

    // Services validation
    if (selectedServices.length < minServices) {
      errors.push({ field: 'services', message: `At least ${minServices} service(s) are required` });
    }

    // Date validations
    if (!validFrom) {
      errors.push({ field: 'validFrom', message: 'Valid from date is required' });
    }

    if (!validUntil) {
      errors.push({ field: 'validUntil', message: 'Valid until date is required' });
    }

    if (validFrom && validUntil) {
      const fromDate = new Date(validFrom);
      const untilDate = new Date(validUntil);

      if (untilDate <= fromDate) {
        errors.push({ field: 'validUntil', message: 'Valid until date must be after valid from date' });
      }

      // Check if validFrom is not in the past (for new bundles)
      if (!isEditMode) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (fromDate < today) {
          errors.push({ field: 'validFrom', message: 'Valid from date cannot be in the past' });
        }
      }
    }

    // Pricing validation
    if (discountPercentage < 0) {
      errors.push({ field: 'discount', message: 'Discount cannot be negative' });
    } else if (discountPercentage > 90) {
      errors.push({ field: 'discount', message: 'Discount cannot exceed 90%' });
    }

    // Bundle price must be less than original price
    if (bundlePrice >= originalTotal && selectedServices.length > 0) {
      errors.push({ field: 'discount', message: 'Bundle price must be less than original price' });
    }

    return errors;
  };

  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message;
  };

  // Service management
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

  // API calls
  const createBundle = async (): Promise<Bundle | null> => {
    try {
      const payload = {
        name: bundleName.trim(),
        description: bundleDescription.trim(),
        services: selectedServices.map((item) => ({
          serviceId: item.service._id,
          quantity: item.quantity,
          originalPrice: item.service.price,
        })),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        categoryId: undefined, // Optional, can be added later
        tags: [],
        terms: '',
      };

      const response = await api.post('/bundles', payload);

      if (response.data?.success) {
        return response.data.data;
      }

      throw new Error(response.data?.message || 'Failed to create bundle');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string; errors?: unknown[] } }; message?: string };
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create bundle';

      // Handle validation errors from backend
      if (error.response?.data?.errors) {
        const backendErrors = error.response.data.errors as Array<{ msg: string }>;
        throw new Error(backendErrors.map(e => e.msg).join(', ') || errorMessage);
      }

      throw new Error(errorMessage);
    }
  };

  const updateBundle = async (): Promise<Bundle | null> => {
    if (!bundle?._id) return null;

    try {
      const payload = {
        name: bundleName.trim(),
        description: bundleDescription.trim(),
        services: selectedServices.map((item) => ({
          serviceId: item.service._id,
          quantity: item.quantity,
          originalPrice: item.service.price,
        })),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        tags: [],
        terms: '',
      };

      const response = await api.put(`/bundles/${bundle._id}`, payload);

      if (response.data?.success) {
        return response.data.data;
      }

      throw new Error(response.data?.message || 'Failed to update bundle');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string; errors?: unknown[] } }; message?: string };
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update bundle';

      // Handle validation errors from backend
      if (error.response?.data?.errors) {
        const backendErrors = error.response.data.errors as Array<{ msg: string }>;
        throw new Error(backendErrors.map(e => e.msg).join(', ') || errorMessage);
      }

      throw new Error(errorMessage);
    }
  };

  // Form submission
  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    setValidationErrors([]);

    // Run validation
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    try {
      setIsCreating(true);

      let savedBundle: Bundle | null = null;

      if (isEditMode) {
        savedBundle = await updateBundle();
        addToast({
          title: 'Bundle Updated',
          description: 'Your bundle has been updated and resubmitted for approval.',
          variant: 'success',
          duration: 5000,
        });
      } else {
        savedBundle = await createBundle();
        addToast({
          title: 'Bundle Created',
          description: 'Your bundle has been created and is pending approval.',
          variant: 'success',
          duration: 5000,
        });
      }

      setSuccess(true);

      // Reset form if creating new
      if (!isEditMode) {
        setSelectedServices([]);
        setBundleName('');
        setBundleDescription('');
        setDiscountPercentage(10);

        // Reset dates
        const today = new Date();
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        setValidFrom(today.toISOString().split('T')[0]);
        setValidUntil(threeMonthsLater.toISOString().split('T')[0]);
      }

      // Call success callback
      if (onSuccess) {
        onSuccess(savedBundle || undefined);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      addToast({
        title: isEditMode ? 'Update Failed' : 'Creation Failed',
        description: errorMessage,
        variant: 'error',
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-nilin-charcoal">
                {isEditMode ? 'Edit Bundle' : 'Create Service Bundle'}
              </h2>
              <p className="text-sm text-nilin-gray">
                {isEditMode
                  ? 'Update your service bundle details'
                  : 'Combine multiple services at a discounted price'}
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-nilin-gray" />
            </button>
          )}
        </div>

        {isEditMode && bundle?.status && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            Status: {bundle.status.charAt(0).toUpperCase() + bundle.status.slice(1)}
            {bundle.status === 'pending' && ' (Updates will require re-approval)'}
          </div>
        )}
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

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
                <span className="ml-3 text-nilin-gray">Loading services...</span>
              </div>
            ) : error && services.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-600 mb-3">{error}</p>
                <button
                  onClick={fetchProviderServices}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-nilin-gray">No services available</p>
                <p className="text-sm text-nilin-gray mt-1">
                  Create services first to build bundles
                </p>
              </div>
            ) : (
              <>
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

                {getFieldError('services') && (
                  <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {getFieldError('services')}
                  </p>
                )}
              </>
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
                  onChange={(e) => {
                    setBundleName(e.target.value);
                    setValidationErrors(prev => prev.filter(v => v.field !== 'name'));
                  }}
                  placeholder="e.g., Home Deep Clean Package"
                  className={cn(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition',
                    getFieldError('name') ? 'border-red-500' : 'border-gray-300'
                  )}
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('name')}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Description *
                </label>
                <textarea
                  value={bundleDescription}
                  onChange={(e) => {
                    setBundleDescription(e.target.value);
                    setValidationErrors(prev => prev.filter(v => v.field !== 'description'));
                  }}
                  placeholder="Describe what's included in this bundle..."
                  rows={3}
                  className={cn(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition resize-none',
                    getFieldError('description') ? 'border-red-500' : 'border-gray-300'
                  )}
                />
                {getFieldError('description') && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('description')}
                  </p>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Valid From *
                  </label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => {
                      setValidFrom(e.target.value);
                      setValidationErrors(prev => prev.filter(v => v.field !== 'validFrom'));
                    }}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition text-sm',
                      getFieldError('validFrom') ? 'border-red-500' : 'border-gray-300'
                    )}
                  />
                  {getFieldError('validFrom') && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('validFrom')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Valid Until *
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => {
                      setValidUntil(e.target.value);
                      setValidationErrors(prev => prev.filter(v => v.field !== 'validUntil'));
                    }}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition text-sm',
                      getFieldError('validUntil') ? 'border-red-500' : 'border-gray-300'
                    )}
                  />
                  {getFieldError('validUntil') && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('validUntil')}
                    </p>
                  )}
                </div>
              </div>

              {/* Discount Slider */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  Discount: {discountPercentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={discountPercentage}
                  onChange={(e) => {
                    setDiscountPercentage(Number(e.target.value));
                    setValidationErrors(prev => prev.filter(v => v.field !== 'discount'));
                  }}
                  className="w-full accent-nilin-coral"
                />
                <div className="flex justify-between text-xs text-nilin-gray mt-1">
                  <span>0%</span>
                  <span>50%</span>
                </div>
                {getFieldError('discount') && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('discount')}
                  </p>
                )}
              </div>

              {/* Quick Discount Buttons */}
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((discount) => (
                  <button
                    key={discount}
                    onClick={() => {
                      setDiscountPercentage(discount);
                      setValidationErrors(prev => prev.filter(v => v.field !== 'discount'));
                    }}
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
          {error && !validationErrors.length && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check className="h-4 w-4 flex-shrink-0" />
              Bundle {isEditMode ? 'updated' : 'created'} successfully!
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={
                isCreating ||
                isLoading ||
                selectedServices.length < minServices ||
                !bundleName.trim() ||
                !bundleDescription.trim() ||
                !validFrom ||
                !validUntil
              }
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
                isCreating || isLoading || selectedServices.length < minServices
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {isEditMode ? 'Update Bundle' : 'Create Bundle'}
                </>
              )}
            </button>

            {onCancel && (
              <button
                onClick={handleCancel}
                className="px-4 py-3 border border-gray-300 rounded-xl font-medium text-nilin-gray hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {selectedServices.length < minServices && (
            <p className="text-xs text-center text-nilin-gray">
              Select at least {minServices} service{minServices > 1 ? 's' : ''} to create a bundle
            </p>
          )}

          {/* Validity Preview */}
          {validFrom && validUntil && (
            <div className="text-xs text-center text-nilin-gray">
              <Calendar className="h-3 w-3 inline mr-1" />
              Valid: {formatDate(validFrom)} - {formatDate(validUntil)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BundleBuilder;
