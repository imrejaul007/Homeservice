/**
 * CouponCreation - Provider coupon creation
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Check,
  DollarSign,
  Percent,
  Clock,
  Calendar,
  Search,
  Filter,
  Loader2,
  Link,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Gift,
  X,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type CouponType = 'percentage' | 'fixed' | 'free_service';
export type CouponStatus = 'active' | 'paused' | 'expired' | 'exhausted';

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

export interface Coupon {
  /** Unique coupon ID */
  id: string;
  /** Coupon code */
  code: string;
  /** Coupon title/name */
  title: string;
  /** Coupon description */
  description?: string;
  /** Coupon type */
  type: CouponType;
  /** Discount value (percentage or fixed amount) */
  value: number;
  /** Currency code (for fixed discount) */
  currency?: string;
  /** Minimum order amount */
  minOrderAmount?: number;
  /** Maximum discount amount (for percentage) */
  maxDiscount?: number;
  /** Start date */
  startDate: string;
  /** End date */
  endDate: string;
  /** Total usage limit */
  usageLimit?: number;
  /** Current usage count */
  usageCount: number;
  /** Per-user limit */
  perUserLimit?: number;
  /** Services applicable (empty = all) */
  applicableServices?: string[];
  /** Is active */
  status: CouponStatus;
  /** Creation date */
  createdAt: string;
  /** Total savings */
  totalSavings?: number;
  /** Number of new customers acquired */
  newCustomersAcquired?: number;
}

