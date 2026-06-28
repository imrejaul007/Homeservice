// Form error type for field-level validation
export interface FormError {
  field: string;
  message: string;
}

// API error response structure
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  fieldErrors?: FormError[];
}

// Network error type
export interface NetworkError {
  type: 'network';
  message: 'Connection error';
}

// Re-export pagination types from api.ts for convenience
export type { PaginationParams, PaginatedResponse } from './api';
