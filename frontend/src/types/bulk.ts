// Bulk operation base types
export interface BulkOperation<T = string> {
  filter?: Record<string, unknown>;
  update?: Record<string, unknown>;
  replace?: T;
  delete?: boolean;
}

// Bulk create request
export interface BulkCreateRequest<T> {
  items: T[];
  options?: {
    ordered?: boolean;  // false = parallel execution
    chunkSize?: number; // default 1000
  };
}

// Bulk update request
export interface BulkUpdateRequest {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  options?: {
    chunkSize?: number;
  };
}

// Bulk delete request
export interface BulkDeleteRequest {
  filter: Record<string, unknown>;
  options?: {
    chunkSize?: number;
  };
}

// Bulk operation result
export interface BulkOperationResult {
  success: boolean;
  insertedCount?: number;
  modifiedCount?: number;
  deletedCount?: number;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// Batch status update (for frontend bulk actions)
export interface BatchStatusUpdate {
  ids: string[];
  status: string;
  metadata?: Record<string, unknown>;
}
