// Search-related types and interfaces
export interface SearchFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  city?: string;
  state?: string;
  sortBy?: 'popularity' | 'price' | 'price_desc' | 'rating' | 'distance' | 'newest';
  page?: number;
  limit?: number;
  providerId?: string;
  tier?: 'elite' | 'premium' | 'standard';
  verified?: boolean;
  isActive?: boolean;
}

export interface Service {
  _id: string;
  providerId: string;
  name: string;
  title?: string; // Alias for name
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  duration: number;
  durationOptions?: Array<{
    duration: number;
    price: number;
    label: string;
  }>;
  images: string[];
  image?: string; // First image (backward compatibility)
  tags: string[];
  location: {
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    coordinates: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  rating: {
    average: number;
    count: number;
    searchMetadata?: {
      searchCount?: number;
    };
  };
  reviewCount?: number; // Alias for rating.count
  isActive: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  // Package identification fields
  isPackage?: boolean;
  bundleId?: string;
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    name?: string;
    avatar?: string;
    rating?: number;
    location?: string;
    isVerified?: boolean;
    businessName?: string;
    businessInfo?: {
      businessName: string;
      description: string;
      website?: string;
      businessType?: string;
    };
  };
  distance?: number;
  fullLocation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  success: boolean;
  data: {
    services: Service[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext?: boolean;
      hasPrev?: boolean;
      nextPage?: number | null;
      prevPage?: number | null;
    };
    filters?: {
      categories: Array<{ name: string; count: number; avgPrice?: number; avgRating?: number }>;
      priceRange: { min: number; max: number; average?: number };
      averageRating: number;
      locationInfo?: {
        city: string;
        radius: number;
        lat?: number;
        lng?: number;
      };
    };
    searchMetadata?: {
      query?: string;
      resultCount: number;
      searchTime: number;
      suggestions?: string[];
      didYouMean?: string[];
      correctionApplied?: boolean;
      expandedQueries?: string[];
    };
  };
  message?: string;
}

export interface Suggestion {
  text: string;
  type: 'service' | 'category';
}

export interface SuggestionsResponse {
  success: boolean;
  data: {
    suggestions: Suggestion[];
    source?: 'meilisearch' | 'mongodb';
  };
}

export interface TrendingSearch {
  term: string;
  category: string;
  searchCount: number;
  icon?: string;
}

export interface TrendingSearchesResponse {
  success: boolean;
  data: {
    trendingSearches: TrendingSearch[];
    services?: Service[]; // Backend also returns services array
    timeframe?: string;
  };
}

export interface SearchProvider {
  id: string;
  _id: string;
  firstName: string;
  lastName?: string;
  businessName: string;
  tagline?: string;
  profilePhoto?: string;
  tier?: 'elite' | 'premium' | 'standard';
  isVerified?: boolean;
  location?: { city: string; state: string; coordinates?: [number, number] } | null;
  rating: number;
  reviewCount: number;
  startingPrice?: number | null;
  maxPrice?: number | null;
  servicesCount: number;
  specializations?: string[];
  completionRate?: number;
  distance?: number;
}

export interface ProviderSearchResponse {
  success: boolean;
  data: {
    providers: SearchProvider[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    searchMetadata?: {
      query?: string;
      resultCount: number;
      searchTime: number;
    };
  };
}

export interface SavedSearch {
  id: string;
  query: string;
  filters: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sortBy?: string;
  };
  createdAt: number;
}