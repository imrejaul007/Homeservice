/**
 * Service Interface Contracts for NILIN Marketplace
 *
 * This module defines the contracts (interfaces) that all services must implement,
 * ensuring consistency, type safety, and proper separation of concerns across the
 * marketplace platform.
 *
 * Architecture Pattern: Dependency Inversion (DIP)
 * High-level modules should not depend on low-level modules. Both should depend on abstractions.
 *
 * @module interfaces/service.interface
 */

import { Document, Types } from 'mongoose';

// =============================================================================
// Base Service Interface
// =============================================================================

/**
 * Base interface for all services in the application.
 * Provides common lifecycle and operational methods.
 */
export interface IServiceBase {
  /**
   * Initialize the service and any required dependencies.
   * Called once during application startup.
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup resources when service is shutting down.
   * Called during application shutdown.
   */
  cleanup?(): Promise<void>;
}

/**
 * Generic service interface with standard CRUD operations.
 * Used as a base for services that manage entities.
 *
 * @typeParam T - The entity type this service manages
 * @typeParam CreateDTO - DTO for creating new entities
 * @typeParam UpdateDTO - DTO for updating existing entities
 */
export interface IServiceCrud<T, CreateDTO, UpdateDTO> extends IServiceBase {
  /**
   * Create a new entity
   * @param data - The data for creating the entity
   * @returns The created entity
   */
  create(data: CreateDTO): Promise<T>;

  /**
   * Find an entity by its ID
   * @param id - The entity ID
   * @returns The entity or null if not found
   */
  findById(id: string | Types.ObjectId): Promise<T | null>;

  /**
   * Find all entities with optional filtering and pagination
   * @param filter - Optional filter criteria
   * @param pagination - Optional pagination parameters
   * @returns Paginated result with items and metadata
   */
  findAll?(filter?: Record<string, unknown>, pagination?: IPaginationParams): Promise<IPaginatedResult<T>>;

  /**
   * Update an existing entity
   * @param id - The entity ID
   * @param data - The update data
   * @returns The updated entity or null if not found
   */
  update(id: string | Types.ObjectId, data: UpdateDTO): Promise<T | null>;

  /**
   * Soft delete an entity (mark as deleted)
   * @param id - The entity ID
   * @returns The deleted entity or null if not found
   */
  delete?(id: string | Types.ObjectId): Promise<T | null>;

  /**
   * Hard delete an entity (permanent removal)
   * @param id - The entity ID
   * @returns True if deleted, false if not found
   */
  hardDelete?(id: string | Types.ObjectId): Promise<boolean>;
}

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * Standard pagination parameters
 */
export interface IPaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result structure
 */
export interface IPaginatedResult<T> {
  /** Array of items on current page */
  items: T[];
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages */
  hasNext: boolean;
  /** Whether there are previous pages */
  hasPrev: boolean;
}

// =============================================================================
// Booking Service Interface
// =============================================================================

/**
 * Booking service interface defining all booking-related operations
 */
export interface IBookingService extends IServiceBase {
  /**
   * Create a new customer booking
   * @param customerId - The customer's user ID
   * @param data - Booking creation data
   * @returns Created booking result with confirmation details
   */
  createCustomerBooking(customerId: string, data: IBookingInputDTO): Promise<IBookingResult>;

  /**
   * Create a guest booking without customer account
   * @param data - Guest booking data
   * @returns Created guest booking result
   */
  createGuestBooking(data: IGuestBookingInputDTO): Promise<IGuestBookingResult>;

  /**
   * Get booking by ID for a specific user
   * @param bookingId - The booking ID
   * @param userId - The requesting user's ID
   * @param userRole - The requesting user's role
   * @returns Booking details
   */
  getBookingById(
    bookingId: string,
    userId: string,
    userRole: 'customer' | 'provider' | 'admin'
  ): Promise<IBookingDetail | null>;

