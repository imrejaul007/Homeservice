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
}

export interface Service {
  _id: string;
  providerId: string;
  name: string;
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
  };
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
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
    };
    filters?: {
      categories: Array<{ name: string; count: number }>;
      priceRange: { min: number; max: number };
      averageRating: number;
      locationInfo?: {
        city: string;
        radius: number;
      };
    };
    searchMetadata?: {
      query?: string;
      resultCount: number;
      searchTime: number;
      suggestions?: string[];
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
  location?: { city: string; state: string } | null;
  rating: number;
  reviewCount: number;
  startingPrice?: number | null;
  maxPrice?: number | null;
  servicesCount: number;
  specializations?: string[];
  completionRate?: number;
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
  viewMode: 'services' | 'providers';
  filters: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sortBy?: string;
  };
  createdAt: string;
}