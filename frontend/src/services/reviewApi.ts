// Re-export everything from the unified reviewsApi for backwards compatibility
// All review functionality is now consolidated in reviewsApi.ts
export {
  reviewsApi,
  default,
} from './reviewsApi';

export type {
  Review,
  ProviderReviewScope,
  ReviewsApiError,
} from './reviewsApi';

export {
  ReviewsApiError,
} from './reviewsApi';
