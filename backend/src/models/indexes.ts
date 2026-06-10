/**
 * MongoDB Indexes Configuration
 *
 * Centralized index management for optimal query performance.
 * This module ensures all database indexes are properly created.
 *
 * Index Types:
 * - Single field indexes for basic queries
 * - Compound indexes for common query patterns
 * - Text indexes for full-text search
 * - Geospatial indexes for location-based queries
 * - Partial indexes for filtered queries
 * - TTL indexes for automatic data expiration
 */

import mongoose from 'mongoose';
import logger from '../utils/logger';

// Import all models to ensure they are registered
import User from './user.model';
import Booking from './booking.model';
import ProviderProfile from './providerProfile.model';
import Service from './service.model';
import Bundle from './bundle.model';
import Review from './review.model';

/**
 * Index configuration for each model
 */
interface IndexConfig {
  modelName: string;
  collectionName: string;
  indexes: Array<{
    key: Record<string, 1 | -1 | 'text' | '2dsphere'>;
    options?: Record<string, unknown>;
    type?: 'single' | 'compound' | 'text' | 'geospatial' | 'partial' | 'ttl';
    description: string;
  }>;
}

/**
 * Comprehensive index definitions for all models
 * This documents all indexes that should exist in the database
 */
const INDEX_CONFIG: IndexConfig[] = [
  // =============================================================================
  // USER MODEL INDEXES
  // =============================================================================
  {
    modelName: 'User',
    collectionName: 'users',
    indexes: [
      // Basic single-field indexes for common queries
      {
        key: { email: 1 },
        options: { unique: true, background: true },
        type: 'single',
        description: 'Email lookup (unique for login)'
      },
      {
        key: { role: 1 },
        options: { background: true },
        type: 'single',
        description: 'Filter users by role'
      },
      {
        key: { isActive: 1 },
        options: { background: true },
        type: 'single',
        description: 'Filter active/inactive users'
      },
      {
        key: { accountStatus: 1 },
        options: { background: true },
        type: 'single',
        description: 'Filter by account status'
      },
      {
        key: { createdAt: -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by creation date (newest first)'
      },
      {
        key: { lastLogin: -1 },
        options: { sparse: true, background: true },
        type: 'single',
        description: 'Sort by last login for activity queries'
      },
      {
        key: { isEmailVerified: 1 },
        options: { background: true },
        type: 'single',
        description: 'Filter by email verification status'
      },
      {
        key: { isDeleted: 1 },
        options: { background: true },
        type: 'single',
        description: 'Filter soft-deleted users'
      },

      // Geospatial index for location-based queries
      {
        key: { 'address.coordinates': '2dsphere' },
        options: { background: true, sparse: true },
        type: 'geospatial',
        description: 'Geospatial queries for user locations'
      },

      // Text search index for admin user search
      {
        key: {
          firstName: 'text',
          lastName: 'text',
          email: 'text'
        },
        options: {
          weights: {
            email: 10,
            firstName: 2,
            lastName: 2
          },
          name: 'user_text_search',
          background: true
        },
        type: 'text',
        description: 'Full-text search on user name and email'
      },

      // Compound indexes for common query patterns
      {
        key: { email: 1, role: 1 },
        options: { background: true },
        type: 'compound',
        description: 'User lookup by email and role'
      },
      {
        key: { email: 1, isDeleted: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Email login with soft delete check'
      },
      {
        key: { isActive: 1, isDeleted: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Combined active/deleted filter'
      },
      {
        key: { accountStatus: 1, role: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Filter by status and role'
      },
      {
        key: { role: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Users by role sorted by registration date'
      },

      // Loyalty system indexes
      {
        key: { 'loyaltySystem.tier': 1 },
        options: { background: true },
        type: 'single',
        description: 'Filter users by loyalty tier'
      },
      {
        key: { 'loyaltySystem.referralCode': 1 },
        options: { unique: true, sparse: true, background: true },
        type: 'single',
        description: 'Referral code lookup (unique)'
      },

      // Social indexes
      {
        key: { 'socialProfiles.followers': 1 },
        options: { background: true },
        type: 'single',
        description: 'Followers list queries'
      },
      {
        key: { 'socialProfiles.following': 1 },
        options: { background: true },
        type: 'single',
        description: 'Following list queries'
      },

      // Session management indexes
      {
        key: { 'sessions.expiresAt': 1 },
        options: { expireAfterSeconds: 0, background: true },
        type: 'ttl',
        description: 'TTL index for session auto-expiration'
      },
      {
        key: { 'sessions.sessionId': 1 },
        options: { unique: true, sparse: true, background: true },
        type: 'single',
        description: 'Session ID lookup (unique)'
      },

      // Fraud detection indexes
      {
        key: { registrationIP: 1 },
        options: { background: true },
        type: 'single',
        description: 'Registration IP for fraud detection'
      },
      {
        key: { 'deviceFingerprints.fingerprint': 1 },
        options: { background: true },
        type: 'single',
        description: 'Device fingerprint lookup'
      },
      {
        key: { knownIPs: 1 },
        options: { background: true },
        type: 'single',
        description: 'Known IPs for fraud detection'
      },

      // Notification indexes
      {
        key: { 'notifications.isRead': 1 },
        options: { sparse: true, background: true },
        type: 'single',
        description: 'Unread notification queries'
      },

      // Tenant isolation indexes
      {
        key: { tenantId: 1, email: 1 },
        options: { unique: true, background: true },
        type: 'compound',
        description: 'Tenant-scoped email uniqueness'
      },
      {
        key: { tenantId: 1, role: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped role filter'
      },
      {
        key: { tenantId: 1, accountStatus: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped status filter'
      }
    ]
  },

  // =============================================================================
  // BOOKING MODEL INDEXES
  // =============================================================================
  {
    modelName: 'Booking',
    collectionName: 'bookings',
    indexes: [
      // Basic single-field indexes
      {
        key: { bookingNumber: 1 },
        options: { unique: true, background: true },
        type: 'single',
        description: 'Booking number lookup (unique)'
      },
      {
        key: { customerId: 1 },
        options: { background: true, sparse: true },
        type: 'single',
        description: 'Customer booking lookup'
      },
      {
        key: { providerId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Provider booking lookup'
      },
      {
        key: { serviceId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Service booking lookup'
      },
      {
        key: { scheduledDate: 1 },
        options: { background: true },
        type: 'single',
        description: 'Scheduled date queries'
      },
      {
        key: { status: 1 },
        options: { background: true },
        type: 'single',
        description: 'Status filter queries'
      },
      {
        key: { createdAt: -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by creation date (newest first)'
      },
      {
        key: { completedAt: -1 },
        options: { sparse: true, background: true },
        type: 'single',
        description: 'Completed bookings sorted by date'
      },

      // Payment status index
      {
        key: { 'payment.status': 1 },
        options: { background: true },
        type: 'single',
        description: 'Payment status queries'
      },

      // Geospatial index
      {
        key: { 'location.address.coordinates.coordinates': '2dsphere' },
        options: { background: true, sparse: true },
        type: 'geospatial',
        description: 'Location-based booking queries'
      },

      // Compound indexes for common query patterns
      {
        key: { customerId: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Customer bookings by status'
      },
      {
        key: { customerId: 1, scheduledDate: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Customer bookings by date'
      },
      {
        key: { customerId: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Customer booking history'
      },
      {
        key: { customerId: 1, status: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Customer bookings by status sorted by date'
      },
      {
        key: { customerId: 1, status: 1, 'pricing.totalAmount': 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Customer dashboard AOV calculations'
      },
      {
        key: { providerId: 1, scheduledDate: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider bookings by date'
      },
      {
        key: { providerId: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider bookings by status'
      },
      {
        key: { providerId: 1, status: 1, scheduledDate: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider dashboard queries'
      },
      {
        key: { providerId: 1, status: 1, completedAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider completed bookings by status'
      },
      {
        key: { providerId: 1, 'pricing.totalAmount': 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider revenue queries'
      },
      {
        key: { status: 1, scheduledDate: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Status and date combined queries'
      },
      {
        key: { status: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Status sorted by creation date'
      },
      {
        key: { serviceId: 1, status: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Service analytics queries'
      },

      // Anti-double-booking partial unique index
      {
        key: { providerId: 1, scheduledDate: 1, scheduledTime: 1, status: 1 },
        options: {
          unique: true,
          partialFilterExpression: {
            status: { $in: ['pending', 'confirmed', 'in_progress'] }
          },
          name: 'provider_slot_booking_unique',
          background: true
        },
        type: 'partial',
        description: 'Prevent double-booking of time slots'
      },

      // Tenant isolation indexes
      {
        key: { tenantId: 1, customerId: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped customer bookings'
      },
      {
        key: { tenantId: 1, providerId: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped provider bookings'
      },
      {
        key: { tenantId: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped booking list'
      },
      {
        key: { tenantId: 1, status: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped status queries'
      },
      {
        key: { tenantId: 1, scheduledDate: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped schedule queries'
      }
    ]
  },

  // =============================================================================
  // PROVIDER PROFILE MODEL INDEXES
  // =============================================================================
  {
    modelName: 'ProviderProfile',
    collectionName: 'providerprofiles',
    indexes: [
      // Basic single-field indexes
      {
        key: { userId: 1 },
        options: { unique: true, background: true },
        type: 'single',
        description: 'User to profile lookup (unique)'
      },
      {
        key: { tenantId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Tenant filter'
      },
      {
        key: { tier: 1 },
        options: { background: true },
        type: 'single',
        description: 'Provider tier filter'
      },
      {
        key: { businessType: 1 },
        options: { background: true },
        type: 'single',
        description: 'Business type filter'
      },
      {
        key: { 'verificationStatus.overall': 1 },
        options: { background: true },
        type: 'single',
        description: 'Verification status filter'
      },
      {
        key: { 'instagramStyleProfile.isVerified': 1 },
        options: { background: true },
        type: 'single',
        description: 'Profile verification filter'
      },
      {
        key: { isActive: 1 },
        options: { background: true },
        type: 'single',
        description: 'Active profile filter'
      },
      {
        key: { isDeleted: 1 },
        options: { background: true },
        type: 'single',
        description: 'Soft delete filter'
      },
      {
        key: { isProfileComplete: 1 },
        options: { background: true },
        type: 'single',
        description: 'Profile completion filter'
      },
      {
        key: { completionPercentage: -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by completion percentage'
      },
      {
        key: { lastActiveAt: -1 },
        options: { sparse: true, background: true },
        type: 'single',
        description: 'Sort by last activity'
      },

      // Rating and review indexes
      {
        key: { 'reviewsData.averageRating': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by rating (highest first)'
      },
      {
        key: { 'reviewsData.totalReviews': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by review count'
      },
      {
        key: { 'analytics.performanceMetrics.qualityScore': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by quality score'
      },
      {
        key: { 'analytics.bookingStats.completedBookings': 1 },
        options: { background: true },
        type: 'single',
        description: 'Completed bookings count filter'
      },
      {
        key: { 'analytics.revenueStats.totalEarnings': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by total earnings'
      },
      {
        key: { 'instagramStyleProfile.followersCount': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by followers count'
      },
      {
        key: { 'businessInfo.serviceRadius': 1 },
        options: { background: true },
        type: 'single',
        description: 'Service radius filter'
      },
      {
        key: { 'analytics.profileViews.date': 1 },
        options: { background: true },
        type: 'single',
        description: 'Profile views by date'
      },

      // Geospatial index
      {
        key: { 'locationInfo.primaryAddress.coordinates': '2dsphere' },
        options: { background: true },
        type: 'geospatial',
        description: 'Location-based provider search'
      },

      // Compound indexes
      {
        key: { isActive: 1, isDeleted: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Combined active/deleted filter'
      },
      {
        key: { 'services.category': 1 },
        options: { background: true },
        type: 'single',
        description: 'Category-based service queries'
      },
      {
        key: { 'services.isActive': 1 },
        options: { background: true },
        type: 'single',
        description: 'Active services filter'
      },

      // Tenant isolation indexes
      {
        key: { tenantId: 1, 'verificationStatus.overall': 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped verification filter'
      },
      {
        key: { tenantId: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped active filter'
      },
      {
        key: { tenantId: 1, 'services.isActive': 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped active services'
      },
      {
        key: { tenantId: 1, isActive: 1, 'verificationStatus.overall': 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped active verified providers'
      }
    ]
  },

  // =============================================================================
  // SERVICE MODEL INDEXES
  // =============================================================================
  {
    modelName: 'Service',
    collectionName: 'services',
    indexes: [
      // Basic single-field indexes
      {
        key: { providerId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Provider service lookup'
      },
      {
        key: { category: 1 },
        options: { background: true },
        type: 'single',
        description: 'Category filter'
      },
      {
        key: { subcategory: 1 },
        options: { sparse: true, background: true },
        type: 'single',
        description: 'Subcategory filter'
      },
      {
        key: { isActive: 1 },
        options: { background: true },
        type: 'single',
        description: 'Active service filter'
      },
      {
        key: { isFeatured: 1 },
        options: { sparse: true, background: true },
        type: 'single',
        description: 'Featured service filter'
      },
      {
        key: { isPopular: 1 },
        options: { background: true },
        type: 'single',
        description: 'Popular service filter'
      },
      {
        key: { isDeleted: 1 },
        options: { background: true },
        type: 'single',
        description: 'Soft delete filter'
      },
      {
        key: { status: 1 },
        options: { background: true },
        type: 'single',
        description: 'Service status filter'
      },
      {
        key: { createdAt: -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by creation date (newest)'
      },

      // Price and rating indexes
      {
        key: { 'price.amount': 1 },
        options: { background: true },
        type: 'single',
        description: 'Price range queries'
      },
      {
        key: { 'rating.average': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by rating (highest first)'
      },
      {
        key: { 'searchMetadata.popularityScore': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by popularity'
      },
      {
        key: { 'searchMetadata.searchCount': -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by search count'
      },

      // Location indexes
      {
        key: { 'location.address.city': 1 },
        options: { background: true },
        type: 'single',
        description: 'City filter'
      },
      {
        key: { 'location.address.state': 1 },
        options: { background: true },
        type: 'single',
        description: 'State filter'
      },

      // Geospatial index
      {
        key: { 'location.coordinates': '2dsphere' },
        options: { background: true },
        type: 'geospatial',
        description: 'Location-based service search'
      },

      // Text search index
      {
        key: {
          name: 'text',
          description: 'text',
          tags: 'text',
          'searchMetadata.searchKeywords': 'text'
        },
        options: {
          weights: {
            name: 10,
            tags: 5,
            'searchMetadata.searchKeywords': 3,
            description: 1
          },
          name: 'service_text_search',
          background: true
        },
        type: 'text',
        description: 'Full-text search on service content'
      },

      // Compound indexes for common queries
      {
        key: { category: 1, isActive: 1, 'rating.average': -1 },
        options: { background: true },
        type: 'compound',
        description: 'Category listing sorted by rating'
      },
      {
        key: { isActive: 1, 'location.coordinates': '2dsphere' },
        options: { background: true },
        type: 'compound',
        description: 'Active services with location'
      },
      {
        key: { 'price.amount': 1, 'rating.average': -1 },
        options: { background: true },
        type: 'compound',
        description: 'Price sorted by rating'
      },
      {
        key: { providerId: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider active services'
      },
      {
        key: { providerId: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider services by status'
      },
      {
        key: { 'location.address.city': 1, category: 1 },
        options: { background: true },
        type: 'compound',
        description: 'City and category filter'
      },
      {
        key: { category: 1, subcategory: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Category and subcategory filter'
      },
      {
        key: { category: 1, _id: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Category listing with consistent order'
      },
      {
        key: { isActive: 1, category: 1, 'rating.average': -1 },
        options: { background: true },
        type: 'compound',
        description: 'Active services by category sorted by rating'
      },
      {
        key: { isActive: 1, 'searchMetadata.searchCount': -1 },
        options: { background: true },
        type: 'compound',
        description: 'Popular active services'
      },
      {
        key: { 'price.amount': 1, 'rating.average': -1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Price filter with rating and active status'
      },

      // Tenant isolation indexes
      {
        key: { tenantId: 1, providerId: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped provider services'
      },
      {
        key: { tenantId: 1, category: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped category filter'
      },
      {
        key: { tenantId: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped active filter'
      },
      {
        key: { tenantId: 1, 'rating.average': -1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped rating sort'
      }
    ]
  },

  // =============================================================================
  // BUNDLE MODEL INDEXES
  // =============================================================================
  {
    modelName: 'Bundle',
    collectionName: 'bundles',
    indexes: [
      // Basic single-field indexes
      {
        key: { tenantId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Tenant filter'
      },
      {
        key: { providerId: 1 },
        options: { background: true, sparse: true },
        type: 'single',
        description: 'Provider bundle lookup'
      },
      {
        key: { status: 1 },
        options: { background: true },
        type: 'single',
        description: 'Approval status filter'
      },
      {
        key: { isActive: 1 },
        options: { background: true },
        type: 'single',
        description: 'Active bundle filter'
      },
      {
        key: { isFeatured: 1 },
        options: { background: true },
        type: 'single',
        description: 'Featured bundle filter'
      },
      {
        key: { categoryId: 1 },
        options: { background: true, sparse: true },
        type: 'single',
        description: 'Category filter'
      },
      {
        key: { createdAt: -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by creation date'
      },
      {
        key: { validFrom: 1 },
        options: { background: true },
        type: 'single',
        description: 'Validity start date filter'
      },
      {
        key: { validUntil: 1 },
        options: { background: true },
        type: 'single',
        description: 'Validity end date filter'
      },

      // Compound indexes
      {
        key: { tenantId: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped active bundles'
      },
      {
        key: { tenantId: 1, categoryId: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped category filter'
      },
      {
        key: { tenantId: 1, validFrom: 1, validUntil: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped validity filter'
      },
      {
        key: { tenantId: 1, isFeatured: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped featured bundles'
      },
      {
        key: { providerId: 1, status: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider bundles by status'
      },
      {
        key: { tenantId: 1, status: 1, isActive: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped status filter'
      },

      // Service lookup index
      {
        key: { 'services.serviceId': 1 },
        options: { background: true },
        type: 'single',
        description: 'Bundle service lookup'
      }
    ]
  },

  // =============================================================================
  // REVIEW MODEL INDEXES
  // =============================================================================
  {
    modelName: 'Review',
    collectionName: 'reviews',
    indexes: [
      // Basic single-field indexes
      {
        key: { tenantId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Tenant filter'
      },
      {
        key: { bookingId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Booking review lookup'
      },
      {
        key: { serviceId: 1 },
        options: { background: true, sparse: true },
        type: 'single',
        description: 'Service review lookup'
      },
      {
        key: { reviewerId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Reviewer review lookup'
      },
      {
        key: { revieweeId: 1 },
        options: { background: true },
        type: 'single',
        description: 'Reviewee review lookup'
      },
      {
        key: { rating: 1 },
        options: { background: true },
        type: 'single',
        description: 'Rating filter and sort'
      },
      {
        key: { isHidden: 1 },
        options: { background: true },
        type: 'single',
        description: 'Hidden review filter'
      },
      {
        key: { moderationStatus: 1 },
        options: { background: true },
        type: 'single',
        description: 'Moderation status filter'
      },
      {
        key: { helpfulVotes: 1 },
        options: { background: true },
        type: 'single',
        description: 'Helpful votes sort'
      },
      {
        key: { reportCount: 1 },
        options: { background: true },
        type: 'single',
        description: 'Report count for moderation'
      },
      {
        key: { createdAt: -1 },
        options: { background: true },
        type: 'single',
        description: 'Sort by creation date (newest)'
      },

      // Text search index
      {
        key: { comment: 'text', title: 'text' },
        options: {
          weights: {
            title: 10,
            comment: 5
          },
          name: 'review_text_search',
          default_language: 'english',
          background: true
        },
        type: 'text',
        description: 'Full-text search on review content'
      },

      // Unique compound index (prevents duplicate reviews)
      {
        key: { bookingId: 1, reviewerId: 1 },
        options: { unique: true, name: 'unique_booking_reviewer', background: true },
        type: 'compound',
        description: 'One review per booking per reviewer (unique)'
      },

      // Compound indexes for common queries
      {
        key: { bookingId: 1, isHidden: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Rating recalculation queries'
      },
      {
        key: { revieweeId: 1, reviewerType: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Provider reviews by date'
      },
      {
        key: { reviewerId: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Reviewer history sorted by date'
      },
      {
        key: { rating: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Reviews sorted by rating and date'
      },
      {
        key: { isHidden: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Hidden reviews by date'
      },
      {
        key: { bookingId: 1, revieweeId: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Service-level rating queries'
      },
      {
        key: { serviceId: 1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Service reviews by date'
      },
      {
        key: { serviceId: 1, rating: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Service reviews by rating'
      },
      {
        key: { helpfulVotes: -1, createdAt: -1 },
        options: { background: true },
        type: 'compound',
        description: 'Most helpful reviews first'
      },
      {
        key: { reportCount: 1, moderationStatus: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Flagged reviews for moderation'
      },

      // Partial indexes for performance
      {
        key: { revieweeId: 1, createdAt: -1, isHidden: 1 },
        options: {
          partialFilterExpression: { isHidden: false },
          name: 'visible_reviews_by_reviewee',
          background: true
        },
        type: 'partial',
        description: 'Visible reviews by provider (partial)'
      },
      {
        key: { moderationStatus: 1, createdAt: -1 },
        options: {
          partialFilterExpression: { moderationStatus: 'pending' },
          name: 'pending_moderation',
          background: true
        },
        type: 'partial',
        description: 'Pending moderation queue (partial)'
      },
      {
        key: { reportCount: -1, createdAt: -1 },
        options: {
          partialFilterExpression: { reportCount: { $gt: 0 } },
          name: 'flagged_reviews',
          background: true
        },
        type: 'partial',
        description: 'Flagged reviews (partial)'
      },

      // Tenant isolation indexes
      {
        key: { tenantId: 1, revieweeId: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped reviewee filter'
      },
      {
        key: { tenantId: 1, reviewerId: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped reviewer filter'
      },
      {
        key: { tenantId: 1, moderationStatus: 1 },
        options: { background: true },
        type: 'compound',
        description: 'Tenant-scoped moderation filter'
      }
    ]
  }
];

/**
 * Get current indexes from a collection
 */
async function getExistingIndexes(collectionName: string): Promise<Array<{ key: Record<string, unknown>; name: string; unique?: boolean; partialFilterExpression?: Record<string, unknown> }>> {
  try {
    if (!mongoose.connection.db) {
      logger.warn('Database connection not ready', { context: 'IndexManager', collectionName });
      return [];
    }
    const collection = mongoose.connection.db.collection(collectionName);
    const indexes = await collection.indexes();
    return indexes.map(idx => ({
      key: idx.key as Record<string, unknown>,
      name: idx.name || 'unknown',
      unique: idx.unique,
      partialFilterExpression: idx.partialFilterExpression as Record<string, unknown> | undefined
    }));
  } catch (error) {
    logger.warn('Failed to get existing indexes', {
      context: 'IndexManager',
      collectionName,
      error: (error as Error).message
    });
    return [];
  }
}

/**
 * Check if an index already exists
 */
function indexExists(existingIndexes: Array<{ key: Record<string, unknown>; name: string }>, indexConfig: { key: Record<string, unknown>; options?: Record<string, unknown> }): boolean {
  const configKey = JSON.stringify(indexConfig.key);

  return existingIndexes.some(idx => {
    const existingKey = JSON.stringify(idx.key);
    // Check by key match or by name if specified
    if (configKey === existingKey) return true;
    if (indexConfig.options?.name && idx.name === indexConfig.options.name) return true;
    return false;
  });
}

/**
 * Create indexes for a single model
 */
async function createIndexesForModel(config: IndexConfig): Promise<{ created: number; skipped: number; errors: number }> {
  const result = { created: 0, skipped: 0, errors: 0 };

  try {
    const existingIndexes = await getExistingIndexes(config.collectionName);
    const model = mongoose.models[config.modelName];

    if (!model) {
      logger.warn('Model not found for indexing', {
        context: 'IndexManager',
        modelName: config.modelName
      });
      result.errors++;
      return result;
    }

    for (const indexConfig of config.indexes) {
      try {
        if (indexExists(existingIndexes, indexConfig)) {
          logger.debug('Index already exists', {
            context: 'IndexManager',
            modelName: config.modelName,
            indexName: indexConfig.options?.name || JSON.stringify(indexConfig.key)
          });
          result.skipped++;
          continue;
        }

        // Create index using ensureIndex (creates if not exists)
        await model.ensureIndexes([indexConfig as any] as any);
        logger.info('Index created', {
          context: 'IndexManager',
          modelName: config.modelName,
          indexName: indexConfig.options?.name || JSON.stringify(indexConfig.key),
          type: indexConfig.type,
          description: indexConfig.description
        });
        result.created++;
      } catch (error) {
        logger.error('Failed to create index', {
          context: 'IndexManager',
          modelName: config.modelName,
          indexName: indexConfig.options?.name || JSON.stringify(indexConfig.key),
          error: (error as Error).message
        });
        result.errors++;
      }
    }
  } catch (error) {
    logger.error('Error processing model indexes', {
      context: 'IndexManager',
      modelName: config.modelName,
      error: (error as Error).message
    });
    result.errors++;
  }

  return result;
}

/**
 * Create all database indexes
 * Call this on application startup to ensure all indexes exist
 *
 * @param options Configuration options
 * @returns Summary of index creation results
 */
export async function createAllIndexes(options: {
  dropDuplicates?: boolean;
  verbose?: boolean;
} = {}): Promise<{
  totalCreated: number;
  totalSkipped: number;
  totalErrors: number;
  models: Record<string, { created: number; skipped: number; errors: number }>;
}> {
  const startTime = Date.now();
  const results: Record<string, { created: number; skipped: number; errors: number }> = {};
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  logger.info('Starting database index creation', {
    context: 'IndexManager',
    modelCount: INDEX_CONFIG.length,
    options
  });

  for (const config of INDEX_CONFIG) {
    const modelResult = await createIndexesForModel(config);
    results[config.modelName] = modelResult;
    totalCreated += modelResult.created;
    totalSkipped += modelResult.skipped;
    totalErrors += modelResult.errors;

    if (options.verbose) {
      logger.info('Model indexes processed', {
        context: 'IndexManager',
        modelName: config.modelName,
        created: modelResult.created,
        skipped: modelResult.skipped,
        errors: modelResult.errors
      });
    }
  }

  const duration = Date.now() - startTime;

  logger.info('Database index creation completed', {
    context: 'IndexManager',
    duration: `${duration}ms`,
    totalCreated,
    totalSkipped,
    totalErrors,
    models: Object.keys(results).length
  });

  return {
    totalCreated,
    totalSkipped,
    totalErrors,
    models: results
  };
}

/**
 * Check and report on index health
 * Useful for monitoring and alerting
 */
export async function checkIndexHealth(): Promise<{
  healthy: boolean;
  issues: Array<{
    modelName: string;
    collectionName: string;
    issue: string;
    severity: 'warning' | 'error';
  }>;
  summary: {
    totalCollections: number;
    totalIndexes: number;
    missingIndexes: number;
  };
}> {
  const issues: Array<{
    modelName: string;
    collectionName: string;
    issue: string;
    severity: 'warning' | 'error';
  }> = [];

  let totalIndexes = 0;

  for (const config of INDEX_CONFIG) {
    try {
      const existingIndexes = await getExistingIndexes(config.collectionName);
      totalIndexes += existingIndexes.length;

      // Check for expected indexes
      for (const expectedIndex of config.indexes) {
        const indexName = expectedIndex.options?.name || JSON.stringify(expectedIndex.key);
        const exists = existingIndexes.some(
          idx => idx.name === indexName || JSON.stringify(idx.key) === JSON.stringify(expectedIndex.key)
        );

        if (!exists) {
          issues.push({
            modelName: config.modelName,
            collectionName: config.collectionName,
            issue: `Missing index: ${indexName}`,
            severity: 'warning'
          });
        }
      }
    } catch (error) {
      issues.push({
        modelName: config.modelName,
        collectionName: config.collectionName,
        issue: `Failed to check indexes: ${(error as Error).message}`,
        severity: 'error'
      });
    }
  }

  return {
    healthy: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    summary: {
      totalCollections: INDEX_CONFIG.length,
      totalIndexes,
      missingIndexes: issues.length
    }
  };
}

/**
 * Get a summary of all indexes by model
 * Useful for documentation and debugging
 */
export function getIndexSummary(): Array<{
  modelName: string;
  collectionName: string;
  indexes: Array<{
    type: string;
    description: string;
    key: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>;
}> {
  return INDEX_CONFIG.map(config => ({
    modelName: config.modelName,
    collectionName: config.collectionName,
    indexes: config.indexes.map(idx => ({
      type: idx.type || 'single',
      description: idx.description,
      key: idx.key,
      options: idx.options
    }))
  }));
}

// Export index config for external use
export { INDEX_CONFIG };
