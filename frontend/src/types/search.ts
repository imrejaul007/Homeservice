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