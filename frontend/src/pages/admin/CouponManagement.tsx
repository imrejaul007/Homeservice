import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Plus,
  Edit3,
  Trash2,
  Search,
  X,
  Save,
  Percent,
  DollarSign,
  RefreshCw,
  Loader2,
  Info,
  Link2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { formatPrice } from '../../utils/currency';
import { cn } from '../../lib/utils';
import {
  adminCouponApi,
  type AdminCoupon,
  type CouponFormPayload,
  type CouponStats,
} from '../../services/adminCouponApi';
import { getOfferValidityLabel } from '../../utils/offerDisplay';

interface ValidationErrors {
  code?: string;
  title?: string;
  value?: string;
  minOrderAmount?: string;
  usageLimit?: string;
  maxUsesPerUser?: string;
  validFrom?: string;
  validUntil?: string;
}

const emptyForm = (): CouponFormPayload => ({
  code: '',
  type: 'percentage',
  value: 10,
  maxDiscount: 0,
  minOrderAmount: 0,
  usageLimit: 1000,
  maxUsesPerUser: 1,
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  title: '',
  description: '',
  featured: false,
});

const validateCoupon = (data: CouponFormPayload, isEditing: boolean): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!isEditing) {
    if (!data.code?.trim()) {
      errors.code = 'Coupon code is required';
    } else if (data.code.trim().length < 6) {
      // FIX: Increase minimum from 3 to 6 characters for security
      errors.code = 'Code must be at least 6 characters';
    } else if (!/^[A-Za-z0-9]+$/.test(data.code)) {
      errors.code = 'Code must be alphanumeric';
    }
  }

  if (!data.title?.trim()) {
    errors.title = 'Title is required';
  }

  if (data.value < 0) {
    errors.value = 'Value cannot be negative';
  } else if (data.type === 'percentage' && data.value > 100) {
    errors.value = 'Percentage cannot exceed 100%';
  }

  if (data.minOrderAmount < 0) errors.minOrderAmount = 'Cannot be negative';
  if (data.usageLimit < 1) errors.usageLimit = 'Usage limit must be at least 1';
  if (data.maxUsesPerUser < 1) errors.maxUsesPerUser = 'Per-customer limit must be at least 1';

  if (!data.validFrom) errors.validFrom = 'Start date is required';
  if (!data.validUntil) {
    errors.validUntil = 'End date is required';
  } else if (data.validFrom && new Date(data.validFrom) >= new Date(data.validUntil)) {
    errors.validUntil = 'End date must be after start date';
  } else if (!isEditing) {
    const end = new Date(`${data.validUntil}T23:59:59`);
    if (end < new Date()) {
      errors.validUntil = 'End date must be in the future for new coupons';
    }
  }

  return errors;
};

function extractError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

