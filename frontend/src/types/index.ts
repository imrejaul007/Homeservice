// API Types
export * from './api';

// Auth Types
export * from './auth';

// Existing type exports
export * from './category';
export * from './experience';
export * from './location.types';
export * from './provider';
export * from './service';

// Chat Types
export * from './chat';

// Offer types (exclude ApiResponse to avoid conflict)
export type { Offer, ClaimedOffer, ClaimResponse, ValidationResult } from './offer';
import type { Offer, ClaimedOffer, ClaimResponse, ValidationResult } from './offer';

// Search types (exclude Service to avoid conflict)
import type { SearchFilters, SearchResponse } from './search';
export type { SearchFilters, SearchResponse };

// Booking types (unified from BookingService.ts and bookingApi.ts)
export * from './booking.types';

// Subscription types (unified tier types across codebase)
export * from './subscription.types';
