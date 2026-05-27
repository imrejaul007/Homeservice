import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Plus,
  Clock,
  DollarSign,
  AlertCircle,
  Loader2,
  Tag as TagIcon,
  MapPin
} from 'lucide-react';
import authService from '../../services/AuthService';
import { useCategories } from '../../hooks/useCategories';
import { useToastActions } from '../common/Toast';
import { parseApiValidationError } from '../../utils/apiError';
import type { Subcategory } from '../../types/category';

interface ServiceResponse {
  _id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  shortDescription: string;
  duration: number;
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
    price: {
      amount: 0,
      currency: 'AED',
      type: 'fixed'
    },
    tags: [],
    status: 'active'
  });

  // Find currently selected category object (AFTER formData state)
  const selectedCategory = useMemo(() => {
    return categoryOptions.find(cat => cat.value === formData.category);
  }, [categoryOptions, formData.category]);


  // Load service data when modal opens
  useEffect(() => {
    if (isOpen && serviceId) {
      loadServiceData();
    } else if (!isOpen) {
      resetForm();
    }
  }, [isOpen, serviceId]);

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      subcategory: '',
      description: '',
      shortDescription: '',
      duration: 60,
      price: { amount: 0, currency: 'AED', type: 'fixed' },
      tags: [],
      status: 'active'
    });
    setErrors({});
    setCurrentTag('');
  };

  const loadServiceData = async () => {
    if (!serviceId) return;

    setIsLoadingService(true);
    try {
      const data = await authService.get<{success: boolean, data: {service: ServiceResponse}}>(`/provider/services/${serviceId}`);

      if (data.success && data.data) {
        const service = data.data.service;

        setFormData({
          name: service.name || '',
          category: service.category || '',
          subcategory: service.subcategory || '',
          description: service.description || '',
          shortDescription: service.shortDescription || '',
          duration: service.duration || 60,
          price: {
            amount: service.price?.amount || 0,
            currency: service.price?.currency || 'AED',
            type: service.price?.type || 'fixed'
          },
          tags: service.tags || [],
          status: service.status || 'active'
        });
      }
    } catch (error) {
      setErrors({ load: error instanceof Error ? error.message : 'Failed to load service data' });
    } finally {
      setIsLoadingService(false);
    }
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | number | boolean | string[]) => {
    setFormData(prev => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      } else if (keys.length === 2) {
        const key0 = keys[0] as keyof ServiceFormData;
        const key1 = keys[1];
        const prevValue = prev[key0] as Record<string, unknown>;
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
        const prevValue = prev[key0] as Record<string, Record<string, unknown>>;
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
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      handleInputChange('tags', [...formData.tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !serviceId) return;

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        price:
          formData.price.type === 'custom'
            ? { ...formData.price, amount: 0 }
            : formData.price,
      };
      const data = await authService.put<{success: boolean}>(`/provider/services/${serviceId}`, payload);

      if (data.success) {
        toast.success('Service updated', 'Your changes have been saved.');
        onServiceUpdated();
        onClose();
        resetForm();
      }
    } catch (error) {
      const { submit, fields } = parseApiValidationError(error);
      setErrors({ submit, ...fields });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingService) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 flex items-center space-x-3 shadow-xl">
          <Loader2 className="w-6 h-6 animate-spin text-nilin-coral" />
          <span className="text-nilin-charcoal">Loading service data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Edit Service</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.load && (
          <div className="mx-6 mt-4 flex items-center p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-600">{errors.load}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
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

          {/* Service Status */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6B6B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px'
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
            </select>
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
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6B6B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
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
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                style={{
                  backgroundImage: formData.category ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6B6B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` : 'none',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
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
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6B6B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
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
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6B6B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
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
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray resize-y min-h-[100px]"
                placeholder="Describe your service in detail..."
              />
              <p className="mt-1.5 text-xs text-nilin-warmGray">{formData.description.length} characters (minimum 50)</p>
              {errors.description && <p className="mt-1.5 text-sm text-red-500">{errors.description}</p>}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Tags <span className="text-nilin-warmGray font-normal">(help customers find your service)</span>
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
                    className="ml-2 p-0.5 rounded-full hover:bg-nilin-coral/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
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
                className="px-4 py-3 bg-nilin-coral/10 border border-nilin-coral/20 rounded-r-xl text-nilin-rose hover:bg-nilin-coral/20 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
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
              onClick={onClose}
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
    </div>
  );
};