  /**
   * Get bookings for a customer
   * @param customerId - The customer's user ID
   * @param filters - Optional filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of bookings
   */
  getCustomerBookings(
    customerId: string,
    filters?: IBookingFilters,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IBookingSummary>>;

  /**
   * Get bookings for a provider
   * @param providerId - The provider's user ID
   * @param filters - Optional filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of bookings
   */
  getProviderBookings(
    providerId: string,
    filters?: IBookingFilters,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IBookingSummary>>;

  /**
   * Update booking status
   * @param bookingId - The booking ID
   * @param newStatus - The new status
   * @param userId - The user performing the update
   * @param reason - Optional reason for status change
   * @returns Updated booking
   */
  updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    userId: string,
    reason?: string
  ): Promise<IBookingDetail | null>;

  /**
   * Cancel a booking
   * @param bookingId - The booking ID
   * @param userId - The user cancelling
   * @param reason - Cancellation reason
   * @returns Cancellation result with refund info
   */
  cancelBooking(bookingId: string, userId: string, reason?: string): Promise<ICancellationResult>;

  /**
   * Get public booking tracking info
   * @param bookingNumber - The booking reference number
   * @returns Public tracking information
   */
  getPublicBookingTracking(bookingNumber: string): Promise<IPublicTrackingInfo | null>;
}

/**
 * Booking status enum
 */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * Location type enum
 * Standardized values for booking location types
 * Note: 'hotel' is an alias for 'at_hotel' - backend normalizes these
 */
export type LocationType = 'at_home' | 'at_provider' | 'at_hotel' | 'hotel' | 'customer_address';

/**
 * Professional preference enum
 */
export type ProfessionalPreference = 'male' | 'female' | 'no_preference';

/**
 * Payment method enum
 */
export type PaymentMethod = 'apple_pay' | 'credit_card' | 'cash';

/**
 * Booking input for customer bookings
 */
export interface IBookingInputDTO {
  serviceId: string;
  providerId: string;
  scheduledDate: string;
  scheduledTime: string;
  locationType: LocationType;
  selectedDuration: number;
  professionalPreference: ProfessionalPreference;
  paymentMethod: PaymentMethod;
  location?: IBookingLocation;
  addOns?: string[];
  couponCode?: string;
  notes?: string;
}

/**
 * Guest booking input
 */
export interface IGuestBookingInputDTO {
  serviceId: string;
  providerId: string;
  scheduledDate: string;
  scheduledTime: string;
  locationType: LocationType;
  selectedDuration: number;
  professionalPreference: ProfessionalPreference;
  paymentMethod: PaymentMethod;
  guestInfo: {
    name: string;
    email: string;
    phone: string;
  };
  location?: IBookingLocation;
  addOns?: string[];
  notes?: string;
}

/**
 * Booking location data
 */
export interface IBookingLocation {
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  notes?: string;
}

/**
 * Booking filters
 */
export interface IBookingFilters {
  status?: BookingStatus[];
  dateFrom?: string;
  dateTo?: string;
  providerId?: string;
  serviceId?: string;
  search?: string;
}

/**
 * Booking result from creation
 */
export interface IBookingResult {
  success: boolean;
  booking: IBookingDetail;
  pricing: IBookingPricing;
  confirmationNumber: string;
}

/**
 * Guest booking result
 */
export interface IGuestBookingResult {
  success: boolean;
  booking: IBookingDetail;
  pricing: IBookingPricing;
  confirmationNumber: string;
  guestToken: string; // For tracking guest booking
}

/**
 * Booking detail view
 */
export interface IBookingDetail {
  _id: string;
  bookingNumber: string;
  customerId?: string;
  providerId: string;
  serviceId: string;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  locationType: LocationType;
  pricing: IBookingPricing;
  customerInfo?: ICustomerInfo;
  providerInfo?: IProviderInfo;
  serviceInfo?: IServiceInfo;
  statusHistory: IStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Booking summary for list views
 */
export interface IBookingSummary {
  _id: string;
  bookingNumber: string;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  totalAmount: number;
  currency: string;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
  };
  providerInfo?: {
    businessName?: string;
  };
  serviceInfo?: {
    name: string;
  };
}

/**
 * Booking pricing details
 */
export interface IBookingPricing {
  basePrice: number;
  addOns: Array<{ name: string; price: number }>;
  discounts: Array<{ type: string; amount: number; description: string }>;
  subtotal: number;
  tax: number;
  totalAmount: number;
  currency: string;
}

/**
 * Customer info snapshot
 */
export interface ICustomerInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  specialRequests?: string;
}

