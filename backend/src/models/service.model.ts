import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IService extends Document {
  providerId: mongoose.Types.ObjectId;
  
  // Basic Service Information
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string; // For search results
  
  // Pricing Information
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
    discounts?: Array<{
      type: 'bulk' | 'seasonal' | 'loyalty' | 'first_time';
      percentage: number;
      minQuantity?: number;
      validFrom?: Date;
      validTo?: Date;
    }>;
  };
  
  // Service Details
  duration: number; // in minutes
  durationOptions?: Array<{
    duration: number;
    price: number;
    label: string;
  }>; // Alternative duration options for booking
  images: string[];
  tags: string[]; // For enhanced search
  requirements?: string[];
  includedItems?: string[];
  addOns?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  
  // Location & Availability
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
      coordinates: [number, number]; // [longitude, latitude]
    };
    serviceArea: {
      type: 'city' | 'zipcode' | 'radius';
      value: string | number;
      maxDistance?: number; // in kilometers
    };
    travelFee?: {
      baseFee: number;
      perKmFee: number;
    };
  };
  
  // Service Settings
  availability: {
    schedule: {
      monday: { isAvailable: boolean; timeSlots: string[] };
      tuesday: { isAvailable: boolean; timeSlots: string[] };
      wednesday: { isAvailable: boolean; timeSlots: string[] };
      thursday: { isAvailable: boolean; timeSlots: string[] };
      friday: { isAvailable: boolean; timeSlots: string[] };
      saturday: { isAvailable: boolean; timeSlots: string[] };
      sunday: { isAvailable: boolean; timeSlots: string[] };
    };
    exceptions: Array<{
      date: Date;
      isAvailable: boolean;
      reason?: string;
    }>;
    bufferTime: number; // minutes between bookings
    instantBooking: boolean;
    advanceBookingDays: number;
  };
  
  // Performance & Social Metrics
  rating: {
    average: number;
    count: number;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  
  // Search & Discovery Optimization  
  searchMetadata: {
    searchCount: number; // How often this service appears in searches
    clickCount: number; // How often users click on this service
    bookingCount: number; // Total bookings for this service
    popularityScore: number; // Calculated score for ranking
    lastSearched?: Date;
    searchKeywords: string[]; // Additional keywords for search
  };
  
  // Business Logic
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  
  // Service Management Status
  status: 'draft' | 'active' | 'inactive' | 'pending_review';
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  // Virtual Properties
  provider: any; // Will be populated from ProviderProfile
  fullLocation: string; // Computed location string
  averageRating: number; // Alias for rating.average
  
  // Methods
  updatePopularityScore(): Promise<void>;
  incrementSearchCount(): Promise<void>;
  incrementClickCount(): Promise<void>;
}

