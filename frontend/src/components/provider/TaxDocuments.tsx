/**
 * TaxDocuments - Tax document download (1099/W-9)
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  Mail,
  Share2,
  Search,
  Filter,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type TaxDocumentType = '1099' | 'W9' | '1096' | 'K1' | 'invoice' | 'statement';

export type TaxDocumentStatus = 'available' | 'processing' | 'unavailable';

export interface TaxDocument {
  /** Unique document ID */
  id: string;
  /** Document title */
  title: string;
  /** Document type */
  type: TaxDocumentType;
  /** Tax year */
  year: number;
  /** Document period (e.g., "Q4 2024" or "Full Year 2024") */
  period: string;
  /** Document status */
  status: TaxDocumentStatus;
  /** Download URL */
  downloadUrl?: string;
  /** Email date */
  emailDate?: string;
  /** Amount (for 1099) */
  amount?: number;
  /** Currency */
  currency?: string;
  /** File size */
  fileSize?: string;
  /** File format */
  fileFormat?: string;
  /** Created date */
  createdAt: string;
  /** Whether it has been downloaded */
  isDownloaded?: boolean;
}

export interface TaxDocumentsProps {
  /** Available tax documents */
  documents: TaxDocument[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when document is downloaded */
  onDownload: (documentId: string) => Promise<void>;
  /** Callback when document is emailed */
  onEmailDocument?: (documentId: string) => Promise<void>;
  /** Callback when viewing document details */
  onViewDetails?: (document: TaxDocument) => void;
  /** Tax year filter */
  selectedYear?: number;
  /** Available years for filtering */
  availableYears?: number[];
  /** Custom className */
  className?: string;
}

// =============================================================================
// Document Type Labels
// =============================================================================

const documentTypeLabels: Record<TaxDocumentType, { label: string; description: string; icon: React.ElementType }> = {
  '1099': {
    label: '1099-NEC / 1099-MISC',
    description: 'Non-employee compensation or miscellaneous income',
    icon: FileText,
  },
  'W9': {
    label: 'W-9 Form',
    description: 'Request for taxpayer identification number',
    icon: FileText,
  },
  '1096': {
    label: '1096 Summary',
    description: 'Annual summary of information returns',
    icon: FileText,
  },
  'K1': {
    label: 'K-1 Form',
    description: 'Partner/shareholder income report',
    icon: FileText,
  },
  'invoice': {
    label: 'Annual Invoice',
    description: 'Summary of all transactions for the year',
    icon: FileText,
  },
  'statement': {
    label: 'Earnings Statement',
    description: 'Detailed breakdown of earnings',
    icon: FileText,
  },
};

// =============================================================================
// Document Card Component
// =============================================================================

interface DocumentCardProps {
  document: TaxDocument;
  onDownload: () => Promise<void>;
  onEmailDocument?: () => Promise<void>;
  onViewDetails?: () => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onDownload,
  onEmailDocument,
  onViewDetails,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  const typeInfo = documentTypeLabels[document.type];
  const TypeIcon = typeInfo?.icon || FileText;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (amount?: number, currency = 'AED') => {
    if (amount === undefined) return null;
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEmail = async () => {
    if (!onEmailDocument) return;
    setIsEmailing(true);
    try {
      await onEmailDocument();
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-nilin-sm overflow-hidden transition-all',
        document.status === 'available'
          ? 'border-nilin-border hover:shadow-nilin-md'
          : 'border-gray-200 opacity-75'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {/* Document Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                document.status === 'available'
                  ? 'bg-nilin-coral/10'
                  : 'bg-gray-100'
              )}
            >
              <TypeIcon
                className={cn(
                  'w-6 h-6',
                  document.status === 'available' ? 'text-nilin-coral' : 'text-gray-400'
                )}
              />
            </div>

            <div>
              <h4 className="font-semibold text-nilin-charcoal">{document.title}</h4>
              <p className="text-sm text-nilin-warmGray">{typeInfo?.label}</p>
              <p className="text-xs text-nilin-lightGray mt-1">{document.period}</p>
            </div>
          </div>

          {/* Status Badge */}
          <StatusBadge status={document.status} />
        </div>

        {/* Amount (for 1099) */}
        {document.amount !== undefined && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg mb-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-green-600 font-medium">Total Earnings</p>
              <p className="text-lg font-bold text-green-700">
                {formatPrice(document.amount, document.currency)}
              </p>
            </div>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(document.createdAt)}
          </span>
          {document.fileSize && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {document.fileSize}
            </span>
          )}
          {document.fileFormat && (
            <span className="px-2 py-0.5 bg-nilin-muted rounded text-nilin-charcoal">
              {document.fileFormat}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {document.status === 'available' && (
        <div className="px-4 py-3 bg-nilin-muted/50 border-t border-nilin-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {document.isDownloaded && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" />
                Downloaded
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onEmailDocument && (
              <button
                onClick={handleEmail}
                disabled={isEmailing}
                className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                title="Email document"
              >
                {isEmailing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={isDownloading || !document.downloadUrl}
              className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Status Badge Component
// =============================================================================

interface StatusBadgeProps {
  status: TaxDocumentStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = {
    available: { label: 'Available', color: 'text-green-600', bgColor: 'bg-green-100' },
    processing: { label: 'Processing', color: 'text-amber-600', bgColor: 'bg-amber-100' },
    unavailable: { label: 'Unavailable', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  };

  const { label, color, bgColor } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
        bgColor,
        color
      )}
    >
      {status === 'processing' ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : status === 'available' ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <AlertCircle className="w-3 h-3" />
      )}
      {label}
    </span>
  );
};

// =============================================================================
// Empty State Component
// =============================================================================

const EmptyState: React.FC = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 rounded-full bg-nilin-muted flex items-center justify-center mx-auto mb-4">
      <FileText className="w-8 h-8 text-nilin-lightGray" />
    </div>
    <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
      No tax documents available
    </h3>
    <p className="text-sm text-nilin-warmGray">
      Tax documents will appear here once they are generated
    </p>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export const TaxDocuments: React.FC<TaxDocumentsProps> = ({
  documents,
  isLoading = false,
  onDownload,
  onEmailDocument,
  onViewDetails,
  selectedYear,
  availableYears = [],
  className,
}) => {
  const [yearFilter, setYearFilter] = useState<number | 'all'>(
    selectedYear || 'all'
  );
  const [typeFilter, setTypeFilter] = useState<TaxDocumentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Group documents by type
  const documentsByType = documents.reduce(
    (acc, doc) => {
      if (!acc[doc.type]) {
        acc[doc.type] = [];
      }
      acc[doc.type].push(doc);
      return acc;
    },
    {} as Record<TaxDocumentType, TaxDocument[]>
  );

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    if (yearFilter !== 'all' && doc.year !== yearFilter) return false;
    if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.period.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Sort by year (descending) and then by date (descending)
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Tax Documents
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {documents.length} document{documents.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        {/* Year Filter */}
        <select
          value={yearFilter}
          onChange={(e) =>
            setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Years</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as TaxDocumentType | 'all')
          }
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          {Object.entries(documentTypeLabels).map(([type, info]) => (
            <option key={type} value={type}>
              {info.label}
            </option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {sortedDocuments.length > 0 ? (
        <div className="space-y-4">
          {sortedDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onDownload={() => onDownload(document.id)}
              onEmailDocument={
                onEmailDocument ? () => onEmailDocument(document.id) : undefined
              }
              onViewDetails={
                onViewDetails ? () => onViewDetails(document) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Info Banner */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Important Tax Information</p>
            <p className="text-blue-600/80">
              Tax documents are typically generated by January 31st for the
              previous year. For any questions about your documents, please
              contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default TaxDocuments;
