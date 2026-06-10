import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Gift,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  Save,
  Calendar,
  Tag,
  Percent,
  DollarSign,
  Users,
  Clock,
  RefreshCw,
  Loader2,
  Info,
  Link2,
  Copy,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AdminPageShell } from '../admin/AdminPageShell';
import ErrorBoundary from '../common/ErrorBoundary';
import { cn } from '../../lib/utils';
import {
  adminOfferApi,
  type AdminOffer,
  type OfferFormPayload,
} from '../../services/adminOfferApi';
import {
  formatOfferDateRange,
  formatOfferValue,
  getOfferValidityLabel,
  resolveOfferGradient,
  OFFER_GRADIENT_MAP,
} from '../../utils/offerDisplay';

const GRADIENT_OPTIONS = Object.keys(OFFER_GRADIENT_MAP);

const emptyForm = (): OfferFormPayload => ({
  title: '',
  displayTitle: '',
  displaySubtitle: '',
  description: '',
  code: '',
  type: 'percentage',
  value: 10,
  maxDiscount: 0,
  minOrderValue: 0,
  maxUses: 1000,
  maxUsesPerUser: 1,
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  displayBadge: '',
  displayGradient: 'from-nilin-rose to-nilin-coral',
  featured: false,
  applicableServices: [],
  applicableCategories: [],
  claimExpiresInDays: 30,
  targetType: 'all',
  targetProviders: [],
  validDays: [],
  validTimeStart: '',
  validTimeEnd: '',
});

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function extractError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

