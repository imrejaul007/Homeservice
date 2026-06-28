/**
 * usePagination - Hook for managing pagination state
 *
 * Provides a clean interface for managing pagination in admin pages.
 *
 * @example
 * ```tsx
 * const {
 *   page,
 *   totalPages,
 *   total,
 *   pageSize,
 *   setPage,
 *   handlePageChange,
 *   pagination
 * } = usePagination({ initialPage: 1, pageSize: 20 });
 *
 * // Use in component
 * <AdminPagination
 *   page={page}
 *   totalPages={totalPages}
 *   total={total}
 *   onPageChange={handlePageChange}
 * />
 * ```
 */

import { useState, useCallback, useMemo } from 'react';

export interface PaginationParams {
  page: number;
  pages: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

export interface UsePaginationOptions {
  /** Initial page number */
  initialPage?: number;
  /** Items per page */
  pageSize?: number;
  /** Whether to preserve page when results update */
  preservePage?: boolean;
}

export interface UsePaginationReturn {
  /** Current page number (1-indexed) */
  page: number;
  /** Total pages */
  totalPages: number;
  /** Total items */
  total: number;
  /** Items per page */
  pageSize: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
  /** Set page directly */
  setPage: (page: number) => void;
  /** Handle page change with bounds checking */
  handlePageChange: (newPage: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Go to first page */
  goToFirst: () => void;
  /** Go to last page */
  goToLast: () => void;
  /** Update from API response */
  setPagination: (response: Partial<PaginationParams>) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Pagination object for AdminPagination component */
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, pageSize: initialPageSize = 20, preservePage = true } = options;

  const [page, setPageState] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(initialPageSize);
  const [lastFetchedTotal, setLastFetchedTotal] = useState<number | null>(null);

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (total === 0) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  // Check bounds when total changes
  const normalizedPage = useMemo(() => {
    if (page > totalPages) return totalPages;
    if (page < 1) return 1;
    return page;
  }, [page, totalPages]);

  // Navigation helpers
  const hasNext = normalizedPage < totalPages;
  const hasPrev = normalizedPage > 1;

  // Set page with bounds checking
  const setPage = useCallback((newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    setPageState(clampedPage);
  }, [totalPages]);

  // Handle page change (for AdminPagination)
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, [setPage]);

  // Navigation functions
  const nextPage = useCallback(() => {
    if (hasNext) setPageState(prev => prev + 1);
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) setPageState(prev => prev - 1);
  }, [hasPrev]);

  const goToFirst = useCallback(() => {
    setPageState(1);
  }, []);

  const goToLast = useCallback(() => {
    setPageState(totalPages);
  }, [totalPages]);

  // Update from API response
  const setPagination = useCallback((response: Partial<PaginationParams>) => {
    if (response.total !== undefined) {
      setTotal(response.total);
    }
    if (response.limit !== undefined) {
      setLimit(response.limit);
    }

    // Preserve page on results update if enabled
    if (preservePage && response.total !== undefined) {
      // Check if total changed significantly (not just count update)
      if (lastFetchedTotal !== null && Math.abs(response.total - lastFetchedTotal) > limit * 2) {
        // Reset to page 1 when total changes significantly
        setPageState(1);
      }
    }

    if (response.page !== undefined) {
      setPageState(response.page);
    }

    if (response.total !== undefined) {
      setLastFetchedTotal(response.total);
    }
  }, [preservePage, lastFetchedTotal, limit]);

  // Reset to initial state
  const reset = useCallback(() => {
    setPageState(initialPage);
    setTotal(0);
    setLimit(initialPageSize);
    setLastFetchedTotal(null);
  }, [initialPage, initialPageSize]);

  // Pagination object for AdminPagination component
  const pagination = useMemo(() => ({
    page: normalizedPage,
    totalPages,
    total,
    pageSize: limit,
    onPageChange: handlePageChange,
  }), [normalizedPage, totalPages, total, limit, handlePageChange]);

  return {
    page: normalizedPage,
    totalPages,
    total,
    pageSize: limit,
    hasNext,
    hasPrev,
    setPage,
    handlePageChange,
    nextPage,
    prevPage,
    goToFirst,
    goToLast,
    setPagination,
    reset,
    pagination,
  };
}

export default usePagination;
