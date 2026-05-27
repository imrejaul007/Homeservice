
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import {
  ArrowLeft,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
  Calendar,
  User,
  CreditCard,
  AlertTriangle,
  Check,
  Ban,
} from 'lucide-react';
import { disputeApi } from '../../services/disputeApi';
import type {
  RefundRequest,
  RefundStatus,
  RefundType,
  RefundFilters,
  RefundStats,
} from '../../services/disputeApi';
import { useAuthStore } from '../../stores/authStore';

interface RefundManagementProps {}

const RefundManagement: React.FC<RefundManagementProps> = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });

  // Filters
  const [filters, setFilters] = useState<RefundFilters>({
    status: undefined,
    type: undefined,
    page: 1,
    limit: 20,
  });

  // Process Modal
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processData, setProcessData] = useState<{
    action: 'approve' | 'reject';
    amount?: number;
    notes?: string;
    rejectionReason?: string;
  }>({
    action: 'approve',
    notes: '',
    rejectionReason: '',
  });

  // Fetch refunds
  const fetchRefunds = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await disputeApi.listRefunds(filters);
      setRefunds(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to load refunds');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await disputeApi.getRefundStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Fetch refund detail
  const fetchRefundDetail = useCallback(async (refundId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await disputeApi.getRefund(refundId);
      if (response.success && response.data) {
        setSelectedRefund(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load refund details');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
    fetchStats();
  }, [fetchRefunds, fetchStats]);

  // Apply filters
  const applyFilters = (newFilters: Partial<RefundFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);
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
      applyFilters({ status: status as RefundStatus });
    }
  };

  // Process refund
  const handleProcessRefund = async () => {
    if (!selectedRefund) return;
    if (processData.action === 'reject' && !processData.rejectionReason) {
      setError('Rejection reason is required');
      return;
    }

    setIsProcessing(true);
    try {
      await disputeApi.processRefund(selectedRefund._id, {
        action: processData.action,
        amount: processData.amount,
        notes: processData.notes,
        rejectionReason: processData.rejectionReason,
      });
      await fetchRefunds();
      await fetchRefundDetail(selectedRefund._id);
      await fetchStats();
      setShowProcessModal(false);
      setProcessData({ action: 'approve', notes: '', rejectionReason: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to process refund');
    } finally {
      setIsProcessing(false);
    }
  };

  // View refund detail
  const handleViewRefund = (refund: RefundRequest) => {
    setSelectedRefund(refund);
    fetchRefundDetail(refund._id);
  };

  // Get refund type label
  const getRefundTypeLabel = (type: RefundType): string => {
    const labels: Record<RefundType, string> = {
      full: 'Full Refund',
      partial: 'Partial Refund',
      prorated: 'Prorated Refund',
      chargeback: 'Chargeback',
      dispute: 'Dispute Resolution',
    };
    return labels[type] || type;
  };

  // Get reason label
  const getReasonLabel = (reason: string): string => {
    const labels: Record<string, string> = {
      cancellation: 'Booking Cancellation',
      service_not_provided: 'Service Not Provided',
      poor_quality: 'Poor Service Quality',
      provider_no_show: 'Provider No Show',
      customer_request: 'Customer Request',
      duplicate_charge: 'Duplicate Charge',
      billing_error: 'Billing Error',
      other: 'Other',
    };
    return labels[reason] || reason;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-nilin-cream">
        <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="mr-4 p-2 hover:bg-nilin-lightGray rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-nilin-charcoal" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-nilin-charcoal">Refund Management</h1>
              <p className="text-sm text-nilin-warmGray">Process and track refund requests</p>
            </div>
          </div>
          <button
            onClick={() => fetchRefunds()}
            className="flex items-center px-4 py-2 bg-white border border-nilin-border rounded-lg hover:bg-nilin-lightGray transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Total Refunds</p>
                  <p className="text-2xl font-semibold text-nilin-charcoal">{stats.totalRefunds}</p>
                  <p className="text-xs text-nilin-warmGray">
                    {disputeApi.formatAmount(stats.totalAmount)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Pending</p>
                  <p className="text-2xl font-semibold text-yellow-600">{stats.pendingCount}</p>
                  <p className="text-xs text-nilin-warmGray">
                    {disputeApi.formatAmount(stats.pendingAmount)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Completed</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.completedCount}</p>
                  <p className="text-xs text-nilin-warmGray">
                    {disputeApi.formatAmount(stats.completedAmount)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-nilin">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-nilin-warmGray">Rejected</p>
                  <p className="text-2xl font-semibold text-red-600">{stats.rejectedCount}</p>
                  <p className="text-xs text-nilin-warmGray">Avg: {disputeApi.formatAmount(stats.avgRefundAmount)}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Refunds List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-nilin overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-nilin-border">
              <div className="flex flex-col md:flex-row gap-4">
                <select
                  value={filters.type || ''}
                  onChange={(e) => applyFilters({ type: (e.target.value || undefined) as RefundType | undefined })}
                  className="px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="">All Types</option>
                  <option value="full">Full Refund</option>
                  <option value="partial">Partial Refund</option>
                  <option value="prorated">Prorated</option>
                  <option value="chargeback">Chargeback</option>
                  <option value="dispute">Dispute</option>
                </select>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap gap-2 mt-4">
                {['pending', 'approved', 'processing', 'completed', 'rejected', 'failed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      filters.status === status
                        ? 'bg-nilin-coral text-white'
                        : 'bg-nilin-lightGray text-nilin-charcoal hover:bg-nilin-border'
                    }`}
                  >
                    {disputeApi.getStatusLabel(status as RefundStatus)}
                  </button>
                ))}
              </div>
            </div>

            {/* Refunds List */}
            <div className="divide-y divide-nilin-border max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
                </div>
              ) : refunds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-nilin-warmGray mb-4" />
                  <p className="text-nilin-warmGray">No refunds found</p>
                </div>
              ) : (
                refunds.map((refund) => (
                  <div
                    key={refund._id}
                    onClick={() => handleViewRefund(refund)}
                    className={`p-4 cursor-pointer hover:bg-nilin-lightGray transition-colors ${
                      selectedRefund?._id === refund._id ? 'bg-nilin-blush' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-nilin-charcoal">{refund.refundNumber}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${disputeApi.getStatusColor(refund.status)}`}>
                            {disputeApi.getStatusLabel(refund.status)}
                          </span>
                        </div>
                        <p className="text-sm text-nilin-warmGray mb-1">{getReasonLabel(refund.reason)}</p>
                        <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {refund.requestedBy?.firstName} {refund.requestedBy?.lastName}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {disputeApi.formatDate(refund.createdAt)}
                          </span>
                          <span className="flex items-center">
                            <CreditCard className="w-3 h-3 mr-1" />
                            {getRefundTypeLabel(refund.type)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-nilin-charcoal">
                          {disputeApi.formatAmount(
                            refund.amount,
                            refund.bookingId?.pricing?.currency || 'AED'
                          )}
                        </p>
                        {refund.refundPercentage && refund.refundPercentage < 100 && (
                          <p className="text-xs text-nilin-warmGray">{refund.refundPercentage}% of original</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-nilin-border flex items-center justify-between">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 text-sm bg-white border border-nilin-border rounded-lg disabled:opacity-50 hover:bg-nilin-lightGray transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-nilin-warmGray">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                  className="px-4 py-2 text-sm bg-white border border-nilin-border rounded-lg disabled:opacity-50 hover:bg-nilin-lightGray transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Refund Detail */}
          <div className="bg-white rounded-xl shadow-nilin overflow-hidden">
            {selectedRefund ? (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-nilin-border">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-nilin-charcoal">{selectedRefund.refundNumber}</h2>
                    <button
                      onClick={() => setSelectedRefund(null)}
                      className="p-1 hover:bg-nilin-lightGray rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-nilin-warmGray" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${disputeApi.getStatusColor(selectedRefund.status)}`}>
                      {disputeApi.getStatusLabel(selectedRefund.status)}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                      {getRefundTypeLabel(selectedRefund.type)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Amount */}
                  <div className="bg-nilin-lightGray rounded-lg p-4 mb-4">
                    <p className="text-sm text-nilin-warmGray mb-1">Refund Amount</p>
                    <p className="text-2xl font-semibold text-nilin-charcoal">
                      {disputeApi.formatAmount(
                        selectedRefund.amount,
                        selectedRefund.bookingId?.pricing?.currency || 'AED'
                      )}
                    </p>
                    {selectedRefund.refundPercentage && selectedRefund.refundPercentage < 100 && (
                      <p className="text-sm text-nilin-warmGray">
                        {selectedRefund.refundPercentage}% of{' '}
                        {disputeApi.formatAmount(
                          selectedRefund.originalAmount,
                          selectedRefund.bookingId?.pricing?.currency || 'AED'
                        )}
                      </p>
                    )}
                  </div>

                  {/* Booking Info */}
                  {selectedRefund.bookingId && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Booking Reference</h3>
                      <div className="bg-nilin-lightGray rounded-lg p-3">
                        <p className="text-sm text-nilin-charcoal font-medium">
                          {selectedRefund.bookingId.bookingNumber}
                        </p>
                        {selectedRefund.bookingId.pricing && (
                          <p className="text-sm text-nilin-warmGray">
                            Original: {disputeApi.formatAmount(
                              selectedRefund.bookingId.pricing.totalAmount,
                              selectedRefund.bookingId.pricing.currency
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Requester */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Requested By</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-nilin-coral rounded-full flex items-center justify-center text-white font-medium">
                        {selectedRefund.requestedBy?.firstName?.[0]}
                        {selectedRefund.requestedBy?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-nilin-charcoal">
                          {selectedRefund.requestedBy?.firstName} {selectedRefund.requestedBy?.lastName}
                        </p>
                        <p className="text-xs text-nilin-warmGray">{selectedRefund.requestedBy?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Reason</h3>
                    <p className="text-sm text-nilin-warmGray">{getReasonLabel(selectedRefund.reason)}</p>
                    {selectedRefund.description && (
                      <p className="text-sm text-nilin-warmGray mt-1">{selectedRefund.description}</p>
                    )}
                  </div>

                  {/* Stripe Info */}
                  {selectedRefund.stripeRefundId && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Stripe Reference</h3>
                      <p className="text-sm text-nilin-warmGray font-mono">{selectedRefund.stripeRefundId}</p>
                    </div>
                  )}

                  {/* Processing Notes */}
                  {selectedRefund.processingNotes && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Processing Notes</h3>
                      <p className="text-sm text-nilin-warmGray">{selectedRefund.processingNotes}</p>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedRefund.rejectionReason && (
                    <div className="mb-4 bg-red-50 rounded-lg p-3">
                      <h3 className="text-sm font-medium text-red-800 mb-2">Rejection Reason</h3>
                      <p className="text-sm text-red-700">{selectedRefund.rejectionReason}</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div>
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-2">Timeline</h3>
                    <div className="space-y-3">
                      {selectedRefund.timeline.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              item.action.includes('reject') || item.action.includes('failed')
                                ? 'bg-red-100'
                                : item.action.includes('approved') || item.action.includes('completed')
                                ? 'bg-green-100'
                                : 'bg-blue-100'
                            }`}
                          >
                            {item.action.includes('reject') || item.action.includes('failed') ? (
                              <XCircle className="w-4 h-4 text-red-600" />
                            ) : item.action.includes('approved') || item.action.includes('completed') ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-nilin-charcoal capitalize">
                              {item.action.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-nilin-warmGray">{disputeApi.formatDateTime(item.timestamp)}</p>
                            {item.details && <p className="text-xs text-nilin-warmGray mt-1">{item.details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {selectedRefund.status === 'pending' && (
                  <div className="p-4 border-t border-nilin-border">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setProcessData({
                            action: 'approve',
                            amount: selectedRefund.amount,
                            notes: '',
                            rejectionReason: '',
                          });
                          setShowProcessModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setProcessData({
                            action: 'reject',
                            notes: '',
                            rejectionReason: '',
                          });
                          setShowProcessModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Ban className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <AlertCircle className="w-12 h-12 text-nilin-warmGray mb-4" />
                <p className="text-nilin-warmGray">Select a refund to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Process Modal */}
      {showProcessModal && selectedRefund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal">
                {processData.action === 'approve' ? 'Approve Refund' : 'Reject Refund'}
              </h3>
              <button
                onClick={() => setShowProcessModal(false)}
                className="p-1 hover:bg-nilin-lightGray rounded"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Amount (for approvals) */}
              {processData.action === 'approve' && (
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Refund Amount ({selectedRefund.bookingId?.pricing?.currency || 'AED'})
                  </label>
                  <input
                    type="number"
                    value={processData.amount || ''}
                    onChange={(e) => setProcessData({ ...processData, amount: parseFloat(e.target.value) })}
                    max={selectedRefund.originalAmount}
                    className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                  />
                  <p className="text-xs text-nilin-warmGray mt-1">
                    Original amount: {disputeApi.formatAmount(selectedRefund.originalAmount, selectedRefund.bookingId?.pricing?.currency || 'AED')}
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Notes (Optional)</label>
                <textarea
                  value={processData.notes || ''}
                  onChange={(e) => setProcessData({ ...processData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add processing notes..."
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              {/* Rejection Reason */}
              {processData.action === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={processData.rejectionReason || ''}
                    onChange={(e) => setProcessData({ ...processData, rejectionReason: e.target.value })}
                    rows={3}
                    placeholder="Explain why the refund is being rejected..."
                    className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowProcessModal(false)}
                className="flex-1 px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-lightGray transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessRefund}
                disabled={isProcessing || (processData.action === 'reject' && !processData.rejectionReason)}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  processData.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : processData.action === 'approve' ? (
                  'Approve'
                ) : (
                  'Reject'
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
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default RefundManagement;
