import React, { useState } from 'react';
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
  Eye,
  CreditCard,
  RefreshCw,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: Date;
  issueDate: Date;
  period: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  paidAt?: Date;
  paymentMethod?: string;
}

interface CorporateInvoicePortalProps {
  invoices: Invoice[];
  onPayInvoice?: (invoiceId: string) => void;
  onDownloadInvoice?: (invoiceId: string) => void;
  onDownloadAll?: () => void;
  accountBalance?: number;
}

const CorporateInvoicePortal: React.FC<CorporateInvoicePortalProps> = ({
  invoices,
  onPayInvoice,
  onDownloadInvoice,
  onDownloadAll,
  accountBalance = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date) => {
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
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.period.toLowerCase().includes(searchQuery.toLowerCase());
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
      onPayInvoice(selectedInvoice.invoiceId);
    }
    setShowPayModal(false);
    setSelectedInvoice(null);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal">Invoice Portal</h2>
          <p className="text-nilin-gray">Manage your corporate invoices and payments</p>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-nilin-gray">Total Invoices</p>
          <p className="text-2xl font-bold text-nilin-charcoal">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-nilin-gray">Pending Payment</p>
          <p className="text-2xl font-bold text-yellow-600">{formatPrice(pendingTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-nilin-gray">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{formatPrice(overdueTotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-sm text-white/80">Account Balance</p>
          <p className="text-2xl font-bold">{formatPrice(accountBalance)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
        <div className="flex gap-2">
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
              {filteredInvoices.map((invoice) => {
                const colors = statusColors[invoice.status];
                return (
                  <tr
                    key={invoice.invoiceId}
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
                            {invoice.items.length} item{invoice.items.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-nilin-gray">{invoice.period}</td>
                    <td className="py-3 px-4 text-sm text-nilin-gray">{formatDate(invoice.issueDate)}</td>
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
                        {onDownloadInvoice && (
                          <button
                            onClick={() => onDownloadInvoice(invoice.invoiceId)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4 text-nilin-gray" />
                          </button>
                        )}
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
              })}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-nilin-gray">No invoices found</p>
          </div>
        )}
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
                  <p className="font-medium">{formatDate(selectedInvoice.issueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-gray">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-gray">Billing Period</p>
                  <p className="font-medium">{selectedInvoice.period}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-gray">Status</p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                      statusColors[selectedInvoice.status].bg,
                      statusColors[selectedInvoice.status].text
                    )}
                  >
                    {statusColors[selectedInvoice.status].icon}
                    {selectedInvoice.status}
                  </span>
                </div>
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
                    {selectedInvoice.items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 text-sm">{item.description}</td>
                        <td className="py-3 text-sm text-center">{item.quantity}</td>
                        <td className="py-3 text-sm text-right">{formatPrice(item.unitPrice)}</td>
                        <td className="py-3 text-sm text-right font-medium">{formatPrice(item.amount)}</td>
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
                    <span>{formatPrice(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-nilin-gray">Tax (0%)</span>
                    <span>{formatPrice(0)}</span>
                  </div>
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
              {onDownloadInvoice && (
                <button
                  onClick={() => onDownloadInvoice(selectedInvoice.invoiceId)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download PDF
                </button>
              )}
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
