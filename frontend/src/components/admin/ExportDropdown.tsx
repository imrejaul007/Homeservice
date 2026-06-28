import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

interface ExportDropdownProps {
  onExport: (format: ExportFormat) => void;
  formats?: ExportFormat[];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}

const formatLabels: Record<ExportFormat, string> = {
  csv: 'CSV',
  excel: 'Excel',
  pdf: 'PDF',
};

const formatIcons: Record<ExportFormat, React.ReactNode> = {
  csv: <FileSpreadsheet className="w-4 h-4" />,
  excel: <FileSpreadsheet className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
};

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  onExport,
  formats = ['csv', 'excel', 'pdf'],
  loading = false,
  disabled = false,
  className = '',
  label = 'Export',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleExport = (format: ExportFormat) => {
    setIsOpen(false);
    onExport(format);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && !loading) {
        setIsOpen(!isOpen);
      }
    } else if (event.key === 'ArrowDown' && isOpen) {
      event.preventDefault();
      const firstItem = dropdownRef.current?.querySelector('[role="menuitem"]') as HTMLElement;
      firstItem?.focus();
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={loading ? 'Exporting, please wait' : 'Export data'}
        aria-disabled={disabled || loading}
        className={`
          inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
          border border-gray-200 bg-white text-nilin-charcoal
          font-medium text-sm transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
          ${disabled || loading
            ? 'opacity-50 cursor-not-allowed bg-gray-50'
            : 'hover:bg-gray-50 cursor-pointer'
          }
        `}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{label}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && !disabled && !loading && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label={`Export format options. ${formats.length} formats available.`}
          className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          <div className="py-1">
            {formats.map((format, index) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                tabIndex={0}
                aria-label={`Export as ${formatLabels[format]}`}
                onClick={() => handleExport(format)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextButton = dropdownRef.current?.querySelectorAll('[role="menuitem"]')[index + 1] as HTMLElement;
                    nextButton?.focus();
                  } else if (e.key === 'ArrowUp' && index === 0) {
                    e.preventDefault();
                    // Focus back on the trigger button
                    const trigger = dropdownRef.current?.querySelector('button') as HTMLElement;
                    trigger?.focus();
                  }
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-inset"
              >
                {formatIcons[format]}
                <span>Export as {formatLabels[format]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default ExportDropdown;
