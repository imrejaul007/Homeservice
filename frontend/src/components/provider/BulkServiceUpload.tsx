/**
 * BulkServiceUpload - CSV upload for bulk service creation
 * Provider Dashboard Component
 */
import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Eye,
  Edit3,
  X,
  ChevronDown,
  RefreshCw,
  FileText,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServiceTemplateRow {
  /** Row number in CSV */
  rowNumber: number;
  /** Service name */
  name: string;
  /** Service category */
  category: string;
  /** Service description */
  description: string;
  /** Base price */
  basePrice: number;
  /** Duration in minutes */
  duration: number;
  /** Service type */
  type: 'standard' | 'premium' | 'basic';
  /** Is active */
  isActive: boolean;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface UploadResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: ValidationError[];
  createdIds?: string[];
}

export interface BulkServiceUploadProps {
  /** Available categories */
  categories: Array<{ id: string; name: string }>;
  /** Callback when upload is complete */
  onUploadComplete: (result: UploadResult) => Promise<void>;
  /** Callback when template is downloaded */
  onDownloadTemplate?: () => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// CSV Template Configuration
// =============================================================================

const CSV_TEMPLATE_HEADERS = [
  'name',
  'category',
  'description',
  'basePrice',
  'duration',
  'type',
  'isActive',
];

const REQUIRED_HEADERS = ['name', 'category', 'basePrice', 'duration'];

const SERVICE_TYPES = ['standard', 'premium', 'basic'];

// =============================================================================
// Utility Functions
// =============================================================================

function generateCSVTemplate(): string {
  const rows = [
    CSV_TEMPLATE_HEADERS.join(','),
    'Classic Haircut,Hair Cutting,Standard haircut with wash and style,150,45,standard,true',
    'Full Color Treatment,Hair Coloring,Complete hair coloring service,350,90,premium,true',
    'Basic Manicure,Nail Care,Simple nail shaping and polish,80,30,basic,true',
  ];
  return rows.join('\n');
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

function validateRow(
  row: string[],
  rowNumber: number,
  categories: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const [name, category, description, basePriceStr, durationStr, type, isActive] = row;

  // Name validation
  if (!name || name.trim().length === 0) {
    errors.push({
      row: rowNumber,
      field: 'name',
      message: 'Service name is required',
      severity: 'error',
    });
  } else if (name.length > 100) {
    errors.push({
      row: rowNumber,
      field: 'name',
      message: 'Service name must be 100 characters or less',
      severity: 'error',
    });
  }

  // Category validation
  if (!category || category.trim().length === 0) {
    errors.push({
      row: rowNumber,
      field: 'category',
      message: 'Category is required',
      severity: 'error',
    });
  } else if (!categories.has(category.toLowerCase())) {
    errors.push({
      row: rowNumber,
      field: 'category',
      message: `Category "${category}" not found. Available: ${Array.from(categories).join(', ')}`,
      severity: 'warning',
    });
  }

  // Base price validation
  if (!basePriceStr || basePriceStr.trim().length === 0) {
    errors.push({
      row: rowNumber,
      field: 'basePrice',
      message: 'Base price is required',
      severity: 'error',
    });
  } else {
    const basePrice = parseFloat(basePriceStr);
    if (isNaN(basePrice)) {
      errors.push({
        row: rowNumber,
        field: 'basePrice',
        message: 'Base price must be a valid number',
        severity: 'error',
      });
    } else if (basePrice < 0) {
      errors.push({
        row: rowNumber,
        field: 'basePrice',
        message: 'Base price cannot be negative',
        severity: 'error',
      });
    } else if (basePrice > 100000) {
      errors.push({
        row: rowNumber,
        field: 'basePrice',
        message: 'Base price seems unusually high (max 100,000)',
        severity: 'warning',
      });
    }
  }

  // Duration validation
  if (!durationStr || durationStr.trim().length === 0) {
    errors.push({
      row: rowNumber,
      field: 'duration',
      message: 'Duration is required',
      severity: 'error',
    });
  } else {
    const duration = parseInt(durationStr, 10);
    if (isNaN(duration)) {
      errors.push({
        row: rowNumber,
        field: 'duration',
        message: 'Duration must be a valid number',
        severity: 'error',
      });
    } else if (duration < 5) {
      errors.push({
        row: rowNumber,
        field: 'duration',
        message: 'Duration must be at least 5 minutes',
        severity: 'error',
      });
    } else if (duration > 480) {
      errors.push({
        row: rowNumber,
        field: 'duration',
        message: 'Duration cannot exceed 8 hours (480 minutes)',
        severity: 'error',
      });
    }
  }

  // Type validation (optional)
  if (type && !SERVICE_TYPES.includes(type.toLowerCase())) {
    errors.push({
      row: rowNumber,
      field: 'type',
      message: `Invalid type "${type}". Use: ${SERVICE_TYPES.join(', ')}`,
      severity: 'warning',
    });
  }

  return errors;
}

function rowToService(row: string[], rowNumber: number): ServiceTemplateRow {
  const [name, category, description, basePriceStr, durationStr, type, isActive] = row;

  return {
    rowNumber,
    name: name?.trim() || '',
    category: category?.trim() || '',
    description: description?.trim() || '',
    basePrice: parseFloat(basePriceStr) || 0,
    duration: parseInt(durationStr, 10) || 30,
    type: (type?.toLowerCase() as ServiceTemplateRow['type']) || 'standard',
    isActive: isActive?.toLowerCase() !== 'false',
  };
}

// =============================================================================
// File Drop Zone Component
// =============================================================================

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ onFileSelect, isUploading }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-xl p-8 text-center transition-all',
        isDragging
          ? 'border-nilin-coral bg-nilin-blush'
          : 'border-nilin-border hover:border-nilin-coral/50',
        isUploading && 'opacity-50 pointer-events-none'
      )}
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
        id="csv-upload"
        disabled={isUploading}
      />
      <label htmlFor="csv-upload" className="cursor-pointer">
        <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-nilin-coral" />
          )}
        </div>
        <p className="text-nilin-charcoal font-medium mb-1">
          {isDragging ? 'Drop your file here' : 'Drag & drop your CSV file'}
        </p>
        <p className="text-sm text-nilin-warmGray mb-4">or click to browse</p>
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-muted text-nilin-charcoal rounded-lg text-sm hover:bg-nilin-blush transition-colors">
          <FileSpreadsheet className="w-4 h-4" />
          Select CSV File
        </span>
      </label>
    </div>
  );
};

