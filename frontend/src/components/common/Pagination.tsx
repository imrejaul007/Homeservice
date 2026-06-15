import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Generates an array of page numbers with ellipsis for large page counts.
 * Examples:
 * - totalPages=3: [1, 2, 3]
 * - totalPages=7, currentPage=2: [1, 2, 3, 4, 5, '...', 7]
 * - totalPages=10, currentPage=5: [1, '...', 4, 5, 6, '...', 10]
 */
function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    // N53: Container transition
    <nav
      role="navigation"
      aria-label={`Pagination, page ${currentPage} of ${totalPages}`}
      className="flex items-center justify-center gap-1 mt-8 pt-6 border-t border-nilin-blush/30 transition-opacity duration-200"
    >
      {/* Previous Button */}
      <button
        onClick={handlePrev}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="px-2 py-1.5 rounded-xl border border-nilin-blush/40 text-nilin-warmGray
          hover:bg-nilin-blush/40 hover:text-nilin-charcoal
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-nilin-warmGray
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
          transition-all"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Page Numbers */}
      {pageNumbers.map((pageNum, idx) =>
        pageNum === '...' ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-2 py-1.5 text-nilin-lightGray select-none"
            aria-hidden="true"
          >
            ...
          </span>
        ) : (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum as number)}
            aria-current={currentPage === pageNum ? 'page' : undefined}
            aria-label={`Page ${pageNum}`}
            className={`min-w-[2.5rem] h-10 px-3 py-1.5 rounded-xl text-sm font-medium transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
              ${currentPage === pageNum
                ? 'bg-nilin-coral text-white shadow-nilin-sm border border-nilin-coral scale-105'
                : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush hover:text-nilin-rose border border-nilin-blush/30'
              }`}
          >
            {pageNum}
          </button>
        )
      )}

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="px-2 py-1.5 rounded-xl border border-nilin-blush/40 text-nilin-warmGray
          hover:bg-nilin-blush/40 hover:text-nilin-charcoal
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-nilin-warmGray
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
          transition-all"
      >
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </nav>
  );
};

export default Pagination;
