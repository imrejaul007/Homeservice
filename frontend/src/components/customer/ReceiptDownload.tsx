import React, { useState, useCallback } from 'react';
import { Download, Receipt, Loader2, CheckCircle, AlertCircle, Mail, Share2, Printer } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

// =============================================================================
// NILIN Customer Dashboard - Receipt Download Component
// Receipt download functionality for completed bookings
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface ReceiptData {
  receiptNumber: string;
  receiptDate: Date;
  transactionId: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  provider: {
    name: string;
    businessName?: string;
  };
  service: {
    name: string;
    description?: string;
    date: Date;
    duration: number;
    location: string;
  };
  amount: number;
  paymentMethod: string;
  cardLast4?: string;
  paymentStatus: 'completed' | 'pending' | 'failed' | 'refunded';
  bookingId: string;
 感谢Message?: string;
}

export interface ReceiptDownloadProps {
  /** Receipt data to display/download */
  receipt: ReceiptData;
  /** Show preview modal */
  showPreview?: boolean;
  /** Callback when download starts */
  onDownloadStart?: () => void;
  /** Callback when download completes */
  onDownloadComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Additional CSS classes */
  className?: string;
}

type DownloadStatus = 'idle' | 'generating' | 'ready' | 'downloading' | 'complete' | 'error';