const serviceSchema = new Schema<IService>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider ID is required'],
      index: true
    },
    
    // Basic Service Information
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: [100, 'Service name cannot exceed 100 characters'],
      index: 'text' // For text search
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true
    },
    subcategory: {
      type: String,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      index: 'text' // For text search
    },
    shortDescription: {
      type: String,
      maxlength: [200, 'Short description cannot exceed 200 characters']
    },
    
    // Pricing Information
    price: {
      amount: {
        type: Number,
        required: [true, 'Price amount is required'],
        min: [0, 'Price cannot be negative'],
        index: true // For price range filtering
      },
      currency: {
        type: String,
        default: 'AED',
        enum: ['AED', 'INR', 'USD', 'EUR', 'GBP']
      },
      type: {
        type: String,
        enum: ['fixed', 'hourly', 'custom'],
        default: 'fixed'
      },
      discounts: [{
        type: {
          type: String,
          enum: ['bulk', 'seasonal', 'loyalty', 'first_time']
        },
        percentage: {
          type: Number,
          min: 1,
          max: 100
        },
        minQuantity: Number,
        validFrom: Date,
        validTo: Date
      }]
    },
    
    // Service Details
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [15, 'Duration must be at least 15 minutes'],
      max: [480, 'Duration cannot exceed 8 hours']
    },

    // Alternative duration options for booking flow
    durationOptions: {
      type: [{
        duration: {
          type: Number,
          required: true,
          min: [15, 'Duration must be at least 15 minutes'],
          max: [480, 'Duration cannot exceed 8 hours']
        },
        price: {
          type: Number,
          required: true,
          min: [0, 'Price cannot be negative']
        },
        label: {
          type: String,
          required: true
        }
      }],
      default: [] // Empty array means only base duration is available
    },

    images: [String],
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
      index: 'text' // For text search
    }],
    requirements: [String],
    includedItems: [String],
    addOns: [{
      name: String,
      price: {
        type: Number,
        min: 0
      },
      description: String
    }],
    
    // Location & Availability
    location: {
      address: {
        street: { type: String, required: true },
        city: { type: String, required: true, index: true },
        state: { type: String, required: true, index: true },
        zipCode: { type: String, required: true },
        country: { type: String, default: 'AE' }
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
          validate: {
            validator: function(coords: number[]) {
              return coords.length === 2 && 
                     coords[0] >= -180 && coords[0] <= 180 && // longitude
                     coords[1] >= -90 && coords[1] <= 90;    // latitude
            },
            message: 'Invalid coordinates'
          }
        }
      },
      serviceArea: {
        type: {
          type: String,
          enum: ['city', 'zipcode', 'radius'],
          default: 'city'
        },
        value: Schema.Types.Mixed,
        maxDistance: {
          type: Number,
          default: 25,
          min: 1,
          max: 100
        }
      },
      travelFee: {
        baseFee: { type: Number, default: 0, min: 0 },
        perKmFee: { type: Number, default: 0, min: 0 }
      }
    },
    
    // Service Settings
    availability: {
      schedule: {
        monday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [String]
        },
        tuesday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [String]
        },
        wednesday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [String]
        },
        thursday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [String]
        },
        friday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [String]
        },
        saturday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [String]
        },
        sunday: {
          isAvailable: { type: Boolean, default: false },
          timeSlots: [String]
        }
      },
      exceptions: [{
        date: { type: Date, required: true },
        isAvailable: { type: Boolean, default: false },
        reason: String
      }],
      bufferTime: { type: Number, default: 15, min: 0 },
      instantBooking: { type: Boolean, default: false },
      advanceBookingDays: { type: Number, default: 30, min: 1, max: 365 }
    },
    
    // Performance & Social Metrics
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
        index: -1 // For sorting by rating
      },
      count: {
        type: Number,
        default: 0,
        min: 0
      },
      distribution: {
        5: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        1: { type: Number, default: 0 }
      }
    },
    
    // Search & Discovery Optimization
    searchMetadata: {
      searchCount: { type: Number, default: 0 },
      clickCount: { type: Number, default: 0 },
      bookingCount: { type: Number, default: 0 },
      popularityScore: {
        type: Number,
        default: 0,
        index: -1 // For sorting by popularity
      },
      lastSearched: Date,
      searchKeywords: [String]
    },
    
    // Business Logic
    isActive: {
      type: Boolean,
      default: true,
      index: true // For filtering active services
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    isPopular: {
      type: Boolean,
      default: false,
      index: true
    },
    
    // Service Management Status
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive', 'pending_review'],
      default: 'active',
      index: true
    },
    
    // Audit Fields
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ===================================
// INDEXES FOR SEARCH OPTIMIZATION
// ===================================

// Geospatial index for location-based search
serviceSchema.index({ 'location.coordinates': '2dsphere' });

// Text search index for name, description, and tags
serviceSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text',
  'searchMetadata.searchKeywords': 'text'
}, {
  weights: {
    name: 10,
    tags: 5,
    description: 1,
    'searchMetadata.searchKeywords': 3
  },
  name: 'service_text_search'
});

// Compound indexes for common search patterns
serviceSchema.index({ category: 1, isActive: 1, 'rating.average': -1 });
serviceSchema.index({ isActive: 1, 'location.coordinates': '2dsphere' });
serviceSchema.index({ 'price.amount': 1, 'rating.average': -1 });
serviceSchema.index({ providerId: 1, isActive: 1 });
serviceSchema.index({ 'location.address.city': 1, category: 1 });
serviceSchema.index({ createdAt: -1 }); // For newest first
serviceSchema.index({ 'searchMetadata.popularityScore': -1 }); // For popularity sorting

// Sparse indexes for optional fields
serviceSchema.index({ subcategory: 1 }, { sparse: true });
serviceSchema.index({ isFeatured: 1 }, { sparse: true, partialFilterExpression: { isFeatured: true } });