const AdminOffersManagement: React.FC = () => {
  // FIX: Use URL search params for filter state persistence
  const [searchParams, setSearchParams] = useSearchParams();

  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [services, setServices] = useState<Array<{ _id: string; name: string; category?: { name: string } }>>([]);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // FIX: Initialize from URL params for persistence
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [filterType, setFilterType] = useState<string>(searchParams.get('type') || 'all');
  // FIX: Added workflow status types
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired' | 'archived' | 'draft' | 'pending_review' | 'approved'>(
    (searchParams.get('status') as any) || 'all'
  );
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AdminOffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showServiceSelector, setShowServiceSelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [formData, setFormData] = useState<OfferFormPayload>(emptyForm());

  // FIX: Sync filter changes to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (filterType !== 'all') params.set('type', filterType);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    setSearchParams(params, { replace: true });
  }, [searchTerm, filterType, filterStatus, setSearchParams]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [offerList, serviceList, categoryList] = await Promise.all([
        adminOfferApi.list(),
        adminOfferApi.loadServiceOptions(),
        adminOfferApi.loadCategoryOptions(),
      ]);
      setOffers(offerList);
      setServices(serviceList);
      setCategories(categoryList);
      if (isRefresh) toast.success('Offers refreshed');
    } catch {
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOffers = offers.filter((offer) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      offer.title.toLowerCase().includes(q) ||
      offer.code.toLowerCase().includes(q) ||
      (offer.displayTitle || '').toLowerCase().includes(q);
    const matchesType = filterType === 'all' || offer.type === filterType;
    const validity = getOfferValidityLabel(offer.validFrom, offer.validUntil, offer.isActive);
    // FIX: Enhanced status filter with workflow statuses
    const matchesStatus = (() => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return offer.isActive && validity.tone !== 'danger';
      if (filterStatus === 'inactive') return !offer.isActive;
      if (filterStatus === 'expired') return validity.tone === 'danger';
      // FIX: Handle workflow statuses
      if (filterStatus === 'archived') return offer.status === 'archived';
      if (filterStatus === 'draft') return offer.status === 'draft';
      if (filterStatus === 'pending_review') return offer.status === 'pending_review';
      if (filterStatus === 'approved') return offer.status === 'approved';
      return true;
    })();
    return matchesSearch && matchesType && matchesStatus;
  });

  // FIX: Enhanced stats with workflow status breakdown
  const stats = {
    total: offers.length,
    active: offers.filter((o) => o.isActive && getOfferValidityLabel(o.validFrom, o.validUntil, true).tone !== 'danger').length,
    featured: offers.filter((o) => o.featured).length,
    claims: offers.reduce((s, o) => s + (o.currentUses || 0), 0),
    // FIX: Add workflow status counts
    draft: offers.filter((o) => o.status === 'draft').length,
    pendingReview: offers.filter((o) => o.status === 'pending_review').length,
    published: offers.filter((o) => o.status === 'published').length,
    archived: offers.filter((o) => o.status === 'archived').length,
  };

  const openCreate = () => {
    setEditingOffer(null);
    setFormData(emptyForm());
    setShowModal(true);
  };

  const openEdit = (offer: AdminOffer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      displayTitle: offer.displayTitle || '',
      displaySubtitle: offer.displaySubtitle || '',
      description: offer.description || '',
      code: offer.code,
      type: offer.type,
      value: offer.value,
      maxDiscount: offer.maxDiscount || 0,
      minOrderValue: offer.minOrderValue,
      maxUses: offer.maxUses,
      maxUsesPerUser: offer.maxUsesPerUser ?? 1,
      validFrom: new Date(offer.validFrom).toISOString().split('T')[0],
      validUntil: new Date(offer.validUntil).toISOString().split('T')[0],
      displayBadge: offer.displayBadge || '',
      displayGradient: offer.displayGradient || 'from-nilin-rose to-nilin-coral',
      featured: offer.featured || false,
      applicableServices: offer.applicableServices || [],
      applicableCategories: offer.applicableCategories || [],
      claimExpiresInDays: offer.claimExpiresInDays || 30,
      targetType: offer.targetType || 'all',
      targetProviders: offer.targetProviders || [],
      validDays: offer.validDays || [],
      validTimeStart: offer.validTimeStart || '',
      validTimeEnd: offer.validTimeEnd || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.code.trim()) {
      toast.error('Title and promo code are required');
      return;
    }
    if (new Date(formData.validUntil) < new Date(formData.validFrom)) {
      toast.error('End date must be after start date');
      return;
    }
    setIsSaving(true);
    try {
      if (editingOffer) {
        await adminOfferApi.update(editingOffer._id, formData);
        toast.success('Offer updated');
      } else {
        await adminOfferApi.create({ ...formData, isActive: true });
        toast.success('Offer created — visible on homepage when active and in date range');
      }
      setShowModal(false);
      setEditingOffer(null);
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to save offer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (offer: AdminOffer) => {
    if (
      !confirm(
        `Deactivate "${offer.displayTitle || offer.title}"? It will disappear from the customer homepage and checkout.`
      )
    ) {
      return;
    }
    try {
      await adminOfferApi.deactivate(offer._id);
      toast.success('Offer deactivated');
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to deactivate offer');
    }
  };

  const handleClone = async (offer: AdminOffer) => {
    const newCode = prompt('Enter new promo code (leave empty to auto-generate):');
    if (newCode === null) return; // User cancelled

    try {
      await adminOfferApi.clone(offer._id, newCode.toUpperCase());
      toast.success('Offer cloned successfully');
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to clone offer');
    }
  };

  const handleToggleActive = async (offer: AdminOffer) => {
    setTogglingId(offer._id);
    try {
      await adminOfferApi.setActive(offer._id, !offer.isActive);
      toast.success(offer.isActive ? 'Offer hidden from customers' : 'Offer is live for customers');
      await loadData();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to update offer status');
    } finally {
      setTogglingId(null);
    }
  };

  const toggleService = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      applicableServices: prev.applicableServices?.includes(id)
        ? prev.applicableServices.filter((x) => x !== id)
        : [...(prev.applicableServices || []), id],
    }));
  };

  const toggleCategory = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      applicableCategories: prev.applicableCategories?.includes(id)
        ? prev.applicableCategories.filter((x) => x !== id)
        : [...(prev.applicableCategories || []), id],
    }));
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

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Offers Management"
        subtitle="Promotions flow to customers on the homepage, offer detail, and booking checkout"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Offers', current: true },
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
              Create offer
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-5 py-4 flex gap-3">
            <Info className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-900 font-sans space-y-1">
              <p className="font-medium">How offers reach customers & providers</p>
              <p>
                Active offers appear on the <strong>homepage</strong> and <strong>/offers</strong> page.
                Customers <strong>claim</strong> an offer, then apply it at <strong>booking checkout</strong>.
                Linking services or categories limits where the discount applies — providers earn bookings on
                their linked services when customers use the code.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total offers', value: stats.total },
              { label: 'Live now', value: stats.active },
              { label: 'Featured', value: stats.featured },
              { label: 'Total redemptions', value: stats.claims },
              // FIX: Add workflow status KPIs
              { label: 'Pending Review', value: stats.pendingReview, accent: 'yellow' },
              { label: 'Archived', value: stats.archived, accent: 'red' },
            ].map((kpi) => (
              <div key={kpi.label} className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                <p className="text-xs uppercase tracking-wide text-nilin-warmGray font-sans">{kpi.label}</p>
                <p className="text-2xl font-serif text-nilin-charcoal mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type="search"
                  placeholder="Search title or code…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 font-sans focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 font-sans"
              >
                <option value="all">All types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed (AED)</option>
                <option value="free_service">Free service</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 font-sans"
              >
                <option value="all">All statuses</option>
                <option value="active">Live</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
                {/* FIX: Add workflow status options */}
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-12 text-center">
              <Gift className="w-14 h-14 text-nilin-warmGray mx-auto mb-4 opacity-60" />
              <p className="font-medium text-nilin-charcoal font-sans">No offers match this view</p>
              <button type="button" onClick={openCreate} className="btn-nilin mt-4">
                Create offer
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => {
                const validity = getOfferValidityLabel(offer.validFrom, offer.validUntil, offer.isActive);
                const serviceCount = offer.applicableServices?.length ?? 0;
                const categoryCount = offer.applicableCategories?.length ?? 0;

                return (
                  <article
                    key={offer._id}
                    className={cn(
                      'glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden flex flex-col',
                      !offer.isActive && 'opacity-75'
                    )}
                  >
                    <div
                      className={cn(
                        'h-28 p-4 relative bg-gradient-to-br',
                        resolveOfferGradient(offer.displayGradient)
                      )}
                    >
                      {offer.displayBadge && (
                        <span className="absolute top-3 left-3 px-2.5 py-0.5 bg-white/25 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                          {offer.displayBadge}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={togglingId === offer._id}
                        onClick={() => handleToggleActive(offer)}
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/35 transition-colors disabled:opacity-50"
                        title={offer.isActive ? 'Deactivate for customers' : 'Activate for customers'}
                      >
                        {togglingId === offer._id ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : offer.isActive ? (
                          <ToggleRight className="w-6 h-6 text-white" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-white/70" />
                        )}
                      </button>
                      <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-white/90 text-sm font-semibold text-nilin-charcoal shadow-sm">
                        {formatOfferValue(offer.type, offer.value)}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col font-sans">
                      <h3 className="font-semibold text-nilin-charcoal leading-snug">
                        {offer.displayTitle || offer.title}
                      </h3>
                      {offer.displayTitle && offer.title !== offer.displayTitle && (
                        <p className="text-xs text-nilin-warmGray mt-0.5">{offer.title}</p>
                      )}
                      <p className="text-sm text-nilin-warmGray mt-2 line-clamp-2">
                        {offer.displaySubtitle || offer.description}
                      </p>

                      <div className="flex items-center gap-2 mt-3">
                        <Tag className="w-3.5 h-3.5 text-nilin-warmGray" />
                        <code className="text-xs font-mono bg-nilin-blush/50 text-nilin-coral px-2 py-0.5 rounded">
                          {offer.code}
                        </code>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 text-xs text-nilin-warmGray">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{formatOfferDateRange(offer.validFrom, offer.validUntil)}</span>
                      </div>

                      {(serviceCount > 0 || categoryCount > 0 || offer.status) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {/* FIX: Show workflow status badge */}
                          {offer.status && offer.status !== 'published' && (
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              offer.status === 'draft' && 'bg-gray-100 text-gray-600',
                              offer.status === 'pending_review' && 'bg-yellow-100 text-yellow-700',
                              offer.status === 'approved' && 'bg-blue-100 text-blue-700',
                              offer.status === 'archived' && 'bg-red-100 text-red-700'
                            )}>
                              {offer.status.replace('_', ' ')}
                            </span>
                          )}
                          {serviceCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <Link2 className="w-3 h-3" />
                              {serviceCount} service{serviceCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {categoryCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              {categoryCount} categor{categoryCount !== 1 ? 'ies' : 'y'}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-4 text-xs">
                        <span className="flex items-center gap-1 text-nilin-warmGray">
                          <Users className="w-3.5 h-3.5" />
                          {offer.currentUses} / {offer.maxUses} used
                        </span>
                        <span className={cn('flex items-center gap-1 font-medium', validityToneClass(validity.tone))}>
                          <Clock className="w-3.5 h-3.5" />
                          {validity.text}
                        </span>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => openEdit(offer)}
                          className="flex-1 btn-nilin py-2 text-sm inline-flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(offer)}
                          className="px-3 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50"
                          title="Clone offer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(offer)}
                          className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                          title="Deactivate offer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {showModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => !isSaving && setShowModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-nilin-border/50 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-nilin-border/50 px-6 py-4 flex justify-between items-center z-10">
                <h2 className="text-xl font-serif text-nilin-charcoal">
                  {editingOffer ? 'Edit offer' : 'Create offer'}
                </h2>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-nilin-muted rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
                <label className="block text-sm font-medium">
                  Internal title *
                  <input
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    placeholder="Summer sale 15% off"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">
                    Display title
                    <input
                      value={formData.displayTitle}
                      onChange={(e) => setFormData({ ...formData, displayTitle: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Display subtitle
                    <input
                      value={formData.displaySubtitle}
                      onChange={(e) => setFormData({ ...formData, displaySubtitle: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                </div>
                <label className="block text-sm font-medium">
                  Promo code *
                  <input
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-mono"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">
                    Type *
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as OfferFormPayload['type'] })
                      }
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed (AED)</option>
                      <option value="free_service">Free service</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    {formData.type === 'percentage' ? 'Discount %' : 'Amount (AED)'}
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) || 0 })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">
                    Valid from *
                    <input
                      type="date"
                      required
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Valid until *
                    <input
                      type="date"
                      required
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">
                    Max uses (global)
                    <input
                      type="number"
                      min={1}
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: Number(e.target.value) || 1 })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Max uses per customer
                    <input
                      type="number"
                      min={1}
                      value={formData.maxUsesPerUser}
                      onChange={(e) => setFormData({ ...formData, maxUsesPerUser: Number(e.target.value) || 1 })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">
                    Claim expires in (days)
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={formData.claimExpiresInDays || 30}
                      onChange={(e) => setFormData({ ...formData, claimExpiresInDays: Number(e.target.value) || 30 })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                </div>
                <label className="block text-sm font-medium">
                  Badge
                  <select
                    value={formData.displayBadge}
                    onChange={(e) => setFormData({ ...formData, displayBadge: e.target.value })}
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                  >
                    <option value="">None</option>
                    <option value="Limited Time">Limited Time</option>
                    <option value="New">New</option>
                    <option value="Popular">Popular</option>
                    <option value="Hot">Hot</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Card gradient
                  <select
                    value={formData.displayGradient}
                    onChange={(e) => setFormData({ ...formData, displayGradient: e.target.value })}
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                  >
                    {GRADIENT_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g.replace('from-', '').replace(/ to-/g, ' → ')}
                      </option>
                    ))}
                  </select>
                  <div
                    className={cn('mt-2 h-10 rounded-xl bg-gradient-to-r', resolveOfferGradient(formData.displayGradient))}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Description
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 resize-none"
                  />
                </label>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowServiceSelector(!showServiceSelector)}
                    className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 text-left flex justify-between"
                  >
                    <span>
                      {formData.applicableServices?.length
                        ? `${formData.applicableServices.length} service(s)`
                        : 'All services (no restriction)'}
                    </span>
                    <span>{showServiceSelector ? '▲' : '▼'}</span>
                  </button>
                  {showServiceSelector && (
                    <div className="mt-2 p-3 rounded-xl border border-nilin-border/40 max-h-40 overflow-y-auto bg-nilin-muted/30">
                      {services.map((s) => (
                        <label key={s._id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.applicableServices?.includes(s._id)}
                            onChange={() => toggleService(s._id)}
                          />
                          <span className="text-sm">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowCategorySelector(!showCategorySelector)}
                    className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 text-left flex justify-between"
                  >
                    <span>
                      {formData.applicableCategories?.length
                        ? `${formData.applicableCategories.length} categor(ies)`
                        : 'All categories'}
                    </span>
                    <span>{showCategorySelector ? '▲' : '▼'}</span>
                  </button>
                  {showCategorySelector && (
                    <div className="mt-2 p-3 rounded-xl border border-nilin-border/40 max-h-40 overflow-y-auto bg-nilin-muted/30">
                      {categories.map((c) => (
                        <label key={c._id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.applicableCategories?.includes(c._id)}
                            onChange={() => toggleCategory(c._id)}
                          />
                          <span className="text-sm">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  />
                  <span className="text-sm">Feature on homepage carousel</span>
                </label>

                {/* NEW: Target audience dropdown */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Target audience
                    <select
                      value={formData.targetType || 'all'}
                      onChange={(e) => setFormData({ ...formData, targetType: e.target.value as OfferFormPayload['targetType'] })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    >
                      <option value="all">All users</option>
                      <option value="new_users">New users only</option>
                      <option value="first_booking">First booking only</option>
                      <option value="specific_users">Specific users</option>
                      <option value="specific_services">Specific services</option>
                      <option value="specific_providers">Specific providers</option>
                    </select>
                  </label>
                </div>

                {/* NEW: Valid days checkboxes */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Valid days (leave empty for all days)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.validDays?.includes(day)}
                          onChange={(e) => {
                            const days = formData.validDays || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, validDays: [...days, day] });
                            } else {
                              setFormData({ ...formData, validDays: days.filter((d) => d !== day) });
                            }
                          }}
                          className="rounded border-nilin-border/50 text-nilin-coral focus:ring-nilin-coral/30"
                        />
                        <span className="text-sm capitalize">{day.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* NEW: Time restrictions */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">
                    Valid from time
                    <input
                      type="time"
                      value={formData.validTimeStart || ''}
                      onChange={(e) => setFormData({ ...formData, validTimeStart: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                      placeholder="09:00"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Valid until time
                    <input
                      type="time"
                      value={formData.validTimeEnd || ''}
                      onChange={(e) => setFormData({ ...formData, validTimeEnd: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                      placeholder="18:00"
                    />
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-nilin-border/50"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className="flex-1 btn-nilin flex justify-center gap-2">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editingOffer ? 'Save changes' : 'Create offer'}
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

export default AdminOffersManagement;