/**
 * Provider info snapshot
 */
export interface IProviderInfo {
  businessName?: string;
  displayName?: string;
  phone?: string;
  profileImage?: string;
}

/**
 * Service info snapshot
 */
export interface IServiceInfo {
  name: string;
  description?: string;
  category?: string;
  image?: string;
}

/**
 * Status history entry
 */
export interface IStatusHistoryEntry {
  status: string;
  timestamp: string;
  reason?: string;
  updatedBy: 'customer' | 'provider' | 'system' | 'admin';
  notes?: string;
}

/**
 * Cancellation result
 */
export interface ICancellationResult {
  success: boolean;
  bookingId: string;
  cancelledAt: string;
  refundStatus: 'pending' | 'processed' | 'not_applicable';
  refundAmount?: number;
  cancellationReason?: string;
}

/**
 * Public tracking info (limited data)
 */
export interface IPublicTrackingInfo {
  bookingNumber: string;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  serviceName: string;
  providerName: string;
  providerPhone?: string;
}

// =============================================================================
// Provider Service Interface
// =============================================================================

/**
 * Provider service interface
 */
export interface IProviderService extends IServiceBase {
  /**
   * Create a new provider profile
   * @param userId - The user ID
   * @param data - Profile data
   * @returns Created profile
   */
  createProfile(userId: string, data: IProviderProfileDTO): Promise<IProviderProfile>;

  /**
   * Get provider profile by user ID
   * @param userId - The user ID
   * @returns Provider profile or null
   */
  getProfileByUserId(userId: string): Promise<IProviderProfile | null>;

  /**
   * Update provider profile
   * @param userId - The user ID
   * @param data - Update data
   * @returns Updated profile
   */
  updateProfile(userId: string, data: Partial<IProviderProfileDTO>): Promise<IProviderProfile | null>;

  /**
   * Get available slots for a provider
   * @param providerId - The provider user ID
   * @param date - The date to check
   * @param duration - Required duration in minutes
   * @returns Array of available time slots
   */
  getAvailableSlots(
    providerId: string,
    date: string,
    duration: number
  ): Promise<IAvailableSlot[]>;

  /**
   * Verify provider documents
   * @param providerId - The provider user ID
   * @param documents - Document data
   * @returns Verification result
   */
  submitDocuments(
    providerId: string,
    documents: IVerificationDocument[]
  ): Promise<IVerificationResult>;

