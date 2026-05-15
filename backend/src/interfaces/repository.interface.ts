/**
 * Repository Interface Contracts for NILIN Marketplace
 *
 * This module defines the data access contracts (interfaces) that all repositories
 * must implement, ensuring consistent data access patterns, proper error handling,
 * and database-agnostic abstractions.
 *
 * Architecture Pattern: Repository Pattern
 * Abstracts data access logic from business logic, enabling easier testing and
 * potential database migration.
 *
 * @module interfaces/repository.interface
 */

import { Document, Types, FilterQuery, UpdateQuery, PipelineStage } from 'mongoose';
import { IPaginatedResult, IAvailableSlot } from './service.interface';

// =============================================================================
// Base Repository Interface
// =============================================================================

/**
 * Base interface for all repositories.
 * Provides common CRUD operations and query capabilities.
 *
 * @typeParam T - The document type this repository manages
 */
export interface IRepositoryBase<T extends Document> {
  /**
   * Find a document by its ID
   * @param id - Document ID
   * @param options - Query options (populate, select, lean)
   * @returns Document or null
   */
  findById(
    id: string | Types.ObjectId,
    options?: IQueryOptions
  ): Promise<T | null>;

  /**
   * Find a single document matching filter
   * @param filter - Query filter
   * @param options - Query options
   * @returns Document or null
   */
  findOne(
    filter: FilterQuery<T>,
    options?: IQueryOptions
  ): Promise<T | null>;

  /**
   * Find all documents matching filter
   * @param filter - Query filter
   * @param options - Query options (pagination, sort, select)
   * @returns Array of documents
   */
  findAll(
    filter: FilterQuery<T>,
    options?: IQueryOptions & IPaginationOptions
  ): Promise<T[]>;

  /**
   * Find documents with pagination
   * @param filter - Query filter
   * @param options - Query and pagination options
   * @returns Paginated result
   */
  findPaginated(
    filter: FilterQuery<T>,
    options?: IQueryOptions & IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<T>>;

  /**
   * Count documents matching filter
   * @param filter - Query filter
   * @returns Count of matching documents
   */
  count(filter?: FilterQuery<T>): Promise<number>;

  /**
   * Create a new document
   * @param data - Document data
   * @returns Created document
   */
  create(data: Partial<T>): Promise<T>;

  /**
   * Create multiple documents
   * @param data - Array of document data
   * @returns Created documents
   */
  createMany(data: Partial<T>[]): Promise<T[]>;

  /**
   * Update a document by ID
   * @param id - Document ID
   * @param update - Update data
   * @param options - Update options
   * @returns Updated document or null
   */
  updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    options?: IUpdateOptions
  ): Promise<T | null>;

  /**
   * Update a single document matching filter
   * @param filter - Query filter
   * @param update - Update data
   * @param options - Update options
   * @returns Updated document or null
   */
  updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: IUpdateOptions
  ): Promise<T | null>;

  /**
   * Update multiple documents
   * @param filter - Query filter
   * @param update - Update data
   * @param options - Update options
   * @returns Number of modified documents
   */
  updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: IUpdateOptions
  ): Promise<number>;

  /**
   * Delete a document by ID
   * @param id - Document ID
   * @returns Deleted document or null
   */
  deleteById(id: string | Types.ObjectId): Promise<T | null>;

  /**
   * Delete a single document matching filter
   * @param filter - Query filter
   * @returns Deleted document or null
   */
  deleteOne(filter: FilterQuery<T>): Promise<T | null>;

  /**
   * Delete multiple documents
   * @param filter - Query filter
   * @returns Number of deleted documents
   */
  deleteMany(filter: FilterQuery<T>): Promise<number>;

  /**
   * Check if document exists
   * @param filter - Query filter
   * @returns True if exists
   */
  exists(filter: FilterQuery<T>): Promise<boolean>;

  /**
   * Execute aggregation pipeline
   * @param pipeline - Aggregation pipeline stages
   * @returns Aggregation results
   */
  aggregate<R = unknown>(pipeline: PipelineStage[]): Promise<R[]>;
}

// =============================================================================
// Query Options
// =============================================================================

/**
 * Common query options
 */
