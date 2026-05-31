import React, { useState, useCallback, useEffect } from 'react';
import { Download, FileText, Loader2, CheckCircle, AlertCircle, Mail, Share2 } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { invoiceApi, Invoice as InvoiceApiType } from '../../services/invoiceApi';

// =============================================================================
// NILIN Customer Dashboard - Invoice Download Component
// PDF invoice generation and download functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  provider: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    taxId?: string;
  };
  booking: {
    id: string;
    serviceName: string;
    scheduledDate: Date;
    duration: number;
    location: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: {
    code?: string;
    amount: number;
    type: 'percentage' | 'fixed';
  };
  total: number;
  paymentMethod?: string;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  notes?: string;
  terms?: string;
}

export interface InvoiceDownloadProps {
  /** Invoice data to display/download (optional if invoiceId is provided) */
  invoice?: InvoiceData;
  /** Invoice ID to fetch from API (optional if invoice data is provided) */
  invoiceId?: string;
  /** Show preview modal */
  showPreview?: boolean;
  /** Auto-download on mount */
  autoDownload?: boolean;
  /** Callback when download starts */
  onDownloadStart?: () => void;
  /** Callback when download completes */
  onDownloadComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Additional CSS classes */
  className?: string;
}

// Helper to map API invoice to InvoiceData format
const mapApiInvoiceToInvoiceData = (apiInvoice: InvoiceApiType): InvoiceData => {
  return {
    invoiceNumber: apiInvoice.invoiceNumber,
    invoiceDate: new Date(apiInvoice.createdAt),
    dueDate: apiInvoice.dueDate ? new Date(apiInvoice.dueDate) : undefined,
    customer: {
      name: apiInvoice.customerName,
      email: apiInvoice.customerEmail,
      phone: apiInvoice.customerPhone,
      address: apiInvoice.customerAddress,
    },
    provider: {
      name: apiInvoice.providerName || 'Service Provider',
      email: '',
      phone: undefined,
      address: undefined,
      taxId: undefined,
    },
    booking: apiInvoice.bookingDetails ? {
      id: apiInvoice.bookingId || '',
      serviceName: apiInvoice.bookingDetails.serviceName,
      scheduledDate: apiInvoice.bookingDetails.scheduledDate ? new Date(apiInvoice.bookingDetails.scheduledDate) : new Date(),
      duration: 60,
      location: apiInvoice.bookingDetails.address || '',
    } : {
      id: '',
      serviceName: 'Service',
      scheduledDate: new Date(),
      duration: 60,
      location: '',
    },
    items: apiInvoice.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
    })),
    subtotal: apiInvoice.subtotal,
    taxRate: apiInvoice.taxRate,
    taxAmount: apiInvoice.taxAmount,
    total: apiInvoice.totalAmount,
    paymentStatus: apiInvoice.status === 'paid' ? 'paid' : apiInvoice.status === 'pending' || apiInvoice.status === 'sent' ? 'pending' : apiInvoice.status === 'refunded' ? 'refunded' : 'failed',
    notes: apiInvoice.notes,
    terms: apiInvoice.terms,
  };
};

type DownloadStatus = 'idle' | 'generating' | 'ready' | 'downloading' | 'complete' | 'error';