// ===================================
// VIRTUAL PROPERTIES
// ===================================

// Provider information (will be populated)
serviceSchema.virtual('provider', {
  ref: 'User',
  localField: 'providerId',
  foreignField: '_id',
  justOne: true
});

// Full location string for display
serviceSchema.virtual('fullLocation').get(function() {
  const addr = this.location.address;
  return `${addr.city}, ${addr.state} ${addr.zipCode}`;
});

// Alias for rating average
serviceSchema.virtual('averageRating').get(function() {
  return this.rating.average;
});

// Distance (will be set during geospatial queries)
serviceSchema.virtual('distance');

// ===================================
// INSTANCE METHODS
// ===================================

// Update popularity score based on various metrics
serviceSchema.methods.updatePopularityScore = async function() {
  const ratingScore = this.rating.average * this.rating.count * 10;
  const searchScore = this.searchMetadata.searchCount * 2;
  const clickScore = this.searchMetadata.clickCount * 5;
  const bookingScore = this.searchMetadata.bookingCount * 20;
  
  // Recency bonus (newer services get slight boost)
  const daysSinceCreation = Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, 100 - daysSinceCreation * 0.5);
  
  this.searchMetadata.popularityScore = ratingScore + searchScore + clickScore + bookingScore + recencyScore;
  
  // Update isPopular flag
  this.isPopular = this.searchMetadata.popularityScore > 500;
  
  await this.save();
};

// Increment search count
serviceSchema.methods.incrementSearchCount = async function() {
  this.searchMetadata.searchCount += 1;
  this.searchMetadata.lastSearched = new Date();
  await this.save();
};

// Increment click count  
serviceSchema.methods.incrementClickCount = async function() {
  this.searchMetadata.clickCount += 1;
  await this.save();
};

// ===================================
// STATIC METHODS
// ===================================

// Find services in geographic area
serviceSchema.statics.findInArea = function(lat: number, lng: number, maxDistanceKm: number, limit: number = 20) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistanceKm * 1000 // Convert km to meters
      }
    },
    isActive: true
  }).limit(limit);
};

// Search services with text and filters
serviceSchema.statics.searchServices = function(searchParams: {
  q?: string;
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  sortBy?: string;
  page?: number;
  limit?: number;
}) {
  const {
    q,
    category,
    subcategory,
    minPrice,
    maxPrice,
    minRating,
    lat,
    lng,
    radius,
    sortBy = 'popularity',
    page = 1,
    limit = 20
  } = searchParams;

  let query: any = { isActive: true };
  let sort: any = {};

  // Text search
  if (q) {
    query.$text = { $search: q };
  }

  // Category filters
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    query['price.amount'] = {};
    if (minPrice !== undefined) query['price.amount'].$gte = minPrice;
    if (maxPrice !== undefined) query['price.amount'].$lte = maxPrice;
  }

  // Rating filter
  if (minRating) query['rating.average'] = { $gte: minRating };

  // Geographic filter
  if (lat && lng && radius) {
    query['location.coordinates'] = {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius * 1000
      }
    };
  }

  // Sorting
  switch (sortBy) {
    case 'price':
      sort['price.amount'] = 1;
      break;
    case 'price_desc':
      sort['price.amount'] = -1;
      break;
    case 'rating':
      sort['rating.average'] = -1;
      break;
    case 'newest':
      sort.createdAt = -1;
      break;
    case 'popularity':
    default:
      sort['searchMetadata.popularityScore'] = -1;
      break;
  }

  // If text search, include text score in sort
  if (q) {
    sort.score = { $meta: 'textScore' };
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('provider', 'firstName lastName avatar rating');
};

// Pre-save middleware to update search keywords
serviceSchema.pre('save', function(next) {
  // Auto-generate search keywords from name and description
  const keywords = new Set<string>();
  
  // Add words from name
  this.name.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 2) keywords.add(word);
  });
  
  // Add words from description
  this.description.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 3) keywords.add(word);
  });
  
  // Add category and subcategory
  keywords.add(this.category.toLowerCase());
  if (this.subcategory) keywords.add(this.subcategory.toLowerCase());
  
  this.searchMetadata.searchKeywords = Array.from(keywords);
  
  next();
});

const Service: Model<IService> = mongoose.model<IService>('Service', serviceSchema);

export default Service;