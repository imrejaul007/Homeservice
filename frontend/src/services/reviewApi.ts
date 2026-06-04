// Re-export everything from the unified reviewsApi for backwards compatibility
// All review functionality is now consolidated in reviewsApi.ts
export {
  reviewsApi,
  default,
  ReviewsApiError,
} from './reviewsApi';

export type {
  Review,
  ProviderReviewScope,
} from './reviewsApi';