interface ReceiptPreviewProps {
  receipt: ReceiptData;
}

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ receipt }) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-AE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white max-w-md mx-auto overflow-hidden">
      {/* Header Pattern */}
      <div className="bg-gradient-to-br from-nilin-coral to-rose-500 p-6 text-white text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
          <CheckCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold mb-1">Payment Successful</h2>
        <p className="text-white/80 text-sm">Thank you for your payment!</p>
      </div>

      {/* Receipt Content */}
      <div className="p-6">
        {/* Receipt Number & Date */}
        <div className="text-center mb-6 pb-6 border-b border-dashed border-nilin-blush">
          <p className="text-xs text-nilin-warmGray uppercase tracking-wider mb-1">
            Receipt Number
          </p>
          <p className="text-lg font-bold text-nilin-charcoal">
            #{receipt.receiptNumber}
          </p>
          <p className="text-sm text-nilin-warmGray mt-2">
            {formatDate(receipt.receiptDate)}
          </p>
        </div>

        {/* Transaction Info */}
        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-sm text-nilin-warmGray">Transaction ID</span>
            <span className="text-sm font-medium text-nilin-charcoal">
              #{receipt.transactionId.slice(-12)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-nilin-warmGray">Status</span>
            <span className={cn(
              'text-sm font-medium px-2 py-0.5 rounded-full',
              receipt.paymentStatus === 'completed' && 'bg-green-100 text-green-700',
              receipt.paymentStatus === 'pending' && 'bg-amber-100 text-amber-700',
              receipt.paymentStatus === 'failed' && 'bg-red-100 text-red-700',
              receipt.paymentStatus === 'refunded' && 'bg-blue-100 text-blue-700'
            )}>
              {receipt.paymentStatus.charAt(0).toUpperCase() + receipt.paymentStatus.slice(1)}
            </span>
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-nilin-blush/20 rounded-xl p-4 mb-6">
          <h3 className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-3">
            Service Details
          </h3>

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-nilin-charcoal">
                {receipt.service.name}
              </p>
              {receipt.service.description && (
                <p className="text-sm text-nilin-warmGray mt-0.5">
                  {receipt.service.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-nilin-blush/30">
              <div>
                <p className="text-xs text-nilin-warmGray">Date</p>
                <p className="text-sm font-medium text-nilin-charcoal">
                  {formatDate(receipt.service.date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-nilin-warmGray">Time</p>
                <p className="text-sm font-medium text-nilin-charcoal">
                  {formatTime(receipt.service.date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-nilin-warmGray">Duration</p>
                <p className="text-sm font-medium text-nilin-charcoal">
                  {receipt.service.duration} min
                </p>
              </div>
              <div>
                <p className="text-xs text-nilin-warmGray">Booking ID</p>
                <p className="text-sm font-medium text-nilin-charcoal">
                  #{receipt.bookingId.slice(-8)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-nilin-blush/30">
              <p className="text-xs text-nilin-warmGray mb-1">Location</p>
              <p className="text-sm text-nilin-charcoal">
                {receipt.service.location}
              </p>
            </div>
          </div>
        </div>

        {/* Provider Info */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-2">
            Service Provider
          </h3>
          <p className="font-medium text-nilin-charcoal">
            {receipt.provider.businessName || receipt.provider.name}
          </p>
          {receipt.provider.businessName && (
            <p className="text-sm text-nilin-warmGray">{receipt.provider.name}</p>
          )}
        </div>

        {/* Payment Summary */}
        <div className="border-t-2 border-nilin-blush pt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-nilin-warmGray">Amount Paid</span>
            <span className="text-2xl font-bold text-nilin-coral">
              {formatPrice(receipt.amount)}
            </span>
          </div>

          <div className="flex justify-between mt-4">
            <span className="text-sm text-nilin-warmGray">Payment Method</span>
            <span className="text-sm font-medium text-nilin-charcoal">
              {receipt.paymentMethod}
              {receipt.cardLast4 && ` •••• ${receipt.cardLast4}`}
            </span>
          </div>
        </div>

        {/* Thank You Message */}
        {receipt.感谢Message && (
          <div className="mt-6 p-4 bg-gradient-to-r from-nilin-blush/30 to-nilin-peach/30 rounded-xl text-center">
            <p className="text-sm text-nilin-charcoal italic">
              "{receipt.感谢Message}"
            </p>
          </div>
        )}

        {/* Customer Info */}
        <div className="mt-6 pt-4 border-t border-dashed border-nilin-blush">
          <p className="text-xs text-nilin-warmGray">Issued to</p>
          <p className="text-sm font-medium text-nilin-charcoal">{receipt.customer.name}</p>
          <p className="text-xs text-nilin-warmGray">{receipt.customer.email}</p>
          {receipt.customer.phone && (
            <p className="text-xs text-nilin-warmGray">{receipt.customer.phone}</p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-nilin-warmGray">
            This is an electronically generated receipt.
          </p>
          <p className="text-xs text-nilin-warmGray mt-1">
            No signature required.
          </p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ReceiptDownload: React.FC<ReceiptDownloadProps> = ({
  receipt,
  showPreview = false,
  onDownloadStart,
  onDownloadComplete,
  onError,
  className,
}) => {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [showModal, setShowModal] = useState(showPreview);
  const [error, setError] = useState<string | null>(null);

  // Generate receipt (simulated)
  const generateReceipt = useCallback(async (): Promise<Blob> => {
    // In production, use a PDF library or backend API
    const receiptContent = `
RECEIPT

Receipt #: ${receipt.receiptNumber}
Date: ${receipt.receiptDate.toLocaleDateString()}
Transaction ID: #${receipt.transactionId.slice(-12)}

PAYMENT STATUS: ${receipt.paymentStatus.toUpperCase()}

SERVICE DETAILS:
Service: ${receipt.service.name}
${receipt.service.description ? `Description: ${receipt.service.description}` : ''}
Date: ${receipt.service.date.toLocaleDateString()}
Time: ${receipt.service.date.toLocaleTimeString()}
Duration: ${receipt.service.duration} minutes
Location: ${receipt.service.location}
Booking ID: #${receipt.bookingId.slice(-8)}

SERVICE PROVIDER:
${receipt.provider.businessName || receipt.provider.name}
${receipt.provider.businessName ? `Contact: ${receipt.provider.name}` : ''}

AMOUNT PAID: ${formatPrice(receipt.amount)}

PAYMENT METHOD: ${receipt.paymentMethod}
${receipt.cardLast4 ? `Card: •••• ${receipt.cardLast4}` : ''}

${receipt.感谢Message ? `Thank you message: "${receipt.感谢Message}"` : ''}

ISSUED TO:
${receipt.customer.name}
${receipt.customer.email}
${receipt.customer.phone || ''}

---
This is an electronically generated receipt.
No signature required.
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    return blob;
  }, [receipt]);

  // Download receipt
  const handleDownload = useCallback(async () => {
    try {
      setStatus('generating');
      setError(null);
      onDownloadStart?.();

      const blob = await generateReceipt();
      setStatus('downloading');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receipt.receiptNumber}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('complete');
      onDownloadComplete?.();

      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate receipt';
      setError(errorMessage);
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [generateReceipt, receipt.receiptNumber, onDownloadStart, onDownloadComplete, onError]);

  // Print receipt
  const handlePrint = useCallback(() => {
    setShowModal(true);
    setTimeout(() => {
      window.print();
    }, 300);
  }, []);

  // Email receipt
  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(`Payment Receipt #${receipt.receiptNumber}`);
    const body = encodeURIComponent(`
Dear ${receipt.customer.name},

Thank you for your payment!

Receipt Details:
- Receipt #: ${receipt.receiptNumber}
- Service: ${receipt.service.name}
- Amount: ${formatPrice(receipt.amount)}
- Date: ${receipt.receiptDate.toLocaleDateString()}
- Transaction ID: #${receipt.transactionId.slice(-12)}

${receipt.感谢Message ? `\n"${receipt.感谢Message}"\n` : ''}
Thank you for choosing our services!

Best regards,
${receipt.provider.businessName || receipt.provider.name}
    `.trim());

    window.open(`mailto:${receipt.customer.email}?subject=${subject}&body=${body}`);
  }, [receipt]);

  // Share receipt
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt #${receipt.receiptNumber}`,
          text: `Payment receipt for ${receipt.service.name} - ${formatPrice(receipt.amount)}`,
        });
      } catch {
        // User cancelled
      }
    }
  }, [receipt]);

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
            : 'Download Receipt'}
        </Button>

        {/* Preview Button */}
        <Button
          variant="secondary"
          leftIcon={<Receipt className="h-4 w-4" />}
          onClick={() => setShowModal(true)}
        >
          Preview
        </Button>

        {/* Print Button */}
        <Button
          variant="ghost"
          leftIcon={<Printer className="h-4 w-4" />}
          onClick={handlePrint}
        >
          Print
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
        title="Receipt Preview"
        size="md"
      >
        <div className="max-h-[70vh] overflow-y-auto -mx-6">
          <ReceiptPreview receipt={receipt} />
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
            Download
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default ReceiptDownload;
