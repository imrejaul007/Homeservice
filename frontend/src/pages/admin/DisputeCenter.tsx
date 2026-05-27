
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { disputeApi } from '../../services/disputeApi';
import type {
  Dispute,
  DisputeStatus,
  ResolutionType,
  DisputeFilters,
  DisputeStats,
} from '../../services/disputeApi';
import { useAuthStore } from '../../stores/authStore';

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

  // Fetch disputes
  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await disputeApi.listDisputes(filters);
      setDisputes(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to load disputes');
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
    } catch (err: any) {
      setError(err.message || 'Failed to load dispute details');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
    fetchStats();
  }, [fetchDisputes, fetchStats]);

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
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    }
  };

  // Assign dispute
  const handleAssign = async (disputeId: string) => {
    try {
      await disputeApi.assignDispute(disputeId);
      await fetchDisputes();
      await fetchDisputeDetail(disputeId);
      setShowAssignModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to assign dispute');
    }
  };

  // Resolve dispute
  const handleResolve = async () => {
    if (!selectedDispute || !resolveData.resolutionType || !resolveData.reason) return;

    try {
      await disputeApi.resolveDispute(selectedDispute._id, resolveData);
      await fetchDisputes();
      await fetchDisputeDetail(selectedDispute._id);
      await fetchStats();
      setShowResolveModal(false);
      setResolveData({ resolutionType: 'no_action', reason: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to resolve dispute');
    }
  };

  // Close dispute
  const handleClose = async (disputeId: string) => {
    if (!confirm('Are you sure you want to close this dispute?')) return;

    try {
      await disputeApi.closeDispute(disputeId);
      await fetchDisputes();
      if (selectedDispute?._id === disputeId) {
        await fetchDisputeDetail(disputeId);
      }
      await fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to close dispute');
    }
  };

  // Update status
  const handleUpdateStatus = async (disputeId: string, status: DisputeStatus) => {
    try {
      await disputeApi.updateDisputeStatus(disputeId, status);
      await fetchDisputes();
      await fetchDisputeDetail(disputeId);
      await fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  // View dispute detail
  const handleViewDispute = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    fetchDisputeDetail(dispute._id);
  };

  return (
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
              <h1 className="text-2xl font-semibold text-nilin-charcoal">Dispute Center</h1>
              <p className="text-sm text-nilin-warmGray">Manage and resolve customer disputes</p>
            </div>
          </div>
          <button
            onClick={() => fetchDisputes()}
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
              <div className="flex flex-wrap gap-2 mt-4">
                {['open', 'under_review', 'escalated', 'resolved', 'closed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
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

            {/* Disputes List */}
            <div className="divide-y divide-nilin-border max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
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
                    onClick={() => handleViewDispute(dispute)}
                    className={`p-4 cursor-pointer hover:bg-nilin-lightGray transition-colors ${
                      selectedDispute?._id === dispute._id ? 'bg-nilin-blush' : ''
                    }`}
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
                      className="p-1 hover:bg-nilin-lightGray rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-nilin-warmGray" />
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
                      className="p-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
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

      {/* Resolve Modal */}
      {showResolveModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal">Resolve Dispute</h3>
              <button onClick={() => setShowResolveModal(false)} className="p-1 hover:bg-nilin-lightGray rounded">
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
  );
};

export default DisputeCenter;