export interface CouponCreationProps {
  /** Existing coupons */
  coupons: Coupon[];
  /** Available services for coupons */
  availableServices: ServiceOption[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when coupon is created */
  onCreate: (coupon: Partial<Coupon>) => Promise<void>;
  /** Callback when coupon is updated */
  onUpdate: (couponId: string, coupon: Partial<Coupon>) => Promise<void>;
  /** Callback when coupon is deleted */
  onDelete: (couponId: string) => Promise<void>;
  /** Callback when coupon code is copied */
  onCopy?: (couponId: string) => Promise<void>;
  /** Callback when viewing coupon analytics */
  onViewAnalytics?: (couponId: string) => void;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Status & Type Configuration
// =============================================================================

const statusConfig: Record<CouponStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-100' },
  paused: { label: 'Paused', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  expired: { label: 'Expired', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  exhausted: { label: 'Exhausted', color: 'text-red-600', bgColor: 'bg-red-100' },
};

const typeConfig: Record<CouponType, { label: string; icon: React.ElementType; color: string }> = {
  percentage: { label: 'Percentage', icon: Percent, color: 'text-purple-600' },
  fixed: { label: 'Fixed Amount', icon: DollarSign, color: 'text-green-600' },
  free_service: { label: 'Free Service', icon: Gift, color: 'text-blue-600' },
};

// =============================================================================
// Coupon Form Modal
// =============================================================================

interface CouponFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (coupon: Partial<Coupon>) => Promise<void>;
  initialData?: Partial<Coupon>;
  availableServices: ServiceOption[];
}

const CouponFormModal: React.FC<CouponFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableServices,
}) => {
  const [formData, setFormData] = useState<Partial<Coupon>>(
    initialData || {
      code: '',
      title: '',
      description: '',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxDiscount: undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      usageLimit: undefined,
      perUserLimit: 1,
      applicableServices: [],
      status: 'active',
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generateCode, setGenerateCode] = useState(false);

  const generateCouponCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.title) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    const current = formData.applicableServices || [];
    const updated = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId];
    setFormData({ ...formData, applicableServices: updated });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-lg w-full my-8">
          <div className="p-6 border-b border-nilin-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-nilin-charcoal">
                {initialData?.id ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-nilin-lightGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Coupon Code */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Coupon Code *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="flex-1 px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 uppercase"
                  placeholder="e.g., SUMMER20"
                  maxLength={20}
                />
                <button
                  onClick={generateCouponCode}
                  className="px-4 py-2.5 bg-nilin-muted text-nilin-charcoal rounded-xl hover:bg-nilin-blush transition-colors text-sm font-medium"
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                placeholder="e.g., Summer Sale 20% Off"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 resize-none"
                placeholder="Describe the offer..."
              />
            </div>

            {/* Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Discount Type
                </label>
                <select
                  value={formData.type || 'percentage'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CouponType })}
                  className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="free_service">Free Service</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  {formData.type === 'percentage' ? 'Discount %' : 'Amount'}
                </label>
                <div className="relative">
                  {formData.type === 'percentage' ? (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                      %
                    </span>
                  ) : (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                      AED
                    </span>
                  )}
                  <input
                    type="number"
                    value={formData.value || ''}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className={cn(
                      'w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
                      formData.type === 'percentage' ? 'pl-10' : 'pl-12'
                    )}
                    min={0}
                    max={formData.type === 'percentage' ? 100 : undefined}
                  />
                </div>
              </div>
            </div>

            {/* Max Discount (for percentage) */}
            {formData.type === 'percentage' && (
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Maximum Discount (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                    AED
                  </span>
                  <input
                    type="number"
                    value={formData.maxDiscount || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDiscount: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full pl-12 pr-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                    placeholder="No limit"
                  />
                </div>
              </div>
            )}

            {/* Min Order Amount */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Minimum Order Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                  AED
                </span>
                <input
                  type="number"
                  value={formData.minOrderAmount || 0}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                  className="w-full pl-12 pr-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  min={0}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Total Usage Limit
                </label>
                <input
                  type="number"
                  value={formData.usageLimit || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, usageLimit: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  placeholder="Unlimited"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Per User Limit
                </label>
                <input
                  type="number"
                  value={formData.perUserLimit || 1}
                  onChange={(e) => setFormData({ ...formData, perUserLimit: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  min={1}
                />
              </div>
            </div>

            {/* Applicable Services */}
            {availableServices.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Applicable Services (leave empty for all)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-nilin-muted rounded-xl">
                  {availableServices.map((service) => {
                    const isSelected = !formData.applicableServices?.length ||
                      formData.applicableServices.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors',
                          isSelected ? 'bg-nilin-coral/20' : 'bg-white hover:bg-nilin-blush'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleServiceToggle(service.id)}
                          className="w-4 h-4 text-nilin-coral rounded focus:ring-nilin-coral"
                        />
                        <span className="text-sm text-nilin-charcoal">{service.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-nilin-border flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.code || !formData.title || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {initialData?.id ? 'Save Changes' : 'Create Coupon'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Coupon Card Component
// =============================================================================

interface CouponCardProps {
  coupon: Coupon;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onCopy: () => Promise<void>;
  onViewAnalytics?: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({
  coupon,
  onEdit,
  onDelete,
  onCopy,
  onViewAnalytics,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const status = statusConfig[coupon.status];
  const type = typeConfig[coupon.type];
  const TypeIcon = type.icon;

  const formatCurrency = (amount: number, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopy = async () => {
    await onCopy();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const discountDisplay =
    coupon.type === 'percentage'
      ? `${coupon.value}%`
      : formatCurrency(coupon.value, coupon.currency);

  const usagePercent = coupon.usageLimit
    ? (coupon.usageCount / coupon.usageLimit) * 100
    : 0;

  const isExpiringSoon =
    new Date(coupon.endDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-nilin-sm overflow-hidden transition-all',
        coupon.status === 'active'
          ? 'border-green-200'
          : coupon.status === 'paused'
          ? 'border-amber-200'
          : 'border-gray-200',
        coupon.status !== 'active' && 'opacity-75'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                coupon.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
              )}
            >
              <Tag className={cn('w-6 h-6', coupon.status === 'active' ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-nilin-charcoal">{coupon.title}</h4>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    status.bgColor,
                    status.color
                  )}
                >
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-lg font-bold text-nilin-coral">
                <TypeIcon className="w-5 h-5" />
                <span>{discountDisplay}</span>
                {coupon.maxDiscount && (
                  <span className="text-xs font-normal text-nilin-warmGray">
                    (max {formatCurrency(coupon.maxDiscount)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Code Badge */}
          <div className="text-right">
            <button
              onClick={handleCopy}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-colors',
                isCopied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-nilin-muted text-nilin-charcoal hover:bg-nilin-blush'
              )}
            >
              {isCopied ? (
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Copied
                </span>
              ) : (
                coupon.code
              )}
            </button>
          </div>
        </div>

        {/* Description */}
        {coupon.description && (
          <p className="text-sm text-nilin-warmGray mb-3">{coupon.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-nilin-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-nilin-warmGray mb-1">
              <Calendar className="w-3 h-3" />
              <span>Valid Until</span>
            </div>
            <p className={cn('text-sm font-medium', isExpiringSoon && 'text-amber-600')}>
              {formatDate(coupon.endDate)}
            </p>
          </div>
          <div className="bg-nilin-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-nilin-warmGray mb-1">
              <BarChart3 className="w-3 h-3" />
              <span>Usage</span>
            </div>
            <p className="text-sm font-medium">
              {coupon.usageCount}
              {coupon.usageLimit && ` / ${coupon.usageLimit}`}
            </p>
          </div>
        </div>

        {/* Usage Progress */}
        {coupon.usageLimit && (
          <div className="mb-3">
            <div className="h-2 bg-nilin-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent >= 90
                    ? 'bg-red-500'
                    : usagePercent >= 70
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                )}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Analytics Preview */}
        {(coupon.totalSavings || coupon.newCustomersAcquired) && (
          <div className="flex items-center gap-4 text-xs text-nilin-warmGray mb-3">
            {coupon.totalSavings && (
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                {formatCurrency(coupon.totalSavings)} saved
              </span>
            )}
            {coupon.newCustomersAcquired !== undefined && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                {coupon.newCustomersAcquired} new customers
              </span>
            )}
          </div>
        )}

        {/* Expiring Warning */}
        {isExpiringSoon && coupon.status === 'active' && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-amber-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Expiring soon! Consider extending the validity.</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-nilin-muted/50 border-t border-nilin-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          {onViewAnalytics && (
            <button
              onClick={onViewAnalytics}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
              title="View analytics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            title="Edit coupon"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-nilin-warmGray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Delete coupon"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const CouponCreation: React.FC<CouponCreationProps> = ({
  coupons,
  availableServices,
  isLoading = false,
  onCreate,
  onUpdate,
  onDelete,
  onCopy,
  onViewAnalytics,
  currency = 'AED',
  className,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CouponStatus | 'all'>('all');

  // Filter coupons
  const filteredCoupons = coupons.filter((coupon) => {
    if (statusFilter !== 'all' && coupon.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        coupon.code.toLowerCase().includes(query) ||
        coupon.title.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: coupons.length,
    active: coupons.filter((c) => c.status === 'active').length,
    totalSavings: coupons.reduce((sum, c) => sum + (c.totalSavings || 0), 0),
    totalUsage: coupons.reduce((sum, c) => sum + c.usageCount, 0),
  };

  const handleSubmit = async (couponData: Partial<Coupon>) => {
    if (editingCoupon) {
      await onUpdate(editingCoupon.id, couponData);
    } else {
      await onCreate(couponData);
    }
    setEditingCoupon(null);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Coupon Management
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {stats.active} active coupon{stats.active !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">Active Coupons</p>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 mb-1">Total Usage</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalUsage}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-xs text-red-600 mb-1">Total Savings</p>
          <p className="text-2xl font-bold text-red-700">
            {new Intl.NumberFormat('en-AE', {
              style: 'currency',
              currency,
              minimumFractionDigits: 0,
            }).format(stats.totalSavings)}
          </p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-600 mb-1">All Coupons</p>
          <p className="text-2xl font-bold text-purple-700">{stats.total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coupons..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CouponStatus | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          {(Object.keys(statusConfig) as CouponStatus[]).map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Coupons Grid */}
      {filteredCoupons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCoupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onEdit={() => setEditingCoupon(coupon)}
              onDelete={() => onDelete(coupon.id)}
              onCopy={onCopy ? () => onCopy(coupon.id) : async () => {}}
              onViewAnalytics={onViewAnalytics ? () => onViewAnalytics(coupon.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No coupons found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            {coupons.length === 0
              ? 'Create your first promotional coupon'
              : 'Try adjusting your filters'}
          </p>
          {coupons.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-rose transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Coupon
            </button>
          )}
        </div>
      )}

      {/* Form Modal */}
      <CouponFormModal
        isOpen={showForm || editingCoupon !== null}
        onClose={() => {
          setShowForm(false);
          setEditingCoupon(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingCoupon || undefined}
        availableServices={availableServices}
      />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default CouponCreation;
