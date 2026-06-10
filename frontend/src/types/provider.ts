// Provider Types for Public API

// ==========================================
// VERIFICATION STATUS TYPE (Phase 1: Infrastructure)
// ==========================================

export type VerificationStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export interface ProviderService {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  images: string[];
  isPopular: boolean;
  isFeatured: boolean;
  tags: string[];
  rating: {
    average: number;
    count: number;
  };
}

export interface ProviderReview {
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  isVerified: boolean;
  createdAt: string;
  response?: {
    text: string;
    timestamp: string;
  };
}

export interface PortfolioItem {
  _id: string;
  title: string;
  description?: string;
  category: string;
  images: Array<{
    url: string;
    caption?: string;
    beforeAfter?: {
      before: string;
      after: string;
    };
  }>;
  tags: string[];
  clientTestimonial?: {
    text: string;
    clientName?: string;
    rating: number;
  };
  createdAt: string;
}

export interface Certification {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate?: string;
  isVerified: boolean;
}

export interface Award {
  title: string;
  organization: string;
  year: number;
  description?: string;
  imageUrl?: string;
}

export interface VerificationBadge {
  type: 'identity' | 'business' | 'insurance' | 'certification' | 'background_check';
  verifiedAt: string;
}

export interface Promotion {
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed_amount' | 'buy_one_get_one';
  discountValue: number;
  validFrom: string;
  validTo: string;
}

export interface BusinessHours {
  monday?: BusinessHoursDay;
  tuesday?: BusinessHoursDay;
  wednesday?: BusinessHoursDay;
  thursday?: BusinessHoursDay;
  friday?: BusinessHoursDay;
  saturday?: BusinessHoursDay;
  sunday?: BusinessHoursDay;
  [key: string]: BusinessHoursDay | undefined;
}

export interface AvailabilitySchedule {
  [key: string]: {
    isAvailable: boolean;
    timeSlots: Array<{
      startTime: string;
      endTime: string;
      isBooked: boolean;
      maxBookings?: number;
      currentBookings: number;
    }>;
  };
}

// Full Provider Profile (for ProviderDetailPage)
export interface Provider {
  _id: string;

  // Basic Info
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: 'individual' | 'small_business' | 'company' | 'franchise';
  tagline: string;
  description: string;

  // Profile Images
  profilePhoto: string;
  coverPhoto: string;

  // Verification
  isVerified: boolean;
  verificationBadges: VerificationBadge[];

  // Bio & Social
  bio: string;
  followersCount: number;

  // Contact
  contact: {
    email: string | null;
    phone: string | null;
    website: string | null;
  };

  // Location
  location: {
    city: string;
    state: string;
    country: string;
    serviceRadius: number;
  } | null;

  // Services
  services: ProviderService[];

  // Reviews
  reviewsData: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
    recentReviews: ProviderReview[];
    responseRate: number;
  };

  // Portfolio
  portfolio: {
    featured: PortfolioItem[];
    certifications: Certification[];
    awards: Award[];
  };

  // Availability
  availability: {
    schedule: AvailabilitySchedule;
    instantBooking: boolean;
    advanceBookingDays: number;
    minNoticeTime: number;
  };

  // Business Hours (lowercase day names)
  businessHours: {
    monday?: BusinessHoursDay;
    tuesday?: BusinessHoursDay;
    wednesday?: BusinessHoursDay;
    thursday?: BusinessHoursDay;
    friday?: BusinessHoursDay;
    saturday?: BusinessHoursDay;
    sunday?: BusinessHoursDay;
    [key: string]: BusinessHoursDay | undefined;
  };

  // Stats
  stats: {
    completionRate: number;
    responseTime: number;
    totalBookings: number;
    repeatCustomerRate: number;
  };

  // Promotions
  promotions: Promotion[];

  // Specializations
  specializations: string[];

  // Tier (for provider ranking)
  tier?: 'elite' | 'premium' | 'standard';

  // Analytics
  analytics?: {
    totalBookings: number;
    totalRevenue: number;
    averageRating: number;
    responseRate: number;
  };

  // Verification Status (detailed)
  verificationStatus?: {
    identity: string;
    documents: string;
    backgroundCheck: string;
    overall: string;
  };

  // Financials
  financials?: {
    totalEarnings: number;
    pendingPayout: number;
    lifetimeValue: number;
  };

  // Team Management
  teamManagement?: {
    enabled: boolean;
    members?: Array<{
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      avatar?: string;
    }>;
  };

  // Timestamps
  establishedDate?: string;
  memberSince: string;
}

// Business Hours Day type for lowercase day names
export interface BusinessHoursDay {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  breakStart?: string;
  breakEnd?: string;
}

// Provider Card (for CategoryPage listings)
export interface ProviderCard {
  _id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  tagline: string;
  profilePhoto: string;
  isVerified: boolean;
  location: {
    city: string;
    state: string;
  } | null;
  rating: number;
  reviewCount: number;
  startingPrice: number | null;
  servicesCount: number;
  services: Array<{
    _id: string;
    name: string;
    subcategory?: string;
    price: number;
    duration: number;
  }>;
  completionRate: number;
}

// API Response Types
export interface ProviderResponse {
  success: boolean;
  data: {
    provider: Provider;
  };
}

export interface ProvidersByCategoryResponse {
  success: boolean;
  data: {
    category: {
      _id: string;
      name: string;
      slug: string;
      description: string;
      icon: string;
      color: string;
    };
    providers: ProviderCard[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface ProvidersBySubcategoryResponse {
  success: boolean;
  data: {
    category: {
      _id: string;
      name: string;
      slug: string;
    };
    subcategory: {
      name: string;
      slug: string;
      description?: string;
      icon?: string;
    };
    providers: ProviderCard[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface FeaturedProvidersResponse {
  success: boolean;
  data: {
    providers: Array<{
      _id: string;
      firstName: string;
      lastName: string;
      businessName: string;
      tagline: string;
      profilePhoto: string;
      coverPhoto: string;
      isVerified: boolean;
      location: {
        city: string;
        state: string;
      } | null;
      rating: number;
      reviewCount: number;
      specializations: string[];
      servicesCount: number;
    }>;
  };
}
