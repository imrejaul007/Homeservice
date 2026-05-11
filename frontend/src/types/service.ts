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
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  isNew?: boolean;
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    name?: string; // Computed full name
    avatar?: string;
    rating?: number;
    location?: string;
    isVerified?: boolean;
  };
  distance?: number;
  fullLocation?: string;
  createdAt: string;
  updatedAt: string;
}
