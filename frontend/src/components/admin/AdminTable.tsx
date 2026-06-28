/**
 * AdminTable - Reusable table component for admin dashboards
 *
 * Provides consistent styling and common table patterns used across admin components.
 *
 * @example
 * ```tsx
 * <AdminTable
 *   columns={[
 *     { key: 'name', header: 'Name' },
 *     { key: 'status', header: 'Status', render: (val) => <Badge>{val}</Badge> },
 *   ]}
 *   data={users}
 *   loading={loading}
 * />
 * ```
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface AdminTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header text */
  header: string;
  /** Optional custom render function */
  render?: <K extends keyof T>(value: T[K], row: T) => React.ReactNode;
  /** Column width */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether column is sortable */
  sortable?: boolean;
  /** Sort direction (for controlled sorting) */
  sortDirection?: 'asc' | 'desc' | null;
}

export interface AdminTableProps<T> {
  /** Table columns configuration */
  columns: AdminTableColumn<T>[];
  /** Table data */
  data: T[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom className */
  className?: string;
  /** Enable pagination */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  /** Sort callback - called when a sortable column header is clicked */
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  /** Currently sorted column key */
  sortKey?: string;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc';
}

export function AdminTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  error = null,
  onRowClick,
  emptyMessage = 'No data available',
  className,
  pagination,
  onSort,
  sortKey,
  sortDirection,
}: AdminTableProps<T>) {
  // Loading state
  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg shadow overflow-hidden', className)}>
        <div aria-live="polite" className="sr-only">Loading data, please wait</div>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 border-b" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-gray-100 flex items-center px-4">
              {columns.map((col) => (
                <div key={col.key} className={cn('h-4 bg-gray-200 rounded', col.width || 'flex-1')} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('bg-white rounded-lg shadow p-8 text-center', className)}>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={cn('bg-white rounded-lg shadow p-8 text-center', className)}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // Calculate pagination
  const paginatedData = pagination
    ? data.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
    : data;

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={cn('bg-white rounded-lg shadow overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.sortable && 'cursor-pointer select-none hover:bg-gray-100'
                  )}
                  style={{ width: column.width }}
                  onClick={column.sortable && onSort ? () => {
                    const newDirection = sortKey === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
                    onSort(column.key, newDirection);
                  } : undefined}
                  aria-sort={sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && sortKey === column.key && (
                      <span className="text-nilin-coral">
                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={(row.id as string) ?? rowIndex}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
                className={cn(
                  'hover:bg-gray-50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                role={onRowClick ? 'button' : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-sm text-gray-900',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    {column.render
                      ? column.render(row[column.key] as T[keyof T], row)
                      : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
          <div className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="w-11 h-11 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="w-11 h-11 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