interface InvoicePreviewProps {
  invoice: InvoiceData;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice }) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-AE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-8 w-8 text-nilin-coral" />
            <h1 className="text-2xl font-bold text-nilin-charcoal">INVOICE</h1>
          </div>
          <p className="text-sm text-nilin-warmGray">
            Invoice #: {invoice.invoiceNumber}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-nilin-charcoal">
            Invoice Date
          </p>
          <p className="text-sm text-nilin-warmGray">
            {formatDate(invoice.invoiceDate)}
          </p>
          {invoice.dueDate && (
            <>
              <p className="text-sm font-medium text-nilin-charcoal mt-2">
                Due Date
              </p>
              <p className="text-sm text-nilin-warmGray">
                {formatDate(invoice.dueDate)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Customer & Provider */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-2">
            Bill To
          </p>
          <p className="font-medium text-nilin-charcoal">{invoice.customer.name}</p>
          <p className="text-sm text-nilin-warmGray">{invoice.customer.email}</p>
          {invoice.customer.phone && (
            <p className="text-sm text-nilin-warmGray">{invoice.customer.phone}</p>
          )}
          {invoice.customer.address && (
            <p className="text-sm text-nilin-warmGray mt-1">{invoice.customer.address}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-2">
            From
          </p>
          <p className="font-medium text-nilin-charcoal">{invoice.provider.name}</p>
          <p className="text-sm text-nilin-warmGray">{invoice.provider.email}</p>
          {invoice.provider.phone && (
            <p className="text-sm text-nilin-warmGray">{invoice.provider.phone}</p>
          )}
          {invoice.provider.taxId && (
            <p className="text-sm text-nilin-warmGray mt-1">Tax ID: {invoice.provider.taxId}</p>
          )}
        </div>
      </div>

      {/* Booking Info */}
      <div className="bg-nilin-blush/20 rounded-xl p-4 mb-8">
        <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-2">
          Booking Details
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-nilin-warmGray">Booking ID</p>
            <p className="text-sm font-medium text-nilin-charcoal">#{invoice.booking.id.slice(-8)}</p>
          </div>
          <div>
            <p className="text-xs text-nilin-warmGray">Service</p>
            <p className="text-sm font-medium text-nilin-charcoal">{invoice.booking.serviceName}</p>
          </div>
          <div>
            <p className="text-xs text-nilin-warmGray">Date & Time</p>
            <p className="text-sm font-medium text-nilin-charcoal">
              {formatDate(invoice.booking.scheduledDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b border-nilin-blush/50">
              <th className="text-left py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                Description
              </th>
              <th className="text-center py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                Qty
              </th>
              <th className="text-right py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                Unit Price
              </th>
              <th className="text-right py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b border-nilin-blush/30">
                <td className="py-3 text-sm text-nilin-charcoal">{item.description}</td>
                <td className="py-3 text-sm text-nilin-charcoal text-center">{item.quantity}</td>
                <td className="py-3 text-sm text-nilin-charcoal text-right">
                  {formatPrice(item.unitPrice)}
                </td>
                <td className="py-3 text-sm text-nilin-charcoal text-right">
                  {formatPrice(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span className="text-sm text-nilin-warmGray">Subtotal</span>
            <span className="text-sm text-nilin-charcoal">{formatPrice(invoice.subtotal)}</span>
          </div>

          {invoice.taxAmount !== undefined && invoice.taxAmount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-nilin-warmGray">
                Tax ({invoice.taxRate || 0}%)
              </span>
              <span className="text-sm text-nilin-charcoal">
                {formatPrice(invoice.taxAmount)}
              </span>
            </div>
          )}

          {invoice.discount && (
            <div className="flex justify-between py-2 text-green-600">
              <span className="text-sm">
                Discount {invoice.discount.code && `(${invoice.discount.code})`}
              </span>
              <span className="text-sm">
                -{formatPrice(invoice.discount.amount)}
              </span>
            </div>
          )}

          <div className="flex justify-between py-3 border-t border-nilin-blush/50 font-semibold">
            <span className="text-nilin-charcoal">Total</span>
            <span className="text-nilin-coral text-lg">{formatPrice(invoice.total)}</span>
          </div>

          <div className="flex justify-between py-2 text-sm">
            <span className="text-nilin-warmGray">Payment Status</span>
            <span className={cn(
              'font-medium',
              invoice.paymentStatus === 'paid' && 'text-green-600',
              invoice.paymentStatus === 'pending' && 'text-amber-600',
              invoice.paymentStatus === 'failed' && 'text-red-600',
              invoice.paymentStatus === 'refunded' && 'text-blue-600'
            )}>
              {invoice.paymentStatus.charAt(0).toUpperCase() + invoice.paymentStatus.slice(1)}
            </span>
          </div>

          {invoice.paymentMethod && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-nilin-warmGray">Payment Method</span>
              <span className="text-nilin-charcoal">{invoice.paymentMethod}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes & Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="border-t border-nilin-blush/30 pt-4">
          {invoice.notes && (
            <div className="mb-4">
              <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-1">
                Notes
              </p>
              <p className="text-sm text-nilin-charcoal">{invoice.notes}</p>
            </div>
          )}

          {invoice.terms && (
            <div>
              <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-1">
                Terms & Conditions
              </p>
              <p className="text-sm text-nilin-charcoal">{invoice.terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const InvoiceDownload: React.FC<InvoiceDownloadProps> = ({
  invoice: invoiceProp,
  invoiceId,
  showPreview = false,
  autoDownload = false,
  onDownloadStart,
  onDownloadComplete,
  onError,
  className,
}) => {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [showModal, setShowModal] = useState(showPreview);
  const [error, setError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | undefined>(invoiceProp);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch invoice from API if invoiceId is provided
  useEffect(() => {
    if (invoiceId && !invoiceProp) {
      const fetchInvoice = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const apiInvoice = await invoiceApi.getInvoice(invoiceId);
          const mappedInvoice = mapApiInvoiceToInvoiceData(apiInvoice);
          setInvoiceData(mappedInvoice);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load invoice';
          setError(errorMessage);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        } finally {
          setIsLoading(false);
        }
      };
      fetchInvoice();
    } else if (invoiceProp) {
      setInvoiceData(invoiceProp);
    }
  }, [invoiceId, invoiceProp, onError]);

  // Use invoiceData (from prop or API)
  const invoice = invoiceData;

  // Download PDF using API
  const handleDownload = useCallback(async () => {
    if (!invoice) return;

    try {
      setStatus('generating');
      setError(null);
      onDownloadStart?.();

      // Download PDF from API if we have invoiceId
      if (invoiceId) {
        setStatus('downloading');
        const pdfBlob = await invoiceApi.downloadInvoicePdf(invoiceId);

        // Create download link
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Fallback: Generate text-based PDF locally
        const pdfContent = `
INVOICE

Invoice #: ${invoice.invoiceNumber}
Date: ${invoice.invoiceDate.toLocaleDateString()}
${invoice.dueDate ? `Due Date: ${invoice.dueDate.toLocaleDateString()}` : ''}

BILL TO:
${invoice.customer.name}
${invoice.customer.email}
${invoice.customer.phone || ''}
${invoice.customer.address || ''}

FROM:
${invoice.provider.name}
${invoice.provider.email}
${invoice.provider.phone || ''}
${invoice.provider.taxId ? `Tax ID: ${invoice.provider.taxId}` : ''}

BOOKING DETAILS:
Booking ID: #${invoice.booking.id.slice(-8)}
Service: ${invoice.booking.serviceName}
Date: ${invoice.booking.scheduledDate.toLocaleDateString()}
Duration: ${invoice.booking.duration} minutes
Location: ${invoice.booking.location}

ITEMS:
${invoice.items.map(item =>
  `${item.description}
  Qty: ${item.quantity} | Unit: ${formatPrice(item.unitPrice)} | Total: ${formatPrice(item.total)}`
).join('\n')}

SUBTOTAL: ${formatPrice(invoice.subtotal)}
${invoice.taxAmount ? `TAX (${invoice.taxRate}%): ${formatPrice(invoice.taxAmount)}` : ''}
${invoice.discount ? `DISCOUNT: -${formatPrice(invoice.discount.amount)}` : ''}
TOTAL: ${formatPrice(invoice.total)}

Payment Status: ${invoice.paymentStatus.toUpperCase()}
${invoice.paymentMethod ? `Payment Method: ${invoice.paymentMethod}` : ''}

${invoice.notes ? `NOTES:\n${invoice.notes}` : ''}
${invoice.terms ? `\nTERMS:\n${invoice.terms}` : ''}
        `.trim();

        setStatus('downloading');
        const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setStatus('complete');
      onDownloadComplete?.();

      // Reset after delay
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download invoice';
      setError(errorMessage);
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [invoice, invoiceId, onDownloadStart, onDownloadComplete, onError]);

  // Auto-download on mount
  useEffect(() => {
    if (autoDownload && invoice && !isLoading) {
      handleDownload();
    }
  }, [autoDownload, invoice, isLoading, handleDownload]);

  // Auto-download on mount
  React.useEffect(() => {
    if (autoDownload) {
      handleDownload();
    }
  }, [autoDownload]);

  // Share invoice via email
  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(`Invoice #${invoice.invoiceNumber}`);
    const body = encodeURIComponent(`
Dear ${invoice.customer.name},

Please find attached your invoice #${invoice.invoiceNumber} for ${invoice.booking.serviceName}.

Total Amount: ${formatPrice(invoice.total)}
Payment Status: ${invoice.paymentStatus}

Thank you for your business!

Best regards,
${invoice.provider.name}
    `.trim());

    window.open(`mailto:${invoice.customer.email}?subject=${subject}&body=${body}`);
  }, [invoice]);

  // Share invoice
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${invoice.invoiceNumber}`,
          text: `Invoice for ${invoice.booking.serviceName} - ${formatPrice(invoice.total)}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    }
  }, [invoice]);

  return (
    <>
      <div className={cn('flex flex-wrap gap-3', className)}>
        {/* Download Button */}
        <Button
          variant="primary"
          leftIcon={
            status === 'generating' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === 'complete' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )
          }
          onClick={handleDownload}
          loading={status === 'generating' || status === 'downloading'}
          disabled={status === 'generating' || status === 'downloading'}
        >
          {status === 'complete'
            ? 'Downloaded'
            : status === 'generating'
            ? 'Generating...'
            : status === 'downloading'
            ? 'Downloading...'
            : 'Download Invoice'}
        </Button>

        {/* Preview Button */}
        <Button
          variant="secondary"
          leftIcon={<FileText className="h-4 w-4" />}
          onClick={() => setShowModal(true)}
        >
          Preview
        </Button>

        {/* Email Button */}
        <Button
          variant="ghost"
          leftIcon={<Mail className="h-4 w-4" />}
          onClick={handleEmail}
        >
          Email
        </Button>

        {/* Share Button */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <Button
            variant="ghost"
            leftIcon={<Share2 className="h-4 w-4" />}
            onClick={handleShare}
          >
            Share
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title="Invoice Preview"
        size="lg"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <InvoicePreview invoice={invoice} />
        </div>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => {
              handleDownload();
              setShowModal(false);
            }}
          >
            Download PDF
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default InvoiceDownload;