const typeBadgeClass = (type: string) => {
  switch (type) {
    case 'percentage':
      return 'bg-sky-100 text-sky-800';
    case 'fixed':
      return 'bg-emerald-100 text-emerald-800';
    case 'free_service':
      return 'bg-violet-100 text-violet-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const validityToneClass = (tone: string) => {
  switch (tone) {
    case 'danger':
      return 'text-red-600';
    case 'warning':
      return 'text-amber-700';
    case 'success':
      return 'text-emerald-700';
    default:
      return 'text-nilin-warmGray';
  }
};

const CouponManagement: React.FC = () => {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'live' | 'active' | 'inactive' | 'expired' | 'scheduled'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<CouponFormPayload>(emptyForm());

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listParams = useCallback(() => {
    const params: Parameters<typeof adminCouponApi.list>[0] = {
      page: currentPage,
      limit: 20,
      search: search || undefined,
      type: filterType === 'all' ? undefined : filterType,
    };
    if (filterStatus === 'inactive') params.isActive = 'false';
    else if (filterStatus === 'active') params.isActive = 'true';
    else if (filterStatus === 'live') params.status = 'live';
    else if (filterStatus === 'expired') params.status = 'expired';
    else if (filterStatus === 'scheduled') params.status = 'scheduled';
    return params;
  }, [currentPage, search, filterType, filterStatus]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [listRes, statsRes] = await Promise.all([
          adminCouponApi.list(listParams()),
          adminCouponApi.stats(),
        ]);
        setCoupons(listRes.coupons);
        setTotalPages(listRes.pagination.pages || 1);
        setStats(statsRes);
        if (isRefresh) toast.success('Coupons refreshed');
      } catch (err) {
        toast.error(extractError(err) || 'Failed to load coupons');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [listParams]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingCoupon(null);
    setFormData(emptyForm());
    setValidationErrors({});
    setShowModal(true);
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditingCoupon(coupon);
    setValidationErrors({});
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscount: coupon.maxDiscount || 0,
      minOrderAmount: coupon.minOrderValue,
      usageLimit: coupon.maxUses,
      maxUsesPerUser: coupon.maxUsesPerUser ?? 1,
      validFrom: coupon.validFrom?.split('T')[0] || '',
      validUntil: coupon.validUntil?.split('T')[0] || '',
      title: coupon.title,
      description: coupon.description || '',
      featured: coupon.featured || false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateCoupon(formData, !!editingCoupon);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (editingCoupon) {
        const { code: _code, ...updateFields } = formData;
        await adminCouponApi.update(editingCoupon._id, updateFields);
        toast.success('Coupon updated');
      } else {
        await adminCouponApi.create(formData);
        toast.success('Coupon created — customers can apply the code at checkout');
      }
      setShowModal(false);
      setEditingCoupon(null);
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (coupon: AdminCoupon) => {
    if (!confirm(`Deactivate "${coupon.code}"? It will no longer work at checkout.`)) return;
    try {
      await adminCouponApi.deactivate(coupon._id);
      toast.success('Coupon deactivated');
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to deactivate');
    }
  };

  const handleToggleActive = async (coupon: AdminCoupon) => {
    setTogglingId(coupon._id);
    try {
      await adminCouponApi.setActive(coupon._id, !coupon.isActive);
      toast.success(coupon.isActive ? 'Coupon disabled' : 'Coupon reactivated');
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (coupon: AdminCoupon) => {
    if (!confirm(`Permanently delete "${coupon.code}"? This cannot be undone.`)) return;
    try {
      await adminCouponApi.delete(coupon._id);
      toast.success('Coupon deleted');
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to delete coupon');
    }
  };

  const formatCouponValue = (coupon: AdminCoupon) => {
    if (coupon.type === 'percentage') {
      const cap = coupon.maxDiscount ? ` (max ${formatPrice(coupon.maxDiscount)})` : '';
      return `${coupon.value}%${cap}`;
    }
    if (coupon.type === 'free_service') return 'Free service';
    return formatPrice(coupon.value);
  };

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Coupon Management"
        subtitle="Discount codes for booking checkout — separate from homepage offer cards"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Coupons', current: true },
        ]}
        headerActions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <button type="button" onClick={openCreate} className="btn-nilin flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create coupon
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-5 py-4 flex gap-3">
            <Info className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-950 font-sans space-y-1">
              <p className="font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                End-to-end flow
              </p>
              <p>
                Coupons share the same database as <strong>Offers</strong> but are managed here as
                checkout codes. Customers enter the code in <strong>booking checkout</strong> (or claim
                via offers). Providers see discounted bookings on their linked services when limits apply.
              </p>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total coupons', value: stats.total },
                { label: 'Active flag', value: stats.active, accent: 'text-emerald-700' },
                { label: 'Total uses', value: stats.totalUses, accent: 'text-sky-700' },
                { label: 'Featured', value: stats.featured, accent: 'text-violet-700' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5"
                >
                  <p className="text-xs uppercase tracking-wide text-nilin-warmGray font-sans">
                    {kpi.label}
                  </p>
                  <p className={cn('text-2xl font-serif mt-1', kpi.accent || 'text-nilin-charcoal')}>
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type="search"
                  placeholder="Search code or title…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 font-sans text-sm focus:ring-2 focus:ring-nilin-rose/30"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 text-sm font-sans"
              >
                <option value="all">All types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
                <option value="free_service">Free service</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as typeof filterStatus);
                  setCurrentPage(1);
                }}
                className="px-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 text-sm font-sans"
              >
                <option value="all">All status</option>
                <option value="live">Live now</option>
                <option value="active">Active flag</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-nilin-warmGray">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading coupons…
              </div>
            ) : coupons.length === 0 ? (
              <div className="py-16 text-center text-nilin-warmGray font-sans">
                <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
                No coupons match your filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b border-nilin-border/50 bg-nilin-blush/20">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">
                        Code
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">
                        Type
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">
                        Value
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">
                        Usage
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">
                        Validity
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">
                        Status
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-nilin-warmGray">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nilin-border/40">
                    {coupons.map((coupon) => {
                      const validity = getOfferValidityLabel(
                        coupon.validFrom,
                        coupon.validUntil,
                        coupon.isActive
                      );
                      return (
                        <tr key={coupon._id} className="hover:bg-nilin-blush/10 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-mono font-semibold text-nilin-charcoal">{coupon.code}</div>
                            <div className="text-nilin-warmGray text-xs mt-0.5">{coupon.title}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                                typeBadgeClass(coupon.type)
                              )}
                            >
                              {coupon.type === 'percentage' ? (
                                <Percent className="w-3 h-3" />
                              ) : coupon.type === 'fixed' ? (
                                <DollarSign className="w-3 h-3" />
                              ) : (
                                <Ticket className="w-3 h-3" />
                              )}
                              {coupon.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-nilin-charcoal">{formatCouponValue(coupon)}</td>
                          <td className="px-5 py-4 text-nilin-charcoal">
                            {coupon.currentUses} / {coupon.maxUses}
                          </td>
                          <td className="px-5 py-4">
                            <div className={cn('font-medium', validityToneClass(validity.tone))}>
                              {validity.text}
                            </div>
                            <div className="text-xs text-nilin-warmGray mt-0.5">
                              until{' '}
                              {new Date(coupon.validUntil).toLocaleDateString('en-AE', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-xs font-medium',
                                  coupon.isActive
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-600'
                                )}
                              >
                                {coupon.isActive ? 'Active' : 'Inactive'}
                              </span>
                              {coupon.featured && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  Featured
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(coupon)}
                                className="p-2 rounded-lg text-nilin-charcoal hover:bg-nilin-blush/50"
                                title="Edit"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(coupon)}
                                disabled={togglingId === coupon._id}
                                className="p-2 rounded-lg text-nilin-charcoal hover:bg-nilin-blush/50 disabled:opacity-50"
                                title={coupon.isActive ? 'Deactivate' : 'Reactivate'}
                              >
                                {togglingId === coupon._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : coupon.isActive ? (
                                  <ToggleRight className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              {coupon.isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivate(coupon)}
                                  className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded-lg"
                                >
                                  Off
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(coupon)}
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 font-sans text-sm">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl border border-nilin-border/50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-nilin-warmGray">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl border border-nilin-border/50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-nilin-border/50">
              <div className="flex items-center justify-between px-6 py-4 border-b border-nilin-border/40">
                <h2 className="text-lg font-serif text-nilin-charcoal">
                  {editingCoupon ? 'Edit coupon' : 'Create coupon'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-nilin-blush/40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Coupon code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    disabled={!!editingCoupon}
                    placeholder="SUMMER15"
                    className={cn(
                      'w-full px-3 py-2 rounded-xl border font-mono',
                      validationErrors.code ? 'border-red-400' : 'border-nilin-border/60'
                    )}
                  />
                  {validationErrors.code && (
                    <p className="text-xs text-red-600 mt-1">{validationErrors.code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={cn(
                      'w-full px-3 py-2 rounded-xl border',
                      validationErrors.title ? 'border-red-400' : 'border-nilin-border/60'
                    )}
                  />
                  {validationErrors.title && (
                    <p className="text-xs text-red-600 mt-1">{validationErrors.title}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as CouponFormPayload['type'],
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed (AED)</option>
                      <option value="free_service">Free service</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {formData.type === 'percentage' ? 'Percent' : 'Amount'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.value}
                      onChange={(e) =>
                        setFormData({ ...formData, value: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                </div>
                {formData.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Max discount (AED)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.maxDiscount}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDiscount: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Min order (AED)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.minOrderAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, minOrderAmount: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Usage limit (global)</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.usageLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, usageLimit: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max uses per customer</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.maxUsesPerUser}
                      onChange={(e) =>
                        setFormData({ ...formData, maxUsesPerUser: Number(e.target.value) || 1 })
                      }
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border',
                        validationErrors.maxUsesPerUser ? 'border-red-400' : 'border-nilin-border/60'
                      )}
                    />
                    {validationErrors.maxUsesPerUser && (
                      <p className="text-xs text-red-600 mt-1">{validationErrors.maxUsesPerUser}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Valid from</label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) =>
                        setFormData({ ...formData, validFrom: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valid until</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) =>
                        setFormData({ ...formData, validUntil: e.target.value })
                      }
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border',
                        validationErrors.validUntil ? 'border-red-400' : 'border-nilin-border/60'
                      )}
                    />
                    {validationErrors.validUntil && (
                      <p className="text-xs text-red-600 mt-1">{validationErrors.validUntil}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded border-nilin-border"
                  />
                  Featured on homepage
                </label>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-nilin-border/60 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-nilin inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingCoupon ? 'Save changes' : 'Create coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default CouponManagement;
