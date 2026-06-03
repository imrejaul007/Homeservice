import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Play,
  Pause,
  Trash2,
  Eye,
  MousePointer,
  TrendingUp,
  Target,
  DollarSign,
  BarChart3,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Calendar,
  Edit2,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import {
  providerAdApi,
  ProviderAd,
  AdStats,
  AdAnalytics,
  CreateAdInput,
  UpdateAdInput,
} from '../../services/providerAdApi';
import { useToastActions } from '../../components/common/Toast';
import { socketService } from '../../services/socket';

interface AdFormData {
  name: string;
  description: string;
  budgetTotal: string;
  budgetDaily: string;
  contentTitle: string;
  contentDescription: string;
  contentImageUrl: string;
  contentCtaText: string;
}

interface AdFormError {
  name?: string;
  budgetTotal?: string;
  contentTitle?: string;
  contentDescription?: string;
  general?: string;
}

const AdsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToastActions();

  // Data state
  const [ads, setAds] = useState<ProviderAd[]>([]);
  const [stats, setStats] = useState<AdStats | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAds, setTotalAds] = useState(0);
  const limit = 10;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<ProviderAd | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<AdFormError | null>(null);

  // Form state
  const [formData, setFormData] = useState<AdFormData>({
    name: '',
    description: '',
    budgetTotal: '',
    budgetDaily: '',
    contentTitle: '',
    contentDescription: '',
    contentImageUrl: '',
    contentCtaText: 'Book Now',
  });

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard'); // FIX: Was '/dashboard'
    }
  }, [user, navigate]);

  // Fetch ads
  const fetchAds = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const options: {
        page: number;
        limit: number;
        status?: string;
        search?: string;
      } = {
        page: currentPage,
        limit,
      };

      if (statusFilter !== 'all') {
        options.status = statusFilter;
      }

      if (debouncedSearch) {
        options.search = debouncedSearch;
      }

      const result = await providerAdApi.getMyAds(options);
      setAds(result.ads);
      setTotalPages(result.pagination.pages);
      setTotalAds(result.pagination.total);
    } catch (err: any) {
      console.error('Failed to fetch ads:', err);
      // Handle network errors vs API errors
      if (!err.response) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load ads');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const result = await providerAdApi.getAdStats();
      setStats(result);
    } catch (err: any) {
      console.error('Failed to fetch ad stats:', err);
      // Stats are non-critical - don't show error, just log
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'provider') {
      void fetchAds();
      void fetchStats();
    }
  }, [fetchAds, fetchStats, user?.role]);

  // FIX: Socket event listeners for real-time ad updates
  useEffect(() => {
    if (user?.role !== 'provider') return;

    // Listen for ad status changes
    const unsubAdStatusChanged = socketService.onAdStatusChanged((data) => {
      if (data.providerId === user._id.toString()) {
        toast.info(`Ad "${data.adName}" status changed to ${data.newStatus}`);
        void fetchAds(true);
        void fetchStats();
      }
    });

    // Listen for budget exhaustion
    const unsubBudgetExhausted = socketService.onAdBudgetExhausted((data) => {
      if (data.providerId === user._id.toString()) {
        const reasonText = data.reason === 'daily' ? 'Daily budget' : data.reason === 'monthly' ? 'Monthly budget' : 'Total budget';
        toast.warning(`Ad "${data.adName}" - ${reasonText} exhausted`);
        void fetchAds(true);
        void fetchStats();
      }
    });

    // Listen for approval status changes
    const unsubApprovalStatusChanged = socketService.onAdApprovalStatusChanged((data) => {
      if (data.providerId === user._id.toString()) {
        if (data.newStatus === 'approved') {
          toast.success(`Ad "${data.adName}" has been approved and is now live`);
        } else if (data.newStatus === 'rejected') {
          toast.error(`Ad "${data.adName}" was rejected: ${data.notes || 'No reason provided'}`);
        } else {
          toast.info(`Ad "${data.adName}" status: ${data.newStatus}`);
        }
        void fetchAds(true);
        void fetchStats();
      }
    });

    return () => {
      unsubAdStatusChanged();
      unsubBudgetExhausted();
      unsubApprovalStatusChanged();
    };
  }, [user?._id, fetchAds, fetchStats]);

  // Handle pause ad
  const handlePauseAd = async (adId: string) => {
    try {
      await providerAdApi.pauseAd(adId);
      toast.success('Ad paused');
      await fetchAds(true);
      await fetchStats();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to pause ad';
      setError(msg);
      toast.error(msg);
    }
  };

  // Handle resume ad
  const handleResumeAd = async (adId: string) => {
    try {
      await providerAdApi.resumeAd(adId);
      toast.success('Ad resumed');
      await fetchAds(true);
      await fetchStats();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resume ad';
      setError(msg);
      toast.error(msg);
    }
  };

  // Handle launch ad
  const handleLaunchAd = async (adId: string) => {
    try {
      await providerAdApi.launchAd(adId);
      toast.success('Ad submitted for review — you will be notified when approved');
      await fetchAds(true);
      await fetchStats();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to launch ad';
      setError(msg);
      toast.error(msg);
    }
  };

  // Handle delete ad
  const handleDeleteAd = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad? This action cannot be undone.')) {
      return;
    }

    try {
      await providerAdApi.deleteAd(adId);
      toast.success('Ad deleted');
      await fetchAds(true);
      await fetchStats();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete ad';
      setError(msg);
      toast.error(msg);
    }
  };

  // Open edit modal
  const openEditModal = (ad: ProviderAd) => {
    if (['active', 'completed', 'cancelled'].includes(ad.status)) {
      toast.error('Pause the ad before editing, or create a new campaign');
      return;
    }
    setSelectedAd(ad);
    setFormData({
      name: ad.name,
      description: ad.description || '',
      budgetTotal: ad.budget.total.toString(),
      budgetDaily: ad.budget.daily?.toString() || '',
      contentTitle: ad.content.title,
      contentDescription: ad.content.description,
      contentImageUrl: ad.content.imageUrl || '',
      contentCtaText: ad.content.ctaText || 'Book Now',
    });
    setFormError(null);
    setShowEditModal(true);
  };

  // Open analytics modal
  const openAnalyticsModal = async (ad: ProviderAd) => {
    setSelectedAd(ad);
    setShowAnalyticsModal(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newError: AdFormError = {};

    if (!formData.name.trim()) {
      newError.name = 'Ad name is required';
    } else if (formData.name.length > 100) {
      newError.name = 'Ad name cannot exceed 100 characters';
    }

    const budgetTotal = parseFloat(formData.budgetTotal);
    if (isNaN(budgetTotal) || budgetTotal < 1) {
      newError.budgetTotal = 'Budget must be at least 1';
    }

    if (!formData.contentTitle.trim()) {
      newError.contentTitle = 'Ad title is required';
    } else if (formData.contentTitle.length > 60) {
      newError.contentTitle = 'Title cannot exceed 60 characters';
    }

    if (!formData.contentDescription.trim()) {
      newError.contentDescription = 'Ad description is required';
    } else if (formData.contentDescription.length > 200) {
      newError.contentDescription = 'Description cannot exceed 200 characters';
    }

    setFormError(newError);
    return Object.keys(newError).length === 0;
  };

  // Handle create ad
  const handleCreateAd = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const adInput: CreateAdInput = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        budget: {
          total: parseFloat(formData.budgetTotal),
          daily: formData.budgetDaily ? parseFloat(formData.budgetDaily) : undefined,
        },
        content: {
          title: formData.contentTitle.trim(),
          description: formData.contentDescription.trim(),
          imageUrl: formData.contentImageUrl.trim() || undefined,
          ctaText: formData.contentCtaText.trim() || 'Book Now',
        },
      };

      await providerAdApi.createAd(adInput);
      toast.success('Ad created as draft — deploy when ready');
      setShowCreateModal(false);
      resetForm();
      await fetchAds(true);
      await fetchStats();
    } catch (err: any) {
      setFormError({
        general: err.response?.data?.message || err.message || 'Failed to create ad',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle update ad
  const handleUpdateAd = async () => {
    if (!validateForm() || !selectedAd) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const adInput: UpdateAdInput = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        budget: {
          total: parseFloat(formData.budgetTotal),
          daily: formData.budgetDaily ? parseFloat(formData.budgetDaily) : undefined,
        },
        content: {
          title: formData.contentTitle.trim(),
          description: formData.contentDescription.trim(),
          imageUrl: formData.contentImageUrl.trim() || undefined,
          ctaText: formData.contentCtaText.trim() || 'Book Now',
        },
      };

      await providerAdApi.updateAd(selectedAd._id, adInput);
      toast.success('Ad updated');
      setShowEditModal(false);
      setSelectedAd(null);
      resetForm();
      await fetchAds(true);
      await fetchStats();
    } catch (err: any) {
      setFormError({
        general: err.response?.data?.message || err.message || 'Failed to update ad',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      budgetTotal: '',
      budgetDaily: '',
      contentTitle: '',
      contentDescription: '',
      contentImageUrl: '',
      contentCtaText: 'Book Now',
    });
    setFormError(null);
  };

  // Get status badge
  const getStatusBadge = (status: ProviderAd['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Pause className="h-3 w-3" />
            Paused
          </span>
        );
      case 'draft':
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Draft
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </span>
        );
    }
  };

  const getApprovalBadge = (ad: ProviderAd) => {
    if (ad.approvalStatus === 'rejected') {
      return (
        <span className="text-xs text-red-600">Rejected</span>
      );
    }
    if (ad.status === 'draft') {
      return (
        <span className="text-xs text-amber-600">Draft — deploy to go live</span>
      );
    }
    if (ad.approvalStatus === 'pending') {
      return (
        <span className="text-xs text-amber-600">Pending review</span>
      );
    }
    return null;
  };

  const displayCtr = (ad: ProviderAd): string => {
    if (ad.statistics.views <= 0) return '0.0';
    return ad.statistics.ctr.toFixed(1);
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `AED ${amount.toLocaleString()}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-nilin-warmGray">Loading ads...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
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
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Provider Ads</h1>
                <p className="text-nilin-warmGray">Create and manage your advertising campaigns</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchAds(true)}
                  disabled={isRefreshing}
                  className="px-4 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="btn-nilin flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Ad
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-nilin flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 rounded-nilin">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal">{stats.totalAds}</p>
                <p className="text-xs text-nilin-warmGray">Total Ads</p>
              </div>

              <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-100 rounded-nilin">
                    <Play className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal">{stats.activeAds}</p>
                <p className="text-xs text-nilin-warmGray">Active</p>
              </div>

              <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-yellow-100 rounded-nilin">
                    <Pause className="h-4 w-4 text-yellow-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal">{stats.pausedAds}</p>
                <p className="text-xs text-nilin-warmGray">Paused</p>
              </div>

              <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-purple-100 rounded-nilin">
                    <Eye className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal">{stats.totalViews.toLocaleString()}</p>
                <p className="text-xs text-nilin-warmGray">Views</p>
              </div>

              <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-nilin-coral/10 rounded-nilin">
                    <MousePointer className="h-4 w-4 text-nilin-coral" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal">{stats.totalClicks.toLocaleString()}</p>
                <p className="text-xs text-nilin-warmGray">Clicks</p>
              </div>

              <div className="glass-nilin rounded-nilin-lg p-4 hover-lift">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-100 rounded-nilin">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal">{formatCurrency(stats.totalSpent)}</p>
                <p className="text-xs text-nilin-warmGray">Spent</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="glass-nilin rounded-nilin-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                  <input
                    type="text"
                    placeholder="Search ads..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-nilin-warmGray" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ads List */}
          <div className="glass-nilin rounded-nilin-lg overflow-hidden">
            {ads.length === 0 ? (
              <div className="text-center py-16">
                <Target className="h-12 w-12 text-nilin-warmGray mx-auto mb-4" />
                <h3 className="text-lg font-medium text-nilin-charcoal mb-2">No ads found</h3>
                <p className="text-nilin-warmGray mb-6">
                  {statusFilter !== 'all' || debouncedSearch
                    ? 'Try adjusting your filters'
                    : 'Create your first advertising campaign'}
                </p>
                {statusFilter === 'all' && !debouncedSearch && (
                  <button
                    onClick={() => {
                      resetForm();
                      setShowCreateModal(true);
                    }}
                    className="btn-nilin inline-flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Ad
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-nilin-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                          Ad Campaign
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                          Budget
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                          Performance
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nilin-border">
                      {ads.map((ad) => (
                        <tr key={ad._id} className="hover:bg-nilin-muted/30 transition-colors">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-nilin-charcoal">{ad.name}</p>
                              <p className="text-sm text-nilin-warmGray truncate max-w-xs">
                                {ad.description || ad.content.description || ad.content.title}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col items-start gap-1">
                              {getStatusBadge(ad.status)}
                              {getApprovalBadge(ad)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm font-medium text-nilin-charcoal">
                                {formatCurrency(ad.budget.total)}
                              </p>
                              <p className="text-xs text-nilin-warmGray">
                                Spent: {formatCurrency(ad.budget.spent)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Eye className="h-4 w-4 text-nilin-warmGray" />
                                <span className="text-nilin-charcoal">{ad.statistics.views.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MousePointer className="h-4 w-4 text-nilin-warmGray" />
                                <span className="text-nilin-charcoal">{ad.statistics.clicks.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-4 w-4 text-nilin-warmGray" />
                                <span className="text-nilin-charcoal">{displayCtr(ad)}%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-nilin-warmGray">
                            {formatDate(ad.createdAt)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openAnalyticsModal(ad)}
                                className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
                                title="View Analytics"
                              >
                                <BarChart3 className="h-4 w-4 text-nilin-warmGray" />
                              </button>

                              {ad.status === 'draft' && (
                                <button
                                  onClick={() => handleLaunchAd(ad._id)}
                                  className="p-2 hover:bg-green-50 rounded-nilin transition-colors"
                                  title="Deploy ad"
                                >
                                  <Play className="h-4 w-4 text-green-600" />
                                </button>
                              )}

                              {ad.status === 'active' && (
                                <button
                                  onClick={() => handlePauseAd(ad._id)}
                                  className="p-2 hover:bg-yellow-50 rounded-nilin transition-colors"
                                  title="Pause Ad"
                                >
                                  <Pause className="h-4 w-4 text-yellow-600" />
                                </button>
                              )}

                              {ad.status === 'paused' && (
                                <button
                                  onClick={() => handleResumeAd(ad._id)}
                                  className="p-2 hover:bg-green-50 rounded-nilin transition-colors"
                                  title="Resume Ad"
                                >
                                  <Play className="h-4 w-4 text-green-600" />
                                </button>
                              )}

                              <button
                                onClick={() => openEditModal(ad)}
                                className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
                                title="Edit Ad"
                              >
                                <Edit2 className="h-4 w-4 text-nilin-warmGray" />
                              </button>

                              <button
                                onClick={() => handleDeleteAd(ad._id)}
                                className="p-2 hover:bg-red-50 rounded-nilin transition-colors"
                                title="Delete Ad"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-nilin-border">
                    <p className="text-sm text-nilin-warmGray">
                      Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalAds)} of {totalAds} ads
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-nilin border border-nilin-border hover:bg-nilin-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4 text-nilin-charcoal" />
                      </button>
                      <span className="px-3 py-1 text-sm text-nilin-charcoal">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-nilin border border-nilin-border hover:bg-nilin-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-4 w-4 text-nilin-charcoal" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Ad Modal */}
      {showCreateModal && (
        <AdFormModal
          title="Create New Ad"
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          isSubmitting={isSubmitting}
          onSubmit={handleCreateAd}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          submitLabel="Create Ad"
        />
      )}

      {/* Edit Ad Modal */}
      {showEditModal && (
        <AdFormModal
          title="Edit Ad"
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          isSubmitting={isSubmitting}
          onSubmit={handleUpdateAd}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAd(null);
            resetForm();
          }}
          submitLabel="Save Changes"
        />
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && selectedAd && (
        <AdAnalyticsModal
          ad={selectedAd}
          onClose={() => {
            setShowAnalyticsModal(false);
            setSelectedAd(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
};

// Ad Form Modal Component
interface AdFormModalProps {
  title: string;
  formData: AdFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdFormData>>;
  formError: AdFormError | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  submitLabel: string;
}

const AdFormModal: React.FC<AdFormModalProps> = ({
  title,
  formData,
  setFormData,
  formError,
  isSubmitting,
  onSubmit,
  onClose,
  submitLabel,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-nilin-lg max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif text-nilin-charcoal">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
          >
            <X className="h-5 w-5 text-nilin-warmGray" />
          </button>
        </div>

        <div className="space-y-4">
          {/* General Error */}
          {formError?.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-nilin flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{formError.general}</p>
            </div>
          )}

          {/* Ad Name */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Ad Campaign Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Summer Cleaning Special"
              maxLength={100}
              className={`w-full px-4 py-2.5 rounded-nilin border text-sm text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/20 ${
                formError?.name ? 'border-red-500 focus:border-red-500' : 'border-nilin-border focus:border-nilin-coral'
              }`}
            />
            {formError?.name && (
              <p className="text-xs text-red-500 mt-1">{formError.name}</p>
            )}
            <p className="text-xs text-nilin-warmGray mt-1">{formData.name.length}/100 characters</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of your ad campaign..."
              rows={2}
              maxLength={500}
              className="w-full px-4 py-2.5 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 resize-none"
            />
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Total Budget (AED) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray text-sm">AED</span>
                <input
                  type="number"
                  value={formData.budgetTotal}
                  onChange={(e) => setFormData({ ...formData, budgetTotal: e.target.value })}
                  placeholder="100"
                  min="1"
                  className={`w-full pl-12 pr-4 py-2.5 rounded-nilin border text-sm text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/20 ${
                    formError?.budgetTotal ? 'border-red-500 focus:border-red-500' : 'border-nilin-border focus:border-nilin-coral'
                  }`}
                />
              </div>
              {formError?.budgetTotal && (
                <p className="text-xs text-red-500 mt-1">{formError.budgetTotal}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Daily Budget (AED)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray text-sm">AED</span>
                <input
                  type="number"
                  value={formData.budgetDaily}
                  onChange={(e) => setFormData({ ...formData, budgetDaily: e.target.value })}
                  placeholder="Optional"
                  min="1"
                  className="w-full pl-12 pr-4 py-2.5 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20"
                />
              </div>
            </div>
          </div>

          {/* Ad Content Section */}
          <div className="pt-4 border-t border-nilin-border">
            <h3 className="text-sm font-medium text-nilin-charcoal mb-4">Ad Content</h3>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Ad Title *
              </label>
              <input
                type="text"
                value={formData.contentTitle}
                onChange={(e) => setFormData({ ...formData, contentTitle: e.target.value })}
                placeholder="e.g., Professional Cleaning Services"
                maxLength={60}
                className={`w-full px-4 py-2.5 rounded-nilin border text-sm text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/20 ${
                  formError?.contentTitle ? 'border-red-500 focus:border-red-500' : 'border-nilin-border focus:border-nilin-coral'
                }`}
              />
              {formError?.contentTitle && (
                <p className="text-xs text-red-500 mt-1">{formError.contentTitle}</p>
              )}
              <p className="text-xs text-nilin-warmGray mt-1">{formData.contentTitle.length}/60 characters</p>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Ad Description *
              </label>
              <textarea
                value={formData.contentDescription}
                onChange={(e) => setFormData({ ...formData, contentDescription: e.target.value })}
                placeholder="Describe what makes your service special..."
                rows={3}
                maxLength={200}
                className={`w-full px-4 py-2.5 rounded-nilin border text-sm text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/20 resize-none ${
                  formError?.contentDescription ? 'border-red-500 focus:border-red-500' : 'border-nilin-border focus:border-nilin-coral'
                }`}
              />
              {formError?.contentDescription && (
                <p className="text-xs text-red-500 mt-1">{formError.contentDescription}</p>
              )}
              <p className="text-xs text-nilin-warmGray mt-1">{formData.contentDescription.length}/200 characters</p>
            </div>

            {/* Image URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Image URL (Optional)
              </label>
              <input
                type="url"
                value={formData.contentImageUrl}
                onChange={(e) => setFormData({ ...formData, contentImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-2.5 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20"
              />
            </div>

            {/* CTA Text */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Call to Action
              </label>
              <input
                type="text"
                value={formData.contentCtaText}
                onChange={(e) => setFormData({ ...formData, contentCtaText: e.target.value })}
                placeholder="Book Now"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20"
              />
              <p className="text-xs text-nilin-warmGray mt-1">{formData.contentCtaText.length}/20 characters</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 rounded-nilin">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Deploy when ready</p>
                <p className="text-xs text-blue-700 mt-1">
                  New campaigns are saved as drafts. Use the play button to deploy and start tracking views and clicks.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 btn-nilin flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                submitLabel
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Analytics Modal Component
interface AdAnalyticsModalProps {
  ad: ProviderAd;
  onClose: () => void;
}

const AdAnalyticsModal: React.FC<AdAnalyticsModalProps> = ({ ad, onClose }) => {
  const [analytics, setAnalytics] = useState<AdAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setError(null);
        const result = await providerAdApi.getAdAnalytics(ad._id);
        setAnalytics(result);
      } catch (err: any) {
        console.error('Failed to fetch analytics:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [ad._id]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-nilin-lg max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif text-nilin-charcoal">Ad Analytics</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
          >
            <X className="h-5 w-5 text-nilin-warmGray" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-nilin-warmGray">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {(() => {
              const stats = analytics?.statistics ?? ad.statistics;
              const budget = analytics?.budget ?? ad.budget;
              return (
                <>
            {/* Ad Info */}
            <div className="mb-6 p-4 bg-nilin-muted/30 rounded-nilin">
              <h3 className="font-medium text-nilin-charcoal mb-1">{ad.name}</h3>
              <p className="text-sm text-nilin-warmGray">{ad.content.title}</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-nilin text-center">
                <Eye className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-nilin-charcoal">
                  {stats.views.toLocaleString()}
                </p>
                <p className="text-xs text-nilin-warmGray">Views</p>
              </div>

              <div className="p-4 bg-green-50 rounded-nilin text-center">
                <MousePointer className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-nilin-charcoal">
                  {stats.clicks.toLocaleString()}
                </p>
                <p className="text-xs text-nilin-warmGray">Clicks</p>
              </div>

              <div className="p-4 bg-purple-50 rounded-nilin text-center">
                <TrendingUp className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-nilin-charcoal">
                  {(stats.views > 0 ? stats.ctr : 0).toFixed(2)}%
                </p>
                <p className="text-xs text-nilin-warmGray">CTR</p>
              </div>

              <div className="p-4 bg-nilin-coral/10 rounded-nilin text-center">
                <DollarSign className="h-6 w-6 text-nilin-coral mx-auto mb-2" />
                <p className="text-2xl font-bold text-nilin-charcoal">
                  AED {(stats.totalSpent ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-nilin-warmGray">Spent</p>
              </div>
            </div>

            {/* Performance Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-nilin-charcoal flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance Details
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-nilin-muted/30 rounded-nilin">
                  <p className="text-xs text-nilin-warmGray mb-1">Conversions</p>
                  <p className="text-lg font-semibold text-nilin-charcoal">
                    {stats.conversions.toLocaleString()}
                  </p>
                </div>

                <div className="p-3 bg-nilin-muted/30 rounded-nilin">
                  <p className="text-xs text-nilin-warmGray mb-1">Conversion Rate</p>
                  <p className="text-lg font-semibold text-nilin-charcoal">
                    {(stats.conversionRate ?? 0).toFixed(2)}%
                  </p>
                </div>

                <div className="p-3 bg-nilin-muted/30 rounded-nilin">
                  <p className="text-xs text-nilin-warmGray mb-1">Cost per Click</p>
                  <p className="text-lg font-semibold text-nilin-charcoal">
                    AED {(stats.costPerClick ?? 0).toFixed(2)}
                  </p>
                </div>

                <div className="p-3 bg-nilin-muted/30 rounded-nilin">
                  <p className="text-xs text-nilin-warmGray mb-1">Cost per Conversion</p>
                  <p className="text-lg font-semibold text-nilin-charcoal">
                    AED {(stats.costPerConversion ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Advanced Performance Metrics */}
            {analytics?.performance && (
              <div className="space-y-4 pt-4 border-t border-nilin-border">
                <h4 className="text-sm font-medium text-nilin-charcoal flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Advanced Metrics
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {analytics.performance.calculatedRoas !== undefined && analytics.performance.calculatedRoas > 0 && (
                    <div className="p-3 bg-green-50 rounded-nilin text-center">
                      <p className="text-xs text-nilin-warmGray mb-1">ROAS</p>
                      <p className="text-lg font-bold text-green-600">
                        {analytics.performance.calculatedRoas.toFixed(2)}x
                      </p>
                    </div>
                  )}

                  {analytics.performance.effectiveCpm !== undefined && analytics.performance.effectiveCpm > 0 && (
                    <div className="p-3 bg-blue-50 rounded-nilin text-center">
                      <p className="text-xs text-nilin-warmGray mb-1">Effective CPM</p>
                      <p className="text-lg font-bold text-blue-600">
                        AED {analytics.performance.effectiveCpm.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {analytics.performance.effectiveCpc !== undefined && analytics.performance.effectiveCpc > 0 && (
                    <div className="p-3 bg-purple-50 rounded-nilin text-center">
                      <p className="text-xs text-nilin-warmGray mb-1">Effective CPC</p>
                      <p className="text-lg font-bold text-purple-600">
                        AED {analytics.performance.effectiveCpc.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {analytics.performance.impressionShare !== undefined && analytics.performance.impressionShare > 0 && (
                    <div className="p-3 bg-nilin-muted/30 rounded-nilin text-center">
                      <p className="text-xs text-nilin-warmGray mb-1">Impression Share</p>
                      <p className="text-lg font-bold text-nilin-charcoal">
                        {(analytics.performance.impressionShare * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Budget Status */}
            <div className="mt-6 pt-6 border-t border-nilin-border">
              <h4 className="text-sm font-medium text-nilin-charcoal mb-4">Budget Status</h4>

              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-nilin-charcoal">Budget Used</span>
                  <span className="text-nilin-warmGray">
                    AED {budget.spent.toLocaleString()} / AED {budget.total.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-nilin-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-nilin-coral rounded-full transition-all"
                    style={{
                      width: `${Math.min((budget.spent / budget.total) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <p className="text-sm text-nilin-warmGray">
                Remaining: AED {budget.remaining.toLocaleString()}
              </p>
            </div>

            {/* Close Button */}
            <div className="mt-6 pt-4">
              <button
                onClick={onClose}
                className="w-full px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
              >
                Close
              </button>
            </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default AdsPage;
