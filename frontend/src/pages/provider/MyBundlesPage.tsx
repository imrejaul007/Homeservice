import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Plus,
  Edit3,
  Trash2,
  Eye,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Tag,
  Calendar,
  Sparkles,
  X,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuthStore } from '../../stores/authStore';
import { bundleApi, Bundle, CreateBundlePayload } from '../../services/bundleApi';
import { api } from '../../services/api';
import type { Service } from '../../types/service';
import { formatPrice } from '../../utils/currency';

// Status badge component
const StatusBadge: React.FC<{
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  rejectionReason?: string;
}> = ({ status, rejectionReason }) => {
  const statusConfig = {
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: Clock,
      label: 'Pending Review',
    },
    approved: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: CheckCircle,
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: XCircle,
      label: 'Rejected',
    },
    active: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: CheckCircle,
      label: 'Active',
    },
    inactive: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: AlertCircle,
      label: 'Inactive',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
      {status === 'rejected' && rejectionReason && (
        <span className="text-xs text-red-600 max-w-[200px] truncate" title={rejectionReason}>
          {rejectionReason}
        </span>
      )}
    </div>
  );
};

// Stats Card component
const StatsCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}> = ({ label, value, icon: Icon, color = 'bg-nilin-coral/10' }) => (
  <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-nilin ${color}`}>
        <Icon className="h-5 w-5 text-nilin-coral" />
      </div>
      <div>
        <p className="text-sm text-nilin-warmGray">{label}</p>
        <p className="text-xl font-bold text-nilin-charcoal">{value}</p>
      </div>
    </div>
  </div>
);

// Confirm Delete Modal
const ConfirmDeleteModal: React.FC<{
  isOpen: boolean;
  bundleName: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, bundleName, isLoading, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-red-100">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Delete Bundle</h3>
          <p className="text-sm text-nilin-warmGray mb-6">
            Are you sure you want to delete "{bundleName}"? This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-nilin bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Bundle Card component
const BundleCard: React.FC<{
  bundle: Bundle;
  onEdit: () => void;
  onDelete: () => void;
  onViewAnalytics: () => void;
}> = ({ bundle, onEdit, onDelete, onViewAnalytics }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 rounded-nilin">
            <Package className="h-6 w-6 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">{bundle.name}</h3>
            <p className="text-sm text-nilin-warmGray line-clamp-2 mt-1">
              {bundle.shortDescription || bundle.description}
            </p>
          </div>
        </div>
        <StatusBadge
          status={bundle.isActive ? 'active' : 'inactive'}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-nilin-muted/30 rounded-nilin">
        <div>
          <p className="text-xs text-nilin-warmGray">Price</p>
          <p className="text-lg font-bold text-nilin-charcoal">
            {formatPrice(bundle.bundlePrice, 'AED')}
          </p>
        </div>
        <div>
          <p className="text-xs text-nilin-warmGray">Savings</p>
          <p className="text-lg font-bold text-green-600">
            {bundle.discountPercent}%
          </p>
        </div>
        <div>
          <p className="text-xs text-nilin-warmGray">Services</p>
          <p className="text-lg font-bold text-nilin-charcoal">
            {bundle.services?.length || 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-nilin-warmGray">Bookings</p>
          <p className="text-lg font-bold text-nilin-charcoal">
            {bundle.bookingsUsed || 0}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-nilin-border/50">
        <div className="flex items-center gap-4 text-sm text-nilin-warmGray">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(bundle.createdAt)}
          </span>
          {bundle.duration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {bundle.duration} {bundle.durationUnit}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onViewAnalytics}
            className="p-2 rounded-nilin hover:bg-nilin-muted text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
            title="View Analytics"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-nilin hover:bg-nilin-muted text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
            title="Edit Bundle"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-nilin hover:bg-red-50 text-nilin-warmGray hover:text-red-600 transition-colors"
            title="Delete Bundle"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Bundle Modal (simplified form)
const EditBundleModal: React.FC<{
  isOpen: boolean;
  bundle: Bundle | null;
  onClose: () => void;
  onSave: (data: Partial<Bundle>) => Promise<void>;
}> = ({ isOpen, bundle, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortDescription: '',
    bundlePrice: 0,
    validityDays: 30,
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bundle) {
      setFormData({
        name: bundle.name || '',
        description: bundle.description || '',
        shortDescription: bundle.shortDescription || '',
        bundlePrice: bundle.bundlePrice || 0,
        validityDays: bundle.validityDays || 30,
        isActive: bundle.isActive ?? true,
      });
    }
  }, [bundle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update bundle');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !bundle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-nilin-strong rounded-nilin-xl max-w-lg w-full shadow-nilin-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-nilin-xl border-b border-nilin-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif text-nilin-charcoal">Edit Bundle</h2>
            <p className="text-sm text-nilin-warmGray">Status will change to pending after save</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
          >
            <X className="h-5 w-5 text-nilin-warmGray" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-nilin flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">
              Bundle Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">
              Short Description *
            </label>
            <input
              type="text"
              required
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              placeholder="Brief description for listings"
              className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">
              Full Description *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of what's included"
              className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Bundle Price (AED) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray">
                  <DollarSign className="h-4 w-4" />
                </span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.bundlePrice}
                  onChange={(e) => setFormData({ ...formData, bundlePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Validity (Days) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray">
                  <Calendar className="h-4 w-4" />
                </span>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.validityDays}
                  onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 30 })}
                  className="w-full pl-10 pr-4 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.isActive ? 'bg-nilin-coral' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-nilin-charcoal">
              {formData.isActive ? 'Bundle is active' : 'Bundle is inactive'}
            </span>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-nilin bg-nilin-coral hover:bg-nilin-rose text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Simple Bundle Builder for Create Tab
const CreateBundleForm: React.FC<{
  services: Service[];
  onCreate: (data: CreateBundlePayload) => Promise<void>;
  onSuccess: () => void;
}> = ({ services, onCreate, onSuccess }) => {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [validityDays, setValidityDays] = useState(30);
  const [categoryId, setCategoryId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const originalTotal = services
    .filter((s) => selectedServiceIds.includes(s._id))
    .reduce((sum, s) => sum + (s.price?.amount || 0), 0);

  const discountAmount = originalTotal * (discountPercent / 100);
  const bundlePrice = originalTotal - discountAmount;

  const handleCreate = async () => {
    setError(null);

    if (selectedServiceIds.length < 2) {
      setError('At least 2 services are required');
      return;
    }

    if (!bundleName.trim()) {
      setError('Please enter a bundle name');
      return;
    }

    if (!shortDescription.trim()) {
      setError('Please enter a short description');
      return;
    }

    if (!bundleDescription.trim()) {
      setError('Please enter a description');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setIsCreating(true);

    try {
      await onCreate({
        name: bundleName.trim(),
        description: bundleDescription.trim(),
        shortDescription: shortDescription.trim(),
        serviceIds: selectedServiceIds,
        bundlePrice,
        validityDays,
        categoryId,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create bundle');
    } finally {
      setIsCreating(false);
    }
  };

  const formatPriceValue = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Get unique categories from services
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Service Selection */}
      <div className="lg:col-span-2">
        <div className="glass-nilin rounded-nilin-lg p-6">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
            Select Services (min 2)
          </h3>

          {services.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-warmGray">No services available</p>
              <p className="text-sm text-nilin-warmGray mt-1">
                Create services first to build bundles
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((service) => {
                const isSelected = selectedServiceIds.includes(service._id);
                return (
                  <div
                    key={service._id}
                    onClick={() => toggleService(service._id)}
                    className={`relative border rounded-nilin-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                        : 'border-nilin-border hover:border-nilin-coral/50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-nilin flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-nilin-charcoal truncate">
                          {service.name}
                        </h4>
                        <p className="text-sm text-nilin-warmGray line-clamp-2 mt-1">
                          {service.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-semibold text-nilin-coral">
                            {formatPriceValue(service.price?.amount || 0)}
                          </span>
                          <span className="text-xs text-nilin-warmGray">
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bundle Configuration */}
      <div className="space-y-4">
        {/* Selected Services Preview */}
        <div className="glass-nilin rounded-nilin-lg p-6">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
            Your Bundle
          </h3>

          {selectedServiceIds.length === 0 ? (
            <div className="text-center py-6 text-nilin-warmGray">
              <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Select services to create your bundle</p>
            </div>
          ) : (
            <div className="space-y-3">
              {services
                .filter((s) => selectedServiceIds.includes(s._id))
                .map((service) => (
                  <div
                    key={service._id}
                    className="flex items-center justify-between py-2 border-b border-nilin-border/50 last:border-0"
                  >
                    <span className="text-sm text-nilin-charcoal truncate">
                      {service.name}
                    </span>
                    <span className="text-sm font-medium text-nilin-charcoal">
                      {formatPriceValue(service.price?.amount || 0)}
                    </span>
                  </div>
                ))}

              <div className="pt-4 border-t border-nilin-border">
                <div className="flex justify-between text-nilin-warmGray text-sm">
                  <span>Original Total</span>
                  <span className="line-through">{formatPriceValue(originalTotal)}</span>
                </div>
                <div className="flex justify-between text-green-600 font-medium mt-1">
                  <span>Your Savings ({discountPercent}%)</span>
                  <span>-{formatPriceValue(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-nilin-charcoal mt-2">
                  <span>Bundle Price</span>
                  <span>{formatPriceValue(bundlePrice)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bundle Details */}
        <div className="glass-nilin rounded-nilin-lg p-6">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
            Bundle Details
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Bundle Name *
              </label>
              <input
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="e.g., Home Deep Clean Package"
                className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Short Description *
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief tagline for listings"
                className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Full Description *
              </label>
              <textarea
                value={bundleDescription}
                onChange={(e) => setBundleDescription(e.target.value)}
                placeholder="Describe what's included in this bundle..."
                rows={3}
                className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Discount: {discountPercent}%
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full accent-nilin-coral"
              />
              <div className="flex justify-between text-xs text-nilin-warmGray mt-1">
                <span>0%</span>
                <span>50%</span>
              </div>
            </div>

            <div className="flex gap-2">
              {[5, 10, 15, 20].map((discount) => (
                <button
                  key={discount}
                  type="button"
                  onClick={() => setDiscountPercent(discount)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-nilin transition ${
                    discountPercent === discount
                      ? 'bg-nilin-coral text-white'
                      : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-muted/80'
                  }`}
                >
                  {discount}%
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Validity (Days) *
              </label>
              <input
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-nilin text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Create Button */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={
            isCreating ||
            selectedServiceIds.length < 2 ||
            !bundleName.trim() ||
            !shortDescription.trim() ||
            !bundleDescription.trim() ||
            !categoryId
          }
          className={`w-full py-3 px-4 rounded-nilin font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            isCreating ||
            selectedServiceIds.length < 2 ||
            !bundleName.trim() ||
            !shortDescription.trim() ||
            !bundleDescription.trim() ||
            !categoryId
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
          }`}
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

        {selectedServiceIds.length < 2 && (
          <p className="text-xs text-center text-nilin-warmGray">
            Select at least 2 services to create a bundle
          </p>
        )}
      </div>
    </div>
  );
};

// Main Page Component
const MyBundlesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Data state
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [deletingBundle, setDeletingBundle] = useState<Bundle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch bundles
  const fetchBundles = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await bundleApi.getMyBundles({ limit: 50 });
      setBundles(response.bundles || []);
    } catch (error) {
      console.error('Failed to fetch bundles:', error);
      showToast('Failed to load bundles', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch provider services for bundle creation
  const fetchServices = useCallback(async () => {
    try {
      // Get services from provider API endpoint using api service (handles auth automatically)
      const response = await api.get('/provider/services');
      const servicesData = response.data.data?.services || response.data.data || [];
      // Transform service data to match frontend Service type
      const transformedServices = servicesData.map((s: any) => ({
        _id: s._id || s.id,
        name: s.name,
        category: s.category,
        price: s.price || { amount: 0, currency: 'AED' },
        duration: s.duration || 60,
      }));
      setServices(transformedServices);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user?.role === 'provider') {
      fetchBundles();
    }
  }, [user, fetchBundles]);

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle create bundle
  const handleCreateBundle = async (data: CreateBundlePayload) => {
    try {
      await bundleApi.createBundle(data);
      showToast('Bundle created successfully! It will be reviewed shortly.', 'success');
      setActiveTab('list');
      fetchBundles();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create bundle');
    }
  };

  // Handle update bundle
  const handleUpdateBundle = async (data: Partial<Bundle>) => {
    if (!editingBundle) return;

    try {
      await bundleApi.updateBundle(editingBundle.id, data);
      showToast('Bundle updated! Status changed to pending review.', 'success');
      setEditingBundle(null);
      fetchBundles();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update bundle');
    }
  };

  // Handle delete bundle
  const handleDeleteBundle = async () => {
    if (!deletingBundle) return;

    setIsDeleting(true);
    try {
      await bundleApi.deleteBundle(deletingBundle.id);
      showToast('Bundle deleted successfully', 'success');
      setDeletingBundle(null);
      fetchBundles();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete bundle', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle view analytics
  const handleViewAnalytics = (bundle: Bundle) => {
    navigate(`/provider/bundles/${bundle.id}/analytics`);
  };

  // Filter bundles
  const filteredBundles = bundles.filter((bundle) => {
    const matchesSearch = bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.shortDescription?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? bundle.isActive : !bundle.isActive);
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalBundles = bundles.length;
  const activeBundles = bundles.filter((b) => b.isActive).length;
  const totalBookings = bundles.reduce((sum, b) => sum + (b.bookingsUsed || 0), 0);
  const totalRevenue = bundles.reduce((sum, b) => sum + (b.bundlePrice * (b.bookingsUsed || 0)), 0);

  // Tab configuration
  const tabs = [
    { id: 'list' as const, label: 'My Bundles', icon: Package },
    { id: 'create' as const, label: 'Create New Bundle', icon: Plus },
  ];

  if (user?.role !== 'provider') {
    return null;
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Bundle Management</h1>
                <p className="text-nilin-warmGray">Create and manage your service bundles</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchBundles(true)}
                  disabled={isRefreshing}
                  className="px-4 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex gap-1 p-1 bg-nilin-muted/50 rounded-nilin w-fit">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === 'create' && services.length === 0) {
                        fetchServices();
                      }
                    }}
                    className={`px-4 py-2 rounded-nilin font-medium text-sm transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-white text-nilin-charcoal shadow-sm'
                        : 'text-nilin-warmGray hover:text-nilin-charcoal'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          {activeTab === 'list' ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatsCard label="Total Bundles" value={totalBundles} icon={Package} />
                <StatsCard label="Active Bundles" value={activeBundles} icon={CheckCircle} color="bg-green-100" />
                <StatsCard label="Total Bookings" value={totalBookings} icon={TrendingUp} color="bg-blue-100" />
                <StatsCard label="Bundle Revenue" value={formatPrice(totalRevenue, 'AED')} icon={DollarSign} color="bg-green-100" />
              </div>

              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                  <input
                    type="text"
                    placeholder="Search bundles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="px-4 py-2 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Bundle List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredBundles.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-8 w-8" />}
                  title={searchQuery || statusFilter !== 'all' ? 'No bundles found' : 'No bundles yet'}
                  description={
                    searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Create your first service bundle to attract more customers'
                  }
                  action={
                    !searchQuery && statusFilter === 'all'
                      ? {
                          label: 'Create Bundle',
                          onClick: () => setActiveTab('create'),
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-4">
                  {filteredBundles.map((bundle) => (
                    <BundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onEdit={() => setEditingBundle(bundle)}
                      onDelete={() => setDeletingBundle(bundle)}
                      onViewAnalytics={() => handleViewAnalytics(bundle)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <CreateBundleForm
              services={services}
              onCreate={handleCreateBundle}
              onSuccess={() => {
                setActiveTab('list');
                fetchBundles();
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <EditBundleModal
        isOpen={!!editingBundle}
        bundle={editingBundle}
        onClose={() => setEditingBundle(null)}
        onSave={handleUpdateBundle}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingBundle}
        bundleName={deletingBundle?.name || ''}
        isLoading={isDeleting}
        onConfirm={handleDeleteBundle}
        onCancel={() => setDeletingBundle(null)}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-nilin shadow-lg z-50 flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {toast.message}
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MyBundlesPage;
