import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Plus,
  Clock,
  DollarSign,
  AlertCircle,
  Loader2,
  Tag as TagIcon,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import authService from '../../services/AuthService';
import { useCategories } from '../../hooks/useCategories';
import { useToastActions } from '../common/Toast';
import { parseApiValidationError } from '../../utils/apiError';
import type { Subcategory } from '../../types/category';

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    default: 'bg-nilin-coral hover:bg-nilin-coral/90 text-white',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
        <div className="text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-amber-100' : 'bg-nilin-blush'
          }`}>
            {variant === 'danger' ? (
              <AlertCircle className="w-6 h-6 text-red-600" />
            ) : variant === 'warning' ? (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-nilin-coral" />
            )}
          </div>
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">{title}</h3>
          <p className="text-sm text-nilin-warmGray mb-6">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-nilin font-medium transition-colors disabled:opacity-50 ${buttonStyles[variant]}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DurationVariant {
  duration: number;
  price: number;
  label: string;
}

interface AddOn {
  name: string;
  price: number;
  description?: string;
}

interface ServiceResponse {
  _id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  shortDescription: string;
  duration: number;
  durationOptions?: DurationVariant[];
  addOns?: AddOn[];
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  tags: string[];
  status: string;
}

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServiceUpdated: () => void;
  serviceId: string | null;
}

interface ServiceFormData {
  name: string;
  category: string;
  subcategory: string;
  description: string;
  shortDescription: string;
  duration: number;
  durationOptions: DurationVariant[];
  addOns: AddOn[];
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  tags: string[];
  status: string;
}


export const EditServiceModal: React.FC<EditServiceModalProps> = ({
  isOpen,
  onClose,
  onServiceUpdated,
  serviceId
}) => {
  const toast = useToastActions();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingService, setIsLoadingService] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentTag, setCurrentTag] = useState('');

  // Fetch categories from API (single source of truth)
  const { categories, isLoading: categoriesLoading } = useCategories();

  // Transform categories for dropdown - show all categories with their subcategories
  const categoryOptions = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    return categories.map(cat => ({
      value: cat.name,
      label: cat.name,
      subcategories: cat.subcategories?.map((sub: Subcategory) => sub.name) || []
    }));
  }, [categories]);

  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    shortDescription: '',
    duration: 60,
    durationOptions: [],
    addOns: [],
    price: {
      amount: 0,
      currency: 'AED',
      type: 'fixed'
    },
    tags: [],
    status: 'active'
  });

  // UI state for collapsible sections
  const [showDurationVariants, setShowDurationVariants] = useState(false);
  const [showAddOns, setShowAddOns] = useState(false);

  // State for adding new duration variant
  const [newVariant, setNewVariant] = useState<DurationVariant>({ duration: 30, price: 0, label: '' });

  // State for adding new add-on
  const [newAddOn, setNewAddOn] = useState<AddOn>({ name: '', price: 0, description: '' });

  // Validation error states for better UX feedback
  const [variantError, setVariantError] = useState<string | null>(null);
  const [addOnError, setAddOnError] = useState<string | null>(null);

  // Track original form data to detect unsaved changes
  const [originalFormData, setOriginalFormData] = useState<ServiceFormData | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Focus trap ref
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Scroll lock and focus trap
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      // Focus first focusable element
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 50);

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!originalFormData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Keyboard handling - Escape to close with unsaved changes check
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      handleClose();
    }
  }, [isOpen, handleClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Find currently selected category object (AFTER formData state)
  const selectedCategory = useMemo(() => {
    return categoryOptions.find(cat => cat.value === formData.category);
  }, [categoryOptions, formData.category]);

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      subcategory: '',
      description: '',
      shortDescription: '',
      duration: 60,
      durationOptions: [],
      addOns: [],
      price: { amount: 0, currency: 'AED', type: 'fixed' },
      tags: [],
      status: 'active'
    });
    setOriginalFormData(null);
    setErrors({});
    setCurrentTag('');
    setShowDurationVariants(false);
    setShowAddOns(false);
  };

  // Load service data when modal opens
  const loadServiceData = useCallback(async () => {
    if (!serviceId) return;

    setIsLoadingService(true);
    try {
      const data = await authService.get<{success: boolean, data: {service: ServiceResponse}}>(`/provider/services/${serviceId}`);

      if (data.success && data.data) {
        const service = data.data.service;

        const loadedFormData: ServiceFormData = {
          name: service.name || '',
          category: service.category || '',
          subcategory: service.subcategory || '',
          description: service.description || '',
          shortDescription: service.shortDescription || '',
          duration: service.duration || 60,
          durationOptions: service.durationOptions || [],
          addOns: service.addOns || [],
          price: {
            amount: service.price?.amount || 0,
            currency: service.price?.currency || 'AED',
            type: service.price?.type || 'fixed'
          },
          tags: service.tags || [],
          status: service.status || 'active'
        };

        setFormData(loadedFormData);
        setOriginalFormData(loadedFormData);

        // Show sections if they have data
        if (service.durationOptions && service.durationOptions.length > 0) {
          setShowDurationVariants(true);
        }
        if (service.addOns && service.addOns.length > 0) {
          setShowAddOns(true);
        }
      }
    } catch (error: unknown) {
      console.error('Error loading service data:', error);
      // Check for 404 / service not found
      const isNotFound = (error as { response?: { status?: number } }).response?.status === 404;
      if (isNotFound) {
        setErrors({ load: 'Service not found' });
      } else {
        setErrors({ load: error instanceof Error ? error.message : 'Failed to load service data' });
        toast.error(
          'Failed to load service',
          error instanceof Error ? error.message : 'An error occurred'
        );
      }
    } finally {
      setIsLoadingService(false);
    }
  }, [serviceId, toast]);

  // Effect to load data when modal opens
  useEffect(() => {
    if (isOpen && serviceId) {
      loadServiceData();
    } else if (!isOpen) {
      resetForm();
    }
  }, [isOpen, serviceId, loadServiceData, resetForm]);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Service name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (formData.description.length < 50) newErrors.description = 'Description must be at least 50 characters';
    if (!formData.shortDescription.trim()) newErrors.shortDescription = 'Short description is required';
    if (formData.duration <= 0) newErrors.duration = 'Duration must be greater than 0';
    if (formData.price.amount <= 0 && formData.price.type !== 'custom') {
      newErrors.price = 'Price must be greater than 0';
    }
    if (formData.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      } else if (keys.length === 2) {
        const key0 = keys[0] as keyof ServiceFormData;
        const key1 = keys[1];
        // Use double cast to handle nested object updates
        const prevValue = prev[key0] as unknown as Record<string, unknown>;
        return {
          ...prev,
          [key0]: {
            ...prevValue,
            [key1]: value
          }
        };
      } else if (keys.length === 3) {
        const key0 = keys[0] as keyof ServiceFormData;
        const key1 = keys[1];
        const key2 = keys[2];
        const prevValue = prev[key0] as unknown as Record<string, Record<string, unknown>>;
        return {
          ...prev,
          [key0]: {
            ...prevValue,
            [key1]: {
              ...prevValue[key1],
              [key2]: value
            }
          }
        };
      }
      return prev;
    });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle category change - clear subcategory when category changes
  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      category: value,
      subcategory: '' // Clear subcategory when category changes
    }));
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
  };

  const addTag = () => {
    const normalizedTag = currentTag.trim().toLowerCase();
    if (!normalizedTag) return;
    if (formData.tags.some(tag => tag.toLowerCase() === normalizedTag)) {
      toast.error('Duplicate tag', 'This tag has already been added');
      return;
    }
    handleInputChange('tags', [...formData.tags, normalizedTag]);
    setCurrentTag('');
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  // Duration Variants Management
  const addDurationVariant = () => {
    setVariantError(null);
    if (!newVariant.label.trim()) {
      setVariantError('Label is required');
      return;
    }
    if (newVariant.duration < 15 || newVariant.duration > 480) {
      setVariantError('Duration must be between 15-480 minutes');
      return;
    }
    if (newVariant.price < 0) {
      setVariantError('Price cannot be negative');
      return;
    }
    handleInputChange('durationOptions', [...formData.durationOptions, { ...newVariant }]);
    setNewVariant({ duration: 30, price: 0, label: '' });
  };

  const removeDurationVariant = (index: number) => {
    handleInputChange('durationOptions', formData.durationOptions.filter((_, i) => i !== index));
  };

  const updateDurationVariant = (index: number, field: keyof DurationVariant, value: string | number) => {
    const updated = [...formData.durationOptions];
    updated[index] = { ...updated[index], [field]: value };
    handleInputChange('durationOptions', updated);
  };

  // Add-Ons Management
  const addAddOn = () => {
    setAddOnError(null);
    if (!newAddOn.name.trim()) {
      setAddOnError('Add-on name is required');
      return;
    }
    if (newAddOn.price < 0) {
      setAddOnError('Price cannot be negative');
      return;
    }
    handleInputChange('addOns', [...formData.addOns, { ...newAddOn }]);
    setNewAddOn({ name: '', price: 0, description: '' });
  };

  const removeAddOn = (index: number) => {
    handleInputChange('addOns', formData.addOns.filter((_, i) => i !== index));
  };

  const updateAddOn = (index: number, field: keyof AddOn, value: string | number) => {
    const updated = [...formData.addOns];
    updated[index] = { ...updated[index], [field]: value };
    handleInputChange('addOns', updated);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !serviceId) return;

    setIsLoading(true);
    try {
      const { status: _status, ...editableFields } = formData;
      const payload = {
        name: editableFields.name,
        category: editableFields.category,
        subcategory: editableFields.subcategory,
        description: editableFields.description,
        shortDescription: editableFields.shortDescription,
        duration: editableFields.duration,
        durationOptions: editableFields.durationOptions.length > 0 ? editableFields.durationOptions : undefined,
        addOns: editableFields.addOns.length > 0 ? editableFields.addOns : undefined,
        price:
          formData.price.type === 'custom'
            ? { ...formData.price, amount: 0 }
            : formData.price,
        tags: editableFields.tags,
      };
      const data = await authService.put<{success: boolean}>(`/provider/services/${serviceId}`, payload);

      if (data.success) {
        toast.success('Service updated', 'Your changes have been saved.');
        onServiceUpdated();
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Error updating service:', error);
      const { submit, fields } = parseApiValidationError(error);
      setErrors({ submit, ...fields });
      toast.error(
        'Failed to update service',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingService) {
    return (
      <div className="fixed inset-0 bg-nilin-charcoal/40 backdrop-blur-md flex items-center justify-center z-50 animate-backdrop-fade-in">
        <div className="glass-nilin-strong rounded-nilin-lg p-8 flex items-center space-x-3 shadow-nilin-lg animate-modal-enter">
          <Loader2 className="w-6 h-6 animate-spin text-nilin-coral" />
          <span className="text-nilin-charcoal">Loading service data...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-nilin-charcoal/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nilin-rose/5 via-transparent to-nilin-coral/5 animate-gradient-shift" />
      </div>
      <div
        ref={modalRef}
        className="glass-nilin-strong rounded-nilin-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-nilin-lg border border-nilin-border animate-modal-enter"
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral px-6 py-4 flex items-center justify-between relative overflow-hidden">
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          <h2 className="text-xl font-serif text-white relative z-10">Edit Service</h2>
          <button
            ref={firstFocusableRef}
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 relative z-10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {errors.load && (
          <div className="mx-6 mt-4 flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-600">{errors.load}</p>
            </div>
            <div className="flex gap-2">
              {!errors.load.includes('not found') && (
                <button
                  type="button"
                  onClick={() => {
                    setErrors({});
                    loadServiceData();
                  }}
                  className="px-3 py-1 rounded-lg bg-red-100 text-red-600 text-sm hover:bg-red-200 transition-colors"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded-lg bg-red-100 text-red-600 text-sm hover:bg-red-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto animate-slide-up">
          <p className="flex items-start gap-2 text-sm text-nilin-warmGray bg-nilin-muted/50 rounded-nilin px-4 py-3 border border-nilin-border">
            <MapPin className="w-4 h-4 text-nilin-coral shrink-0 mt-0.5" />
            <span>
              Service location is taken from your{' '}
              <Link to="/provider/profile" className="text-nilin-coral font-medium hover:underline">
                Provider Profile
              </Link>
              .
            </span>
          </p>

          {/* Service Status (read-only — activation requires admin approval) */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Status
            </label>
            <div className="px-4 py-3 rounded-xl bg-nilin-muted/50 border border-nilin-border text-sm text-nilin-charcoal capitalize">
              {formData.status.replace('_', ' ')}
            </div>
            <p className="mt-1.5 text-xs text-nilin-warmGray">
              Status changes require admin approval. Use the toggle on the services list to activate or
              deactivate approved services.
            </p>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Name */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Service Name *
              </label>
              <input
                type="text"
                maxLength={100}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                placeholder="e.g., Professional House Cleaning"
              />
              {errors.name && <p className="mt-1.5 text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Category Dropdown */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={categoriesLoading}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer dropdown-arrow"
              >
                <option value="">{categoriesLoading ? 'Loading categories...' : 'Select a category'}</option>
                {categoryOptions.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1.5 text-sm text-red-500">{errors.category}</p>}
            </div>

            {/* Subcategory Dropdown - Only show when category is selected */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Subcategory
              </label>
              <select
                value={formData.subcategory}
                onChange={(e) => handleInputChange('subcategory', e.target.value)}
                disabled={!formData.category || categoriesLoading}
                className={`w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer ${formData.category ? 'dropdown-arrow' : ''}`}
              >
                <option value="">
                  {!formData.category ? 'Select a category first' : selectedCategory?.subcategories.length ? 'Select a subcategory (optional)' : 'No subcategories available'}
                </option>
                {selectedCategory?.subcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Duration with Minutes Label */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Duration *
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray w-4 h-4" />
                <input
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                  className="w-full pl-12 pr-16 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-nilin-warmGray">
                  minutes
                </span>
              </div>
              {errors.duration && <p className="mt-1.5 text-sm text-red-500">{errors.duration}</p>}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Price Type */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Price Type *
              </label>
              <select
                value={formData.price.type}
                onChange={(e) => handleInputChange('price.type', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer dropdown-arrow"
              >
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Per Hour</option>
                <option value="custom">Custom Quote</option>
              </select>
            </div>

            {/* Price Amount with AED Symbol */}
            {formData.price.type !== 'custom' && (
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Price Amount *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray w-4 h-4" />
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.price.amount}
                    onChange={(e) => handleInputChange('price.amount', parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-16 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-nilin-coral">
                    AED
                  </span>
                </div>
                {errors.price && <p className="mt-1.5 text-sm text-red-500">{errors.price}</p>}
              </div>
            )}

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Currency
              </label>
              <select
                value={formData.price.currency}
                onChange={(e) => handleInputChange('price.currency', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer dropdown-arrow"
              >
                <option value="AED">AED (UAE Dirham)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (Pound)</option>
                <option value="INR">INR (Rupee)</option>
              </select>
            </div>
          </div>

          {/* Descriptions */}
          <div className="space-y-4">
            {/* Short Description */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Short Description *
              </label>
              <input
                type="text"
                maxLength={150}
                value={formData.shortDescription}
                onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                placeholder="Brief description for search results"
              />
              <p className="mt-1.5 text-xs text-nilin-warmGray">{formData.shortDescription.length}/150 characters</p>
              {errors.shortDescription && <p className="mt-1.5 text-sm text-red-500">{errors.shortDescription}</p>}
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Detailed Description *
              </label>
              <textarea
                rows={4}
                maxLength={1000}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray resize-y min-h-[100px]"
                placeholder="Describe your service in detail..."
              />
              <p className={`mt-1.5 text-xs ${formData.description.length > 900 ? 'text-red-500' : 'text-nilin-warmGray'}`}>{formData.description.length}/1000 characters (minimum 50)</p>
              {errors.description && <p className="mt-1.5 text-sm text-red-500">{errors.description}</p>}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Tags * <span className="text-nilin-warmGray font-normal">(help customers find your service)</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20"
                >
                  <TagIcon className="w-3 h-3 mr-1" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 p-0.5 rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-4 py-3 rounded-l-xl bg-white/60 border border-nilin-border border-r-0 focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                placeholder="Add a tag and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-3 bg-nilin-coral/10 border border-nilin-coral/20 rounded-r-xl text-nilin-rose hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                aria-label="Add tag"
              >
                <Plus className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Duration Variants */}
          <div className="border-t border-nilin-border pt-6">
            <button
              type="button"
              onClick={() => setShowDurationVariants(!showDurationVariants)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-nilin-coral" />
                <span className="text-sm font-medium text-nilin-charcoal">
                  Duration Variants
                </span>
                {formData.durationOptions.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-nilin-coral/10 text-nilin-coral rounded-full">
                    {formData.durationOptions.length}
                  </span>
                )}
              </div>
              {showDurationVariants ? (
                <ChevronUp className="w-5 h-5 text-nilin-warmGray" />
              ) : (
                <ChevronDown className="w-5 h-5 text-nilin-warmGray" />
              )}
            </button>

            {showDurationVariants && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-nilin-warmGray">
                  Offer multiple service options with different durations and prices (e.g., Express, Standard, Premium).
                </p>

                {formData.durationOptions.length > 0 && (
                  <div className="space-y-2">
                    {formData.durationOptions.map((variant, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-nilin-muted/30 rounded-xl">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={variant.label}
                            onChange={(e) => updateDurationVariant(index, 'label', e.target.value)}
                            placeholder="Label (e.g., Premium)"
                            className="px-3 py-2 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                          />
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                            <input
                              type="number"
                              value={variant.duration}
                              onChange={(e) => updateDurationVariant(index, 'duration', parseInt(e.target.value) || 0)}
                              min="15"
                              max="480"
                              className="w-full pl-10 pr-3 py-2 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                            />
                          </div>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                            <input
                              type="number"
                              value={variant.price}
                              onChange={(e) => updateDurationVariant(index, 'price', parseFloat(e.target.value) || 0)}
                              min="0"
                              className="w-full pl-10 pr-3 py-2 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDurationVariant(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          aria-label={`Remove ${variant.label || 'variant'}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newVariant.label}
                      onChange={(e) => setNewVariant({ ...newVariant, label: e.target.value })}
                      placeholder="Label"
                      className="px-3 py-2 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                    />
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                      <input
                        type="number"
                        value={newVariant.duration}
                        onChange={(e) => setNewVariant({ ...newVariant, duration: parseInt(e.target.value) || 0 })}
                        min="15"
                        max="480"
                        placeholder="Minutes"
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                      />
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                      <input
                        type="number"
                        value={newVariant.price}
                        onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) || 0 })}
                        min="0"
                        placeholder="Price"
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addDurationVariant}
                    disabled={!newVariant.label.trim()}
                    className="px-4 py-2 bg-nilin-coral/10 text-nilin-coral rounded-lg hover:bg-nilin-coral/20 transition-colors disabled:opacity-50 flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                    aria-label="Add duration variant"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" /> Add
                  </button>
                </div>
                {/* Validation error for duration variants */}
                {variantError && (
                  <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {variantError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Add-Ons */}
          <div className="border-t border-nilin-border pt-6">
            <button
              type="button"
              onClick={() => setShowAddOns(!showAddOns)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-nilin-coral" />
                <span className="text-sm font-medium text-nilin-charcoal">
                  Add-Ons
                </span>
                {formData.addOns.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-nilin-coral/10 text-nilin-coral rounded-full">
                    {formData.addOns.length}
                  </span>
                )}
              </div>
              {showAddOns ? (
                <ChevronUp className="w-5 h-5 text-nilin-warmGray" />
              ) : (
                <ChevronDown className="w-5 h-5 text-nilin-warmGray" />
              )}
            </button>

            {showAddOns && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-nilin-warmGray">
                  Offer optional extras that customers can add to their booking (e.g., Extra cleaning supplies, Express delivery).
                </p>

                {formData.addOns.length > 0 && (
                  <div className="space-y-2">
                    {formData.addOns.map((addon, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 bg-nilin-muted/30 rounded-xl border border-nilin-border/50">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={addon.name}
                            onChange={(e) => updateAddOn(index, 'name', e.target.value)}
                            placeholder="Name"
                            className="px-3 py-2.5 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                          />
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                            <input
                              type="number"
                              value={addon.price}
                              onChange={(e) => updateAddOn(index, 'price', parseFloat(e.target.value) || 0)}
                              min="0"
                              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            value={addon.description || ''}
                            onChange={(e) => updateAddOn(index, 'description', e.target.value)}
                            placeholder="Description"
                            className="px-3 py-2.5 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAddOn(index)}
                          className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          aria-label={`Remove ${addon.name || 'add-on'}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={newAddOn.name}
                      onChange={(e) => {
                        setNewAddOn({ ...newAddOn, name: e.target.value });
                        setAddOnError(null);
                      }}
                      placeholder="Add-on name"
                      className="px-3 py-2.5 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                    />
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                      <input
                        type="number"
                        value={newAddOn.price}
                        onChange={(e) => {
                          setNewAddOn({ ...newAddOn, price: parseFloat(e.target.value) || 0 });
                          setAddOnError(null);
                        }}
                        min="0"
                        placeholder="Price"
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      value={newAddOn.description}
                      onChange={(e) => setNewAddOn({ ...newAddOn, description: e.target.value })}
                      placeholder="Description (optional)"
                      className="px-3 py-2.5 rounded-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addAddOn}
                    disabled={!newAddOn.name.trim()}
                    className="px-4 py-2.5 bg-nilin-coral/10 text-nilin-coral rounded-lg hover:bg-nilin-coral/20 transition-colors disabled:opacity-50 flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                    aria-label="Add add-on"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" /> Add
                  </button>
                </div>
                {/* Validation error for add-ons */}
                {addOnError && (
                  <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {addOnError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error Messages */}
          {errors.submit && (
            <div className="flex items-center p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-4 pt-4 border-t border-nilin-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 rounded-xl border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || categoriesLoading}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg shadow-nilin-rose/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Service'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Discard Changes Confirmation Modal */}
      <ConfirmModal
        isOpen={showDiscardModal}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="warning"
        onConfirm={() => {
          setShowDiscardModal(false);
          onClose();
        }}
        onCancel={() => setShowDiscardModal(false)}
      />
    </div>
  );
};
