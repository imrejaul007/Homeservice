import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Eye,
  CreditCard,
  RefreshCw,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Invoice, invoiceApi } from '../../services/invoiceApi';

interface CorporateInvoicePortalProps {
  onPayInvoice?: (invoiceId: string) => void;
  onDownloadInvoice?: (invoiceId: string) => void;
  onDownloadAll?: () => void;
  accountBalance?: number;
}

const LIMIT = 20;

const CorporateInvoicePortal: React.FC<CorporateInvoicePortalProps> = ({
  onPayInvoice,
  onDownloadInvoice,
  onDownloadAll,
  accountBalance = 0,
}) => {
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'draft' | 'sent' | 'cancelled' | 'refunded'>('all');

  // Date range filter state (lines ~36-37)
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});

  // Pagination state (line ~178)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // UI state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch invoices with pagination and date filters (lines ~48-73)
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invoiceApi.getInvoices({
        page,
        limit: LIMIT,
        status: statusFilter === 'all' ? undefined : statusFilter as Invoice['status'],
        search: searchQuery || undefined,
        startDate: dateRange.start,
        endDate: dateRange.end,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setInvoices(response.invoices);
      setTotalPages(response.totalPages);
      setTotal(response.total);
      setHasInitialized(true);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      // Keep existing invoices on error to avoid UI flash
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, dateRange]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, dateRange]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-AE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Clock className="h-4 w-4" /> },
    paid: { bg: 'bg-green-100', text: 'text-green-700', icon: <Check className="h-4 w-4" /> },
    overdue: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="h-4 w-4" /> },
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <FileText className="h-4 w-4" /> },
    sent: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Clock className="h-4 w-4" /> },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', icon: <X className="h-4 w-4" /> },
    refunded: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <DollarSign className="h-4 w-4" /> },
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.period?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingTotal = invoices
    .filter((inv) => inv.status === 'pending')
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const overdueTotal = invoices
    .filter((inv) => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const handlePayInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPayModal(true);
  };

  const confirmPayment = () => {
    if (selectedInvoice && onPayInvoice) {
      onPayInvoice(selectedInvoice.id);
    }
    setShowPayModal(false);
    setSelectedInvoice(null);
  };

  // Wire PDF download (lines ~241-256)
  const handleDownload = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const pdfBlob = await invoiceApi.downloadInvoicePdf(invoiceId);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onDownloadInvoice) {
        onDownloadInvoice(invoiceId);
      }
    } catch (error) {
      console.error('Failed to download invoice PDF:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  // Skeleton loader for table rows
  const TableSkeleton = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
              <div>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mt-1" />
              </div>
            </div>
          </td>
          <td className="py-4 px-4"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
          <td className="py-4 px-4"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
          <td className="py-4 px-4"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
          <td className="py-4 px-4"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto" /></td>
          <td className="py-4 px-4"><div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
          <td className="py-4 px-4"><div className="h-8 w-20 bg-gray-200 rounded animate-pulse ml-auto" /></td>
        </tr>
      ))}
    </>
  );

  // Empty state component (differentiates no data vs no results)
  const EmptyState = () => {
    const hasFilters = searchQuery || statusFilter !== 'all' || dateRange.start || dateRange.end;

    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-nilin-gray font-medium">
          {hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {hasFilters
            ? 'Try adjusting your search or filter criteria'
            : 'Invoices will appear here once created'}
        </p>
        {hasFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setDateRange({});
            }}
            className="mt-4 text-sm text-nilin-coral hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  };

  // Pagination controls
  const PaginationControls = () => {
    if (totalPages <= 1 && !loading) return null;

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <div className="text-sm text-nilin-gray">
          Showing {invoices.length > 0 ? (page - 1) * LIMIT + 1 : 0} to {Math.min(page * LIMIT, total)} of {total} invoices
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(
              'p-2 rounded-lg transition',
              page === 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-gray-100 text-nilin-gray'
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition',
                    page === pageNum
                      ? 'bg-nilin-coral text-white'
                      : 'hover:bg-gray-100 text-nilin-gray'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={cn(
              'p-2 rounded-lg transition',
              page === totalPages
                ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-gray-100 text-nilin-gray'
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal">Invoice Portal</h2>
          <p className="text-nilin-gray">Manage your corporate invoices and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvoices}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Refresh"
          >
            <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </button>
          {onDownloadAll && (
            <button
              onClick={onDownloadAll}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Download className="h-5 w-5" />
              Download All
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-nilin-gray">Total Invoices</p>
          <p className="text-2xl font-bold text-nilin-charcoal">{loading ? '-' : total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-nilin-gray">Pending Payment</p>
          <p className="text-2xl font-bold text-yellow-600">{loading ? '-' : formatPrice(pendingTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-nilin-gray">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{loading ? '-' : formatPrice(overdueTotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-sm text-white/80">Account Balance</p>
          <p className="text-2xl font-bold">{formatPrice(accountBalance)}</p>
        </div>
      </div>

      {/* Filters (date range added at lines ~148-176) */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-gray" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
          />
        </div>

        {/* Date range filter inputs */}
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-nilin-gray" />
          <input
            type="date"
            value={dateRange.start || ''}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value || undefined }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none text-sm"
            placeholder="Start date"
          />
          <span className="text-nilin-gray">to</span>
          <input
            type="date"
            value={dateRange.end || ''}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value || undefined }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none text-sm"
            placeholder="End date"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'paid', 'overdue'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition capitalize',
                statusFilter === status
                  ? 'bg-nilin-coral text-white'
                  : 'bg-white border border-gray-300 text-nilin-gray hover:bg-gray-50'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-nilin-gray">Invoice</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-nilin-gray">Period</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-nilin-gray">Issue Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-nilin-gray">Due Date</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-nilin-gray">Amount</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-nilin-gray">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-nilin-gray">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !hasInitialized ? (
                <TableSkeleton />
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  const colors = statusColors[invoice.status] || statusColors.pending;
                  return (
                    <tr
                      key={invoice.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-nilin-gray" />
                          </div>
                          <div>
                            <p className="font-medium text-nilin-charcoal">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-nilin-gray">
                              {invoice.items?.length || 0} item{(invoice.items?.length || 0) > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-nilin-gray">{invoice.period || '-'}</td>
                      <td className="py-3 px-4 text-sm text-nilin-gray">{formatDate(invoice.createdAt)}</td>
                      <td className="py-3 px-4 text-sm text-nilin-gray">{formatDate(invoice.dueDate)}</td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-semibold text-nilin-charcoal">{formatPrice(invoice.totalAmount)}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                            colors.bg,
                            colors.text
                          )}
                        >
                          {colors.icon}
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedInvoice(invoice)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-nilin-gray" />
                          </button>
                          <button
                            onClick={() => handleDownload(invoice.id)}
                            disabled={downloadingId === invoice.id}
                            className={cn(
                              'p-2 hover:bg-gray-100 rounded-lg transition',
                              downloadingId === invoice.id && 'opacity-50 cursor-not-allowed'
                            )}
                            title="Download PDF"
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="h-4 w-4 text-nilin-gray animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 text-nilin-gray" />
                            )}
                          </button>
                          {invoice.status !== 'paid' && onPayInvoice && (
                            <button
                              onClick={() => handlePayInvoice(invoice)}
                              className="px-3 py-1.5 bg-nilin-coral text-white text-sm rounded-lg hover:bg-nilin-coral/90 transition"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <PaginationControls />
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && !showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-nilin-charcoal">
                Invoice {selectedInvoice.invoiceNumber}
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-nilin-gray">Issue Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-gray">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-gray">Billing Period</p>
                  <p className="font-medium">{selectedInvoice.period || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-gray">Status</p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                      (statusColors[selectedInvoice.status] || statusColors.pending).bg,
                      (statusColors[selectedInvoice.status] || statusColors.pending).text
                    )}
                  >
                    {(statusColors[selectedInvoice.status] || statusColors.pending).icon}
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-nilin-gray">Customer</p>
                  <p className="font-medium">{selectedInvoice.customerName}</p>
                  <p className="text-sm text-nilin-gray">{selectedInvoice.customerEmail}</p>
                </div>
                {selectedInvoice.providerName && (
                  <div>
                    <p className="text-xs text-nilin-gray">Provider</p>
                    <p className="font-medium">{selectedInvoice.providerName}</p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-semibold text-nilin-charcoal mb-3">Line Items</h4>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-nilin-gray">Description</th>
                      <th className="text-center py-2 text-sm font-medium text-nilin-gray">Qty</th>
                      <th className="text-right py-2 text-sm font-medium text-nilin-gray">Unit Price</th>
                      <th className="text-right py-2 text-sm font-medium text-nilin-gray">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 text-sm">{item.description}</td>
                        <td className="py-3 text-sm text-center">{item.quantity}</td>
                        <td className="py-3 text-sm text-right">{formatPrice(item.unitPrice)}</td>
                        <td className="py-3 text-sm text-right font-medium">{formatPrice(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-nilin-gray">Subtotal</span>
                    <span>{formatPrice(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-nilin-gray">Tax ({selectedInvoice.taxRate}%)</span>
                    <span>{formatPrice(selectedInvoice.taxAmount)}</span>
                  </div>
                  {selectedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-nilin-gray">Discount</span>
                      <span className="text-green-600">-{formatPrice(selectedInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-nilin-coral">{formatPrice(selectedInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              {selectedInvoice.paidAt && (
                <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Payment Received</p>
                    <p className="text-sm text-green-700">
                      Paid on {formatDate(selectedInvoice.paidAt)}
                      {selectedInvoice.paymentMethod && ` via ${selectedInvoice.paymentMethod}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleDownload(selectedInvoice.id)}
                disabled={downloadingId === selectedInvoice.id}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                {downloadingId === selectedInvoice.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                Download PDF
              </button>
              {selectedInvoice.status !== 'paid' && onPayInvoice && (
                <button
                  onClick={() => handlePayInvoice(selectedInvoice)}
                  className="flex-1 py-2.5 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-coral/90 transition flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-5 w-5" />
                  Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-nilin-charcoal">Pay Invoice</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-nilin-gray">Invoice</p>
                <p className="font-semibold text-nilin-charcoal">{selectedInvoice.invoiceNumber}</p>
                <p className="text-2xl font-bold text-nilin-coral mt-2">{formatPrice(selectedInvoice.totalAmount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Payment Method</label>
                <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none">
                  <option>Corporate Account (Balance: {formatPrice(accountBalance)})</option>
                  <option>Credit Card</option>
                  <option>Bank Transfer</option>
                </select>
              </div>

              {accountBalance < selectedInvoice.totalAmount && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Insufficient Balance</p>
                    <p className="text-sm text-red-700">
                      Your account balance is insufficient. Please add funds or use a different payment method.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedInvoice(null);
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                disabled={accountBalance < selectedInvoice.totalAmount}
                className={cn(
                  'flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2',
                  accountBalance >= selectedInvoice.totalAmount
                    ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                <Check className="h-5 w-5" />
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateInvoicePortal;