  /**
   * Search providers by criteria
   * @param criteria - Search criteria
   * @param pagination - Pagination params
   * @returns Paginated provider results
   */
  searchProviders(
    criteria: IProviderSearchCriteria,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IProviderSearchResult>>;
}

/**
 * Provider profile data
 */
export interface IProviderProfileDTO {
  businessName: string;
  displayName?: string;
  description?: string;
  categories: string[];
  services: string[];
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  workingHours: IWorkingHours;
  serviceArea?: {
    type: 'radius' | 'zone';
    radius?: number;
    zones?: string[];
  };
  isMobile: boolean;
  images?: string[];
}

/**
 * Provider profile
 */
export interface IProviderProfile extends IProviderProfileDTO {
  _id: string;
  userId: string;
  isVerified: boolean;
  verificationStatus: 'pending' | 'in_review' | 'approved' | 'rejected';
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  responseRate: number;
  responseTime: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Working hours for a day
 */
export interface IWorkingHours {
  [day: string]: {
    enabled: boolean;
    slots: Array<{
      start: string; // "09:00"
      end: string; // "17:00"
    }>;
  };
}

/**
 * Available time slot
 */
export interface IAvailableSlot {
  time: string; // "09:00"
  available: boolean;
  duration?: number;
}

/**
 * Verification document
 */
export interface IVerificationDocument {
  type: 'id' | 'license' | 'insurance' | 'certification' | 'address_proof';
  documentUrl: string;
  documentNumber?: string;
  expiryDate?: string;
}

/**
 * Verification result
 */
export interface IVerificationResult {
  success: boolean;
  submissionId: string;
  estimatedReviewTime: string;
}

/**
 * Provider search criteria
 */
export interface IProviderSearchCriteria {
  query?: string;
  categories?: string[];
  location?: {
    coordinates: [number, number];
    radiusKm: number;
  };
  minRating?: number;
  isAvailable?: boolean;
  isVerified?: boolean;
  isMobile?: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
  date?: string;
  time?: string;
  duration?: number;
}

/**
 * Provider search result
 */
export interface IProviderSearchResult {
  _id: string;
  userId: string;
  businessName: string;
  displayName?: string;
  description?: string;
  categories: string[];
  averageRating: number;
  totalReviews: number;
  location: {
    city: string;
    state: string;
  };
  isMobile: boolean;
  isVerified: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
  thumbnail?: string;
  nextAvailable?: {
    date: string;
    time: string;
  };
}

// =============================================================================
// Service (Marketplace Service/Product) Interface
// =============================================================================

/**
 * Service (product) service interface
 */
export interface IServiceService extends IServiceBase {
  /**
   * Create a new service
   * @param providerId - The provider user ID
   * @param data - Service data
   * @returns Created service
   */
  createService(providerId: string, data: IServiceDTO): Promise<IServiceEntity>;

  /**
   * Get service by ID
   * @param serviceId - The service ID
   * @returns Service or null
   */
  getServiceById(serviceId: string): Promise<IServiceEntity | null>;

  /**
   * Update service
   * @param serviceId - The service ID
   * @param providerId - The provider user ID (for authorization)
   * @param data - Update data
   * @returns Updated service
   */
  updateService(
    serviceId: string,
    providerId: string,
    data: Partial<IServiceDTO>
  ): Promise<IServiceEntity | null>;

  /**
   * Delete service
   * @param serviceId - The service ID
   * @param providerId - The provider user ID (for authorization)
   * @returns True if deleted
   */
  deleteService(serviceId: string, providerId: string): Promise<boolean>;

