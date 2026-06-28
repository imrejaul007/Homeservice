
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ExportDropdown } from '../../components/admin/ExportDropdown';
import { BulkActionToolbar, type BulkAction } from '../../components/admin/BulkActionToolbar';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import {
  Search,
  Filter,
  Eye,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Plus,
  FileText,
  Image,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  DollarSign,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
  Shield,
  Download,
  UserPlus,
  TrendingUp,
  CheckSquare,
  Square,
  Gavel,
  AlertOctagon,
} from 'lucide-react';
import { disputeApi } from '../../services/disputeApi';
import type {
  Dispute,
  DisputeStatus,
  ResolutionType,
  DisputeFilters,
  DisputeStats,
  AppealStatus,
} from '../../services/disputeApi';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAuthStore } from '../../stores/authStore';
import { AdminPagination } from '../../components/admin/AdminPagination';

interface DisputeCenterProps {}

const DisputeCenter: React.FC<DisputeCenterProps> = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });

  // Filters
  const [filters, setFilters] = useState<DisputeFilters>({
    status: (searchParams.get('status') as DisputeStatus) || undefined,
    category: searchParams.get('category') || undefined,
    priority: searchParams.get('priority') || undefined,
    search: searchParams.get('search') || '',
    page: parseInt(searchParams.get('page') || '1'),
    limit: 20,
  });

  // Appeal state
  const [showAppealReviewModal, setShowAppealReviewModal] = useState(false);
  const [appealReviewData, setAppealReviewData] = useState<{
    action: 'approve' | 'reject';
    reviewNotes: string;
  }>({ action: 'approve', reviewNotes: '' });
  const [isReviewingAppeal, setIsReviewingAppeal] = useState(false);
  const [pendingAppealsCount, setPendingAppealsCount] = useState(0);

  // Actions
  const [messageInput, setMessageInput] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [resolveData, setResolveData] = useState<{
    resolutionType: ResolutionType;
    amount?: number;
    reason: string;
    notes?: string;
  }>({
    resolutionType: 'no_action',
    reason: '',
  });

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Bulk selection state
  const [selectedDisputes, setSelectedDisputes] = useState<Set<string>>(new Set());

  // Bulk action progress state
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 });

  // Bulk action handlers
  const handleBulkAssign = useCallback(async () => {
    const ids = Array.from(selectedDisputes);
    if (ids.length === 0) return;

    setBulkActionInProgress(true);
    setBulkProgress({ completed: 0, total: ids.length });

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const result = await disputeApi.assignDispute(id);
        setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
        return result;
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results
      .map((r, idx) => ({ result: r, id: ids[idx] }))
      .filter(({ result }) => result.status === 'rejected');

    // Track which IDs failed so user can retry just those
    const failedIds = new Set(failed.map((f) => f.id));
    const successCount = successful.length;
    const failedCount = failed.length;

    if (failedCount > 0 && successCount > 0) {
      // Partial failure: keep selection on failed IDs so user can retry
      toast.error(
        `Partial success: ${successCount} of ${ids.length} assigned`,
        `${failedCount} dispute(s) failed to assign. ${failedCount} remain selected for retry.`
      );
      setSelectedDisputes(failedIds);
    } else if (successCount === ids.length) {
      // All succeeded
      toast.success(`Successfully assigned ${successCount} dispute(s) to you`);
      setSelectedDisputes(new Set());
    } else {
      // All failed
      const errorMessage =
        (failed[0]?.result as PromiseRejectedResult)?.reason?.message ||
        'Failed to assign disputes';
      toast.error(
        `Failed to assign ${failedCount} dispute(s)`,
        errorMessage
      );
      // Keep selection so user can retry
    }

    setBulkActionInProgress(false);
    setBulkProgress({ completed: 0, total: 0 });
    await fetchDisputes();
  }, [selectedDisputes, fetchDisputes]);

  const handleBulkEscalate = useCallback(async () => {
    const ids = Array.from(selectedDisputes);
    if (ids.length === 0) return;

    setBulkActionInProgress(true);
    setBulkProgress({ completed: 0, total: ids.length });

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const result = await disputeApi.updateDisputeStatus(id, 'escalated');
        setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
        return result;
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results
      .map((r, idx) => ({ result: r, id: ids[idx] }))
      .filter(({ result }) => result.status === 'rejected');

    const failedIds = new Set(failed.map((f) => f.id));
    const successCount = successful.length;
    const failedCount = failed.length;

    if (failedCount > 0 && successCount > 0) {
      // Partial failure: keep selection on failed IDs so user can retry
      toast.error(
        `Partial success: ${successCount} of ${ids.length} escalated`,
        `${failedCount} dispute(s) failed to escalate. ${failedCount} remain selected for retry.`
      );
      setSelectedDisputes(failedIds);
    } else if (successCount === ids.length) {
      // All succeeded
      toast.success(`Successfully escalated ${successCount} dispute(s)`);
      setSelectedDisputes(new Set());
    } else {
      // All failed
      const errorMessage =
        (failed[0]?.result as PromiseRejectedResult)?.reason?.message ||
        'Failed to escalate disputes';
      toast.error(
        `Failed to escalate ${failedCount} dispute(s)`,
        errorMessage
      );
      // Keep selection so user can retry
    }

    setBulkActionInProgress(false);
    setBulkProgress({ completed: 0, total: 0 });
    await fetchDisputes();
    await fetchStats();
  }, [selectedDisputes, fetchDisputes, fetchStats]);

  const handleBulkExport = useCallback(() => {
    const selectedItems = disputes.filter(d => selectedDisputes.has(d._id));
    const headers = ['ID', 'Dispute Number', 'Customer', 'Provider', 'Category', 'Priority', 'Status', 'Amount', 'Created'];
    const rows = selectedItems.map(d => [
      d._id,
      d.disputeNumber,
      d.initiator.name,
      d.respondent.name,
      d.category,
      d.priority,
      d.status,
      d.disputedAmount || '',
      new Date(d.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disputes-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedItems.length} dispute(s)`);
  }, [selectedDisputes, disputes]);

  const handleBulkAction = useCallback(async (actionId: string) => {
    switch (actionId) {
      case 'assign':
        await handleBulkAssign();
        break;
      case 'escalate':
        await handleBulkEscalate();
        break;
      case 'export':
        handleBulkExport();
        break;
    }
  }, [handleBulkAssign, handleBulkEscalate, handleBulkExport]);

  // Define bulk actions
  const bulkActions: BulkAction[] = useMemo(() => [
    {
      id: 'assign',
      label: 'Assign to Me',
      icon: <UserPlus className="w-4 h-4" />,
      variant: 'default',
      confirmTitle: 'Confirm Assignment',
      confirmDescription: 'Assign all selected disputes to yourself?',
      requiresConfirm: true,
    },
    {
      id: 'escalate',
      label: 'Escalate',
      icon: <TrendingUp className="w-4 h-4" />,
      variant: 'warning',
      confirmTitle: 'Confirm Escalation',
      confirmDescription: 'Escalate all selected disputes? This will mark them as high priority.',
      requiresConfirm: true,
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download className="w-4 h-4" />,
      variant: 'default',
    },
  ], []);

  // Selection handlers
  const toggleDisputeSelection = useCallback((disputeId: string) => {
    setSelectedDisputes(prev => {
      const next = new Set(prev);
      if (next.has(disputeId)) {
        next.delete(disputeId);
      } else {
        next.add(disputeId);
      }
      return next;
    });
  }, []);

  const toggleAllDisputes = useCallback(() => {
    if (selectedDisputes.size === disputes.length) {
      setSelectedDisputes(new Set());
    } else {
      setSelectedDisputes(new Set(disputes.map(d => d._id)));
    }
  }, [disputes, selectedDisputes.size]);

  const clearSelection = useCallback(() => {
    setSelectedDisputes(new Set());
  }, []);

  const selectedCount = selectedDisputes.size;
  const isAllSelected = disputes.length > 0 && selectedDisputes.size === disputes.length;

  // Handle export
  const handleExportDisputes = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      const headers = ['ID', 'Customer', 'Provider', 'Category', 'Priority', 'Status', 'Amount', 'Created'];
      const rows = disputes.map(d => [
        d._id,
        d.customerId?.name || d.customerId?.email || '',
        d.providerId?.name || d.providerId?.email || '',
        d.category,
        d.priority,
        d.status,
        d.disputedAmount || '',
        new Date(d.createdAt).toISOString(),
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `disputes-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${disputes.length} dispute(s) to ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch disputes
  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await disputeApi.listDisputes(filters);
      setDisputes(response.data);
      setPagination(response.pagination);
    } catch (err) {
      const message = err.message || 'Failed to load disputes';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await disputeApi.getDisputeStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      toast.error('Failed to load dispute statistics');
    }
  }, []);

  // Fetch dispute detail
  const fetchDisputeDetail = useCallback(async (disputeId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await disputeApi.getDispute(disputeId);
      if (response.success && response.data) {
        setSelectedDispute(response.data);
      }
    } catch (err) {
      const message = err.message || 'Failed to load dispute details';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
    fetchStats();
    fetchPendingAppealsCount();
  }, [fetchDisputes, fetchStats, fetchPendingAppealsCount]);

  // Apply filters
  const applyFilters = (newFilters: Partial<DisputeFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    if (filters.status === status) {
      applyFilters({ status: undefined });
    } else {
      applyFilters({ status: status as DisputeStatus });
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!selectedDispute || !messageInput.trim()) return;

    try {
      await disputeApi.addMessage(selectedDispute._id, messageInput.trim());
      await fetchDisputeDetail(selectedDispute._id);
      setMessageInput('');
    } catch (err) {
      const message = err.message || 'Failed to send message';
      setError(message);
      toast.error(message);
    }
  };

  // Assign dispute
  const handleAssign = async (disputeId: string) => {
    try {
      await disputeApi.assignDispute(disputeId);
      toast.success('Dispute assigned successfully');
      await fetchDisputes();
      await fetchDisputeDetail(disputeId);
      setShowAssignModal(false);
    } catch (err) {
      const message = err.message || 'Failed to assign dispute';
      setError(message);
      toast.error(message);
    }
  };

  // Resolve dispute
  const handleResolve = async () => {
    if (!selectedDispute || !resolveData.resolutionType || !resolveData.reason) return;

    try {
      await disputeApi.resolveDispute(selectedDispute._id, resolveData);
      toast.success('Dispute resolved successfully');
      await fetchDisputes();
      await fetchDisputeDetail(selectedDispute._id);
      await fetchStats();
      setShowResolveModal(false);
      setResolveData({ resolutionType: 'no_action', reason: '' });
    } catch (err) {
      const message = err.message || 'Failed to resolve dispute';
      setError(message);
      toast.error(message);
    }
  };

  // Review appeal
  const handleReviewAppeal = async () => {
    if (!selectedDispute) return;
    if (!appealReviewData.reviewNotes.trim()) {
      toast.error('Review notes are required');
      return;
    }

    setIsReviewingAppeal(true);
    try {
      await disputeApi.reviewAppeal(
        selectedDispute._id,
        appealReviewData.action,
        appealReviewData.reviewNotes
      );
      toast.success(`Appeal ${appealReviewData.action === 'approve' ? 'approved' : 'rejected'} successfully`);
      await fetchDisputes();
      await fetchDisputeDetail(selectedDispute._id);
      await fetchPendingAppealsCount();
      setShowAppealReviewModal(false);
      setAppealReviewData({ action: 'approve', reviewNotes: '' });
    } catch (err) {
      const message = err.message || 'Failed to review appeal';
      setError(message);
      toast.error(message);
    } finally {
      setIsReviewingAppeal(false);
    }
  };

  // Fetch pending appeals count
  const fetchPendingAppealsCount = useCallback(async () => {
    try {
      const response = await disputeApi.getPendingAppeals(1, 1);
      setPendingAppealsCount(response.pagination.total);
    } catch (err) {
      console.error('Failed to fetch pending appeals count:', err);
    }
  }, []);

  // Close dispute
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  const handleClose = async (disputeId: string) => {
    if (!disputeId) return;
    setShowCloseModal(true);
    setCloseNotes('');
  };

  const confirmClose = async () => {
    if (!selectedDispute) return;

    // Validate resolution notes are provided
    if (!closeNotes.trim()) {
      toast.error('Resolution notes are required before closing a dispute');
      return;
    }

    setIsClosing(true);
    try {
      await disputeApi.closeDispute(selectedDispute._id, closeNotes.trim());
      toast.success('Dispute closed successfully');
      await fetchDisputes();
      await fetchDisputeDetail(selectedDispute._id);
      await fetchStats();
      setShowCloseModal(false);
      setCloseNotes('');
    } catch (err) {
      const message = err?.message || 'Failed to close dispute';
      setError(message);
      toast.error(message);
    } finally {
      setIsClosing(false);
    }
  };

  // Update status
  const handleUpdateStatus = async (disputeId: string, status: DisputeStatus) => {
    try {
      await disputeApi.updateDisputeStatus(disputeId, status);
      toast.success(`Dispute status updated to ${status}`);
      await fetchDisputes();
      await fetchDisputeDetail(disputeId);
      await fetchStats();
    } catch (err) {
      const message = err.message || 'Failed to update status';
      setError(message);
      toast.error(message);
    }
  };

  // View dispute detail
  const handleViewDispute = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    fetchDisputeDetail(dispute._id);
  };

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Dispute Center"
        subtitle="Manage and resolve customer disputes"
        backHref="/admin/dashboard"
        wideLayout
        headerActions={
          <>
            <button
              onClick={() => fetchDisputes()}
              className="flex items-center px-4 py-2 bg-white border border-nilin-border rounded-lg hover:bg-nilin-lightGray transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {pendingAppealsCount > 0 && (
              <button
                onClick={() => applyFilters({ status: 'resolved' })}
                className="flex items-center px-4 py-2 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                <Gavel className="w-4 h-4 mr-2" />
                Appeals
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded-full">
                  {pendingAppealsCount}
                </span>
              </button>
            )}
            <ExportDropdown
              onExport={handleExportDisputes}
              formats={['csv', 'excel', 'pdf']}
              loading={isExporting}
            />
          </>
        }
      >
      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <div id="main-content">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral" />
        </div>
      )}
      <div>
        {/* Stats Cards */}
        {stats && (
          <div className={`grid gap-4 mb-6 ${pendingAppealsCount > 0 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Total Disputes</p>
                  <p className="text-2xl font-semibold text-nilin-charcoal">{stats.totalDisputes}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Open</p>
                  <p className="text-2xl font-semibold text-yellow-600">{stats.openDisputes}</p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Escalated</p>
                  <p className="text-2xl font-semibold text-red-600">{stats.escalatedDisputes}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Avg Response</p>
                  <p className="text-2xl font-semibold text-nilin-charcoal">
                    {stats.avgResponseTimeHours ? `${Math.round(stats.avgResponseTimeHours)}h` : 'N/A'}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>
            {pendingAppealsCount > 0 && (
              <div className="bg-yellow-50 rounded-xl p-4 shadow-nilin border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-700">Pending Appeals</p>
                    <p className="text-2xl font-semibold text-yellow-700">{pendingAppealsCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-yellow-200 rounded-lg flex items-center justify-center">
                    <Gavel className="w-5 h-5 text-yellow-700" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Disputes List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-nilin overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-nilin-border">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                  <input
                    type="text"
                    placeholder="Search disputes..."
                    value={filters.search || ''}
                    onChange={(e) => applyFilters({ search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                  />
                </div>
                <select
                  value={filters.category || ''}
                  onChange={(e) => applyFilters({ category: e.target.value || undefined })}
                  className="px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="">All Categories</option>
                  <option value="service_quality">Service Quality</option>
                  <option value="no_show">No Show</option>
                  <option value="damage">Damage</option>
                  <option value="billing">Billing</option>
                  <option value="cancellation">Cancellation</option>
                  <option value="communication">Communication</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={filters.priority || ''}
                  onChange={(e) => applyFilters({ priority: e.target.value || undefined })}
                  className="px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Status Filters */}
              <div role="tablist" aria-label="Dispute status filters" className="flex flex-wrap gap-2 mt-4">
                {['open', 'under_review', 'escalated', 'resolved', 'closed'].map((status) => (
                  <button
                    key={status}
                    role="tab"
                    aria-selected={filters.status === status}
                    tabIndex={filters.status === status ? 0 : -1}
                    onClick={() => handleStatusFilter(status)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                      filters.status === status
                        ? 'bg-nilin-coral text-white'
                        : 'bg-nilin-lightGray text-nilin-charcoal hover:bg-nilin-border'
                    }`}
                  >
                    {disputeApi.getStatusLabel(status as DisputeStatus)}
                  </button>
                ))}
              </div>
            </div>

            {/* Selection Header */}
            {disputes.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-nilin-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={toggleAllDisputes}
                    className="w-9 h-9 flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    aria-label={isAllSelected ? 'Deselect all disputes' : 'Select all disputes'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-5 h-5 text-nilin-coral" />
                    ) : selectedCount > 0 ? (
                      <CheckSquare className="w-5 h-5 text-nilin-coral" />
                    ) : (
                      <Square className="w-5 h-5 text-nilin-warmGray" />
                    )}
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
                  </span>
                </label>
                {selectedCount > 0 && (
                  <span className="text-xs text-nilin-warmGray">
                    {selectedCount} of {disputes.length} selected
                  </span>
                )}
              </div>
            )}

            {/* Disputes List */}
            <div className="divide-y divide-nilin-border max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-nilin-warmGray">Loading disputes...</p>
                </div>
              ) : disputes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-nilin-warmGray mb-4" />
                  <p className="text-nilin-warmGray">No disputes found</p>
                </div>
              ) : (
                disputes.map((dispute) => (
                  <div
                    key={dispute._id}
                    className={`flex items-start p-4 cursor-pointer hover:bg-nilin-lightGray transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-inset ${
                      selectedDispute?._id === dispute._id ? 'bg-nilin-blush' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDisputeSelection(dispute._id);
                      }}
                      onDoubleClick={() => handleViewDispute(dispute)}
                      className="w-9 h-9 flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 mr-3 mt-1"
                      aria-label={`Select dispute ${dispute.disputeNumber}`}
                      aria-pressed={selectedDisputes.has(dispute._id)}
                    >
                      {selectedDisputes.has(dispute._id) ? (
                        <CheckSquare className="w-5 h-5 text-nilin-coral" />
                      ) : (
                        <Square className="w-5 h-5 text-nilin-warmGray" />
                      )}
                    </button>

                    {/* Content */}
                    <button
                      onClick={() => handleViewDispute(dispute)}
                      className="flex-1 text-left"
                    >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-nilin-charcoal">{dispute.disputeNumber}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${disputeApi.getStatusColor(dispute.status)}`}>
                            {disputeApi.getStatusLabel(dispute.status)}
                          </span>
                          {dispute.priority === 'urgent' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Urgent</span>
                          )}
                          {dispute.status === 'escalated' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Auto-Escalated
                            </span>
                          )}
                          {dispute.escalationTriggers && dispute.escalationTriggers.length > 0 && (
                            <span
                              className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 cursor-help"
                              title={`Triggers: ${dispute.escalationTriggers.map(t => disputeApi.getEscalationTriggerDescription(t)).join(', ')}`}
                            >
                              {dispute.escalationTriggers.length} escalation trigger(s)
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-nilin-warmGray mb-1">{dispute.reason}</p>
                        <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {dispute.initiator.name}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {disputeApi.formatDate(dispute.createdAt)}
                          </span>
                          {dispute.bookingReference && (
                            <span className="flex items-center">
                              <DollarSign className="w-3 h-3 mr-1" />
                              {disputeApi.formatAmount(
                                dispute.bookingReference.totalAmount,
                                dispute.bookingReference.currency
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dispute.messages.length > 0 && (
                          <span className="flex items-center text-nilin-warmGray">
                            <MessageSquare className="w-4 h-4 mr-1" />
                            {dispute.messages.length}
                          </span>
                        )}
                        {dispute.evidence.length > 0 && (
                          <span className="flex items-center text-nilin-warmGray">
                            <Image className="w-4 h-4 mr-1" />
                            {dispute.evidence.length}
                          </span>
                        )}
                      </div>
                    </div>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            <AdminPagination
              page={pagination.page}
              totalPages={pagination.pages}
              total={pagination.total}
              pageSize={pagination.limit}
              onPageChange={handlePageChange}
              showPageNumbers
              showTotal
              className="p-4 border-t border-nilin-border"
              ariaLabel="Dispute list pagination"
            />
          </div>

          {/* Dispute Detail */}
          <div className="bg-white rounded-xl shadow-nilin overflow-hidden">
            {selectedDispute ? (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-nilin-border">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-nilin-charcoal">{selectedDispute.disputeNumber}</h2>
                    <button
                      onClick={() => setSelectedDispute(null)}
                      aria-label="Close dispute details"
                      className="w-11 h-11 flex items-center justify-center hover:bg-nilin-lightGray rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      <X className="w-5 h-5 text-nilin-warmGray" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${disputeApi.getStatusColor(selectedDispute.status)}`}>
                      {disputeApi.getStatusLabel(selectedDispute.status)}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                      {disputeApi.getCategoryLabel(selectedDispute.category)}
                    </span>
                  </div>
                  {selectedDispute.assignedTo && (
                    <div className="flex items-center text-sm text-nilin-warmGray">
                      <Shield className="w-4 h-4 mr-2" />
                      Assigned to {selectedDispute.assignedTo.firstName} {selectedDispute.assignedTo.lastName}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Booking Info */}
                  {selectedDispute.bookingReference && (
                    <div className="bg-nilin-lightGray rounded-lg p-3 mb-4">
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Booking Reference</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-nilin-warmGray">Booking #</p>
                          <p className="text-nilin-charcoal">{selectedDispute.bookingReference.bookingNumber}</p>
                        </div>
                        <div>
                          <p className="text-nilin-warmGray">Amount</p>
                          <p className="text-nilin-charcoal">
                            {disputeApi.formatAmount(
                              selectedDispute.bookingReference.totalAmount,
                              selectedDispute.bookingReference.currency
                            )}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-nilin-warmGray">Service</p>
                          <p className="text-nilin-charcoal">{selectedDispute.bookingReference.serviceName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-1">Customer</h3>
                      <p className="text-sm text-nilin-warmGray">{selectedDispute.initiator.name}</p>
                      <p className="text-xs text-nilin-warmGray">{selectedDispute.initiator.email}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-1">Provider</h3>
                      <p className="text-sm text-nilin-warmGray">{selectedDispute.respondent.name}</p>
                      <p className="text-xs text-nilin-warmGray">{selectedDispute.respondent.email}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-1">Reason</h3>
                    <p className="text-sm text-nilin-warmGray mb-2">{selectedDispute.reason}</p>
                    <p className="text-sm text-nilin-warmGray">{selectedDispute.description}</p>
                  </div>

                  {/* Evidence */}
                  {selectedDispute.evidence.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Evidence ({selectedDispute.evidence.length})</h3>
                      <div className="space-y-2">
                        {selectedDispute.evidence.map((ev) => (
                          <div key={ev._id} className="flex items-start gap-2 bg-nilin-lightGray rounded-lg p-2">
                            {ev.type === 'image' ? (
                              <Image className="w-4 h-4 text-nilin-warmGray mt-0.5" />
                            ) : (
                              <FileText className="w-4 h-4 text-nilin-warmGray mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm text-nilin-charcoal">{ev.description || 'No description'}</p>
                              <p className="text-xs text-nilin-warmGray">{disputeApi.formatDateTime(ev.submittedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution */}
                  {selectedDispute.resolution && (
                    <div className="mb-4 bg-green-50 rounded-lg p-3">
                      <h3 className="text-sm font-medium text-green-800 mb-2">Resolution</h3>
                      <p className="text-sm text-green-700">{disputeApi.getResolutionLabel(selectedDispute.resolution.type)}</p>
                      {selectedDispute.resolution.amount && (
                        <p className="text-sm text-green-700">
                          Amount: {disputeApi.formatAmount(selectedDispute.resolution.amount)}
                        </p>
                      )}
                      <p className="text-sm text-green-600 mt-1">{selectedDispute.resolution.reason}</p>
                    </div>
                  )}

                  {/* Appeal Section */}
                  {selectedDispute.status === 'resolved' && selectedDispute.appeal && (
                    <div className={`mb-4 rounded-lg p-3 ${
                      selectedDispute.appeal.status === 'pending' ? 'bg-yellow-50' :
                      selectedDispute.appeal.status === 'approved' ? 'bg-blue-50' :
                      'bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-nilin-charcoal flex items-center gap-2">
                          <Gavel className="w-4 h-4" />
                          Appeal
                        </h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${disputeApi.getAppealStatusColor(selectedDispute.appeal.status)}`}>
                          {disputeApi.getAppealStatusLabel(selectedDispute.appeal.status)}
                        </span>
                      </div>

                      {selectedDispute.appeal.status === 'pending' && (
                        <>
                          <p className="text-sm text-yellow-800 mb-2">
                            An appeal has been submitted and is awaiting review.
                          </p>
                          <p className="text-sm text-yellow-700 mb-2">
                            <strong>Reason:</strong> {selectedDispute.appeal.reason}
                          </p>
                          <p className="text-xs text-yellow-600 mb-3">
                            Submitted: {disputeApi.formatDateTime(selectedDispute.appeal.submittedAt)}
                          </p>
                          <button
                            onClick={() => {
                              setAppealReviewData({ action: 'approve', reviewNotes: '' });
                              setShowAppealReviewModal(true);
                            }}
                            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                          >
                            Review Appeal
                          </button>
                        </>
                      )}

                      {selectedDispute.appeal.status === 'approved' && (
                        <>
                          <p className="text-sm text-blue-700 mb-1">
                            Appeal was approved. The dispute has been reopened.
                          </p>
                          {selectedDispute.appeal.reviewNotes && (
                            <p className="text-sm text-blue-600">
                              <strong>Review Notes:</strong> {selectedDispute.appeal.reviewNotes}
                            </p>
                          )}
                        </>
                      )}

                      {selectedDispute.appeal.status === 'rejected' && (
                        <>
                          <p className="text-sm text-gray-700 mb-1">
                            Appeal was rejected.
                          </p>
                          {selectedDispute.appeal.reviewNotes && (
                            <p className="text-sm text-gray-600">
                              <strong>Review Notes:</strong> {selectedDispute.appeal.reviewNotes}
                            </p>
                          )}
                        </>
                      )}

                      {/* Original Resolution Info */}
                      {selectedDispute.appeal.originalResolution && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Original Resolution:</p>
                          <p className="text-sm text-gray-600">
                            {disputeApi.getResolutionLabel(selectedDispute.appeal.originalResolution.type)}
                            {selectedDispute.appeal.originalResolution.amount && (
                              ` (${disputeApi.formatAmount(selectedDispute.appeal.originalResolution.amount)})`
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Timeline</h3>
                    <div className="space-y-2">
                      {selectedDispute.timeline.slice(-5).reverse().map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-2 h-2 mt-2 rounded-full bg-nilin-coral" />
                          <div className="flex-1">
                            <p className="text-sm text-nilin-charcoal">{item.action.replace('_', ' ')}</p>
                            <p className="text-xs text-nilin-warmGray">{disputeApi.formatDateTime(item.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Messages */}
                  <div>
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-2">
                      Messages ({selectedDispute.messages.length})
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                      {selectedDispute.messages.map((msg) => (
                        <div
                          key={msg._id}
                          className={`p-2 rounded-lg ${
                            msg.senderRole === 'admin'
                              ? 'bg-purple-50 ml-4'
                              : msg.senderRole === 'customer'
                              ? 'bg-blue-50'
                              : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-nilin-charcoal capitalize">{msg.senderRole}</span>
                            <span className="text-xs text-nilin-warmGray">{disputeApi.formatDateTime(msg.timestamp)}</span>
                          </div>
                          <p className="text-sm text-nilin-warmGray">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-nilin-border">
                  {/* Message Input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Add a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      aria-label="Send message"
                      className="w-11 h-11 flex items-center justify-center bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {!selectedDispute.assignedTo && selectedDispute.status !== 'closed' && (
                      <button
                        onClick={() => handleAssign(selectedDispute._id)}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Assign to Me
                      </button>
                    )}
                    {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
                      <button
                        onClick={() => setShowResolveModal(true)}
                        className="px-3 py-1.5 text-sm bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                    {selectedDispute.status === 'resolved' && (
                      <button
                        onClick={() => handleClose(selectedDispute._id)}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Close Dispute
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <AlertCircle className="w-12 h-12 text-nilin-warmGray mb-4" />
                <p className="text-nilin-warmGray">Select a dispute to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appeal Review Modal */}
      {showAppealReviewModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal flex items-center gap-2">
                <Gavel className="w-5 h-5" />
                Review Appeal
              </h3>
              <button
                onClick={() => setShowAppealReviewModal(false)}
                aria-label="Close appeal review modal"
                className="w-11 h-11 flex items-center justify-center hover:bg-nilin-lightGray rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Appeal Reason Display */}
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-800 mb-1">Appeal Reason:</p>
                <p className="text-sm text-yellow-700">{selectedDispute.appeal?.reason}</p>
              </div>

              {/* Original Resolution */}
              {selectedDispute.appeal?.originalResolution && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Original Resolution:</p>
                  <p className="text-sm text-gray-600">
                    {disputeApi.getResolutionLabel(selectedDispute.appeal.originalResolution.type)}
                    {selectedDispute.appeal.originalResolution.amount && (
                      ` - ${disputeApi.formatAmount(selectedDispute.appeal.originalResolution.amount)}`
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{selectedDispute.appeal.originalResolution.reason}</p>
                </div>
              )}

              {/* Action Selection */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Decision</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAppealReviewData({ ...appealReviewData, action: 'approve' })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      appealReviewData.action === 'approve'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-nilin-border text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                    Approve
                  </button>
                  <button
                    onClick={() => setAppealReviewData({ ...appealReviewData, action: 'reject' })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      appealReviewData.action === 'reject'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-nilin-border text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <XCircle className="w-5 h-5 mx-auto mb-1" />
                    Reject
                  </button>
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Review Notes {appealReviewData.action === 'reject' ? '(Required)' : '(Optional)'}
                </label>
                <textarea
                  value={appealReviewData.reviewNotes}
                  onChange={(e) => setAppealReviewData({ ...appealReviewData, reviewNotes: e.target.value })}
                  rows={4}
                  placeholder={
                    appealReviewData.action === 'approve'
                      ? 'Explain why the appeal is approved...'
                      : 'Explain why the appeal is rejected...'
                  }
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                />
                {appealReviewData.action === 'reject' && !appealReviewData.reviewNotes.trim() && (
                  <p className="mt-1 text-sm text-nilin-rose">Review notes are required when rejecting an appeal</p>
                )}
              </div>

              {/* Warning for Approval */}
              {appealReviewData.action === 'approve' && (
                <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertOctagon className="w-5 h-5 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    Approving this appeal will reopen the dispute and clear the current resolution.
                    The dispute will be returned to the queue for reassignment.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAppealReviewModal(false)}
                className="flex-1 px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-lightGray transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAppeal}
                disabled={isReviewingAppeal || (appealReviewData.action === 'reject' && !appealReviewData.reviewNotes.trim())}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  appealReviewData.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isReviewingAppeal ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  appealReviewData.action === 'approve' ? 'Approve Appeal' : 'Reject Appeal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal">Resolve Dispute</h3>
              <button onClick={() => setShowResolveModal(false)} aria-label="Close resolve dispute modal" className="w-11 h-11 flex items-center justify-center hover:bg-nilin-lightGray rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2">
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Resolution Type</label>
                <select
                  value={resolveData.resolutionType}
                  onChange={(e) => setResolveData({ ...resolveData, resolutionType: e.target.value as ResolutionType })}
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="no_action">No Action Required</option>
                  <option value="refund">Full Refund</option>
                  <option value="partial_refund">Partial Refund</option>
                  <option value="provider_warning">Provider Warning</option>
                  <option value="provider_suspended">Provider Suspended</option>
                </select>
              </div>

              {['refund', 'partial_refund'].includes(resolveData.resolutionType) && (
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Refund Amount ({selectedDispute.bookingReference?.currency || 'AED'})
                  </label>
                  <input
                    type="number"
                    value={resolveData.amount || ''}
                    onChange={(e) => setResolveData({ ...resolveData, amount: parseFloat(e.target.value) })}
                    max={selectedDispute.bookingReference?.totalAmount}
                    placeholder={`Max: ${selectedDispute.bookingReference?.totalAmount}`}
                    className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Reason</label>
                <textarea
                  value={resolveData.reason}
                  onChange={(e) => setResolveData({ ...resolveData, reason: e.target.value })}
                  rows={3}
                  placeholder="Explain the resolution..."
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Notes (Optional)</label>
                <textarea
                  value={resolveData.notes || ''}
                  onChange={(e) => setResolveData({ ...resolveData, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-lightGray transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolveData.reason}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Dispute Modal */}
      {showCloseModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal">Close Dispute</h3>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseNotes('');
                }}
                aria-label="Close close-dispute modal"
                className="w-11 h-11 flex items-center justify-center hover:bg-nilin-lightGray rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-nilin-warmGray">
                  You are about to close dispute <span className="font-medium text-nilin-charcoal">{selectedDispute.disputeNumber}</span>.
                  This will mark the dispute as closed and prevent further actions.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any closing notes or final remarks..."
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseNotes('');
                }}
                disabled={isClosing}
                className="flex-1 px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-lightGray transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmClose}
                disabled={isClosing}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isClosing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Close Dispute'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="w-11 h-11 flex items-center justify-center hover:bg-red-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Bulk Action Progress Indicator */}
      {bulkActionInProgress && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-nilin-charcoal text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">
            Processing {bulkProgress.completed} of {bulkProgress.total}...
          </span>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedItems={disputes.filter(d => selectedDisputes.has(d._id))}
        totalCount={pagination.total}
        entityName="disputes"
        actions={bulkActions}
        onAction={handleBulkAction}
        onClear={clearSelection}
      />
      </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default DisputeCenter;
