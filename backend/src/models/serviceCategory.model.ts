import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IServiceCategory extends Document {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color?: string;
  imageUrl?: string;
  
  subcategories: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    icon?: string;
    color?: string;
    imageUrl?: string;
    isActive: boolean;
    sortOrder: number;
    metadata?: {
      averagePrice?: number;
      averageDuration?: number; // in minutes
      popularTimes?: string[]; // ['morning', 'afternoon', 'evening']
      requiredSkills?: string[];
    };
  }>;
  
  isActive: boolean;
  isFeatured: boolean;
  comingSoon: boolean;
  sortOrder: number;
  
  metadata: {
    totalProviders?: number;
    totalServices?: number;
    averageRating?: number;
    popularityScore?: number;
  };
  
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const serviceCategorySchema = new Schema<IServiceCategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
      unique: true
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
    },
    description: {
      type: String,
      required: [true, 'Category description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    icon: {
      type: String,
      required: [true, 'Category icon is required']
    },
    color: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color']
    },
    imageUrl: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
        message: 'Image URL must be a valid URL'
      }
    },
    
    subcategories: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      slug: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: /^[a-z0-9-]+$/
      },
      description: {
        type: String,
        required: true,
        maxlength: 300
      },
      icon: String,
      color: {
        type: String,
        match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      },
      imageUrl: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Image URL must be a valid URL'
        }
      },
      isActive: { type: Boolean, default: true },
      sortOrder: { type: Number, default: 0 },
      metadata: {
        averagePrice: { type: Number, min: 0 },
        averageDuration: { type: Number, min: 0 },
        popularTimes: [{ type: String, enum: ['morning', 'afternoon', 'evening', 'night'] }],
        requiredSkills: [String]
      }
    }],
    
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    comingSoon: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    
    metadata: {
      totalProviders: { type: Number, default: 0, min: 0 },
      totalServices: { type: Number, default: 0, min: 0 },
      averageRating: { type: Number, min: 0, max: 5 },
      popularityScore: { type: Number, default: 0, min: 0 }
    },
    
    seo: {
      metaTitle: { type: String, maxlength: 60 },
      metaDescription: { type: String, maxlength: 160 },
      keywords: [{ type: String, maxlength: 50 }],
      canonicalUrl: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Canonical URL must be a valid URL'
        }
      }
    },
    
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
serviceCategorySchema.index({ slug: 1 }, { unique: true });
serviceCategorySchema.index({ isActive: 1, sortOrder: 1 });
serviceCategorySchema.index({ isFeatured: 1, isActive: 1 });
serviceCategorySchema.index({ 'metadata.popularityScore': -1 });
serviceCategorySchema.index({ 'subcategories.slug': 1 });
serviceCategorySchema.index({ 'subcategories.isActive': 1 });

// Ensure subcategory slugs are unique within each category
serviceCategorySchema.index(
  { slug: 1, 'subcategories.slug': 1 },
  { unique: true, partialFilterExpression: { 'subcategories.slug': { $exists: true } } }
);

// Virtual for active subcategories count
serviceCategorySchema.virtual('activeSubcategoriesCount').get(function() {
  return this.subcategories.filter(sub => sub.isActive).length;
});

// Pre-save middleware
serviceCategorySchema.pre('save', function(next) {
  // Generate slug from name if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  
  // Generate slugs for subcategories
  this.subcategories.forEach(sub => {
    if (!sub.slug && sub.name) {
      sub.slug = sub.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }
  });
  
  next();
});

// Static methods
serviceCategorySchema.statics.findActiveCategories = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

serviceCategorySchema.statics.findFeaturedCategories = function() {
  return this.find({ isActive: true, isFeatured: true }).sort({ sortOrder: 1 });
};

serviceCategorySchema.statics.findBySlug = function(slug: string) {
  return this.findOne({ slug, isActive: true });
};

const ServiceCategory: Model<IServiceCategory> = mongoose.model<IServiceCategory>('ServiceCategory', serviceCategorySchema);

export default ServiceCategory;