  /**
   * Get services by provider
   * @param providerId - The provider user ID
   * @param pagination - Pagination params
   * @returns Paginated services
   */
  getProviderServices(
    providerId: string,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IServiceEntity>>;

  /**
   * Search services
   * @param criteria - Search criteria
   * @param pagination - Pagination params
   * @returns Paginated results
   */
  searchServices(
    criteria: IServiceSearchCriteria,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IServiceSearchResult>>;

  /**
   * Get service categories
   * @returns All categories with subcategories
   */
  getCategories(): Promise<IServiceCategory[]>;
}

/**
 * Service entity DTO
 */
export interface IServiceDTO {
  name: string;
  description: string;
  categoryId: string;
  subcategoryId?: string;
  basePrice: number;
  duration: number;
  durationOptions?: Array<{
    duration: number;
    price: number;
    label?: string;
  }>;
  addOns?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  images?: string[];
  isActive: boolean;
  isFeatured?: boolean;
}

/**
 * Service entity
 */
export interface IServiceEntity extends IServiceDTO {
  _id: string;
  providerId: string;
  averageRating: number;
  totalBookings: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service search criteria
 */
export interface IServiceSearchCriteria {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  providerId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  location?: {
    coordinates: [number, number];
    radiusKm: number;
  };
  isFeatured?: boolean;
}

/**
 * Service search result
 */
export interface IServiceSearchResult {
  _id: string;
  name: string;
  description: string;
  basePrice: number;
  duration: number;
  providerId: string;
  providerName: string;
  providerRating: number;
  categoryName: string;
  thumbnail?: string;
  averageRating: number;
  totalBookings: number;
  isFeatured: boolean;
}

/**
 * Service category
 */
export interface IServiceCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  subcategories: Array<{
    _id: string;
    name: string;
    slug: string;
    description?: string;
  }>;
}

// =============================================================================
// Payment Service Interface
// =============================================================================

/**
 * Payment service interface
 */
export interface IPaymentService extends IServiceBase {
  /**
   * Process a payment for a booking
   * @param bookingId - The booking ID
   * @param paymentMethod - Payment method
   * @param customerId - The customer user ID
   * @returns Payment result
   */
  processPayment(
    bookingId: string,
    paymentMethod: PaymentMethod,
    customerId: string
  ): Promise<IPaymentResult>;

  /**
   * Process refund for cancelled booking
   * @param bookingId - The booking ID
   * @param reason - Refund reason
   * @returns Refund result
   */
  processRefund(bookingId: string, reason?: string): Promise<IRefundResult>;

  /**
   * Get payment status
   * @param paymentId - The payment ID
   * @returns Payment status
   */
  getPaymentStatus(paymentId: string): Promise<IPaymentStatus>;

  /**
   * Create payment intent (for Stripe, etc.)
   * @param bookingId - The booking ID
   * @param customerId - The customer user ID
   * @returns Payment intent data
   */
  createPaymentIntent(bookingId: string, customerId: string): Promise<IPaymentIntent>;
}

/**
 * Payment result
 */
export interface IPaymentResult {
  success: boolean;
  paymentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  error?: string;
}

/**
 * Refund result
 */
export interface IRefundResult {
  success: boolean;
  refundId: string;
  originalPaymentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
  estimatedArrival?: string;
  error?: string;
}

/**
 * Payment status
 */
export interface IPaymentStatus {
  paymentId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  amount: number;
  currency: string;
  transactions: Array<{
    id: string;
    type: 'charge' | 'refund';
    amount: number;
    timestamp: string;
    status: string;
  }>;
}

/**
 * Payment intent data
 */
export interface IPaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

// =============================================================================
// Auth Service Interface
// =============================================================================

/**
 * Authentication service interface
 */
export interface IAuthService extends IServiceBase {
  /**
   * Register a new user
   * @param data - Registration data
   * @returns Registration result with tokens
   */
  register(data: IRegisterDTO): Promise<IAuthResult>;

  /**
   * Login user
   * @param email - User email
   * @param password - User password
   * @returns Login result with tokens
   */
  login(email: string, password: string): Promise<IAuthResult>;

  /**
   * Logout user
   * @param userId - User ID
   * @param refreshToken - Refresh token to invalidate
   */
  logout(userId: string, refreshToken?: string): Promise<void>;

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   * @returns New tokens
   */
  refreshToken(refreshToken: string): Promise<ITokenPair>;

  /**
   * Request password reset
   * @param email - User email
   */
  requestPasswordReset(email: string): Promise<void>;

  /**
   * Reset password with token
   * @param token - Reset token
   * @param newPassword - New password
   */
  resetPassword(token: string, newPassword: string): Promise<void>;

  /**
   * Verify email
   * @param token - Verification token
   */
  verifyEmail(token: string): Promise<void>;

  /**
   * Enable 2FA
   * @param userId - User ID
   * @returns QR code and secret for authenticator app
   */
  enable2FA(userId: string): Promise<ITwoFactorSetup>;

  /**
   * Verify 2FA code
   * @param userId - User ID
   * @param code - TOTP code
   * @returns Whether verification succeeded
   */
  verify2FA(userId: string, code: string): Promise<boolean>;
}

/**
 * Registration data
 */
export interface IRegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'customer' | 'provider';
}

/**
 * Authentication result
 */
export interface IAuthResult {
  success: boolean;
  user: IUserInfo;
  tokens: ITokenPair;
}

/**
 * User info (safe to expose to client)
 */
export interface IUserInfo {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'provider' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
}

/**
 * Token pair
 */
export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/**
 * Two-factor authentication setup
 */
export interface ITwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

// =============================================================================
// Notification Service Interface
// =============================================================================

/**
 * Notification service interface
 */
export interface INotificationService extends IServiceBase {
  /**
   * Send a notification
   * @param userId - Target user ID
   * @param notification - Notification data
   * @returns Notification ID
   */
  send(userId: string, notification: INotificationData): Promise<string>;

