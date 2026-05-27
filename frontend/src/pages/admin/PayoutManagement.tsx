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
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { payoutApi, type AdminWithdrawal, type WithdrawalStats, type WithdrawalFilters, type WithdrawalDetails } from '../../services/payoutApi';
import { useAuthStore } from '../../stores/authStore';

interface PayoutManagementProps {}

const PayoutManagement: React.FC<PayoutManagementProps> = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const [filters, setFilters] = useState<WithdrawalFilters>({
    status: 'pending',
    page: 1,
    limit: 20,
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Process Modal
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawal | null>(null);
  const [processAction, setProcessAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<WithdrawalDetails | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await payoutApi.getAdminWithdrawals(filters);
      if (response.success && response.data) {
        setWithdrawals(response.data.withdrawals);
        setPagination(response.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load withdrawals');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await payoutApi.getAdminWithdrawalStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch withdrawal details
  const fetchWithdrawalDetails = useCallback(async (withdrawalId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await payoutApi.getAdminWithdrawalDetails(withdrawalId);
      if (response.success && response.data) {
        setDetailData(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load withdrawal details');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
    fetchStats();
  }, [fetchWithdrawals, fetchStats]);

  // Apply filters
  const applyFilters = (newFilters: Partial<WithdrawalFilters>) => {
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
      applyFilters({ status });
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search: searchQuery });
  };

  // Open process modal
  const openProcessModal = (withdrawal: AdminWithdrawal, action: 'approve' | 'reject') => {
    setSelectedWithdrawal(withdrawal);
    setProcessAction(action);
    setRejectionReason('');
    setShowProcessModal(true);
  };

  // Close process modal
  const closeProcessModal = () => {
    setShowProcessModal(false);
    setSelectedWithdrawal(null);
    setRejectionReason('');
  };

  // Process withdrawal
  const processWithdrawal = async () => {
    if (!selectedWithdrawal) return;

    if (processAction === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let response;
      if (processAction === 'approve') {
        response = await payoutApi.approveWithdrawal(selectedWithdrawal._id);
      } else {
        response = await payoutApi.rejectWithdrawal(selectedWithdrawal._id, rejectionReason);
      }

      if (response.success) {
        closeProcessModal();
        fetchWithdrawals();
        fetchStats();
      } else {
        setError(response.message || `Failed to ${processAction} withdrawal`);
      }
    } catch (err: any) {
      setError(err.message || `Failed to ${processAction} withdrawal`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open detail modal
  const openDetailModal = async (withdrawal: AdminWithdrawal) => {
    setShowDetailModal(true);
    setDetailData(null);
    await fetchWithdrawalDetails(withdrawal._id);
  };

  // Close detail modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailData(null);
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'reversed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statusFilters = [
    { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600' },
    { value: 'processing', label: 'Processing', icon: RefreshCw, color: 'text-blue-600' },
    { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-600' },
    { value: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-600' },
    { value: 'reversed', label: 'Rejected', icon: Ban, color: 'text-gray-600' },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Payout Management</h1>
                <p className="text-sm text-gray-500">Manage provider withdrawal requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Withdrawals</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isLoadingStats ? '-' : stats?.pending.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {isLoadingStats ? '-' : formatCurrency(stats?.pending.totalAmount || 0)}
            </p>
          </div>

          {/* Processing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isLoadingStats ? '-' : stats?.processing.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {isLoadingStats ? '-' : formatCurrency(stats?.processing.totalAmount || 0)}
            </p>
          </div>

          {/* Completed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isLoadingStats ? '-' : stats?.completed.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {isLoadingStats ? '-' : formatCurrency(stats?.completed.totalAmount || 0)}
            </p>
          </div>

          {/* Total Pending Amount */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pending</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isLoadingStats ? '-' : formatCurrency(stats?.totalPendingAmount || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Awaiting processing
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Status Filters */}
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => handleStatusFilter(filter.value)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                    filters.status === filter.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <filter.icon className={`w-4 h-4 ${filters.status === filter.value ? 'text-white' : filter.color}`} />
                  <span className="text-sm font-medium">{filter.label}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search provider..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Withdrawals List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                      <p className="text-gray-500 mt-2">Loading withdrawals...</p>
                    </td>
                  </tr>
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Wallet className="w-12 h-12 text-gray-300 mx-auto" />
                      <p className="text-gray-500 mt-2">No withdrawals found</p>
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <tr key={withdrawal._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-900">
                              {withdrawal.userFirstName} {withdrawal.userLastName}
                            </p>
                            <p className="text-sm text-gray-500">{withdrawal.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(withdrawal.transaction.amount, withdrawal.transaction.currency)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                            withdrawal.transaction.status
                          )}`}
                        >
                          {withdrawal.transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {withdrawal.transaction.metadata?.bankAccount?.bankName || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {withdrawal.transaction.metadata?.bankAccount?.accountNumber
                            ? `****${withdrawal.transaction.metadata.bankAccount.accountNumber.slice(-4)}`
                            : 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {formatDate(withdrawal.transaction.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openDetailModal(withdrawal)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {withdrawal.transaction.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openProcessModal(withdrawal, 'approve')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openProcessModal(withdrawal, 'reject')}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Process Modal */}
      {showProcessModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {processAction === 'approve' ? 'Approve' : 'Reject'} Withdrawal
                </h3>
                <button
                  onClick={closeProcessModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {selectedWithdrawal.userFirstName} {selectedWithdrawal.userLastName}
                    </p>
                    <p className="text-sm text-gray-500">{selectedWithdrawal.userEmail}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Amount</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(
                        selectedWithdrawal.transaction.amount,
                        selectedWithdrawal.transaction.currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Bank</span>
                    <span className="text-sm text-gray-900">
                      {selectedWithdrawal.transaction.metadata?.bankAccount?.bankName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Account</span>
                    <span className="text-sm text-gray-900">
                      {selectedWithdrawal.transaction.metadata?.bankAccount?.accountNumber
                        ? `****${selectedWithdrawal.transaction.metadata.bankAccount.accountNumber.slice(-4)}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {processAction === 'reject' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection (minimum 10 characters)..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This reason will be shared with the provider.
                  </p>
                </div>
              )}

              {processAction === 'approve' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Approve this withdrawal?</p>
                      <p className="text-sm text-green-700 mt-1">
                        The requested amount will be deducted from the provider's wallet and
                        transferred to their bank account.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={closeProcessModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processWithdrawal}
                disabled={
                  isProcessing ||
                  (processAction === 'reject' && rejectionReason.trim().length < 10)
                }
                className={`px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  processAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : processAction === 'approve' ? (
                  'Approve Withdrawal'
                ) : (
                  'Reject Withdrawal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Withdrawal Details</h3>
                <button
                  onClick={closeDetailModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : detailData ? (
                <div className="space-y-6">
                  {/* Provider Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Provider</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {detailData.provider.firstName} {detailData.provider.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{detailData.provider.email}</p>
                          {detailData.provider.phone && (
                            <p className="text-sm text-gray-500">{detailData.provider.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">
                      Transaction Details
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Amount</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(detailData.transaction.amount, detailData.transaction.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Status</span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                            detailData.transaction.status
                          )}`}
                        >
                          {detailData.transaction.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Reference</span>
                        <span className="text-sm text-gray-900 font-mono">
                          {detailData.transaction.reference}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Requested</span>
                        <span className="text-sm text-gray-900">
                          {formatDate(detailData.transaction.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Details */}
                  {detailData.transaction.metadata?.bankAccount && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">
                        Bank Account
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Bank</span>
                          <span className="text-sm text-gray-900">
                            {(detailData.transaction.metadata as { bankAccount: { bankName: string; accountHolder: string; accountNumber: string; iban?: string } }).bankAccount.bankName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Account Holder</span>
                          <span className="text-sm text-gray-900">
                            {(detailData.transaction.metadata as { bankAccount: { bankName: string; accountHolder: string; accountNumber: string; iban?: string } }).bankAccount.accountHolder}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Account Number</span>
                          <span className="text-sm text-gray-900 font-mono">
                            {(detailData.transaction.metadata as { bankAccount: { bankName: string; accountHolder: string; accountNumber: string; iban?: string } }).bankAccount.accountNumber}
                          </span>
                        </div>
                        {(detailData.transaction.metadata as { bankAccount: { bankName: string; accountHolder: string; accountNumber: string; iban?: string } }).bankAccount.iban && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">IBAN</span>
                            <span className="text-sm text-gray-900 font-mono">
                              {(detailData.transaction.metadata as { bankAccount: { bankName: string; accountHolder: string; accountNumber: string; iban?: string } }).bankAccount.iban}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Wallet Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Wallet</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Current Balance</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(detailData.wallet.balance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Pending Balance</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(detailData.wallet.pendingBalance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Available Balance</span>
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(detailData.wallet.availableBalance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {detailData.transaction.metadata?.rejectionReason && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">
                        Rejection Reason
                      </h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800">
                          {(detailData.transaction.metadata as { rejectionReason?: string; rejectedAt?: string }).rejectionReason}
                        </p>
                        <p className="text-xs text-red-600 mt-2">
                          Rejected on{' '}
                          {(detailData.transaction.metadata as { rejectionReason?: string; rejectedAt?: string }).rejectedAt &&
                            formatDate((detailData.transaction.metadata as { rejectionReason?: string; rejectedAt?: string }).rejectedAt!)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500">No details available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default PayoutManagement;
