/**
 * AdminPagination - Reusable pagination component for admin pages
 *
 * Provides consistent pagination UI with First/Previous/Next/Last buttons,
 * page numbers with ellipsis, and result summary.
 *
 * @example
 * ```tsx
 * <AdminPagination
 *   page={1}
 *   totalPages={10}
 *   total={250}
 *   onPageChange={(p) => setPage(p)}
 *   showPageNumbers
 *   showTotal
 * />
 * ```
 */

import React from 'react';
import { cn } from '../../lib/utils';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface AdminPaginationProps {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of results */
  total?: number;
  /** Items per page */
  pageSize?: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Show page number buttons with ellipsis */
  showPageNumbers?: boolean;
  /** Show "Showing X-Y of Z results" text */
  showTotal?: boolean;
  /** Custom container className */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, 'ellipsis', total);
  } else if (current >= total - 3) {
    pages.push(1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total);
  }

  return pages;
}

export function AdminPagination({
  page,
  totalPages,
  total,
  pageSize = 20,
  onPageChange,
  showPageNumbers = true,
  showTotal = true,
  className,
  ariaLabel = 'Pagination',
}: AdminPaginationProps) {
  if (totalPages <= 1 && !showTotal) {
    return null;
  }

  const pageNumbers = showPageNumbers ? getPageNumbers(page, totalPages) : [];

  const startItem = total ? (page - 1) * pageSize + 1 : 0;
  const endItem = total ? Math.min(page * pageSize, total) : 0;

  const baseButtonClass = cn(
    'inline-flex items-center justify-center',
    'min-w-[36px] h-9 px-3',
    'text-sm font-medium rounded-lg',
    'transition-colors duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2'
  );

  const activeButtonClass = cn(baseButtonClass, 'bg-nilin-coral text-white');
  const inactiveButtonClass = cn(
    baseButtonClass,
    'text-nilin-charcoal hover:bg-nilin-lightGray'
  );
  const disabledButtonClass = cn(
    baseButtonClass,
    'text-nilin-warmGray opacity-50 cursor-not-allowed pointer-events-none'
  );

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className={cn('flex flex-col sm:flex-row items-center justify-between gap-4', className)}
    >
      {/* Results summary */}
      {showTotal && total !== undefined && totalPages > 1 && (
        <p className="text-sm text-nilin-warmGray" aria-live="polite">
          Showing {startItem}-{endItem} of {total.toLocaleString()} results
        </p>
      )}

      {/* Page info and controls */}
      <div className="flex items-center gap-1">
        {/* First page button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={page === 1 ? disabledButtonClass : inactiveButtonClass}
          aria-label="Go to first page"
          title="First page"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        {/* Previous page button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={page === 1 ? disabledButtonClass : inactiveButtonClass}
          aria-label="Go to previous page"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {showPageNumbers && pageNumbers.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 mx-1">
            {pageNumbers.map((p, index) =>
              p === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="inline-flex items-center justify-center min-w-[36px] h-9 text-nilin-warmGray"
                  aria-hidden="true"
                >
                  &hellip;
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={p === page ? activeButtonClass : inactiveButtonClass}
                  aria-label={`Go to page ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}
          </div>
        )}

        {/* Mobile: Page X of Y */}
        <span className="sm:hidden mx-2 text-sm text-nilin-charcoal">
          Page {page} of {totalPages}
        </span>

        {/* Desktop: Page X of Y */}
        {showPageNumbers && (
          <span className="hidden sm:inline mx-2 text-sm text-nilin-charcoal min-w-[100px] text-center">
            Page {page} of {totalPages}
          </span>
        )}

        {/* Next page button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={page === totalPages ? disabledButtonClass : inactiveButtonClass}
          aria-label="Go to next page"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last page button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={page === totalPages ? disabledButtonClass : inactiveButtonClass}
          aria-label="Go to last page"
          title="Last page"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

export default AdminPagination;
