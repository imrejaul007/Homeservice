/**
 * Admin Utils - Shared utilities for admin components
 *
 * Provides common formatting, date handling, and other utilities
 * used across admin dashboard components.
 */

/**
 * Format a number as currency (AED)
 */
export function formatCurrency(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string to local date
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string to local date and time
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a large number with abbreviations (K, M, B)
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Get status color class based on status string
 */
export function getStatusColor(status: string): string {
  const statusLower = status?.toLowerCase() || '';

  const colorMap: Record<string, string> = {
    // Positive statuses
    active: 'text-green-600 bg-green-50',
    approved: 'text-green-600 bg-green-50',
    completed: 'text-green-600 bg-green-50',
    success: 'text-green-600 bg-green-50',
    verified: 'text-green-600 bg-green-50',

    // Warning statuses
    pending: 'text-yellow-600 bg-yellow-50',
    processing: 'text-yellow-600 bg-yellow-50',
    warning: 'text-yellow-600 bg-yellow-50',

    // Negative statuses
    rejected: 'text-red-600 bg-red-50',
    failed: 'text-red-600 bg-red-50',
    blocked: 'text-red-600 bg-red-50',
    suspended: 'text-red-600 bg-red-50',
    cancelled: 'text-red-600 bg-red-50',
    deactivated: 'text-red-600 bg-red-50',

    // Neutral statuses
    draft: 'text-gray-600 bg-gray-50',
    archived: 'text-gray-600 bg-gray-50',
  };

  // Find matching status
  for (const [key, value] of Object.entries(colorMap)) {
    if (statusLower.includes(key)) {
      return value;
    }
  }

  // Default
  return 'text-gray-600 bg-gray-50';
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