export interface IQueryOptions {
  /** Fields to populate */
  populate?: string | Array<string | IPopulateConfig>;
  /** Fields to select */
  select?: string | Record<string, number>;
  /** Return plain objects instead of documents */
  lean?: boolean;
  /** Enable query caching */
  cache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Populate configuration
 */
export interface IPopulateConfig {
  /** Field path to populate */
  path: string;
  /** Fields to select from populated document */
  select?: string;
  /** Match condition for population */
  match?: Record<string, unknown>;
  /** Field to use for population */
  foreignField?: string;
  /** Limit results from population */
  limit?: number;
}

/**
 * Pagination options
 */
export interface IPaginationOptions {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Offset (alternative to page) */
  skip?: number;
}

/**
 * Sort options
 */
export interface ISortOptions {
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Multiple sort fields */
  sort?: Record<string, 'asc' | 'desc'>;
}

/**
 * Update options
 */
export interface IUpdateOptions {
  /** Return updated document */
  new?: boolean;
  /** Run validators */
  runValidators?: boolean;
  /** Allow empty updates */
  allowEmpty?: boolean;
  /** Upsert if not found */
  upsert?: boolean;
}

// =============================================================================
// Booking Repository Interface
// =============================================================================

/**
 * Booking repository interface
 */
export interface IBookingRepository extends IRepositoryBase<IBookingDocument> {
  /**
   * Find bookings by customer ID
   * @param customerId - Customer user ID
   * @param filter - Additional filter
   * @param options - Pagination options
   * @returns Paginated bookings
   */
  findByCustomerId(
    customerId: string | Types.ObjectId,
    filter?: Partial<IBookingFilter>,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IBookingDocument>>;

  /**
   * Find bookings by provider ID
   * @param providerId - Provider user ID
   * @param filter - Additional filter
   * @param options - Pagination options
   * @returns Paginated bookings
   */
  findByProviderId(
    providerId: string | Types.ObjectId,
    filter?: Partial<IBookingFilter>,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IBookingDocument>>;

  /**
   * Find booking by booking number
   * @param bookingNumber - Unique booking reference
   * @returns Booking or null
   */
  findByBookingNumber(bookingNumber: string): Promise<IBookingDocument | null>;

  /**
   * Find bookings by status
   * @param status - Booking status
   * @param options - Pagination options
   * @returns Paginated bookings
   */
  findByStatus(
    status: string | string[],
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IBookingDocument>>;

  /**
   * Find bookings in date range
   * @param startDate - Start date
   * @param endDate - End date
   * @param filter - Additional filter
   * @param options - Pagination options
   * @returns Paginated bookings
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    filter?: Partial<IBookingFilter>,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IBookingDocument>>;

  /**
   * Find conflicting bookings (for availability check)
   * @param providerId - Provider ID
   * @param date - Booking date
   * @param startTime - Start time
   * @param duration - Duration in minutes
   * @returns Conflicting bookings
   */
  findConflictingBookings(
    providerId: string | Types.ObjectId,
    date: Date,
    startTime: string,
    duration: number
  ): Promise<IBookingDocument[]>;

  /**
   * Get booking statistics
   * @param filter - Filter criteria
   * @returns Booking statistics
   */
  getStatistics(filter?: Partial<IBookingStatsFilter>): Promise<IBookingStatistics>;

  /**
   * Update booking status with history
   * @param id - Booking ID
   * @param newStatus - New status
   * @param updatedBy - Who updated
   * @param reason - Reason for change
   * @returns Updated booking
   */
  updateStatusWithHistory(
    id: string | Types.ObjectId,
    newStatus: string,
    updatedBy: 'customer' | 'provider' | 'system' | 'admin',
    reason?: string
  ): Promise<IBookingDocument | null>;
}

/**
 * Booking document interface (for type-safe repository)
 */
export interface IBookingDocument extends Document {
  bookingNumber: string;
  customerId?: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  isGuestBooking: boolean;
  guestInfo?: {
    name: string;
    email: string;
    phone: string;
  };
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  estimatedEndTime: Date;
  locationType: 'at_home' | 'hotel';
  selectedDuration: number;
  professionalPreference: 'male' | 'female' | 'no_preference';
  paymentMethod: 'apple_pay' | 'credit_card' | 'cash';
  location: {
    type: string;
    address: {
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
  };
  status: string;
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    reason?: string;
    updatedBy: 'customer' | 'provider' | 'system' | 'admin';
    notes?: string;
  }>;
  pricing: {
    basePrice: number;
    addOns: Array<{ name: string; price: number }>;
    discounts: Array<{ type: string; amount: number; description: string }>;
    subtotal: number;
    tax: number;
    totalAmount: number;
    currency: string;
  };
  customerInfo: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    specialRequests?: string;
    accessInstructions?: string;
  };
  providerResponse: {
    acceptedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
    estimatedArrival?: Date;
    arrivalTime?: Date;
    completedAt?: Date;
    notes?: string;
  };
  messages: Array<{
    _id: Types.ObjectId;
    from: Types.ObjectId;
    content: string;
    timestamp: Date;
    read: boolean;
  }>;
  cancellation?: {
    cancelledAt: Date;
    cancelledBy: 'customer' | 'provider' | 'system' | 'admin';
    reason: string;
    refundStatus: string;
    refundAmount?: number;
  };
  isReviewed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking filter for queries
 */
export interface IBookingFilter {
  status?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  providerId?: string;
  serviceId?: string;
  search?: string;
}

/**
 * Booking statistics filter
 */
export interface IBookingStatsFilter {
  providerId?: string;
  customerId?: string;
  serviceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Booking statistics result
 */
export interface IBookingStatistics {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  totalRevenue: number;
  averageBookingValue: number;
  cancellationRate: number;
}

// =============================================================================
// User Repository Interface
// =============================================================================

/**
 * User repository interface
 */
export interface IUserRepository extends IRepositoryBase<IUserDocument> {
  /**
   * Find user by email
   * @param email - User email
   * @returns User or null
   */
  findByEmail(email: string): Promise<IUserDocument | null>;

  /**
   * Find user by email (case-insensitive)
   * @param email - User email
   * @returns User or null
   */
  findByEmailCI(email: string): Promise<IUserDocument | null>;

  /**
   * Find users by role
   * @param role - User role
   * @param options - Pagination options
   * @returns Paginated users
   */
  findByRole(
    role: string,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IUserDocument>>;

  /**
   * Find users by provider status
   * @param isProvider - Whether user is a provider
   * @param options - Pagination options
   * @returns Paginated users
   */
  findByProviderStatus(
    isProvider: boolean,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IUserDocument>>;

  /**
   * Update user profile
   * @param id - User ID
   * @param profile - Profile data
   * @returns Updated user
   */
  updateProfile(
    id: string | Types.ObjectId,
    profile: Partial<IUserProfile>
  ): Promise<IUserDocument | null>;

  /**
   * Update user password
   * @param id - User ID
   * @param hashedPassword - Hashed password
   * @returns Updated user
   */
  updatePassword(
    id: string | Types.ObjectId,
    hashedPassword: string
  ): Promise<IUserDocument | null>;

  /**
   * Verify user email
   * @param id - User ID
   * @returns Updated user
   */
  verifyEmail(id: string | Types.ObjectId): Promise<IUserDocument | null>;

  /**
   * Check if email exists
   * @param email - Email to check
   * @param excludeUserId - User ID to exclude
   * @returns True if exists
   */
  emailExists(email: string, excludeUserId?: string): Promise<boolean>;
}

/**
 * User document interface
 */
export interface IUserDocument extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'provider' | 'admin';
  phone?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  isActive: boolean;
  isProvider: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  profileImage?: string;
  preferences: {
    language: string;
    currency: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User profile data
 */
export interface IUserProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImage?: string;
  preferences?: IUserDocument['preferences'];
}

// =============================================================================
// Service Repository Interface
// =============================================================================

/**
 * Service repository interface
 */
export interface IServiceRepository extends IRepositoryBase<IServiceDocument> {
  /**
   * Find services by provider ID
   * @param providerId - Provider user ID
   * @param options - Pagination options
   * @returns Paginated services
   */
  findByProviderId(
    providerId: string | Types.ObjectId,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IServiceDocument>>;

  /**
   * Find services by category
   * @param categoryId - Category ID
   * @param options - Pagination options
   * @returns Paginated services
   */
  findByCategory(
    categoryId: string | Types.ObjectId,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IServiceDocument>>;

  /**
   * Find featured services
   * @param limit - Maximum results
   * @returns Featured services
   */
  findFeatured(limit?: number): Promise<IServiceDocument[]>;

  /**
   * Find active services
   * @param options - Pagination options
   * @returns Paginated active services
   */
  findActive(options?: IPaginationOptions & ISortOptions): Promise<IPaginatedResult<IServiceDocument>>;

  /**
   * Search services by text
   * @param query - Search query
   * @param options - Pagination and filter options
   * @returns Paginated services
   */
  searchByText(
    query: string,
    options?: IPaginationOptions & ISortOptions & IServiceSearchOptions
  ): Promise<IPaginatedResult<IServiceDocument>>;

  /**
   * Update service availability
   * @param id - Service ID
   * @param isActive - Active status
   * @returns Updated service
   */
  setAvailability(
    id: string | Types.ObjectId,
    isActive: boolean
  ): Promise<IServiceDocument | null>;

  /**
   * Get services with pricing in range
   * @param minPrice - Minimum price
   * @param maxPrice - Maximum price
   * @param options - Pagination options
   * @returns Paginated services
   */
  findByPriceRange(
    minPrice: number,
    maxPrice: number,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IServiceDocument>>;
}

/**
 * Service document interface
 */
export interface IServiceDocument extends Document {
  name: string;
  description: string;
  providerId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subcategoryId?: Types.ObjectId;
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
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service search options
 */
export interface IServiceSearchOptions {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: {
    coordinates: [number, number];
    radiusKm: number;
  };
  providerId?: string;
}

// =============================================================================
// Provider Repository Interface
// =============================================================================

/**
 * Provider repository interface
 */
export interface IProviderRepository extends IRepositoryBase<IProviderDocument> {
  /**
   * Find provider by user ID
   * @param userId - User ID
   * @returns Provider or null
   */
  findByUserId(userId: string | Types.ObjectId): Promise<IProviderDocument | null>;

  /**
   * Find providers by verification status
   * @param status - Verification status
   * @param options - Pagination options
   * @returns Paginated providers
   */
  findByVerificationStatus(
    status: 'pending' | 'in_review' | 'approved' | 'rejected',
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IProviderDocument>>;

  /**
   * Find verified providers
   * @param options - Pagination options
   * @returns Paginated verified providers
   */
  findVerified(options?: IPaginationOptions & ISortOptions): Promise<IPaginatedResult<IProviderDocument>>;

  /**
   * Search providers
   * @param query - Search query
   * @param options - Search options
   * @returns Paginated providers
   */
  search(
    query: string,
    options?: IPaginationOptions & ISortOptions & IProviderSearchOptions
  ): Promise<IPaginatedResult<IProviderDocument>>;

  /**
   * Find providers by location
   * @param coordinates - [longitude, latitude]
   * @param radiusKm - Search radius in kilometers
   * @param options - Pagination options
   * @returns Paginated providers
   */
  findByLocation(
    coordinates: [number, number],
    radiusKm: number,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IProviderDocument>>;

  /**
   * Update provider rating
   * @param id - Provider ID
   * @param newRating - New average rating
   * @returns Updated provider
   */
  updateRating(
    id: string | Types.ObjectId,
    newRating: number
  ): Promise<IProviderDocument | null>;

  /**
   * Increment booking count
   * @param id - Provider ID
   * @returns Updated provider
   */
  incrementBookingCount(id: string | Types.ObjectId): Promise<IProviderDocument | null>;
}

/**
 * Provider document interface
 */
export interface IProviderDocument extends Document {
  userId: Types.ObjectId;
  businessName: string;
  displayName?: string;
  description?: string;
  categories: Types.ObjectId[];
  services: Types.ObjectId[];
  location: {
    type: string;
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
  workingHours: {
    [day: string]: {
      enabled: boolean;
      slots: Array<{
        start: string;
        end: string;
      }>;
    };
  };
  serviceArea?: {
    type: 'radius' | 'zone';
    radius?: number;
    zones?: string[];
  };
  isMobile: boolean;
  isVerified: boolean;
  verificationStatus: 'pending' | 'in_review' | 'approved' | 'rejected';
  verificationDocuments?: Array<{
    type: string;
    documentUrl: string;
    documentNumber?: string;
    expiryDate?: Date;
    verifiedAt?: Date;
  }>;
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  responseRate: number;
  responseTime: number;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider search options
 */
export interface IProviderSearchOptions {
  categories?: string[];
  minRating?: number;
  isVerified?: boolean;
  isMobile?: boolean;
  serviceArea?: {
    coordinates: [number, number];
    radiusKm: number;
  };
}

// =============================================================================
// Category Repository Interface
// =============================================================================

/**
 * Category repository interface
 */
export interface ICategoryRepository extends IRepositoryBase<ICategoryDocument> {
  /**
   * Find category by slug
   * @param slug - Category slug
   * @returns Category or null
   */
  findBySlug(slug: string): Promise<ICategoryDocument | null>;

  /**
   * Find category with subcategories
   * @param id - Category ID
   * @returns Category with populated subcategories
   */
  findWithSubcategories(id: string | Types.ObjectId): Promise<ICategoryDocument | null>;

  /**
   * Find all root categories (no parent)
   * @returns Root categories
   */
  findRootCategories(): Promise<ICategoryDocument[]>;

  /**
   * Find subcategories of a category
   * @param parentId - Parent category ID
   * @returns Subcategories
   */
  findSubcategories(parentId: string | Types.ObjectId): Promise<ICategoryDocument[]>;

  /**
   * Get category tree (all categories with subcategories)
   * @returns Category tree
   */
  getCategoryTree(): Promise<ICategoryDocument[]>;
}

/**
 * Category document interface
 */
export interface ICategoryDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  parentId?: Types.ObjectId;
  subcategories: Types.ObjectId[];
  order: number;
  isActive: boolean;
  metadata?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Review Repository Interface
// =============================================================================

/**
 * Review repository interface
 */
export interface IReviewRepository extends IRepositoryBase<IReviewDocument> {
  /**
   * Find reviews by service ID
   * @param serviceId - Service ID
   * @param options - Pagination options
   * @returns Paginated reviews
   */
  findByServiceId(
    serviceId: string | Types.ObjectId,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IReviewDocument>>;

  /**
   * Find reviews by provider ID
   * @param providerId - Provider user ID
   * @param options - Pagination options
   * @returns Paginated reviews
   */
  findByProviderId(
    providerId: string | Types.ObjectId,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IReviewDocument>>;

  /**
   * Find reviews by customer ID
   * @param customerId - Customer user ID
   * @param options - Pagination options
   * @returns Paginated reviews
   */
  findByCustomerId(
    customerId: string | Types.ObjectId,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IReviewDocument>>;

  /**
   * Find review by booking ID
   * @param bookingId - Booking ID
   * @returns Review or null
   */
  findByBookingId(bookingId: string | Types.ObjectId): Promise<IReviewDocument | null>;

  /**
   * Check if review exists for booking
   * @param bookingId - Booking ID
   * @returns True if exists
   */
  existsForBooking(bookingId: string | Types.ObjectId): Promise<boolean>;

  /**
   * Get average rating for service
   * @param serviceId - Service ID
   * @returns Average rating and count
   */
  getServiceRating(serviceId: string | Types.ObjectId): Promise<{ average: number; count: number }>;

  /**
   * Get average rating for provider
   * @param providerId - Provider user ID
   * @returns Average rating and count
   */
  getProviderRating(providerId: string | Types.ObjectId): Promise<{ average: number; count: number }>;
}

/**
 * Review document interface
 */
export interface IReviewDocument extends Document {
  bookingId: Types.ObjectId;
  serviceId: Types.ObjectId;
  providerId: Types.ObjectId;
  customerId: Types.ObjectId;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  isPublic: boolean;
  providerResponse?: {
    response: string;
    respondedAt: Date;
  };
  helpfulCount: number;
  reportCount: number;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Availability Repository Interface
// =============================================================================

/**
 * Availability repository interface
 */
export interface IAvailabilityRepository extends IRepositoryBase<IAvailabilityDocument> {
  /**
   * Find availability by provider and date
   * @param providerId - Provider user ID
   * @param date - Date
   * @returns Availability or null
   */
  findByProviderAndDate(
    providerId: string | Types.ObjectId,
    date: Date
  ): Promise<IAvailabilityDocument | null>;

  /**
   * Find availability range
   * @param providerId - Provider user ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Availability documents
   */
  findByProviderAndDateRange(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<IAvailabilityDocument[]>;

  /**
   * Get available slots for date
   * @param providerId - Provider user ID
   * @param date - Date
   * @param duration - Required duration in minutes
   * @returns Available time slots
   */
  getAvailableSlots(
    providerId: string | Types.ObjectId,
    date: Date,
    duration: number
  ): Promise<IAvailableSlot[]>;

  /**
   * Block time slot
   * @param providerId - Provider user ID
   * @param date - Date
   * @param startTime - Start time
   * @param endTime - End time
   * @param reason - Block reason
   * @returns Updated availability
   */
  blockTimeSlot(
    providerId: string | Types.ObjectId,
    date: Date,
    startTime: string,
    endTime: string,
    reason?: string
  ): Promise<IAvailabilityDocument | null>;

  /**
   * Unblock time slot
   * @param providerId - Provider user ID
   * @param date - Date
   * @param startTime - Start time
   * @param endTime - End time
   * @returns Updated availability
   */
  unblockTimeSlot(
    providerId: string | Types.ObjectId,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<IAvailabilityDocument | null>;
}

/**
 * Availability document interface
 */
export interface IAvailabilityDocument extends Document {
  providerId: Types.ObjectId;
  date: Date;
  slots: Array<{
    start: string;
    end: string;
    isBooked: boolean;
    bookingId?: Types.ObjectId;
    isBlocked: boolean;
    blockReason?: string;
  }>;
  overrides?: {
    isAvailable: boolean;
    reason?: string;
    slots?: IAvailabilityDocument['slots'];
  };
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Wallet Repository Interface
// =============================================================================

/**
 * Wallet repository interface
 */
export interface IWalletRepository extends IRepositoryBase<IWalletDocument> {
  /**
   * Find wallet by user ID
   * @param userId - User ID
   * @returns Wallet or null
   */
  findByUserId(userId: string | Types.ObjectId): Promise<IWalletDocument | null>;

  /**
   * Find or create wallet for user
   * @param userId - User ID
   * @returns Wallet
   */
  findOrCreate(userId: string | Types.ObjectId): Promise<IWalletDocument>;

  /**
   * Add transaction to wallet
   * @param walletId - Wallet ID
   * @param transaction - Transaction data
   * @returns Updated wallet
   */
  addTransaction(
    walletId: string | Types.ObjectId,
    transaction: IWalletTransaction
  ): Promise<IWalletDocument | null>;

  /**
   * Get transactions for wallet
   * @param walletId - Wallet ID
   * @param options - Pagination options
   * @returns Paginated transactions
   */
  getTransactions(
    walletId: string | Types.ObjectId,
    options?: IPaginationOptions & ISortOptions
  ): Promise<IPaginatedResult<IWalletTransaction>>;

  /**
   * Update wallet balance
   * @param walletId - Wallet ID
   * @param amount - Amount to add (positive) or subtract (negative)
   * @param type - Transaction type
   * @param reference - Reference ID
   * @returns Updated wallet
   */
  updateBalance(
    walletId: string | Types.ObjectId,
    amount: number,
    type: string,
    reference?: string
  ): Promise<IWalletDocument | null>;
}

/**
 * Wallet document interface
 */
export interface IWalletDocument extends Document {
  userId: Types.ObjectId;
  balance: number;
  currency: string;
  isActive: boolean;
  transactions: IWalletTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wallet transaction
 */
export interface IWalletTransaction {
  _id?: Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  balance: number;
  description: string;
  reference?: string;
  referenceType?: 'booking' | 'payout' | 'refund' | 'bonus' | 'withdrawal';
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}
