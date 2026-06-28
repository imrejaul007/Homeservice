import { AxiosError } from 'axios';

export const FEATURE_UNAVAILABLE_MESSAGE =
  'This feature is not available yet. Check back after the next release.';

export const API_ERROR_MESSAGE = 'Failed to load data. Please try again.';

export function isFeatureUnavailable(error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status;
  const code = (error as AxiosError<{ code?: string }>)?.response?.data?.code;
  return status === 503 || status === 501 || code === 'FEATURE_NOT_AVAILABLE';
}

export function isNotFound(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 404;
}

export function getAdminFetchErrorMessage(error: unknown): string {
  if (isFeatureUnavailable(error) || isNotFound(error)) {
    return FEATURE_UNAVAILABLE_MESSAGE;
  }
  const message = (error as AxiosError<{ message?: string; error?: string }>)?.response?.data
    ?.message;
  if (message) return message;
  if (error instanceof Error && error.message) return error.message;
  return API_ERROR_MESSAGE;
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}
