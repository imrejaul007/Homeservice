// Unified Service type that works with both search API and components
export interface Service {
  _id: string;
  providerId: string;
  name: string;
  title?: string; // Alias for name (backward compatibility)
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
    discounts?: Array<{ code: string; amount: number; type: 'fixed' | 'percentage' }>;
  };
  duration: number;
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
  };
  reviewCount?: number; // Alias for rating.count
  reviews?: {
    average?: number;
    count?: number;
  };
  status?: 'draft' | 'active' | 'inactive' | 'pending_review' | 'rejected';
  isActive: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    name?: string; // Computed full name
    businessName?: string;
    avatar?: string;
    rating?: number;
    location?: string;
    isVerified?: boolean;
  };
  distance?: number;
  fullLocation?: string;
  searchMetadata?: {
    searchCount: number;
    clickCount: number;
    bookingCount: number;
    popularityScore: number;
  };
  durationOptions?: Array<{ duration: number; price: number; label: string }>;
  availability?: {
    schedule: {
      [day: string]: {
        isAvailable: boolean;
        exceptions?: Array<{ date: string; reason: string }>;
      };
    };
  };
  createdAt: string;
  updatedAt: string;
}
