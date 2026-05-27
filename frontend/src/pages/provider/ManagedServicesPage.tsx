import React, { useState, useEffect, useCallback } from 'react';
import {
  managedContractApi,
  ManagedContract,
  ContractStatus,
  CreateContractInput,
  UpdateContractInput,
  AddTeamMemberInput,
  ContractFilters,
  ContractReport,
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusLabel,
  getPriorityLabel,
  getRoleLabel,
  getPricingModelLabel,
  calculateContractDuration,
  isExpiringSoon,
} from '../../services/managedContractApi';
import { useToast } from '../../components/common/Toast';

// ============================================
// Icon Components
// ============================================

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const FileTextIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ============================================
// Type Definitions
// ============================================

type ViewMode = 'list' | 'detail' | 'create' | 'edit';
type TabType = 'overview' | 'details' | 'team' | 'sla' | 'reports';

// ============================================
// Main Component
// ============================================

const ManagedServicesPage: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [contracts, setContracts] = useState<ManagedContract[]>([]);
  const [selectedContract, setSelectedContract] = useState<ManagedContract | null>(null);
  const [stats, setStats] = useState<{
    totalContracts: number;
    activeContracts: number;
    totalRevenue: number;
    expiringContracts: number;
  } | null>(null);

  // Filter state
  const [filters, setFilters] = useState<ContractFilters>({
    status: undefined,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
  });

  // Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<ContractReport | null>(null);

  // Toast
  const { showToast } = useToast();

  // ============================================
  // Data Fetching
  // ============================================

  const fetchContracts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await managedContractApi.getContracts(filters);
      setContracts(response.data);
      setPagination({
        total: response.meta.total,
        pages: response.meta.pages,
      });
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
      showToast('Failed to load contracts', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const [statsResponse, expiringResponse] = await Promise.all([
        managedContractApi.getStats(),
        managedContractApi.getExpiringContracts(30),
      ]);

      setStats({
        totalContracts: statsResponse.data.totalContracts,
        activeContracts: statsResponse.data.activeContracts,
        totalRevenue: statsResponse.data.totalRevenue,
        expiringContracts: expiringResponse.data.length,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchContractDetail = useCallback(async (contractId: string) => {
    try {
      const response = await managedContractApi.getContractById(contractId);
      setSelectedContract(response.data);
    } catch (error) {
      console.error('Failed to fetch contract details:', error);
      showToast('Failed to load contract details', 'error');
    }
  }, [showToast]);

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    fetchContracts();
    fetchStats();
  }, [fetchContracts, fetchStats]);

  useEffect(() => {
    if (selectedContractId) {
      fetchContractDetail(selectedContractId);
    }
  }, [selectedContractId, fetchContractDetail]);

  // ============================================
  // Handlers
  // ============================================

  const handleRefresh = () => {
    fetchContracts(true);
    fetchStats();
  };

  const handleViewContract = (contract: ManagedContract) => {
    setSelectedContractId(contract._id);
    setViewMode('detail');
    setActiveTab('overview');
  };

  const handleViewTeamMembers = (contract: ManagedContract) => {
    setSelectedContractId(contract._id);
    setViewMode('detail');
    setActiveTab('team');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedContractId(null);
    setSelectedContract(null);
    fetchContracts();
  };

  const handleFilterChange = (key: keyof ContractFilters, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleCreateContract = async (input: CreateContractInput) => {
    setIsSubmitting(true);
    try {
      await managedContractApi.createContract(input);
      showToast('Contract created successfully', 'success');
      setShowCreateModal(false);
      fetchContracts();
      fetchStats();
    } catch (error) {
      console.error('Failed to create contract:', error);
      showToast('Failed to create contract', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateContract = async (input: UpdateContractInput) => {
    if (!selectedContractId) return;
    setIsSubmitting(true);
    try {
      await managedContractApi.updateContract(selectedContractId, input);
      showToast('Contract updated successfully', 'success');
      fetchContractDetail(selectedContractId);
      fetchStats();
    } catch (error) {
      console.error('Failed to update contract:', error);
      showToast('Failed to update contract', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (action: 'activate' | 'suspend' | 'terminate', reason?: string) => {
    if (!selectedContractId) return;
    setIsSubmitting(true);
    try {
      if (action === 'activate') {
        await managedContractApi.activateContract(selectedContractId);
        showToast('Contract activated', 'success');
      } else if (action === 'suspend') {
        await managedContractApi.suspendContract(selectedContractId, reason);
        showToast('Contract suspended', 'success');
      } else if (action === 'terminate') {
        if (!reason) {
          showToast('Termination reason is required', 'error');
          setIsSubmitting(false);
          return;
        }
        await managedContractApi.terminateContract(selectedContractId, reason);
        showToast('Contract terminated', 'success');
      }
      setShowStatusModal(false);
      fetchContractDetail(selectedContractId);
      fetchContracts();
      fetchStats();
    } catch (error) {
      console.error('Failed to change status:', error);
      showToast('Failed to change contract status', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTeamMember = async (input: AddTeamMemberInput) => {
    if (!selectedContractId) return;
    setIsSubmitting(true);
    try {
      await managedContractApi.addTeamMember(selectedContractId, input);
      showToast('Team member added', 'success');
      setShowTeamModal(false);
      fetchContractDetail(selectedContractId);
    } catch (error) {
      console.error('Failed to add team member:', error);
      showToast('Failed to add team member', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveTeamMember = async (email: string) => {
    if (!selectedContractId) return;
    try {
      await managedContractApi.removeTeamMember(selectedContractId, email);
      showToast('Team member removed', 'success');
      fetchContractDetail(selectedContractId);
    } catch (error) {
      console.error('Failed to remove team member:', error);
      showToast('Failed to remove team member', 'error');
    }
  };

  const handleSetPrimaryContact = async (email: string) => {
    if (!selectedContractId) return;
    try {
      await managedContractApi.setPrimaryContact(selectedContractId, email);
      showToast('Primary contact set', 'success');
      fetchContractDetail(selectedContractId);
    } catch (error) {
      console.error('Failed to set primary contact:', error);
      showToast('Failed to set primary contact', 'error');
    }
  };

  const handleCalculateSLA = async () => {
    if (!selectedContractId) return;
    try {
      const response = await managedContractApi.calculateSLACompliance(selectedContractId);
      showToast(`SLA Compliance: ${response.data.complianceRate}%`, 'success');
      fetchContractDetail(selectedContractId);
    } catch (error) {
      console.error('Failed to calculate SLA:', error);
      showToast('Failed to calculate SLA compliance', 'error');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedContractId) return;
    try {
      const response = await managedContractApi.generateReport(selectedContractId);
      setGeneratedReport(response.data);
      showToast('Report generated', 'success');
      setShowReportModal(true);
    } catch (error) {
      console.error('Failed to generate report:', error);
      showToast('Failed to generate report', 'error');
    }
  };

  // ============================================
  // Render Methods
  // ============================================

  const renderStatCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Contracts"
        value={stats?.totalContracts || 0}
        icon={<BuildingIcon />}
      />
      <StatCard
        label="Active"
        value={stats?.activeContracts || 0}
        icon={<CheckIcon />}
        color="green"
      />
      <StatCard
        label="Total Revenue"
        value={formatCurrency(stats?.totalRevenue || 0)}
        icon={<ChartIcon />}
        color="blue"
      />
      <StatCard
        label="Expiring Soon"
        value={stats?.expiringContracts || 0}
        icon={<ClockIcon />}
        color="orange"
      />
    </div>
  );

  const renderFilters = () => (
    <div className="glass-nilin rounded-nilin-lg p-4 mb-6 border border-nilin-border/50">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by client name..."
            className="w-full px-4 py-2 glass-nilin rounded-nilin text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <select
          className="px-4 py-2 glass-nilin rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>

        {/* Sort */}
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={filters.sortBy || 'createdAt'}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
        >
          <option value="createdAt">Date Created</option>
          <option value="startDate">Start Date</option>
          <option value="endDate">End Date</option>
          <option value="clientName">Client Name</option>
          <option value="pricing.monthlyFee">Monthly Fee</option>
        </select>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose disabled:opacity-50 transition-all duration-200 shadow-lg shadow-nilin-coral/30"
        >
          <RefreshIcon />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );

  const renderContractList = () => (
    <div className="glass-nilin rounded-nilin-lg border border-nilin-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contract
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contacts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monthly Fee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SLA Compliance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </td>
              </tr>
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No contracts found
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr
                  key={contract._id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewContract(contract)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {contract.contractNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      Created {formatDate(contract.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {contract.clientName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {contract.clientContactName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTeamMembers(contract);
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      title="View contact list"
                    >
                      {contract.teamMembers?.length ?? 0}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(contract.status)}`}>
                      {getStatusLabel(contract.status)}
                    </span>
                    {isExpiringSoon(contract.endDate) && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                        Expiring Soon
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(contract.pricing.monthlyFee)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {getPricingModelLabel(contract.pricing.model)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {calculateContractDuration(contract.startDate, contract.endDate)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (contract.slaCompliance.totalBookings > 0
                              ? contract.slaCompliance.complianceRate
                              : 0) >= 90
                              ? 'bg-green-500'
                              : (contract.slaCompliance.totalBookings > 0
                                  ? contract.slaCompliance.complianceRate
                                  : 0) >= 70
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{
                            width: `${
                              contract.slaCompliance.totalBookings > 0
                                ? contract.slaCompliance.complianceRate
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {contract.slaCompliance.totalBookings > 0
                          ? contract.slaCompliance.complianceRate
                          : 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewContract(contract);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
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
            Showing {((filters.page ?? 1) - 1) * (filters.limit ?? 20) + 1} to{' '}
            {Math.min((filters.page ?? 1) * (filters.limit ?? 20), pagination.total)} of {pagination.total} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page ?? 1) - 1)}
              disabled={filters.page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange((filters.page ?? 1) + 1)}
              disabled={filters.page === pagination.pages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderContractDetail = () => {
    if (!selectedContract) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToList}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedContract.contractNumber}
                </h2>
                <p className="text-gray-500">{selectedContract.clientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedContract.status)}`}>
                {getStatusLabel(selectedContract.status)}
              </span>
              <button
                onClick={() => setViewMode('edit')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Contract
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-500">Monthly Fee</p>
              <p className="text-lg font-semibold">
                {formatCurrency(selectedContract.pricing.monthlyFee)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contract Period</p>
              <p className="text-lg font-semibold">
                {calculateContractDuration(selectedContract.startDate, selectedContract.endDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">SLA Priority</p>
              <p className="text-lg font-semibold">
                {getPriorityLabel(selectedContract.slaTerms.priority)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">SLA Compliance</p>
              <p className="text-lg font-semibold">
                {selectedContract.slaCompliance.totalBookings > 0
                  ? selectedContract.slaCompliance.complianceRate
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b">
            <div className="flex overflow-x-auto">
              {(['overview', 'details', 'team', 'sla', 'reports'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'details' && renderDetailsTab()}
            {activeTab === 'team' && renderTeamTab()}
            {activeTab === 'sla' && renderSLATab()}
            {activeTab === 'reports' && renderReportsTab()}
          </div>
        </div>
      </div>
    );
  };

  const renderOverviewTab = () => {
    if (!selectedContract) return null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Client Information</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Contact Name</dt>
              <dd className="font-medium">{selectedContract.clientContactName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium">{selectedContract.clientEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium">{selectedContract.clientPhone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Address</dt>
              <dd className="font-medium text-right">
                {selectedContract.clientAddress.street}<br />
                {selectedContract.clientAddress.city}, {selectedContract.clientAddress.emirate}
              </dd>
            </div>
          </dl>
        </div>

        {/* Metrics */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Contract Metrics</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Revenue</dt>
              <dd className="font-medium">{formatCurrency(selectedContract.metrics.totalRevenue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Bookings</dt>
              <dd className="font-medium">{selectedContract.metrics.totalBookings}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg Rating</dt>
              <dd className="font-medium">{selectedContract.metrics.averageRating.toFixed(1)} / 5</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Churn Risk</dt>
              <dd className={`font-medium capitalize ${
                selectedContract.metrics.churnRisk === 'high' ? 'text-red-600' :
                selectedContract.metrics.churnRisk === 'medium' ? 'text-orange-600' : 'text-green-600'
              }`}>
                {selectedContract.metrics.churnRisk}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  };

  const renderDetailsTab = () => {
    if (!selectedContract) return null;

    return (
      <div className="space-y-6">
        {/* Service Scope */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Service Scope</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Categories</dt>
                <dd className="font-medium">
                  {selectedContract.serviceScope.categories.length > 0
                    ? selectedContract.serviceScope.categories.join(', ')
                    : 'None specified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Max Monthly Services</dt>
                <dd className="font-medium">{selectedContract.serviceScope.maxMonthlyServices}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Pricing Details</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Pricing Model</dt>
                <dd className="font-medium">{getPricingModelLabel(selectedContract.pricing.model)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Monthly Fee</dt>
                <dd className="font-medium">{formatCurrency(selectedContract.pricing.monthlyFee)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Minimum Commitment</dt>
                <dd className="font-medium">{selectedContract.pricing.minimumCommitmentMonths} months</dd>
              </div>
              {selectedContract.pricing.overtimeRate && (
                <div>
                  <dt className="text-sm text-gray-500">Overtime Rate</dt>
                  <dd className="font-medium">{formatCurrency(selectedContract.pricing.overtimeRate)}/hr</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Documents */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Documents</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            {selectedContract.documents.length > 0 ? (
              <ul className="space-y-2">
                {selectedContract.documents.map((doc, index) => (
                  <li key={index} className="flex items-center justify-between p-2 bg-white rounded">
                    <div className="flex items-center gap-2">
                      <DocumentIcon />
                      <span>{doc.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{doc.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">No documents uploaded</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTeamTab = () => {
    if (!selectedContract) return null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Team Members</h3>
          <button
            onClick={() => setShowTeamModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon />
            Add Member
          </button>
        </div>

        {selectedContract.teamMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedContract.teamMembers.map((member) => (
              <div key={member.email} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{member.name}</h4>
                    {(selectedContract.primaryContactId === member.userId ||
                      selectedContract.primaryContactId === member.email) && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        Primary Contact
                      </span>
                    )}
                  </div>
                  <span className="text-sm bg-gray-200 px-2 py-0.5 rounded">
                    {getRoleLabel(member.role)}
                  </span>
                </div>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Email</dt>
                    <dd>{member.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Phone</dt>
                    <dd>{member.phone}</dd>
                  </div>
                </dl>
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  {(selectedContract.primaryContactId !== member.userId &&
                    selectedContract.primaryContactId !== member.email) && (
                    <button
                      onClick={() => handleSetPrimaryContact(member.email)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Set as Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveTeamMember(member.email)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <UsersIcon />
            <p className="mt-2">No team members assigned</p>
          </div>
        )}
      </div>
    );
  };

  const renderSLATab = () => {
    if (!selectedContract) return null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">SLA Terms & Compliance</h3>
          <button
            onClick={handleCalculateSLA}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshIcon />
            Recalculate
          </button>
        </div>

        {/* SLA Terms */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-4">SLA Terms</h4>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Response Time</dt>
              <dd className="font-medium">{selectedContract.slaTerms.responseTimeMinutes} min</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Completion Time</dt>
              <dd className="font-medium">{selectedContract.slaTerms.completionTimeHours} hrs</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Availability</dt>
              <dd className="font-medium">{selectedContract.slaTerms.availabilityPercentage}%</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Priority</dt>
              <dd className="font-medium">{getPriorityLabel(selectedContract.slaTerms.priority)}</dd>
            </div>
          </dl>
        </div>

        {/* Compliance */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-4">Compliance Score</h4>
          <div className="flex items-center gap-6 mb-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  strokeWidth="12"
                  className="stroke-gray-200"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  strokeWidth="12"
                  className={`${
                    (selectedContract.slaCompliance.totalBookings > 0
                      ? selectedContract.slaCompliance.complianceRate
                      : 0) >= 90
                      ? 'stroke-green-500'
                      : (selectedContract.slaCompliance.totalBookings > 0
                          ? selectedContract.slaCompliance.complianceRate
                          : 0) >= 70
                      ? 'stroke-yellow-500'
                      : 'stroke-red-500'
                  }`}
                  fill="none"
                  strokeDasharray={`${
                    selectedContract.slaCompliance.totalBookings > 0
                      ? selectedContract.slaCompliance.complianceRate * 3.52
                      : 0
                  } 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {selectedContract.slaCompliance.totalBookings > 0
                    ? selectedContract.slaCompliance.complianceRate
                    : 0}%
                </span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {selectedContract.slaCompliance.compliantBookings}
                </p>
                <p className="text-sm text-gray-500">Compliant</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {selectedContract.slaCompliance.totalBookings - selectedContract.slaCompliance.compliantBookings}
                </p>
                <p className="text-sm text-gray-500">Breached</p>
              </div>
            </div>
          </div>

          {/* Breach Details */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-500">Response Time Breaches</p>
              <p className="font-medium text-orange-600">
                {selectedContract.slaCompliance.responseTimeBreaches}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Completion Breaches</p>
              <p className="font-medium text-orange-600">
                {selectedContract.slaCompliance.completionTimeBreaches}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Availability Breaches</p>
              <p className="font-medium text-orange-600">
                {selectedContract.slaCompliance.availabilityBreaches}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReportsTab = () => {
    if (!selectedContract) return null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Reports</h3>
          <button
            onClick={handleGenerateReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <FileTextIcon />
            Generate Report
          </button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100">
            <ChartIcon />
            <h4 className="font-medium mt-2">Performance Report</h4>
            <p className="text-sm text-gray-500">View booking performance metrics</p>
          </button>
          <button className="bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100">
            <CalendarIcon />
            <h4 className="font-medium mt-2">SLA Report</h4>
            <p className="text-sm text-gray-500">Analyze SLA compliance history</p>
          </button>
          <button className="bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100">
            <ChartIcon />
            <h4 className="font-medium mt-2">Financial Report</h4>
            <p className="text-sm text-gray-500">Revenue and invoice details</p>
          </button>
        </div>

        {/* Status Actions */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-4">Contract Actions</h4>
          <div className="flex flex-wrap gap-3">
            {selectedContract.status === 'pending' && (
              <button
                onClick={() => handleStatusChange('activate')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Activate Contract
              </button>
            )}
            {selectedContract.status === 'active' && (
              <button
                onClick={() => setShowStatusModal(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Suspend Contract
              </button>
            )}
            {(selectedContract.status === 'active' || selectedContract.status === 'suspended') && (
              <button
                onClick={() => setShowStatusModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Terminate Contract
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Modals
  // ============================================

  const renderCreateModal = () => {
    if (!showCreateModal) return null;

    return (
      <CreateContractModal
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateContract}
        isSubmitting={isSubmitting}
      />
    );
  };

  const renderTeamModal = () => {
    if (!showTeamModal) return null;

    return (
      <AddTeamMemberModal
        onClose={() => setShowTeamModal(false)}
        onSubmit={handleAddTeamMember}
        isSubmitting={isSubmitting}
      />
    );
  };

  const renderStatusModal = () => {
    if (!showStatusModal || !selectedContract) return null;

    return (
      <StatusChangeModal
        currentStatus={selectedContract.status}
        onClose={() => setShowStatusModal(false)}
        onSubmit={handleStatusChange}
        isSubmitting={isSubmitting}
      />
    );
  };

  const renderReportModal = () => {
    if (!showReportModal || !generatedReport) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Contract Report</h2>
              <p className="text-sm text-gray-500">{generatedReport.contractNumber} - {generatedReport.clientName}</p>
            </div>
            <button
              onClick={() => setShowReportModal(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <XIcon />
            </button>
          </div>
          <div className="p-6 space-y-6">
            {/* Period */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium mb-2">Report Period</h3>
              <p className="text-sm text-gray-600">
                {formatDate(generatedReport.period.start)} - {formatDate(generatedReport.period.end)}
              </p>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="font-medium mb-4">Booking Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-2xl font-bold">{generatedReport.metrics.totalBookings}</p>
                  <p className="text-sm text-gray-500">Total Bookings</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-600">{generatedReport.metrics.completedBookings}</p>
                  <p className="text-sm text-gray-500">Completed</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-red-600">{generatedReport.metrics.cancelledBookings}</p>
                  <p className="text-sm text-gray-500">Cancelled</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(generatedReport.metrics.averageServiceValue)}
                  </p>
                  <p className="text-sm text-gray-500">Avg Value</p>
                </div>
              </div>
            </div>

            {/* SLA Compliance */}
            <div>
              <h3 className="font-medium mb-4">SLA Compliance</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Compliance Rate</span>
                  <span className={`text-lg font-bold ${
                    (generatedReport.metrics.totalBookings > 0
                      ? generatedReport.slaCompliance.complianceRate
                      : 0) >= 90
                      ? 'text-green-600'
                      : (generatedReport.metrics.totalBookings > 0
                          ? generatedReport.slaCompliance.complianceRate
                          : 0) >= 70
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {generatedReport.metrics.totalBookings > 0
                      ? generatedReport.slaCompliance.complianceRate
                      : 0}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Response Time Breaches</p>
                    <p className="font-medium text-orange-600">{generatedReport.slaCompliance.breaches.responseTime}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Completion Breaches</p>
                    <p className="font-medium text-orange-600">{generatedReport.slaCompliance.breaches.completionTime}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Availability Breaches</p>
                    <p className="font-medium text-orange-600">{generatedReport.slaCompliance.breaches.availability}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financials */}
            <div>
              <h3 className="font-medium mb-4">Financials</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Total Invoiced</dt>
                    <dd className="font-medium">{formatCurrency(generatedReport.financials.totalInvoiced)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Total Paid</dt>
                    <dd className="font-medium text-green-600">{formatCurrency(generatedReport.financials.totalPaid)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Pending Payment</dt>
                    <dd className="font-medium text-orange-600">{formatCurrency(generatedReport.financials.pendingPayment)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Team Performance */}
            {generatedReport.teamPerformance.length > 0 && (
              <div>
                <h3 className="font-medium mb-4">Team Performance</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pb-2">Team Member</th>
                        <th className="pb-2">Bookings Handled</th>
                        <th className="pb-2">Avg Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedReport.teamPerformance.map((member, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2">{member.memberName}</td>
                          <td className="py-2">{member.bookingsHandled}</td>
                          <td className="py-2">{member.averageRating.toFixed(1)} / 5</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="p-6 border-t flex justify-end">
            <button
              onClick={() => setShowReportModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="min-h-screen bg-nilin-cream">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Managed Services</h1>
            <p className="text-gray-500">Manage corporate contracts and SLA agreements</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30"
          >
            <PlusIcon />
            New Contract
          </button>
        </div>

        {/* Content */}
        {viewMode === 'list' && (
          <>
            {renderStatCards()}
            {renderFilters()}
            {renderContractList()}
          </>
        )}

        {viewMode === 'detail' && renderContractDetail()}
        {viewMode === 'edit' && selectedContract && (
          <EditContractForm
            contract={selectedContract}
            onBack={() => setViewMode('detail')}
            onSave={handleUpdateContract}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Modals */}
      {renderCreateModal()}
      {renderTeamModal()}
      {renderStatusModal()}
      {renderReportModal()}
    </div>
  );
};

// ============================================
// Sub-components
// ============================================

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'orange';
}> = ({ label, value, icon, color = 'gray' }) => {
  const colorClasses = {
    gray: 'bg-white/70 border border-nilin-border/50 text-nilin-charcoal',
    blue: 'bg-nilin-blush/40 border border-nilin-border/50 text-nilin-charcoal',
    green: 'bg-green-50/40 border border-nilin-border/50 text-nilin-charcoal',
    orange: 'bg-nilin-peach/30 border border-nilin-border/50 text-nilin-charcoal',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color === 'gray' ? 'bg-white/70' : 'bg-white/30'}`}>{icon}</div>
        <div>
          <p className="text-sm opacity-75">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
};

const CreateContractModal: React.FC<{
  onClose: () => void;
  onSubmit: (input: CreateContractInput) => void;
  isSubmitting: boolean;
}> = ({ onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState<Partial<CreateContractInput>>({
    clientName: '',
    clientContactName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: {
      street: '',
      city: '',
      emirate: '',
    },
    pricing: {
      monthlyFee: 0,
      model: 'fixed',
    },
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as CreateContractInput);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Create New Contract</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Client Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientContactName}
                  onChange={(e) => setFormData({ ...formData, clientContactName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientAddress?.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    clientAddress: { ...formData.clientAddress!, street: e.target.value }
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientAddress?.city}
                  onChange={(e) => setFormData({
                    ...formData,
                    clientAddress: { ...formData.clientAddress!, city: e.target.value }
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emirate
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.clientAddress?.emirate}
                  onChange={(e) => setFormData({
                    ...formData,
                    clientAddress: { ...formData.clientAddress!, emirate: e.target.value }
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Fee (AED) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.pricing?.monthlyFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricing: { ...formData.pricing!, monthlyFee: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Model
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.pricing?.model}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricing: { ...formData.pricing!, model: e.target.value as CreateContractInput['pricing']['model'] }
                  })}
                >
                  <option value="fixed">Fixed Monthly</option>
                  <option value="hourly">Hourly</option>
                  <option value="per_service">Per Service</option>
                  <option value="tiered">Tiered</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Notes
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              />
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddTeamMemberModal: React.FC<{
  onClose: () => void;
  onSubmit: (input: AddTeamMemberInput) => void;
  isSubmitting: boolean;
}> = ({ onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState<AddTeamMemberInput>({
    name: '',
    email: '',
    phone: '',
    role: 'technician',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Add Team Member</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as AddTeamMemberInput['role'] })}
              >
                <option value="manager">Manager</option>
                <option value="technician">Technician</option>
                <option value="coordinator">Coordinator</option>
                <option value="backup">Backup</option>
              </select>
            </div>
          </div>
          <div className="p-6 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StatusChangeModal: React.FC<{
  currentStatus: ContractStatus;
  onClose: () => void;
  onSubmit: (action: 'suspend' | 'terminate', reason?: string) => void;
  isSubmitting: boolean;
}> = ({ currentStatus, onClose, onSubmit, isSubmitting }) => {
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'suspend' | 'terminate'>('suspend');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action === 'terminate' && !reason.trim()) {
      return;
    }
    onSubmit(action, reason);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Change Contract Status</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <div className="space-y-2">
                {currentStatus === 'active' && (
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="action"
                      value="suspend"
                      checked={action === 'suspend'}
                      onChange={() => setAction('suspend')}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-orange-600">Suspend Contract</p>
                      <p className="text-sm text-gray-500">Temporarily pause the contract</p>
                    </div>
                  </label>
                )}
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="action"
                    value="terminate"
                    checked={action === 'terminate'}
                    onChange={() => setAction('terminate')}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-red-600">Terminate Contract</p>
                    <p className="text-sm text-gray-500">Permanently end the contract</p>
                  </div>
                </label>
              </div>
            </div>

            {action === 'terminate' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Termination Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Please provide a reason for termination..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="p-6 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (action === 'terminate' && !reason.trim())}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                action === 'terminate' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isSubmitting ? 'Processing...' : action === 'terminate' ? 'Terminate' : 'Suspend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditContractForm: React.FC<{
  contract: ManagedContract;
  onBack: () => void;
  onSave: (input: UpdateContractInput) => void;
  isSubmitting: boolean;
}> = ({ contract, onBack, onSave, isSubmitting }) => {
  const [formData, setFormData] = useState<UpdateContractInput>({
    clientName: contract.clientName,
    clientContactName: contract.clientContactName,
    clientEmail: contract.clientEmail,
    clientPhone: contract.clientPhone,
    clientAddress: contract.clientAddress,
    internalNotes: contract.internalNotes,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="text-xl font-bold">Edit Contract</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.clientContactName}
                onChange={(e) => setFormData({ ...formData, clientContactName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.clientEmail}
                onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.internalNotes}
              onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
            />
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManagedServicesPage;