  /**
   * Get user notifications
   * @param userId - User ID
   * @param pagination - Pagination params
   * @returns Paginated notifications
   */
  getUserNotifications(
    userId: string,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<INotification>>;

  /**
   * Mark notification as read
   * @param notificationId - Notification ID
   * @param userId - User ID (for authorization)
   */
  markAsRead(notificationId: string, userId: string): Promise<void>;

  /**
   * Mark all notifications as read
   * @param userId - User ID
   */
  markAllAsRead(userId: string): Promise<void>;

  /**
   * Delete a notification
   * @param notificationId - Notification ID
   * @param userId - User ID (for authorization)
   */
  deleteNotification(notificationId: string, userId: string): Promise<void>;

  /**
   * Get unread count
   * @param userId - User ID
   * @returns Number of unread notifications
   */
  getUnreadCount(userId: string): Promise<number>;
}

/**
 * Notification data for sending
 */
export interface INotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: Array<'push' | 'email' | 'sms'>;
}

/**
 * Notification type enum
 */
export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'review_request'
  | 'payment_received'
  | 'refund_processed'
  | 'new_message'
  | 'offer_available'
  | 'dispute_received'
  | 'dispute_resolved'
  | 'system';

/**
 * Notification entity
 */
export interface INotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// =============================================================================
// Search Service Interface
// =============================================================================

/**
 * Search service interface
 */
export interface ISearchService extends IServiceBase {
  /**
   * Search across all entities
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  search(query: string, options?: ISearchOptions): Promise<ISearchResults>;

  /**
   * Search services
   * @param query - Search query
   * @param filters - Optional filters
   * @param pagination - Pagination params
   * @returns Paginated service results
   */
  searchServices(
    query: string,
    filters?: IServiceSearchCriteria,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IServiceSearchResult>>;

  /**
   * Search providers
   * @param query - Search query
   * @param filters - Optional filters
   * @param pagination - Pagination params
   * @returns Paginated provider results
   */
  searchProviders(
    query: string,
    filters?: IProviderSearchCriteria,
    pagination?: IPaginationParams
  ): Promise<IPaginatedResult<IProviderSearchResult>>;

  /**
   * Get search suggestions
   * @param query - Partial query
   * @param limit - Maximum suggestions
   * @returns Array of suggestions
   */
  getSuggestions(query: string, limit?: number): Promise<ISearchSuggestion[]>;

  /**
   * Index a service for search
   * @param serviceId - Service ID
   */
  indexService(serviceId: string): Promise<void>;

  /**
   * Remove service from search index
   * @param serviceId - Service ID
   */
  removeServiceFromIndex(serviceId: string): Promise<void>;
}

/**
 * Search options
 */
export interface ISearchOptions {
  filters?: {
    categoryId?: string;
    location?: {
      coordinates: [number, number];
      radiusKm: number;
    };
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
  };
  highlight?: boolean;
  fuzzy?: boolean;
}

/**
 * Search results
 */
export interface ISearchResults {
  services: IServiceSearchResult[];
  providers: IProviderSearchResult[];
  categories: IServiceCategory[];
  totalResults: number;
  query: string;
  took: number; // milliseconds
}

/**
 * Search suggestion
 */
export interface ISearchSuggestion {
  text: string;
  type: 'service' | 'provider' | 'category';
  count?: number;
}

// All types are already exported via 'export type' declarations above.
// This module serves as the central export point for service interfaces.