// =============================================================================
// Preview Table Component
// =============================================================================

interface PreviewTableProps {
  services: ServiceTemplateRow[];
  errors: ValidationError[];
  onRemoveRow: (index: number) => void;
}

const PreviewTable: React.FC<PreviewTableProps> = ({ services, errors, onRemoveRow }) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const getRowErrors = (rowNumber: number) =>
    errors.filter((e) => e.row === rowNumber);

  const hasErrors = (rowNumber: number) =>
    getRowErrors(rowNumber).some((e) => e.severity === 'error');

  return (
    <div className="overflow-x-auto rounded-xl border border-nilin-border">
      <table className="w-full">
        <thead className="bg-nilin-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Service Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Category
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Price
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nilin-border">
          {services.map((service, index) => {
            const rowErrors = getRowErrors(service.rowNumber);
            const errorCount = rowErrors.filter((e) => e.severity === 'error').length;
            const warningCount = rowErrors.filter((e) => e.severity === 'warning').length;
            const hasCriticalErrors = hasErrors(service.rowNumber);

            return (
              <React.Fragment key={service.rowNumber}>
                <tr
                  className={cn(
                    'hover:bg-nilin-muted/30 transition-colors',
                    hasCriticalErrors && 'bg-red-50/50'
                  )}
                >
                  <td className="px-4 py-3 text-sm text-nilin-warmGray">
                    {service.rowNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {hasCriticalErrors && (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-nilin-charcoal">
                        {service.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-nilin-warmGray">
                    {service.category}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal">
                    {service.basePrice.toFixed(2)} AED
                  </td>
                  <td className="px-4 py-3 text-sm text-nilin-warmGray">
                    {service.duration} min
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          service.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {(errorCount > 0 || warningCount > 0) && (
                        <button
                          onClick={() =>
                            setExpandedRow(expandedRow === index ? null : index)
                          }
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {errorCount > 0 && <span>{errorCount} error{errorCount > 1 ? 's' : ''}</span>}
                          {warningCount > 0 && <span>{warningCount} warning{warningCount > 1 ? 's' : ''}</span>}
                          <ChevronDown
                            className={cn(
                              'w-3 h-3 transition-transform',
                              expandedRow === index && 'rotate-180'
                            )}
                          />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onRemoveRow(index)}
                      className="p-1.5 text-nilin-warmGray hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                {expandedRow === index && rowErrors.length > 0 && (
                  <tr className="bg-amber-50/50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="space-y-1.5">
                        {rowErrors.map((error, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-start gap-2 text-sm',
                              error.severity === 'error'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            )}
                          >
                            {error.severity === 'error' ? (
                              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="font-medium capitalize">
                                {error.field}:
                              </span>{' '}
                              {error.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// Error Summary Component
// =============================================================================

interface ErrorSummaryProps {
  errors: ValidationError[];
}

const ErrorSummary: React.FC<ErrorSummaryProps> = ({ errors }) => {
  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  const groupedErrors = useMemo(() => {
    const grouped: Record<string, ValidationError[]> = {};
    errors.forEach((error) => {
      if (!grouped[error.field]) {
        grouped[error.field] = [];
      }
      grouped[error.field].push(error);
    });
    return grouped;
  }, [errors]);

  return (
    <div className="bg-white rounded-xl border border-nilin-border p-4">
      <h4 className="font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Validation Summary
      </h4>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-nilin-warmGray">
            <span className="font-semibold text-nilin-charcoal">{errorCount}</span> errors
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-nilin-warmGray">
            <span className="font-semibold text-nilin-charcoal">{warningCount}</span> warnings
          </span>
        </div>
      </div>

      {Object.entries(groupedErrors).length > 0 && (
        <div className="space-y-3">
          {Object.entries(groupedErrors).map(([field, fieldErrors]) => (
            <div key={field} className="border border-nilin-border rounded-lg p-3">
              <h5 className="text-sm font-medium text-nilin-charcoal capitalize mb-2">
                {field} ({fieldErrors.length})
              </h5>
              <ul className="space-y-1">
                {fieldErrors.slice(0, 3).map((error, i) => (
                  <li
                    key={i}
                    className={cn(
                      'text-xs',
                      error.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                    )}
                  >
                    Row {error.row}: {error.message}
                  </li>
                ))}
                {fieldErrors.length > 3 && (
                  <li className="text-xs text-nilin-warmGray">
                    ... and {fieldErrors.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Results Modal Component
// =============================================================================

interface ResultsModalProps {
  result: UploadResult | null;
  onClose: () => void;
}

const ResultsModal: React.FC<ResultsModalProps> = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-nilin-xl max-w-md w-full p-6"
        >
          <div className="text-center mb-6">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                result.success
                  ? 'bg-green-100'
                  : result.imported > 0
                  ? 'bg-amber-100'
                  : 'bg-red-100'
              )}
            >
              {result.success || result.imported > 0 ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
              {result.success ? 'Import Complete!' : 'Import Finished with Issues'}
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {result.imported} service{result.imported !== 1 ? 's' : ''} imported
              {result.failed > 0 && `, ${result.failed} failed`}
            </p>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-6 max-h-48 overflow-y-auto border border-nilin-border rounded-lg p-3">
              {result.errors.slice(0, 10).map((error, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 text-sm py-1',
                    error.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                  )}
                >
                  {error.severity === 'error' ? (
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span>
                    Row {error.row}, {error.field}: {error.message}
                  </span>
                </div>
              ))}
              {result.errors.length > 10 && (
                <p className="text-sm text-nilin-warmGray pt-2">
                  ... and {result.errors.length - 10} more issues
                </p>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
          >
            Done
          </button>
        </motion.div>
      </div>
    </>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const BulkServiceUpload: React.FC<BulkServiceUploadProps> = ({
  categories,
  onUploadComplete,
  onDownloadTemplate,
  className,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'uploading' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedServices, setParsedServices] = useState<ServiceTemplateRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const categorySet = useMemo(
    () => new Set(categories.map((c) => c.name.toLowerCase())),
    [categories]
  );

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const rows = parseCSV(text);

          if (rows.length < 2) {
            setValidationErrors([
              {
                row: 0,
                field: 'file',
                message: 'CSV file is empty or has no data rows',
                severity: 'error',
              },
            ]);
            setIsUploading(false);
            return;
          }

          // Validate headers
          const headers = rows[0].map((h) => h.toLowerCase());
          const missingHeaders = REQUIRED_HEADERS.filter(
            (h) => !headers.includes(h)
          );

          if (missingHeaders.length > 0) {
            setValidationErrors([
              {
                row: 0,
                field: 'headers',
                message: `Missing required headers: ${missingHeaders.join(', ')}`,
                severity: 'error',
              },
            ]);
            setIsUploading(false);
            return;
          }

          // Parse data rows
          const services: ServiceTemplateRow[] = [];
          const errors: ValidationError[] = [];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            // Skip empty rows
            if (row.every((cell) => !cell || cell.trim() === '')) continue;

            // Pad row to expected length
            while (row.length < CSV_TEMPLATE_HEADERS.length) {
              row.push('');
            }

            const rowErrors = validateRow(row, i + 1, categorySet);
            errors.push(...rowErrors);

            services.push(rowToService(row, i + 1));
          }

          setParsedServices(services);
          setValidationErrors(errors);
          setStep('preview');
        } catch (error) {
          setValidationErrors([
            {
              row: 0,
              field: 'file',
              message: 'Failed to parse CSV file. Please check the format.',
              severity: 'error',
            },
          ]);
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setValidationErrors([
          {
            row: 0,
            field: 'file',
            message: 'Failed to read file',
            severity: 'error',
          },
        ]);
        setIsUploading(false);
      };

      reader.readAsText(selectedFile);
    },
    [categorySet]
  );

  const handleDownloadTemplate = useCallback(() => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onDownloadTemplate?.();
  }, [onDownloadTemplate]);

  const handleRemoveRow = useCallback((index: number) => {
    setParsedServices((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = useCallback(async () => {
    const criticalErrors = validationErrors.filter(
      (e) => e.severity === 'error'
    );

    // Filter out rows with critical errors
    const validServices = parsedServices.filter(
      (s) => !validationErrors.some((e) => e.row === s.rowNumber && e.severity === 'error')
    );

    if (validServices.length === 0) {
      setUploadResult({
        success: false,
        imported: 0,
        failed: parsedServices.length,
        errors: validationErrors,
      });
      setStep('done');
      return;
    }

    setStep('uploading');
    setIsUploading(true);

    try {
      await onUploadComplete({
        success: true,
        imported: validServices.length,
        failed: parsedServices.length - validServices.length,
        errors: validationErrors.filter((e) => e.severity === 'error'),
      });
      setUploadResult({
        success: true,
        imported: validServices.length,
        failed: parsedServices.length - validServices.length,
        errors: validationErrors.filter((e) => e.severity === 'error'),
      });
      setStep('done');
    } catch (error) {
      setUploadResult({
        success: false,
        imported: 0,
        failed: parsedServices.length,
        errors: [
          ...validationErrors,
          {
            row: 0,
            field: 'upload',
            message: error instanceof Error ? error.message : 'Upload failed',
            severity: 'error',
          },
        ],
      });
      setStep('done');
    } finally {
      setIsUploading(false);
    }
  }, [parsedServices, validationErrors, onUploadComplete]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setParsedServices([]);
    setValidationErrors([]);
    setUploadResult(null);
    setIsUploading(false);
  }, []);

  const hasCriticalErrors = validationErrors.some(
    (e) => e.severity === 'error'
  );
  const validCount = parsedServices.filter(
    (s) => !validationErrors.some((e) => e.row === s.rowNumber && e.severity === 'error')
  ).length;

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Bulk Service Upload
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Upload multiple services at once using a CSV file
          </p>
        </div>
        {step === 'upload' && (
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 mb-6">
        {['upload', 'preview', 'done'].map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  step === s
                    ? 'bg-nilin-coral text-white'
                    : ['upload', 'preview', 'done'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-nilin-muted text-nilin-warmGray'
                )}
              >
                {['upload', 'preview', 'done'].indexOf(step) > i ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium capitalize',
                  step === s ? 'text-nilin-coral' : 'text-nilin-warmGray'
                )}
              >
                {s}
              </span>
            </div>
            {i < 2 && (
              <div
                className={cn(
                  'flex-1 h-0.5 max-w-[80px]',
                  ['upload', 'preview', 'done'].indexOf(step) > i
                    ? 'bg-green-500'
                    : 'bg-nilin-muted'
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <FileDropZone
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
            />

            {validationErrors.length > 0 && (
              <div className="mt-4">
                <ErrorSummary errors={validationErrors} />
              </div>
            )}

            {/* Template Preview */}
            <div className="mt-6 p-4 bg-nilin-muted/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-nilin-warmGray" />
                <span className="text-sm font-medium text-nilin-charcoal">
                  CSV Template Format
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nilin-muted/50">
                      {CSV_TEMPLATE_HEADERS.map((header) => (
                        <th
                          key={header}
                          className="px-2 py-1 text-left text-nilin-warmGray"
                        >
                          {header}
                          {REQUIRED_HEADERS.includes(header) && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-nilin-border">
                      {CSV_TEMPLATE_HEADERS.map((header) => (
                        <td key={header} className="px-2 py-1 text-nilin-charcoal">
                          {header === 'type' ? 'standard/premium/basic' : ''}
                          {header === 'isActive' ? 'true/false' : ''}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* File Info */}
            <div className="flex items-center justify-between mb-4 p-3 bg-nilin-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">{file?.name}</p>
                  <p className="text-xs text-nilin-warmGray">
                    {(file?.size ?? 0 / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="p-2 text-nilin-warmGray hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{validCount}</p>
                <p className="text-xs text-green-600">Ready to Import</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {validationErrors.filter((e) => e.severity === 'error').length}
                </p>
                <p className="text-xs text-red-600">Errors</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {validationErrors.filter((e) => e.severity === 'warning').length}
                </p>
                <p className="text-xs text-amber-600">Warnings</p>
              </div>
            </div>

            {/* Error Summary */}
            {validationErrors.length > 0 && (
              <div className="mb-4">
                <ErrorSummary errors={validationErrors} />
              </div>
            )}

            {/* Preview Table */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal mb-2">
                Preview ({parsedServices.length} rows)
              </h4>
              <PreviewTable
                services={parsedServices}
                errors={validationErrors}
                onRemoveRow={handleRemoveRow}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-nilin-border">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Choose Different File
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || isUploading}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors',
                  validCount > 0 && !isUploading
                    ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                    : 'bg-nilin-muted text-nilin-warmGray cursor-not-allowed'
                )}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import {validCount} Service{validCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-8"
          >
            <ResultsModal result={uploadResult} onClose={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default BulkServiceUpload;
