/**
 * Enhanced Pagination utilities for consistent API responses
 * Includes robust input validation, NaN handling, and DoS prevention
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Configuration constants
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;
const MIN_PAGE = 1;

/**
 * Safely parse an integer from a value, returning a default if invalid
 */
export const safeParseInt = (value: unknown, defaultValue: number, min?: number, max?: number): number => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const num = Number(value);

  // Handle NaN and Infinity
  if (!Number.isFinite(num)) {
    return defaultValue;
  }

  // Check if it's actually an integer
  if (!Number.isInteger(num)) {
    return defaultValue;
  }

  // Apply min constraint
  let result = num;
  if (min !== undefined) {
    result = Math.max(min, num);
  }

  // Apply max constraint
  if (max !== undefined) {
    result = Math.min(max, result);
  }

  return result;
};

/**
 * Parse and validate pagination parameters with strict bounds
 */
export const parsePaginationParams = (query: {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
}): PaginationParams => {
  const page = safeParseInt(query.page, DEFAULT_PAGE, MIN_PAGE);
  const limit = safeParseInt(query.limit, DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);

  // Validate sortBy - only allow safe field names
  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'email', '_id', 'scheduledDate', 'status', 'totalAmount'];
  let sortBy = String(query.sortBy || 'createdAt');

  // Prevent injection through sortBy parameter
  if (!allowedSortFields.includes(sortBy)) {
    sortBy = 'createdAt';
  }

  // Validate sortOrder
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, sortBy, sortOrder };
};

/**
 * Calculate pagination metadata with safe arithmetic
 */
export const getPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  // Ensure total is a valid number
  const safeTotal = safeParseInt(total, 0, 0);
  const safePage = safeParseInt(page, DEFAULT_PAGE, MIN_PAGE);
  const safeLimit = safeParseInt(limit, DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);

  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    nextPage: safePage < totalPages ? safePage + 1 : null,
    prevPage: safePage > 1 ? safePage - 1 : null,
  };
};

/**
 * Calculate skip value for pagination with overflow protection
 */
export const calculateSkip = (page: number, limit: number): number => {
  const safePage = safeParseInt(page, DEFAULT_PAGE, MIN_PAGE);
  const safeLimit = safeParseInt(limit, DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);

  // Prevent overflow for very large page numbers
  // Max safe skip is limited to prevent query performance issues
  const maxPage = 10000;
  const safePageNum = Math.min(safePage, maxPage);

  return Math.max(0, (safePageNum - 1) * safeLimit);
};

/**
 * Generic paginated query helper with enhanced error handling
 */
export const paginate = async <T>(
  model: any,
  query: Record<string, unknown>,
  params: PaginationParams,
  populate?: string | Record<string, unknown> | null
): Promise<PaginatedResult<T>> => {
  const page = safeParseInt(params.page ?? DEFAULT_PAGE, DEFAULT_PAGE, MIN_PAGE);
  const limit = safeParseInt(params.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);
  const sortBy = String(params.sortBy || 'createdAt');
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

  // Validate sortBy field to prevent injection
  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'email', '_id', 'scheduledDate', 'status', 'totalAmount', 'price', 'rating'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const skip = calculateSkip(page, limit);
  const sort: Record<string, 1 | -1> = { [safeSortBy]: sortOrder as 1 | -1 };

  try {
    const [data, total] = await Promise.all([
      model
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate(populate as any)
        .lean(),
      model.countDocuments(query),
    ]);

    return {
      data: data || [],
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    // Log error and return empty result with proper pagination metadata
    console.error('Pagination query error:', error);
    return {
      data: [],
      pagination: getPaginationMeta(0, page, limit),
    };
  }
};

// ============================================
// CURSOR-BASED PAGINATION
// ============================================

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Generate cursor from document
 */
export const generateCursor = (doc: any, sortBy: string): string => {
  const value = doc[sortBy];
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

/**
 * Parse cursor for query with validation
 */
export const parseCursor = (
  cursor: string,
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): Record<string, unknown> => {
  // Validate cursor format to prevent injection
  if (!cursor || typeof cursor !== 'string') {
    return {};
  }

  // For ObjectId cursors (24 hex characters)
  if (/^[a-fA-F0-9]{24}$/.test(cursor)) {
    return sortOrder === 'asc'
      ? { _id: { $gt: cursor } }
      : { _id: { $lt: cursor } };
  }

  // For date cursors (ISO format)
  if (/^\d{4}-\d{2}-\d{2}T/.test(cursor)) {
    const date = new Date(cursor);
    if (!isNaN(date.getTime())) {
      return sortOrder === 'asc'
        ? { [sortBy]: { $gt: date } }
        : { [sortBy]: { $lt: date } };
    }
  }

  // For numeric cursors
  const numCursor = Number(cursor);
  if (Number.isFinite(numCursor)) {
    return sortOrder === 'asc'
      ? { [sortBy]: { $gt: numCursor } }
      : { [sortBy]: { $lt: numCursor } };
  }

  // For string cursors (alphanumeric only for safety)
  if (/^[a-zA-Z0-9_-]+$/.test(cursor)) {
    return sortOrder === 'asc'
      ? { [sortBy]: { $gt: cursor } }
      : { [sortBy]: { $lt: cursor } };
  }

  // Invalid cursor format - return empty query
  return {};
};

/**
 * Cursor-based pagination query with enhanced validation
 */
export const cursorPaginate = async <T>(
  model: any,
  query: Record<string, unknown>,
  params: CursorPaginationParams,
  populate?: string | Record<string, unknown> | null
): Promise<CursorPaginatedResult<T>> => {
  const limit = safeParseInt(params.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);
  const sortBy = String(params.sortBy || '_id');
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

  // Validate sortBy
  const allowedSortFields = ['_id', 'createdAt', 'updatedAt', 'name', 'price', 'rating'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : '_id';

  const sort = { [safeSortBy]: sortOrder };

  let finalQuery = { ...query };

  // Add cursor to query if provided and valid
  if (params.cursor) {
    const cursorQuery = parseCursor(params.cursor, safeSortBy, params.sortOrder === 'asc' ? 'asc' : 'desc');
    if (Object.keys(cursorQuery).length > 0) {
      finalQuery = { ...finalQuery, ...cursorQuery };
    }
  }

  try {
    // Fetch one extra to check if there's more
    const data = await model
      .find(finalQuery)
      .sort(sort)
      .limit(limit + 1)
      .populate(populate as any)
      .lean();

    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    const nextCursor = hasMore && data.length > 0
      ? generateCursor(data[data.length - 1], safeSortBy)
      : null;

    return {
      data: data || [],
      nextCursor,
      hasMore,
    };
  } catch (error) {
    console.error('Cursor pagination error:', error);
    return {
      data: [],
      nextCursor: null,
      hasMore: false,
    };
  }
};

export default {
  safeParseInt,
  parsePaginationParams,
  getPaginationMeta,
  calculateSkip,
  paginate,
  cursorPaginate,
  generateCursor,
  parseCursor,
};
