import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
import type { DurationVariant, AddOn, ServiceFormData } from '../../types/service';
import { ImageUpload } from '../common/ImageUpload';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServiceAdded: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({ isOpen, onClose, onServiceAdded }) => {
  const toast = useToastActions();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentTag, setCurrentTag] = useState('');

  // Form data state FIRST (must be before useMemo that uses it)
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    shortDescription: '',
    duration: 60,
    price: {
      amount: 0,
      currency: 'AED',
      type: 'fixed'
    },
    tags: [],
    durationOptions: [],
    addOns: [],
    images: []
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

  // Max limits for items
  const MAX_TAGS = 10;
  const MAX_DURATION_VARIANTS = 10;
  const MAX_ADD_ONS = 10;
  const DRAFT_KEY = 'draft-service-new';

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  // Fetch categories from API (single source of truth)
  const { categories, isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories();

  // Transform categories for dropdown - show all categories with their subcategories
  const categoryOptions = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    return categories.map(cat => ({
      value: cat.name,
      label: cat.name,
      subcategories: cat.subcategories?.map((sub: Subcategory) => sub.name) || []
    }));
  }, [categories]);

  // Find currently selected category object (AFTER formData)
  const selectedCategory = useMemo(() => {
    return categoryOptions.find(cat => cat.value === formData.category);
  }, [categoryOptions, formData.category]);

  // Focus trap ref
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus trap for keyboard accessibility
  const handleTabKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

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

  // Keyboard handling - Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Restore draft when modal opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { formData?: ServiceFormData };
      if (parsed.formData?.name?.trim()) {
        setShowDraftPrompt(true);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [isOpen]);

  // Debounced auto-save
  useEffect(() => {
    if (!isOpen || !hasUnsavedChanges) return;
    const timer = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ formData, savedAt: new Date().toISOString() }),
      );
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [formData, hasUnsavedChanges, isOpen]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { formData?: ServiceFormData };
      if (parsed.formData) {
        setFormData(parsed.formData);
        setHasUnsavedChanges(false);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      setShowDraftPrompt(false);
    }
  };

  const dismissDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftPrompt(false);
  };

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
    if (formData.tags.length === 0) newErrors.tags = 'At least one tag is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | number | string[] | DurationVariant[] | AddOn[]) => {
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
    setHasUnsavedChanges(true);

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
    setHasUnsavedChanges(true);
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
  };

  const addTag = () => {
    const normalizedTag = currentTag.trim().toLowerCase();
    if (!normalizedTag) return;
    if (formData.tags.length >= MAX_TAGS) {
      toast.warning('Tag limit reached', `Maximum ${MAX_TAGS} tags allowed`);
      return;
    }
    if (formData.tags.some(tag => tag.toLowerCase() === normalizedTag)) {
      toast.error('Duplicate tag', { description: 'This tag has already been added' });
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
    if (formData.durationOptions.length >= MAX_DURATION_VARIANTS) {
      setVariantError(`Maximum ${MAX_DURATION_VARIANTS} variants allowed`);
      return;
    }
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
    if (formData.addOns.length >= MAX_ADD_ONS) {
      setAddOnError(`Maximum ${MAX_ADD_ONS} add-ons allowed`);
      return;
    }
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
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const serviceData = {
        name: formData.name,
        category: formData.category,
        subcategory: formData.subcategory,
        description: formData.description,
        shortDescription: formData.shortDescription,
        duration: formData.duration,
        price:
          formData.price.type === 'custom'
            ? { ...formData.price, amount: 0 }
            : formData.price,
        tags: formData.tags,
        durationOptions: formData.durationOptions.length > 0 ? formData.durationOptions : undefined,
        addOns: formData.addOns.length > 0 ? formData.addOns : undefined,
        images: formData.images, // Include existing images (uploaded before service creation)
      };

      const data = await authService.post<{success: boolean, data?: {service?: {_id: string}}}>('/provider/services', serviceData);

      if (data.success) {
        localStorage.removeItem(DRAFT_KEY);
        setHasUnsavedChanges(false);
        setLastSaved(null);
        toast.success(
          'Service created',
          'Submitted for review. You can activate it from the list or edit screen when ready.'
        );
        onServiceAdded();
        onClose();
        // Reset form
        setFormData({
          name: '',
          category: '',
          subcategory: '',
          description: '',
          shortDescription: '',
          duration: 60,
          price: { amount: 0, currency: 'AED', type: 'fixed' },
          tags: [],
          durationOptions: [],
          addOns: [],
          images: []
        });
        setErrors({});
        setVariantError(null);
        setAddOnError(null);
        setCurrentTag('');
        setShowDurationVariants(false);
        setShowAddOns(false);
      }
    } catch (error) {
      const { submit, fields } = parseApiValidationError(error);
      setErrors({ submit, ...fields });
      toast.error(
        'Failed to create service',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-service-modal-title"
      className="fixed inset-0 bg-nilin-charcoal/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nilin-rose/5 via-transparent to-nilin-coral/5 animate-gradient-shift" />
      </div>
      <div
        ref={modalRef}
        className="glass-nilin-strong rounded-nilin-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-nilin-lg border border-nilin-border animate-modal-enter"
        onKeyDown={handleTabKey}
      >
        <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral px-6 py-4 flex items-center justify-between relative overflow-hidden">
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          <h2 id="add-service-modal-title" className="text-xl font-serif text-white relative z-10">Add New Service</h2>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-nilin-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 relative z-10"
            aria-label="Close add service modal"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Loading/Error/Empty state for categories */}
        {categoriesLoading && (
          <div className="px-6 pt-4 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-nilin-coral mr-2" />
            <span className="text-nilin-warmGray text-sm">Loading categories...</span>
          </div>
        )}

        {(categoriesError || (!categoriesLoading && categoryOptions.length === 0)) && !errors.submit && (
          <div className="px-6 pt-4">
            <div className="flex items-center p-4 rounded-nilin-lg bg-nilin-coral/10 border border-nilin-coral/20">
              <AlertCircle className="w-5 h-5 text-nilin-rose mr-3 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-nilin-rose font-medium">Unable to load categories</p>
                <p className="text-xs text-nilin-rose/80 mt-0.5">
                  {categoriesError || 'No categories available. Please try again later.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchCategories()}
                className="ml-3 px-3 py-1.5 text-sm font-medium text-nilin-coral hover:bg-nilin-coral/10 rounded-nilin-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {showDraftPrompt && (
          <div className="mx-6 mt-4 p-4 rounded-nilin-lg bg-nilin-coral/10 border border-nilin-coral/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-nilin-charcoal">You have an unsaved service draft. Restore it?</p>
            <div className="flex gap-2">
              <button type="button" onClick={restoreDraft} className="px-3 py-1.5 text-sm font-medium bg-nilin-coral text-white rounded-nilin-lg">
                Restore draft
              </button>
              <button type="button" onClick={dismissDraft} className="px-3 py-1.5 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {lastSaved && (
          <p className="px-6 pt-2 text-xs text-nilin-warmGray" aria-live="polite">
            Draft saved {lastSaved.toLocaleTimeString()}
          </p>
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

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Name */}
            <div>
              <label htmlFor="add-service-name" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Service Name *
              </label>
              <input
                type="text"
                id="add-service-name"
                maxLength={100}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'add-service-name-error' : undefined}
                className="w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 focus:shadow-[0_0_0_3px_rgba(232,180,168,0.1)] outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                placeholder="e.g., Professional House Cleaning"
              />
              {errors.name && <p id="add-service-name-error" role="alert" className="mt-1.5 text-sm text-red-500 animate-slide-down">{errors.name}</p>}
            </div>

            {/* Category Dropdown */}
            <div>
              <label htmlFor="add-service-category" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Category *
              </label>
              <select
                id="add-service-category"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={categoriesLoading}
                aria-invalid={!!errors.category}
                aria-describedby={errors.category ? 'add-service-category-error' : undefined}
                className="w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 focus:shadow-[0_0_0_3px_rgba(232,180,168,0.1)] outline-none transition-all text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer dropdown-arrow"
              >
                <option value="">{categoriesLoading ? 'Loading categories...' : 'Select a category'}</option>
                {categoryOptions.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {errors.category && <p id="add-service-category-error" role="alert" className="mt-1.5 text-sm text-red-500 animate-slide-down">{errors.category}</p>}
            </div>

            {/* Subcategory Dropdown - Only show when category is selected */}
            <div>
              <label htmlFor="add-service-subcategory" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Subcategory
              </label>
              <select
                id="add-service-subcategory"
                value={formData.subcategory}
                onChange={(e) => handleInputChange('subcategory', e.target.value)}
                disabled={!formData.category || categoriesLoading}
                className={`w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer ${formData.category ? 'dropdown-arrow' : ''}`}
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
              <label htmlFor="add-service-duration" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Duration *
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray w-4 h-4" />
                <input
                  type="number"
                  id="add-service-duration"
                  min="15"
                  max="480"
                  step="15"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                  aria-invalid={!!errors.duration}
                  aria-describedby={errors.duration ? 'add-service-duration-error' : undefined}
                  className="w-full pl-12 pr-16 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-nilin-warmGray">
                  minutes
                </span>
              </div>
              {errors.duration && <p id="add-service-duration-error" role="alert" className="mt-1.5 text-sm text-red-500">{errors.duration}</p>}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Price Type */}
            <div>
              <label htmlFor="add-service-price-type" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Price Type *
              </label>
              <select
                id="add-service-price-type"
                value={formData.price.type}
                onChange={(e) => handleInputChange('price.type', e.target.value)}
                className="w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer dropdown-arrow"
              >
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Per Hour</option>
                <option value="custom">Custom Quote</option>
              </select>
            </div>

            {/* Price Amount with AED Symbol */}
            {formData.price.type !== 'custom' && (
              <div>
                <label htmlFor="add-service-price-amount" className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Price Amount *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray w-4 h-4" />
                  <input
                    type="number"
                    id="add-service-price-amount"
                    min="1"
                    step="0.01"
                    value={formData.price.amount}
                    onChange={(e) => handleInputChange('price.amount', parseFloat(e.target.value) || 0)}
                    aria-invalid={!!errors.price}
                    aria-describedby={errors.price ? 'add-service-price-error' : undefined}
                    className="w-full pl-12 pr-16 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-nilin-coral">
                    AED
                  </span>
                </div>
                {errors.price && <p id="add-service-price-error" role="alert" className="mt-1.5 text-sm text-red-500">{errors.price}</p>}
              </div>
            )}

            {/* Currency (only show when not custom or as placeholder) */}
            <div>
              <label htmlFor="add-service-price-currency" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Currency
              </label>
              <select
                id="add-service-price-currency"
                value={formData.price.currency}
                onChange={(e) => handleInputChange('price.currency', e.target.value)}
                className="w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer dropdown-arrow"
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
              <label htmlFor="add-service-short-description" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Short Description *
              </label>
              <input
                type="text"
                id="add-service-short-description"
                maxLength={150}
                value={formData.shortDescription}
                onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                aria-invalid={!!errors.shortDescription}
                aria-describedby={errors.shortDescription ? 'add-service-short-description-error' : 'add-service-short-description-hint'}
                className="w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                placeholder="Brief description for search results"
              />
              <p id="add-service-short-description-hint" className="mt-1.5 text-xs text-nilin-warmGray">{formData.shortDescription.length}/150 characters</p>
              {errors.shortDescription && <p id="add-service-short-description-error" role="alert" className="mt-1.5 text-sm text-red-500">{errors.shortDescription}</p>}
            </div>

            {/* Detailed Description */}
            <div>
              <label htmlFor="add-service-description" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Detailed Description *
              </label>
              <textarea
                id="add-service-description"
                rows={4}
                maxLength={1000}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'add-service-description-error' : 'add-service-description-hint'}
                className="w-full px-4 py-3 rounded-nilin-lg bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray resize-y min-h-[100px]"
                placeholder="Describe your service in detail..."
              />
              <p id="add-service-description-hint" className={`mt-1.5 text-xs ${formData.description.length > 900 ? 'text-red-500' : 'text-nilin-warmGray'}`}>{formData.description.length}/1000 characters (minimum 50)</p>
              {errors.description && <p id="add-service-description-error" role="alert" className="mt-1.5 text-sm text-red-500">{errors.description}</p>}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="add-service-tags" className="block text-sm font-medium text-nilin-charcoal mb-2">
              Tags * <span className="text-nilin-warmGray font-normal">(help customers find your service)</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20 animate-tag-appear"
                >
                  <TagIcon className="w-3 h-3 mr-1" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 hover:scale-110 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
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
                id="add-service-tags"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                aria-invalid={!!errors.tags}
                aria-describedby={errors.tags ? 'add-service-tags-error' : undefined}
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
            {errors.tags && <p id="add-service-tags-error" role="alert" className="mt-1.5 text-sm text-red-500">{errors.tags}</p>}
          </div>

          {/* Service Images */}
          <div className="border-t border-nilin-border pt-6">
            <ImageUpload
              images={formData.images}
              onImagesChange={(images) => handleInputChange('images', images)}
              maxImages={5}
              disabled={isLoading}
              uploadEndpoint="/provider/services/upload-images"
              label="Service Images"
              helpText="Add up to 5 images to showcase your service"
            />
          </div>

          {/* Duration Variants */}
          <div className="border-t border-nilin-border pt-6">
            <button
              type="button"
              onClick={() => setShowDurationVariants(!showDurationVariants)}
              aria-expanded={showDurationVariants}
              aria-controls="duration-variants-content"
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
              <div id="duration-variants-content" className="mt-4 space-y-4">
                <p className="text-xs text-nilin-warmGray">
                  Offer multiple service options with different durations and prices (e.g., Express, Standard, Premium).
                </p>

                {/* Existing Variants */}
                {formData.durationOptions.length > 0 && (
                  <div className="space-y-2">
                    {formData.durationOptions.map((variant, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-nilin-muted/30 rounded-nilin-lg">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={variant.label}
                            onChange={(e) => updateDurationVariant(index, 'label', e.target.value)}
                            placeholder="Label (e.g., Express)"
                            className="px-3 py-2 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                          />
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                            <input
                              type="number"
                              value={variant.duration}
                              onChange={(e) => updateDurationVariant(index, 'duration', parseInt(e.target.value) || 0)}
                              min="15"
                              max="480"
                              placeholder="Minutes"
                              className="w-full pl-10 pr-3 py-2 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                            />
                          </div>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                            <input
                              type="number"
                              value={variant.price}
                              onChange={(e) => updateDurationVariant(index, 'price', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              placeholder="Price"
                              className="w-full pl-10 pr-3 py-2 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDurationVariant(index)}
                          className="p-2 text-nilin-rose hover:bg-nilin-rose/10 rounded-nilin-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-rose"
                          aria-label={`Remove ${variant.label || 'variant'}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Variant */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newVariant.label}
                      onChange={(e) => setNewVariant({ ...newVariant, label: e.target.value })}
                      placeholder="Label (e.g., Premium)"
                      className="px-3 py-2 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
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
                        className="w-full pl-10 pr-3 py-2 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                      />
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                      <input
                        type="number"
                        value={newVariant.price}
                        onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        className="w-full pl-10 pr-3 py-2 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-1 focus:ring-nilin-coral/20 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addDurationVariant}
                    disabled={!newVariant.label.trim()}
                    className="px-4 py-2 bg-nilin-coral/10 text-nilin-coral rounded-nilin-lg hover:bg-nilin-coral/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                    aria-label="Add duration variant"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add
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
              aria-expanded={showAddOns}
              aria-controls="addons-content"
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
              <div id="addons-content" className="mt-4 space-y-4">
                <p className="text-xs text-nilin-warmGray">
                  Offer optional extras that customers can add to their booking (e.g., Extra cleaning supplies, Express delivery).
                </p>

                {/* Existing Add-Ons */}
                {formData.addOns.length > 0 && (
                  <div className="space-y-2">
                    {formData.addOns.map((addon, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 bg-nilin-muted/30 rounded-nilin-lg border border-nilin-border/50">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={addon.name}
                            onChange={(e) => updateAddOn(index, 'name', e.target.value)}
                            placeholder="Add-on name"
                            className="px-3 py-2.5 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                          />
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                            <input
                              type="number"
                              value={addon.price}
                              onChange={(e) => updateAddOn(index, 'price', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              placeholder="Price"
                              className="w-full pl-10 pr-3 py-2.5 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            value={addon.description || ''}
                            onChange={(e) => updateAddOn(index, 'description', e.target.value)}
                            placeholder="Description (optional)"
                            className="px-3 py-2.5 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAddOn(index)}
                          className="p-2.5 text-nilin-rose hover:bg-nilin-rose/10 rounded-nilin-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-rose"
                          aria-label={`Remove ${addon.name || 'add-on'}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Add-On */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={newAddOn.name}
                      onChange={(e) => {
                        setNewAddOn({ ...newAddOn, name: e.target.value });
                        setAddOnError(null);
                      }}
                      placeholder="Add-on name"
                      className="px-3 py-2.5 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
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
                        step="0.01"
                        placeholder="Price"
                        className="w-full pl-10 pr-3 py-2.5 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      value={newAddOn.description}
                      onChange={(e) => setNewAddOn({ ...newAddOn, description: e.target.value })}
                      placeholder="Description (optional)"
                      className="px-3 py-2.5 rounded-nilin-lg border border-nilin-border bg-white focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addAddOn}
                    disabled={!newAddOn.name.trim()}
                    className="px-4 py-2.5 bg-nilin-coral/10 text-nilin-coral rounded-nilin-lg hover:bg-nilin-coral/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                    aria-label="Add add-on"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add
                  </button>
                </div>
                {/* Validation error for add-ons */}
                {addOnError && (
                  <p id="add-service-addon-error" role="alert" className="mt-2 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {addOnError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error Messages */}
          {errors.submit && (
            <div role="alert" className="flex items-center p-4 rounded-nilin-lg bg-nilin-coral/10 border border-nilin-coral/20">
              <AlertCircle className="w-5 h-5 text-nilin-rose mr-3 flex-shrink-0" />
              <p className="text-sm text-nilin-rose">{errors.submit}</p>
            </div>
          )}

          {/* Screen reader announcements */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {isLoading && 'Submitting service...'}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-4 pt-4 border-t border-nilin-border">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-nilin-lg border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || categoriesLoading}
              className="px-8 py-3 rounded-nilin-lg bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg shadow-nilin-rose/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Service'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
