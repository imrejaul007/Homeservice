
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  FileText,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  PieChart,
  BarChart3,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ExternalLink,
  Building2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { earningsApi, type EarningsReport, type EarningsDashboardSummary, type TaxDocument, type Commission, type PaginatedResponse } from '../../services/earningsApi';

// Time period type
type Period = 'week' | 'month' | 'quarter' | 'year';
type TabType = 'overview' | 'commissions' | 'tax-documents' | 'reports';
const VALID_TABS: TabType[] = ['overview', 'commissions', 'tax-documents', 'reports'];

// Format currency
const formatCurrency = (amount: number, currency: string = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format percentage
const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const EarningsReport: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Memoized initial tab from URL params - only computed once
  const initialTab = useMemo<TabType>(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.includes(tab as TabType)) {
      return tab as TabType;
    }
    return 'overview';
  }, [searchParams]);

  // State
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [period, setPeriod] = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Individual fetch status tracking for partial failure handling
  const [fetchStatus, setFetchStatus] = useState<{
    dashboard: 'idle' | 'loading' | 'success' | 'error';
    commissions: 'idle' | 'loading' | 'success' | 'error';
    taxDocuments: 'idle' | 'loading' | 'success' | 'error';
    reports: 'idle' | 'loading' | 'success' | 'error';
  }>({
    dashboard: 'idle',
    commissions: 'idle',
    taxDocuments: 'idle',
    reports: 'idle',
  });

  // Data state
  const [dashboardSummary, setDashboardSummary] = useState<EarningsDashboardSummary | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [taxDocuments, setTaxDocuments] = useState<TaxDocument[]>([]);
  const [earningsReports, setEarningsReports] = useState<EarningsReport[]>([]);

  // Pagination
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionTotalPages, setCommissionTotalPages] = useState(1);
  const [taxDocPage, setTaxDocPage] = useState(1);
  const [taxDocTotalPages, setTaxDocTotalPages] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsTotalPages, setReportsTotalPages] = useState(1);

  // Filter state
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { start, end };
  });

  // Modal state
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [selectedTaxDocument, setSelectedTaxDocument] = useState<TaxDocument | null>(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showTaxDocModal, setShowTaxDocModal] = useState(false);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [reportDateRange, setReportDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard'); // FIX: Was '/dashboard'
    }
  }, [user, navigate]);

  // Fetch dashboard summary
  const fetchDashboardSummary = useCallback(async () => {
    setFetchStatus((prev) => ({ ...prev, dashboard: 'loading' }));
    try {
      const data = await earningsApi.getDashboardSummary(period);
      setDashboardSummary(data);
      setFetchStatus((prev) => ({ ...prev, dashboard: 'success' }));
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      setFetchStatus((prev) => ({ ...prev, dashboard: 'error' }));
      // Don't set global error - handled by Promise.allSettled
    }
  }, [period]);

  // Fetch commissions
  const fetchCommissions = useCallback(async (page: number = 1) => {
    setFetchStatus((prev) => ({ ...prev, commissions: 'loading' }));
    try {
      setIsLoading(true);
      const params: any = { page, limit: 10 };
      if (commissionStatusFilter !== 'all') {
        params.status = commissionStatusFilter;
      }
      if (dateRangeFilter.start) {
        params.startDate = dateRangeFilter.start.toISOString();
      }
      if (dateRangeFilter.end) {
        params.endDate = dateRangeFilter.end.toISOString();
      }

      const response: PaginatedResponse<Commission> = await earningsApi.getCommissions(params);
      setCommissions(response.items);
      setCommissionPage(response.page);
      setCommissionTotalPages(response.totalPages);
      setFetchStatus((prev) => ({ ...prev, commissions: 'success' }));
    } catch (err) {
      console.error('Error fetching commissions:', err);
      setFetchStatus((prev) => ({ ...prev, commissions: 'error' }));
      // Preserve original error message from API
      const errorMessage = err instanceof Error ? err.message : 'Failed to load commissions';
      setError(`Failed to load commissions: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [commissionStatusFilter, dateRangeFilter]);

  // Fetch tax documents
  const fetchTaxDocuments = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response: PaginatedResponse<TaxDocument> = await earningsApi.getTaxDocuments({
        page,
        limit: 10,
      });
      setTaxDocuments(response.items);
      setTaxDocPage(response.page);
      setTaxDocTotalPages(response.totalPages);
    } catch (err) {
      console.error('Error fetching tax documents:', err);
      setError('Failed to load tax documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch earnings reports
  const fetchEarningsReports = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response: PaginatedResponse<EarningsReport> = await earningsApi.getEarningsReports({
        page,
        limit: 10,
      });
      setEarningsReports(response.items);
      setReportsPage(response.page);
      setReportsTotalPages(response.totalPages);
    } catch (err) {
      console.error('Error fetching earnings reports:', err);
      setError('Failed to load earnings reports');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchDashboardSummary(),
          fetchCommissions(1),
          fetchTaxDocuments(1),
          fetchEarningsReports(1),
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchDashboardSummary, fetchCommissions, fetchTaxDocuments, fetchEarningsReports]);

  // Tab change handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchDashboardSummary(),
        fetchCommissions(commissionPage),
        fetchTaxDocuments(taxDocPage),
        fetchEarningsReports(reportsPage),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Generate report handler
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await earningsApi.generateEarningsReport(
        reportDateRange.start.toISOString(),
        reportDateRange.end.toISOString(),
        { includeTaxDocument: true }
      );
      await fetchEarningsReports(1);
      setShowGenerateReportModal(false);
      toast.success('Report generated successfully');
    } catch (err) {
      console.error('Error generating report:', err);
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to generate report. Please try again.');
      setError('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Export handler
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      toast.loading(`Exporting as ${format.toUpperCase()}...`);
      await earningsApi.downloadExport(
        dateRangeFilter.start.toISOString(),
        dateRangeFilter.end.toISOString(),
        format
      );
      toast.success(`Export downloaded as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Error exporting data:', err);
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to export data. Please try again.');
      setError('Failed to export data');
    }
  };

  // Open commission modal
  const openCommissionModal = (commission: Commission) => {
    setSelectedCommission(commission);
    setShowCommissionModal(true);
  };

  // Open tax document modal
  const openTaxDocumentModal = (doc: TaxDocument) => {
    setSelectedTaxDocument(doc);
    setShowTaxDocModal(true);
  };

  // Download tax document using API (bypasses auth interceptor properly)
  const handleDownloadTaxDocument = async (documentId: string) => {
    try {
      const blob = await earningsApi.downloadTaxDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tax_document_${documentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading tax document:', err);
      setError('Failed to download tax document');
    }
  };

  // View report details using API (bypasses auth interceptor properly)
  const handleViewReportDetails = async (reportId: string) => {
    try {
      const report = await earningsApi.getEarningsReportById(reportId);
      // Open a new window with report details as JSON or use a modal
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(`
          <html>
            <head><title>Earnings Report</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1>Earnings Report</h1>
              <pre>${JSON.stringify(report, null, 2)}</pre>
            </body>
          </html>
        `);
        reportWindow.document.close();
      }
    } catch (err) {
      console.error('Error viewing report:', err);
      setError('Failed to load report details');
    }
  };

  // Tab content rendering
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'commissions':
        return renderCommissionsTab();
      case 'tax-documents':
        return renderTaxDocumentsTab();
      case 'reports':
        return renderReportsTab();
      default:
        return null;
    }
  };

  // Overview Tab
  const renderOverviewTab = () => {
    if (!dashboardSummary) {
      return <div className="text-center py-8 text-gray-500">Loading summary...</div>;
    }

    const { current, previous, growth, topDayOfWeek, pendingPayments, nextPayout } = dashboardSummary;

    return (
      <div className="space-y-6">
        {/* Growth Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Earnings */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Gross Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(current.grossEarnings)}
                </p>
              </div>
              <div
                className={`p-3 rounded-full ${
                  growth.grossEarnings >= 0 ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                {growth.grossEarnings >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
            <p
              className={`text-sm mt-2 ${
                growth.grossEarnings >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatPercentage(growth.grossEarnings)} vs last {period}
            </p>
          </div>

          {/* Net Earnings */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Net Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(current.netEarnings)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p
              className={`text-sm mt-2 ${
                growth.netEarnings >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatPercentage(growth.netEarnings)} vs last {period}
            </p>
          </div>

          {/* Total Bookings */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{current.totalBookings}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p
              className={`text-sm mt-2 ${
                growth.totalBookings >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatPercentage(growth.totalBookings)} vs last {period}
            </p>
          </div>

          {/* Average Booking Value */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg. Booking Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(current.averageBookingValue)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-100">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p
              className={`text-sm mt-2 ${
                growth.averageBookingValue >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatPercentage(growth.averageBookingValue)} vs last {period}
            </p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Payments */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Payments</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(pendingPayments.amount)}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {pendingPayments.count} pending transactions
            </p>
          </div>

          {/* Next Payout */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-50">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Next Payout</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(nextPayout.amount)}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Scheduled for {formatDate(nextPayout.date)}
            </p>
          </div>

          {/* Top Day */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-50">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Best Day</p>
                <p className="text-xl font-bold text-gray-900">{topDayOfWeek.day}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {topDayOfWeek.count} bookings, {formatCurrency(topDayOfWeek.earnings)}
            </p>
          </div>
        </div>

        {/* Period Comparison */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Period Comparison</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Current Period</p>
              <p className="text-sm font-medium">
                {formatDate(dashboardSummary.currentPeriod.start)} -{' '}
                {formatDate(dashboardSummary.currentPeriod.end)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Previous Period</p>
              <p className="text-sm font-medium">
                {formatDate(dashboardSummary.comparisonPeriod.start)} -{' '}
                {formatDate(dashboardSummary.comparisonPeriod.end)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Commission Paid</p>
              <p className="text-sm font-medium text-red-600">
                {formatCurrency(current.totalCommission)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Completed</p>
              <p className="text-sm font-medium text-green-600">
                {current.totalBookings} bookings
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Previous Period Earnings</p>
              <p className="text-sm font-medium">
                {formatCurrency(previous.netEarnings)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Commissions Tab
  const renderCommissionsTab = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Status:</label>
              <select
                value={commissionStatusFilter}
                onChange={(e) => {
                  setCommissionStatusFilter(e.target.value);
                  fetchCommissions(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="calculated">Calculated</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={dateRangeFilter.start.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newStart = new Date(e.target.value);
                  setDateRangeFilter((prev) => {
                    // If new start date is after current end date, swap them
                    if (newStart > prev.end) {
                      return { start: prev.end, end: newStart };
                    }
                    return { ...prev, start: newStart };
                  });
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={dateRangeFilter.end.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newEnd = new Date(e.target.value);
                  setDateRangeFilter((prev) => {
                    // If new end date is before current start date, swap them
                    if (newEnd < prev.start) {
                      return { start: newEnd, end: prev.start };
                    }
                    return { ...prev, end: newEnd };
                  });
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchCommissions(1)}>
              Apply Filter
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Commission List — mobile cards */}
      <div className="md:hidden space-y-3 mb-4">
        {commissions.map((commission) => (
          <div key={commission._id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {commission.metadata?.serviceTitle || 'Service'}
                </p>
                <p className="text-xs text-gray-500">{commission.bookingNumber}</p>
              </div>
              <span className="text-sm font-semibold text-green-600 flex-shrink-0">
                {formatCurrency(commission.providerEarnings, commission.metadata?.currency)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
              <span>Amount: {formatCurrency(commission.grossAmount, commission.metadata?.currency)}</span>
              <span>Fee: -{formatCurrency(commission.commissionAmount)}</span>
              <span className="col-span-2">
                {commission.metadata?.bookingDate
                  ? formatDate(commission.metadata.bookingDate)
                  : formatDate(commission.calculatedAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openCommissionModal(commission)}
              className="min-h-[44px] w-full text-sm font-medium text-primary-600 border border-primary-200 rounded-lg"
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* Commission List — desktop table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Booking
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                  Date
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Commission
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Earnings
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commissions.map((commission) => (
                <tr key={commission._id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-3 sm:py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">
                        {commission.metadata?.serviceTitle || 'Service'}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none">{commission.bookingNumber}</p>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden sm:table-cell">
                    {commission.metadata?.bookingDate
                      ? formatDate(commission.metadata.bookingDate)
                      : formatDate(commission.calculatedAt)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(commission.grossAmount, commission.metadata?.currency)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                    <p className="text-sm text-red-600">
                      -{formatCurrency(commission.commissionAmount)}
                    </p>
                    <p className="text-xs text-gray-500">{commission.commissionRate}%</p>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-semibold text-green-600">
                    {formatCurrency(commission.providerEarnings, commission.metadata?.currency)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        commission.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : commission.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : commission.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : commission.status === 'disputed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {commission.status}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4">
                    <button
                      onClick={() => openCommissionModal(commission)}
                      className="text-primary-600 hover:text-primary-800 text-xs sm:text-sm font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-gray-500">
            Page {commissionPage} of {commissionTotalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={commissionPage <= 1}
              onClick={() => fetchCommissions(commissionPage - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={commissionPage >= commissionTotalPages}
              onClick={() => fetchCommissions(commissionPage + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Tax Documents Tab
  const renderTaxDocumentsTab = () => (
    <div className="space-y-4">
      {/* Tax Documents List — mobile cards */}
      <div className="md:hidden space-y-3 mb-4">
        {taxDocuments.map((doc) => (
          <div key={doc._id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-900 mb-1">{doc.documentNumber}</p>
            <p className="text-xs text-gray-500 mb-2 capitalize">{doc.type.replace('_', ' ')}</p>
            <p className="text-xs text-gray-600 mb-2">
              {formatDate(doc.period.start)} – {formatDate(doc.period.end)}
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-3">
              {formatCurrency(doc.subtotal, doc.currency)}
            </p>
            <button
              type="button"
              onClick={() => handleDownloadTaxDocument(doc._id)}
              className="min-h-[44px] w-full text-sm font-medium text-primary-600 border border-primary-200 rounded-lg"
            >
              Download
            </button>
          </div>
        ))}
      </div>

      {/* Tax Documents List — desktop table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Document
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                  Type
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Amount
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Tax
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {taxDocuments.map((doc) => (
                <tr key={doc._id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-3 sm:py-4">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-none">{doc.documentNumber}</p>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {doc.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">
                    {formatDate(doc.period.start)} - {formatDate(doc.period.end)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium text-gray-900 hidden md:table-cell">
                    {formatCurrency(doc.subtotal, doc.currency)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden lg:table-cell">
                    {formatCurrency(doc.totalTax, doc.currency)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doc.status === 'issued'
                          ? 'bg-green-100 text-green-800'
                          : doc.status === 'paid'
                            ? 'bg-blue-100 text-blue-800'
                            : doc.status === 'draft'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openTaxDocumentModal(doc)}
                        className="text-primary-600 hover:text-primary-800 text-xs sm:text-sm font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDownloadTaxDocument(doc._id)}
                        className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium p-1"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-gray-500">
            Page {taxDocPage} of {taxDocTotalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={taxDocPage <= 1}
              onClick={() => fetchTaxDocuments(taxDocPage - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={taxDocPage >= taxDocTotalPages}
              onClick={() => fetchTaxDocuments(taxDocPage + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Reports Tab
  const renderReportsTab = () => (
    <div className="space-y-4">
      {/* Generate Report Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowGenerateReportModal(true)}>
          <FileText className="w-4 h-4 mr-2" />
          Generate New Report
        </Button>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Report ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bookings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Commission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {earningsReports.map((report) => (
                <tr key={report._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {report._id.substring(report._id.length - 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Generated {formatDate(report.generatedAt)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(report.period.start)} - {formatDate(report.period.end)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">
                    {formatCurrency(report.totalProviderEarnings)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{report.totalBookings}</td>
                  <td className="px-6 py-4 text-sm text-red-600">
                    {formatCurrency(report.totalCommission)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        report.status === 'sent'
                          ? 'bg-green-100 text-green-800'
                          : report.status === 'generated'
                            ? 'bg-blue-100 text-blue-800'
                            : report.status === 'archived'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleViewReportDetails(report._id)}
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {reportsPage} of {reportsTotalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={reportsPage <= 1}
              onClick={() => fetchEarningsReports(reportsPage - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={reportsPage >= reportsTotalPages}
              onClick={() => fetchEarningsReports(reportsPage + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/provider/dashboard' },
            { label: 'Earnings & Reports', href: '/provider/earnings-report' },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Earnings & Reports</h1>
            <p className="text-gray-500 mt-1">
              Track your earnings, commissions, and download tax documents
            </p>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" role="tablist">
            {[
              { id: 'overview', label: 'Overview', icon: PieChart },
              { id: 'commissions', label: 'Commissions', icon: DollarSign },
              { id: 'tax-documents', label: 'Tax Documents', icon: Receipt },
              { id: 'reports', label: 'Reports', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-content`}
                id={`${tab.id}-tab`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => handleTabChange(tab.id as TabType)}
                onKeyDown={(e) => {
                  const tabs = ['overview', 'commissions', 'tax-documents', 'reports'];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
                    e.preventDefault();
                    handleTabChange(tabs[currentIndex + 1] as TabType);
                    document.getElementById(`${tabs[currentIndex + 1]}-tab`)?.focus();
                  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    handleTabChange(tabs[currentIndex - 1] as TabType);
                    document.getElementById(`${tabs[currentIndex - 1]}-tab`)?.focus();
                  }
                }}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon
                  className={`-ml-0.5 mr-2 h-5 w-5 ${
                    activeTab === tab.id ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tab Content */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>

      {/* Commission Detail Modal */}
      {showCommissionModal && selectedCommission && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCommissionModal(false)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="commission-modal-title"
              className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 id="commission-modal-title" className="text-xl font-bold text-gray-900">Commission Details</h2>
                  <p className="text-sm text-gray-500">{selectedCommission.bookingNumber}</p>
                </div>
                <button
                  onClick={() => setShowCommissionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Service</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedCommission.metadata?.serviceTitle || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Category</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedCommission.metadata?.categoryName || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Amount</span>
                    <span className="font-medium">
                      {formatCurrency(selectedCommission.grossAmount, selectedCommission.metadata?.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(selectedCommission.discountAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Amount</span>
                    <span className="font-medium">
                      {formatCurrency(selectedCommission.netAmount, selectedCommission.metadata?.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-gray-600">Commission ({selectedCommission.commissionRate}%)</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(selectedCommission.commissionAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform Fee</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(selectedCommission.platformFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing Fee</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(selectedCommission.paymentProcessingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-lg font-semibold text-gray-900">Your Earnings</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedCommission.providerEarnings, selectedCommission.metadata?.currency)}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Commission Rule</span>
                    <span className="text-sm font-medium">{selectedCommission.ruleName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedCommission.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : selectedCommission.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : selectedCommission.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {selectedCommission.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={() => setShowCommissionModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tax Document Modal */}
      {showTaxDocModal && selectedTaxDocument && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowTaxDocModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedTaxDocument.type.replace('_', ' ').toUpperCase()}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedTaxDocument.documentNumber}</p>
                </div>
                <button
                  onClick={() => setShowTaxDocModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Provider Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Provider Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="font-medium">{selectedTaxDocument.providerDetails.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{selectedTaxDocument.providerDetails.email}</p>
                  </div>
                  {selectedTaxDocument.providerDetails.taxRegistrationNumber && (
                    <div>
                      <p className="text-gray-500">Tax Registration</p>
                      <p className="font-medium">
                        {selectedTaxDocument.providerDetails.taxRegistrationNumber}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Tax
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedTaxDocument.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{item.description}</td>
                          <td className="px-4 py-2 text-right">
                            {formatCurrency(item.amount, selectedTaxDocument.currency)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatCurrency(item.taxAmount, selectedTaxDocument.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(selectedTaxDocument.subtotal, selectedTaxDocument.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Tax</span>
                  <span className="font-medium">
                    {formatCurrency(selectedTaxDocument.totalTax, selectedTaxDocument.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-lg font-semibold">Total Amount</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(selectedTaxDocument.totalAmount, selectedTaxDocument.currency)}
                  </span>
                </div>
              </div>

              {/* Tax Breakdown */}
              {selectedTaxDocument.taxBreakdown.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Tax Breakdown</h4>
                  {selectedTaxDocument.taxBreakdown.map((tb, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-blue-700">
                        {tb.type.toUpperCase()} ({tb.rate}%)
                      </span>
                      <span className="text-blue-900 font-medium">
                        {formatCurrency(tb.taxAmount, selectedTaxDocument.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadTaxDocument(selectedTaxDocument._id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => setShowTaxDocModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateReportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowGenerateReportModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-gray-900">Generate Earnings Report</h2>
                <button
                  onClick={() => setShowGenerateReportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={reportDateRange.start.toISOString().split('T')[0]}
                    onChange={(e) =>
                      setReportDateRange((prev) => ({
                        ...prev,
                        start: new Date(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={reportDateRange.end.toISOString().split('T')[0]}
                    onChange={(e) =>
                      setReportDateRange((prev) => ({
                        ...prev,
                        end: new Date(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  The report will include all earnings and may generate a tax document for the selected
                  period.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowGenerateReportModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateReport} disabled={isGeneratingReport}>
                  {isGeneratingReport ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default EarningsReport;
