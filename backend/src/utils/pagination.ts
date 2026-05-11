/**
 * Pagination utilities for consistent API responses
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

/**
 * Parse and validate pagination parameters
 */
export const parsePaginationParams = (query: {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
}): PaginationParams => {
  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 20), 10) || 20));
  const sortBy = String(query.sortBy || 'createdAt');
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, sortBy, sortOrder };
};

/**
 * Calculate pagination metadata
 */
export const getPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
};

/**
 * Generic paginated query helper
 */
export const paginate = async <T>(
  model: any,
  query: Record<string, unknown>,
  params: PaginationParams,
  populate?: string | Record<string, unknown> | null
): Promise<PaginatedResult<T>> => {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const sortBy = params.sortBy ?? 'createdAt';
  const sortOrder = params.sortOrder ?? 'desc';

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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
    data,
    pagination: getPaginationMeta(total, page, limit),
  };
};

/**
 * Cursor-based pagination for large datasets
 */
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
 * Parse cursor for query
 */
export const parseCursor = (cursor: string, sortBy: string, sortOrder: 'asc' | 'desc'): Record<string, unknown> => {
  // For ObjectId cursors
  if (/^[a-fA-F0-9]{24}$/.test(cursor)) {
    return sortOrder === 'asc'
      ? { _id: { $gt: cursor } }
      : { _id: { $lt: cursor } };
  }

  // For date cursors
  if (/^\d{4}-\d{2}-\d{2}T/.test(cursor)) {
    return sortOrder === 'asc'
      ? { [sortBy]: { $gt: new Date(cursor) } }
      : { [sortBy]: { $lt: new Date(cursor) } };
  }

  // For string cursors
  return sortOrder === 'asc'
    ? { [sortBy]: { $gt: cursor } }
    : { [sortBy]: { $lt: cursor } };
};

/**
 * Cursor-based pagination query
 */
export const cursorPaginate = async <T>(
  model: any,
  query: Record<string, unknown>,
  params: CursorPaginationParams,
  populate?: string | Record<string, unknown> | null
): Promise<CursorPaginatedResult<T>> => {
  const { cursor, limit = 20, sortBy = '_id', sortOrder = 'desc' } = params;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  let finalQuery = { ...query };

  // Add cursor to query if provided
  if (cursor) {
    const cursorQuery = parseCursor(cursor, sortBy, sortOrder);
    finalQuery = { ...finalQuery, ...cursorQuery };
  }

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
    ? generateCursor(data[data.length - 1], sortBy)
    : null;

  return {
    data,
    nextCursor,
    hasMore,
  };
};

export default {
  parsePaginationParams,
  getPaginationMeta,
  paginate,
  cursorPaginate,
  generateCursor,
  parseCursor,
};
