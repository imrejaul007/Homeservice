import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit3,
  Trash2,
  Star,
  X,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Eye,
  ChevronRight,
  AlertCircle,
  Filter,
  BarChart3,
  Activity,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { formatPrice } from '../../utils/currency';
import { cn } from '../../lib/utils';
import {
  adminBundleApi,
  type AdminBundle,
  type BundleStats,
  type BundleEditPayload,
} from '../../services/adminBundleApi';

type Tab = 'pending' | 'all' | 'analytics';
type BundleStatus = 'pending' | 'approved' | 'rejected';

// ============================================
// Helper Functions
// ============================================

function extractError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusBadgeClass = (status: BundleStatus) => {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'pending':
    default:
      return 'bg-amber-100 text-amber-800';
  }
};

const statusIcon = (status: BundleStatus) => {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'rejected':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'pending':
    default:
      return <Clock className="w-4 h-4 text-amber-600" />;
  }
};

// ============================================
// Bundle Details Modal
// ============================================

const BundleDetailsModal: React.FC<{
  bundle: AdminBundle;
  onClose: () => void;
}> = ({ bundle, onClose }) => {
  const provider = bundle.providerId;
  const category = bundle.categoryId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-nilin-border/50 shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-nilin-border/50 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-serif text-nilin-charcoal">{bundle.name}</h2>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', statusBadgeClass(bundle.status))}>
                {bundle.status}
              </span>
              {bundle.isFeatured && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              )}
            </div>
            {bundle.rejectionReason && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Rejection reason: {bundle.rejectionReason}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-nilin-blush/40 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Bundle Image */}
          {bundle.image && (
            <div className="rounded-xl overflow-hidden bg-nilin-blush/20">
              <img src={bundle.image} alt={bundle.name} className="w-full h-48 object-cover" />
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-nilin-warmGray mb-2">Description</h3>
            <p className="text-nilin-charcoal font-sans">{bundle.description}</p>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-nilin-blush/20 rounded-xl p-4">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Original Price</p>
              <p className="text-lg font-serif text-nilin-charcoal mt-1">
                {formatPrice(bundle.originalPrice, bundle.currency)}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Bundle Price</p>
              <p className="text-lg font-serif text-emerald-700 mt-1">
                {formatPrice(bundle.bundlePrice, bundle.currency)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Savings</p>
              <p className="text-lg font-serif text-amber-700 mt-1">
                {bundle.savingsPercentage}% ({formatPrice(bundle.savingsAmount, bundle.currency)})
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-nilin-border/40 rounded-xl p-4 text-center">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Bookings</p>
              <p className="text-xl font-serif text-nilin-charcoal mt-1">{bundle.bookingCount}</p>
            </div>
            <div className="bg-white border border-nilin-border/40 rounded-xl p-4 text-center">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Redemptions</p>
              <p className="text-xl font-serif text-nilin-charcoal mt-1">
                {bundle.redemptionsUsed}
                {bundle.maxRedemptions ? ` / ${bundle.maxRedemptions}` : ''}
              </p>
            </div>
            <div className="bg-white border border-nilin-border/40 rounded-xl p-4 text-center">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Rating</p>
              <p className="text-xl font-serif text-nilin-charcoal mt-1">
                {bundle.rating?.average?.toFixed(1) || 'N/A'} ({bundle.rating?.count || 0})
              </p>
            </div>
            <div className="bg-white border border-nilin-border/40 rounded-xl p-4 text-center">
              <p className="text-xs text-nilin-warmGray uppercase tracking-wide">Services</p>
              <p className="text-xl font-serif text-nilin-charcoal mt-1">{bundle.services?.length || 0}</p>
            </div>
          </div>

          {/* Provider Info */}
          {provider && (
            <div>
              <h3 className="text-sm font-medium text-nilin-warmGray mb-3">Provider</h3>
              <div className="bg-white border border-nilin-border/40 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-nilin-blush/50 flex items-center justify-center">
                  <span className="text-lg font-medium text-nilin-coral">
                    {provider.firstName?.[0]}{provider.lastName?.[0]}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-nilin-charcoal">
                    {provider.businessName || `${provider.firstName} ${provider.lastName}`}
                  </p>
                  <p className="text-sm text-nilin-warmGray">{provider.email}</p>
                  {provider.phone && <p className="text-sm text-nilin-warmGray">{provider.phone}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Services */}
          {bundle.services && bundle.services.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-nilin-warmGray mb-3">Services Included</h3>
              <div className="space-y-2">
                {bundle.services.map((service, idx) => (
                  <div key={idx} className="bg-white border border-nilin-border/40 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-nilin-charcoal">{service?.serviceName ?? 'Unknown Service'}</p>
                      {service?.description && (
                        <p className="text-sm text-nilin-warmGray">{service.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-nilin-charcoal">
                        {formatPrice(service?.originalPrice ?? 0, bundle.currency)}
                      </p>
                      {service?.quantity > 1 && (
                        <p className="text-xs text-nilin-warmGray">Qty: {service.quantity}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms */}
          {bundle.terms && (
            <div>
              <h3 className="text-sm font-medium text-nilin-warmGray mb-2">Terms & Conditions</h3>
              <p className="text-sm text-nilin-charcoal bg-gray-50 rounded-xl p-4">{bundle.terms}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-nilin-warmGray">Valid From</p>
              <p className="text-nilin-charcoal font-medium">{formatDate(bundle.validFrom)}</p>
            </div>
            <div>
              <p className="text-nilin-warmGray">Valid Until</p>
              <p className="text-nilin-charcoal font-medium">{formatDate(bundle.validUntil)}</p>
            </div>
            {category && (
              <div>
                <p className="text-nilin-warmGray">Category</p>
                <p className="text-nilin-charcoal font-medium">{category.name}</p>
              </div>
            )}
            <div>
              <p className="text-nilin-warmGray">Created</p>
              <p className="text-nilin-charcoal font-medium">{formatDateTime(bundle.createdAt)}</p>
            </div>
          </div>

          {/* Tags */}
          {bundle.tags && bundle.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bundle.tags.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-nilin-blush/40 text-nilin-coral rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-nilin-border/50 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-nilin-border/50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Rejection Modal
// ============================================

const RejectModal: React.FC<{
  bundle: AdminBundle;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}> = ({ bundle, onClose, onReject }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onReject(reason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-nilin-border/50 shadow-xl">
        <div className="p-6 border-b border-nilin-border/50 flex items-center justify-between">
          <h2 className="text-lg font-serif text-nilin-charcoal">Reject Bundle</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-nilin-blush/40 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-nilin-warmGray font-sans">
            You are about to reject <strong className="text-nilin-charcoal">{bundle.name}</strong>.
            Please provide a reason for the provider.
          </p>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why this bundle is being rejected..."
              className="w-full px-4 py-3 rounded-xl border border-nilin-border/50 resize-none font-sans"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-nilin-border/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject Bundle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// Edit Bundle Modal
// ============================================

const EditBundleModal: React.FC<{
  bundle: AdminBundle;
  onClose: () => void;
  onSave: (updates: BundleEditPayload) => Promise<void>;
}> = ({ bundle, onClose, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<BundleEditPayload>({
    name: bundle.name,
    description: bundle.description,
    bundlePrice: bundle.bundlePrice,
    maxRedemptions: bundle.maxRedemptions,
    isActive: bundle.isActive,
    isFeatured: bundle.isFeatured,
    status: bundle.status,
    tags: bundle.tags || [],
    terms: bundle.terms,
    image: bundle.image,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-nilin-border/50 shadow-xl">
        <div className="p-6 border-b border-nilin-border/50 flex items-center justify-between">
          <h2 className="text-lg font-serif text-nilin-charcoal">Edit Bundle</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-nilin-blush/40 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-sans"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">Description</label>
            <textarea
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 resize-none font-sans"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">Bundle Price (AED)</label>
              <input
                type="number"
                min={0}
                value={formData.bundlePrice || 0}
                onChange={(e) => setFormData({ ...formData, bundlePrice: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">Max Redemptions</label>
              <input
                type="number"
                min={0}
                value={formData.maxRedemptions || ''}
                onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Unlimited"
                className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-sans"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">Image URL</label>
            <input
              type="url"
              value={formData.image || ''}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-sans"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-1">Terms</label>
            <textarea
              rows={2}
              value={formData.terms || ''}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-nilin-border/50 resize-none font-sans"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive || false}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFeatured || false}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Featured</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">Status</label>
              <select
                value={formData.status || 'pending'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BundleStatus })}
                className="w-full px-3 py-2 rounded-xl border border-nilin-border/50 font-sans text-sm"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-nilin-border/50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-nilin flex justify-center items-center gap-2">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const BundleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [pendingBundles, setPendingBundles] = useState<AdminBundle[]>([]);
  const [stats, setStats] = useState<BundleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<BundleStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);

  // Modals
  const [selectedBundle, setSelectedBundle] = useState<AdminBundle | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load data
  const loadBundles = useCallback(async () => {
    try {
      const params = {
        page: currentPage,
        limit: 20,
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
      };
      const result = await adminBundleApi.list(params);
      setBundles(result.bundles);
      setTotalPages(result.pagination.pages || 1);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to load bundles');
    }
  }, [currentPage, filterStatus, searchTerm]);

  const loadPendingBundles = useCallback(async () => {
    try {
      const result = await adminBundleApi.getPending({ limit: 100 });
      setPendingBundles(result.bundles);
      setPendingCount(result.count);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to load pending bundles');
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const result = await adminBundleApi.stats();
      setStats(result);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to load stats');
    }
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      await Promise.all([loadBundles(), loadPendingBundles(), loadStats()]);
      if (isRefresh) toast.success('Bundles refreshed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadBundles, loadPendingBundles, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Actions
  const handleApprove = async (bundle: AdminBundle) => {
    if (!confirm(`Approve "${bundle.name}"? It will become visible to customers.`)) return;
    setActionLoading(bundle._id);
    try {
      await adminBundleApi.approve(bundle._id);
      toast.success('Bundle approved');
      await loadAll();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to approve bundle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedBundle) return;
    setActionLoading(selectedBundle._id);
    try {
      await adminBundleApi.reject(selectedBundle._id, reason);
      toast.success('Bundle rejected');
      setShowRejectModal(false);
      setSelectedBundle(null);
      await loadAll();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to reject bundle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (bundle: AdminBundle) => {
    if (!confirm(`Delete "${bundle.name}"? This action cannot be undone.`)) return;
    setActionLoading(bundle._id);
    try {
      await adminBundleApi.delete(bundle._id);
      toast.success('Bundle deleted');
      await loadAll();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to delete bundle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFeatured = async (bundle: AdminBundle) => {
    setActionLoading(bundle._id);
    try {
      await adminBundleApi.toggleFeatured(bundle._id);
      toast.success(bundle.isFeatured ? 'Bundle unfeatured' : 'Bundle featured');
      await loadAll();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to toggle featured');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSave = async (updates: BundleEditPayload) => {
    if (!selectedBundle) return;
    try {
      await adminBundleApi.update(selectedBundle._id, updates);
      toast.success('Bundle updated');
      await loadAll();
    } catch (err) {
      toast.error(extractError(err) || 'Failed to update bundle');
      throw err;
    }
  };

  const openDetails = (bundle: AdminBundle) => {
    setSelectedBundle(bundle);
    setShowDetailsModal(true);
  };

  const openReject = (bundle: AdminBundle) => {
    setSelectedBundle(bundle);
    setShowRejectModal(true);
  };

  const openEdit = (bundle: AdminBundle) => {
    setSelectedBundle(bundle);
    setShowEditModal(true);
  };

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const tabs = [
    { id: 'pending' as Tab, label: 'Pending Review', count: pendingCount },
    { id: 'all' as Tab, label: 'All Bundles', count: stats?.counts.total },
    { id: 'analytics' as Tab, label: 'Analytics', count: undefined },
  ];

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Bundle Management"
        subtitle="Review and manage service bundles"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Bundles', current: true },
        ]}
        headerActions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        }
      >
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-nilin-border/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium font-sans border-b-2 -mb-px transition-colors flex items-center gap-2',
                activeTab === tab.id
                  ? 'border-nilin-coral text-nilin-coral'
                  : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  tab.id === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-nilin-blush/50 text-nilin-coral'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pending Review Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
              </div>
            ) : pendingBundles.length === 0 ? (
              <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-12 text-center">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                <p className="font-medium text-nilin-charcoal font-sans">All caught up!</p>
                <p className="text-sm text-nilin-warmGray mt-1">No bundles pending review</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBundles.map((bundle) => (
                  <div key={bundle._id} className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                    <div className="flex items-start gap-4">
                      {/* Image */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-nilin-blush/30 flex-shrink-0">
                        {bundle.image ? (
                          <img src={bundle.image} alt={bundle.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-nilin-coral/50" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-nilin-charcoal font-sans">{bundle.name}</h3>
                            <p className="text-sm text-nilin-warmGray mt-1">
                              {bundle.providerId?.businessName || `${bundle.providerId?.firstName} ${bundle.providerId?.lastName}`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-serif text-lg text-nilin-charcoal">
                              {formatPrice(bundle.bundlePrice, bundle.currency)}
                            </p>
                            <p className="text-xs text-emerald-600">
                              Save {bundle.savingsPercentage}%
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-nilin-warmGray">
                          <span className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {bundle.services?.length || 0} services
                          </span>
                          <span>Original: {formatPrice(bundle.originalPrice, bundle.currency)}</span>
                          <span>Created {formatDate(bundle.createdAt)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => openDetails(bundle)}
                            className="px-3 py-1.5 rounded-lg border border-nilin-border/50 text-sm hover:bg-nilin-blush/40 flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(bundle)}
                            className="px-3 py-1.5 rounded-lg border border-nilin-border/50 text-sm hover:bg-nilin-blush/40 flex items-center gap-1"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => openReject(bundle)}
                            className="px-4 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(bundle)}
                            disabled={actionLoading === bundle._id}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            {actionLoading === bundle._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Bundles Tab */}
        {activeTab === 'all' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                  <input
                    type="search"
                    placeholder="Search bundles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 font-sans text-sm focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as BundleStatus | 'all');
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 text-sm font-sans"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-12 text-center">
                <Package className="w-14 h-14 text-nilin-warmGray mx-auto mb-4 opacity-50" />
                <p className="font-medium text-nilin-charcoal font-sans">No bundles found</p>
              </div>
            ) : (
              <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm font-sans">
                    <thead>
                      <tr className="border-b border-nilin-border/50 bg-nilin-blush/20">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">Bundle</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-nilin-warmGray">Provider</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-nilin-warmGray">Price</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-nilin-warmGray">Savings</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-nilin-warmGray">Status</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-nilin-warmGray">Featured</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-nilin-warmGray">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nilin-border/40">
                      {bundles.map((bundle) => (
                        <tr key={bundle._id} className="hover:bg-nilin-blush/10 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-nilin-blush/30 flex-shrink-0">
                                {bundle.image ? (
                                  <img src={bundle.image} alt={bundle.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-6 h-6 text-nilin-coral/50" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-nilin-charcoal truncate max-w-[200px]">{bundle.name}</p>
                                <p className="text-xs text-nilin-warmGray">{bundle.services?.length || 0} services</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-nilin-charcoal">
                              {bundle.providerId?.businessName || `${bundle.providerId?.firstName} ${bundle.providerId?.lastName}`}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <p className="font-medium text-nilin-charcoal">{formatPrice(bundle.bundlePrice, bundle.currency)}</p>
                            <p className="text-xs text-nilin-warmGray line-through">{formatPrice(bundle.originalPrice, bundle.currency)}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              {bundle.savingsPercentage}%
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', statusBadgeClass(bundle.status))}>
                              {statusIcon(bundle.status)}
                              {bundle.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleFeatured(bundle)}
                              disabled={actionLoading === bundle._id || bundle.status !== 'approved'}
                              className="p-2 rounded-full hover:bg-nilin-blush/40 disabled:opacity-50"
                              title={bundle.isFeatured ? 'Unfeature' : 'Feature'}
                            >
                              <Star
                                className={cn('w-5 h-5', bundle.isFeatured ? 'text-amber-500 fill-amber-500' : 'text-nilin-warmGray')}
                              />
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openDetails(bundle)}
                                className="p-2 rounded-lg hover:bg-nilin-blush/50"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4 text-nilin-charcoal" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(bundle)}
                                className="p-2 rounded-lg hover:bg-nilin-blush/50"
                                title="Edit"
                              >
                                <Edit3 className="w-4 h-4 text-nilin-coral" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(bundle)}
                                disabled={actionLoading === bundle._id}
                                className="p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                                title="Delete"
                              >
                                {actionLoading === bundle._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
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
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                        <Package className="w-5 h-5 text-sky-600" />
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray">Total Bundles</p>
                    </div>
                    <p className="text-3xl font-serif text-nilin-charcoal">{stats.counts.total}</p>
                  </div>

                  <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray">Active</p>
                    </div>
                    <p className="text-3xl font-serif text-emerald-700">{stats.counts.approved}</p>
                  </div>

                  <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray">Pending</p>
                    </div>
                    <p className="text-3xl font-serif text-amber-700">{stats.counts.pending}</p>
                  </div>

                  <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-violet-600" />
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray">Total Revenue</p>
                    </div>
                    <p className="text-3xl font-serif text-violet-700">{formatPrice(stats.revenue.totalRevenue, 'AED')}</p>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-nilin-border/40 p-4 text-center">
                    <p className="text-xs text-nilin-warmGray uppercase tracking-wide mb-1">Rejected</p>
                    <p className="text-2xl font-serif text-red-600">{stats.counts.rejected}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-nilin-border/40 p-4 text-center">
                    <p className="text-xs text-nilin-warmGray uppercase tracking-wide mb-1">Featured</p>
                    <p className="text-2xl font-serif text-amber-600">{stats.counts.featured}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-nilin-border/40 p-4 text-center">
                    <p className="text-xs text-nilin-warmGray uppercase tracking-wide mb-1">Total Bookings</p>
                    <p className="text-2xl font-serif text-nilin-charcoal">{stats.revenue.totalBookings}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-nilin-border/40 p-4 text-center">
                    <p className="text-xs text-nilin-warmGray uppercase tracking-wide mb-1">Redemptions</p>
                    <p className="text-2xl font-serif text-nilin-charcoal">{stats.revenue.totalRedemptions}</p>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6">
                  <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Revenue Overview
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-nilin-warmGray">Original Value Given</p>
                      <p className="text-xl font-serif text-nilin-charcoal mt-1">
                        {formatPrice(stats.revenue.totalOriginalValue, 'AED')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-nilin-warmGray">Actual Revenue</p>
                      <p className="text-xl font-serif text-emerald-700 mt-1">
                        {formatPrice(stats.revenue.totalRevenue, 'AED')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-nilin-warmGray">Total Savings Given</p>
                      <p className="text-xl font-serif text-amber-700 mt-1">
                        {formatPrice(stats.revenue.totalSavings, 'AED')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-nilin-warmGray">Avg Savings %</p>
                      <p className="text-xl font-serif text-nilin-charcoal mt-1">
                        {stats.revenue.avgSavingsPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Performing */}
                <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6">
                  <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-violet-600" />
                    Top Performing Bundles
                  </h3>
                  <div className="space-y-3">
                    {bundles
                      .filter((b) => b.status === 'approved')
                      .sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0))
                      .slice(0, 5)
                      .map((bundle, idx) => (
                        <div key={bundle._id} className="flex items-center gap-4 p-3 bg-white/60 rounded-xl">
                          <span className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm font-medium text-violet-700">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-nilin-charcoal truncate">{bundle.name}</p>
                            <p className="text-sm text-nilin-warmGray">
                              {bundle.providerId?.businessName || `${bundle.providerId?.firstName} ${bundle.providerId?.lastName}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-nilin-charcoal">{bundle.bookingCount} bookings</p>
                            <p className="text-sm text-emerald-600">
                              {formatPrice((bundle.bundlePrice || 0) * (bundle.bookingCount || 0), 'AED')} revenue
                            </p>
                          </div>
                        </div>
                      ))}
                    {bundles.filter((b) => b.status === 'approved').length === 0 && (
                      <p className="text-center text-nilin-warmGray py-8">No approved bundles yet</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modals */}
        {showDetailsModal && selectedBundle && (
          <BundleDetailsModal bundle={selectedBundle} onClose={() => { setShowDetailsModal(false); setSelectedBundle(null); }} />
        )}

        {showRejectModal && selectedBundle && (
          <RejectModal
            bundle={selectedBundle}
            onClose={() => { setShowRejectModal(false); setSelectedBundle(null); }}
            onReject={handleReject}
          />
        )}

        {showEditModal && selectedBundle && (
          <EditBundleModal
            bundle={selectedBundle}
            onClose={() => { setShowEditModal(false); setSelectedBundle(null); }}
            onSave={handleEditSave}
          />
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default BundleManagement;
