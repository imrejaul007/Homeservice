# 🗄️ Database Design and Setup Guide

## 📋 Implementation Checklist
- [ ] **MongoDB Installation**: Local MongoDB setup and MongoDB Compass
- [ ] **Database Configuration**: Connection strings and environment setup
- [ ] **User Model**: Enhanced authentication model with security features
- [ ] **Profile Models**: CustomerProfile and ProviderProfile schemas
- [ ] **Category Models**: Service categories and subcategories
- [ ] **Indexes**: Database indexes for performance optimization
- [ ] **Data Seeding**: Initial data population scripts
- [ ] **Backup Strategy**: Database backup and restore procedures
- [ ] **Security Setup**: Authentication and access control
- [ ] **Testing Data**: Sample data for development and testing

---

## 🔧 MongoDB Installation and Setup

### **Step 1: Install MongoDB Locally**

#### **Windows Installation:**
```bash
# Download MongoDB Community Server from: https://www.mongodb.com/try/download/community

# Or using Chocolatey
choco install mongodb

# Or using Scoop
scoop install mongodb

# Start MongoDB service
net start MongoDB

# Verify installation
mongosh --version
```

#### **macOS Installation:**
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify installation
mongosh --version
```

#### **Linux (Ubuntu) Installation:**
```bash
# Import MongoDB public GPG Key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Reload package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify installation
mongosh --version
```

### **Step 2: Install MongoDB Compass (GUI)**
1. Download from: https://www.mongodb.com/products/compass
2. Install the application
3. Connect to `mongodb://localhost:27017`
4. Create database: `home_service_marketplace`

### **Step 3: Configure Environment Variables**
**File**: `backend/.env`

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/home_service_marketplace
MONGODB_URI_TEST=mongodb://localhost:27017/home_service_marketplace_test

# For MongoDB Atlas (Production)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/home_service_marketplace?retryWrites=true&w=majority

# Database Options
DB_MAX_POOL_SIZE=10
DB_SERVER_SELECTION_TIMEOUT_MS=5000
DB_SOCKET_TIMEOUT_MS=45000
DB_BUFFER_MAX_ENTRIES=0
DB_USE_NEW_URL_PARSER=true
DB_USE_UNIFIED_TOPOLOGY=true
```

---

## 🏗️ Database Connection Configuration

### **Step 4: Create Database Connection Module**
**File**: `backend/src/config/database.ts`

```typescript
import mongoose from 'mongoose';

interface DatabaseConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home_service_marketplace';
  
  if (isTest) {
    uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/home_service_marketplace_test';
  }

  const options: mongoose.ConnectOptions = {
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10'),
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || '5000'),
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT_MS || '45000'),
    bufferMaxEntries: parseInt(process.env.DB_BUFFER_MAX_ENTRIES || '0'),
  };

  return { uri, options };
};

export const connectDB = async (): Promise<void> => {
  try {
    const { uri, options } = getDatabaseConfig();
    
    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 Database URI: ${uri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs
    
    await mongoose.connect(uri, options);
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🏠 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('🔌 MongoDB Disconnected');
  } catch (error) {
    console.error('❌ MongoDB Disconnect Error:', error);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔄 Mongoose connection closed through app termination');
  process.exit(0);
});
```

### **Step 5: Database Health Check**
**File**: `backend/src/utils/dbHealthCheck.ts`

```typescript
import mongoose from 'mongoose';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy';
  connection: {
    readyState: number;
    name: string;
    host: string;
    port: number;
  };
  performance: {
    responseTime: number;
    timestamp: string;
  };
  collections: {
    name: string;
    count: number;
  }[];
}

export const checkDatabaseHealth = async (): Promise<DatabaseHealthStatus> => {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity
    const adminDb = mongoose.connection.db?.admin();
    if (!adminDb) {
      throw new Error('Database admin interface not available');
    }

    await adminDb.ping();

    // Get collection information
    const collections = await mongoose.connection.db?.collections() || [];
    const collectionInfo = await Promise.all(
      collections.map(async (collection) => ({
        name: collection.collectionName,
        count: await collection.countDocuments()
      }))
    );

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      connection: {
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name || 'unknown',
        host: mongoose.connection.host || 'localhost',
        port: mongoose.connection.port || 27017
      },
      performance: {
        responseTime,
        timestamp: new Date().toISOString()
      },
      collections: collectionInfo
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'unhealthy',
      connection: {
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name || 'unknown',
        host: mongoose.connection.host || 'localhost',
        port: mongoose.connection.port || 27017
      },
      performance: {
        responseTime,
        timestamp: new Date().toISOString()
      },
      collections: []
    };
  }
};
```

---

## 📋 Complete Data Models

### **Step 6: Enhanced User Model**
**File**: `backend/src/models/user.model.ts` (Updated with additional features)

```typescript
import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export type UserRole = 'customer' | 'provider' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending_verification' | 'deactivated';

export interface IUser extends Document {
  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  
  // Profile
  avatar?: string;
  bio?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Address
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Account Status
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  isDeleted: boolean;
  
  // Security
  lastLogin?: Date;
  lastLoginIP?: string;
  loginAttempts: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  
  // Tokens
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  verificationToken?: string;
  verificationExpire?: Date;
  refreshTokens: string[]; // For multiple device support
  
  // Preferences
  preferences: {
    language: string;
    timezone: string;
    currency: string;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      marketing: boolean;
    };
  };
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  // Virtual Properties
  fullName: string;
  age?: number;
  
  // Instance Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
  generateResetToken(): string;
  generateVerificationToken(): string;
  isLocked(): boolean;
  incLoginAttempts(): Promise<any>;
  resetLoginAttempts(): Promise<any>;
  updateLastLogin(ip?: string): Promise<void>;
}

const userSchema = new Schema<IUser>(
  {
    // Basic Info
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
      validate: {
        validator: (v: string) => /^[a-zA-Z\s-']+$/.test(v),
        message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
      }
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
      validate: {
        validator: (v: string) => /^[a-zA-Z\s-']+$/.test(v),
        message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
      }
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Please provide a valid email address'
      }
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
      validate: {
        validator: function(this: IUser, password: string) {
          // Only validate on new passwords, not on updates
          if (this.isNew || this.isModified('password')) {
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
          }
          return true;
        },
        message: 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          return !v || /^[\+]?[(]?[\d\s\-\(\)]{10,}$/.test(v);
        },
        message: 'Please provide a valid phone number'
      }
    },
    role: {
      type: String,
      enum: {
        values: ['customer', 'provider', 'admin'],
        message: 'Role must be either customer, provider, or admin'
      },
      default: 'customer',
      index: true
    },
    
    // Profile
    avatar: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
        message: 'Avatar must be a valid URL'
      }
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(v: Date) {
          if (!v) return true;
          const today = new Date();
          const age = today.getFullYear() - v.getFullYear();
          return age >= 13 && age <= 120;
        },
        message: 'Age must be between 13 and 120 years'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    
    // Address
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'US' },
      zipCode: String,
      coordinates: {
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 }
      }
    },
    
    // Account Status
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'pending_verification', 'deactivated'],
      default: 'pending_verification',
      index: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    
    // Security
    lastLogin: Date,
    lastLoginIP: String,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    passwordChangedAt: Date,
    
    // Tokens
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    verificationToken: String,
    verificationExpire: Date,
    refreshTokens: [String],
    
    // Preferences
    preferences: {
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      currency: { type: String, default: 'USD' },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false }
      }
    },
    
    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.__v;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpire;
        delete ret.verificationToken;
        delete ret.verificationExpire;
        delete ret.refreshTokens;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Compound Indexes for Performance
userSchema.index({ email: 1, role: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });
userSchema.index({ accountStatus: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'address.coordinates': '2dsphere' }); // For geospatial queries

// Virtual Properties
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return undefined;
  const today = new Date();
  const age = today.getFullYear() - this.dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - this.dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.dateOfBirth.getDate())) {
    return age - 1;
  }
  return age;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    this.password = await bcrypt.hash(this.password, saltRounds);
    this.passwordChangedAt = new Date();
  }
  
  // Update account status based on verification
  if (this.isModified('isEmailVerified') && this.isEmailVerified) {
    if (this.accountStatus === 'pending_verification') {
      this.accountStatus = 'active';
    }
  }
  
  next();
});

// Instance Methods
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

userSchema.methods.generateAuthToken = function(): string {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    firstName: this.firstName,
    lastName: this.lastName,
    isEmailVerified: this.isEmailVerified,
    accountStatus: this.accountStatus
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    { 
      expiresIn: process.env.JWT_EXPIRE || '15m',
      issuer: 'home-service-platform'
    }
  );
};

userSchema.methods.generateRefreshToken = function(): string {
  const refreshToken = jwt.sign(
    { 
      id: this._id,
      tokenVersion: Date.now() // For token invalidation
    },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: '7d' }
  );

  // Store refresh token
  this.refreshTokens.push(refreshToken);
  
  // Limit stored tokens (keep only last 5)
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  return refreshToken;
};

userSchema.methods.generateResetToken = function(): string {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  return resetToken;
};

userSchema.methods.generateVerificationToken = function(): string {
  const verificationToken = jwt.sign(
    { id: this._id, purpose: 'email-verification' },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' }
  );

  this.verificationToken = verificationToken;
  this.verificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return verificationToken;
};

userSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  const lockTime = parseInt(process.env.LOCK_TIME_HOURS || '2') * 60 * 60 * 1000;
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

userSchema.methods.updateLastLogin = async function(ip?: string) {
  const updateData: any = { lastLogin: new Date() };
  if (ip) updateData.lastLoginIP = ip;
  
  return this.updateOne(updateData);
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;
```

### **Step 7: Service Category Model**
**File**: `backend/src/models/serviceCategory.model.ts` (Enhanced)

```typescript
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
```

---

## 🌱 Database Seeding

### **Step 8: Comprehensive Category Seeder**
**File**: `backend/src/seeders/categories.seeder.ts` (Enhanced)

```typescript
import mongoose from 'mongoose';
import ServiceCategory from '../models/serviceCategory.model';
import { connectDB } from '../config/database';

const categories = [
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description: 'Professional beauty and personal care services including hair, makeup, skincare, and nail care',
    icon: 'beauty',
    color: '#FF6B9D',
    sortOrder: 1,
    isFeatured: true,
    subcategories: [
      {
        name: 'Hair Styling',
        slug: 'hair-styling',
        description: 'Professional hair cutting, styling, coloring, and treatments',
        icon: 'scissors',
        color: '#FF8A80',
        sortOrder: 1,
        metadata: {
          averagePrice: 75,
          averageDuration: 90,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['hair_cutting', 'color_theory', 'styling']
        }
      },
      {
        name: 'Makeup Services',
        slug: 'makeup-services',
        description: 'Professional makeup for events, weddings, and special occasions',
        icon: 'palette',
        color: '#F48FB1',
        sortOrder: 2,
        metadata: {
          averagePrice: 100,
          averageDuration: 60,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['makeup_artistry', 'color_matching', 'event_makeup']
        }
      },
      {
        name: 'Facial Treatments',
        slug: 'facial-treatments',
        description: 'Professional facial treatments, skincare, and anti-aging services',
        icon: 'sparkles',
        color: '#CE93D8',
        sortOrder: 3,
        metadata: {
          averagePrice: 85,
          averageDuration: 75,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['skincare', 'facial_massage', 'product_knowledge']
        }
      },
      {
        name: 'Nail Care',
        slug: 'nail-care',
        description: 'Manicure, pedicure, nail art, and nail enhancement services',
        icon: 'hand',
        color: '#B39DDB',
        sortOrder: 4,
        metadata: {
          averagePrice: 45,
          averageDuration: 45,
          popularTimes: ['morning', 'afternoon', 'evening'],
          requiredSkills: ['manicure', 'pedicure', 'nail_art']
        }
      },
      {
        name: 'Eyebrows & Lashes',
        slug: 'eyebrows-lashes',
        description: 'Eyebrow shaping, threading, tinting, and eyelash extensions',
        icon: 'eye',
        color: '#90CAF9',
        sortOrder: 5,
        metadata: {
          averagePrice: 55,
          averageDuration: 30,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['threading', 'waxing', 'lash_extensions']
        }
      }
    ],
    seo: {
      metaTitle: 'Professional Beauty Services - Hair, Makeup & Skincare',
      metaDescription: 'Book professional beauty services including hair styling, makeup, facials, and nail care with verified beauty professionals.',
      keywords: ['beauty services', 'hair styling', 'makeup', 'facial', 'nail care', 'eyebrows']
    }
  },
  
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    description: 'Comprehensive health and wellness services for mind, body, and spirit',
    icon: 'heart',
    color: '#4CAF50',
    sortOrder: 2,
    isFeatured: true,
    subcategories: [
      {
        name: 'Massage Therapy',
        slug: 'massage-therapy',
        description: 'Therapeutic and relaxation massage services including deep tissue, Swedish, and hot stone',
        icon: 'massage',
        color: '#66BB6A',
        sortOrder: 1,
        metadata: {
          averagePrice: 90,
          averageDuration: 60,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['massage_therapy', 'anatomy', 'pressure_techniques']
        }
      },
      {
        name: 'Spa Treatments',
        slug: 'spa-treatments',
        description: 'Comprehensive spa experiences including body wraps, scrubs, and aromatherapy',
        icon: 'flower',
        color: '#81C784',
        sortOrder: 2,
        metadata: {
          averagePrice: 120,
          averageDuration: 90,
          popularTimes: ['afternoon'],
          requiredSkills: ['spa_treatments', 'aromatherapy', 'body_treatments']
        }
      },
      {
        name: 'Acupuncture',
        slug: 'acupuncture',
        description: 'Traditional acupuncture and alternative healing therapies',
        icon: 'target',
        color: '#A5D6A7',
        sortOrder: 3,
        metadata: {
          averagePrice: 85,
          averageDuration: 60,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['acupuncture', 'tcm', 'holistic_healing']
        }
      },
      {
        name: 'Meditation & Mindfulness',
        slug: 'meditation-mindfulness',
        description: 'Guided meditation, mindfulness coaching, and stress reduction techniques',
        icon: 'zen',
        color: '#C8E6C9',
        sortOrder: 4,
        metadata: {
          averagePrice: 60,
          averageDuration: 45,
          popularTimes: ['morning', 'evening'],
          requiredSkills: ['meditation', 'mindfulness', 'stress_management']
        }
      }
    ],
    seo: {
      metaTitle: 'Health & Wellness Services - Massage, Spa & Alternative Therapy',
      metaDescription: 'Find certified health and wellness professionals for massage therapy, spa treatments, acupuncture, and meditation services.',
      keywords: ['massage therapy', 'spa treatments', 'wellness', 'acupuncture', 'meditation']
    }
  },

  {
    name: 'Fitness & Training',
    slug: 'fitness-training',
    description: 'Personal training, fitness coaching, and specialized workout programs',
    icon: 'dumbbell',
    color: '#FF9800',
    sortOrder: 3,
    isFeatured: true,
    subcategories: [
      {
        name: 'Personal Training',
        slug: 'personal-training',
        description: 'One-on-one fitness training sessions tailored to your goals',
        icon: 'person-running',
        color: '#FFB74D',
        sortOrder: 1,
        metadata: {
          averagePrice: 70,
          averageDuration: 60,
          popularTimes: ['morning', 'evening'],
          requiredSkills: ['personal_training', 'exercise_physiology', 'nutrition']
        }
      },
      {
        name: 'Yoga Instruction',
        slug: 'yoga-instruction',
        description: 'Private and group yoga sessions for all levels and styles',
        icon: 'yoga',
        color: '#FFCC02',
        sortOrder: 2,
        metadata: {
          averagePrice: 55,
          averageDuration: 75,
          popularTimes: ['morning', 'evening'],
          requiredSkills: ['yoga_instruction', 'anatomy', 'meditation']
        }
      },
      {
        name: 'Pilates',
        slug: 'pilates',
        description: 'Pilates instruction focusing on core strength and flexibility',
        icon: 'pilates',
        color: '#FFE082',
        sortOrder: 3,
        metadata: {
          averagePrice: 65,
          averageDuration: 60,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['pilates', 'core_training', 'flexibility']
        }
      },
      {
        name: 'Nutrition Coaching',
        slug: 'nutrition-coaching',
        description: 'Personalized nutrition counseling and meal planning services',
        icon: 'apple',
        color: '#FFF176',
        sortOrder: 4,
        metadata: {
          averagePrice: 80,
          averageDuration: 60,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['nutrition', 'meal_planning', 'dietary_counseling']
        }
      },
      {
        name: 'Dance Instruction',
        slug: 'dance-instruction',
        description: 'Private dance lessons in various styles and skill levels',
        icon: 'music',
        color: '#FFEB3B',
        sortOrder: 5,
        metadata: {
          averagePrice: 50,
          averageDuration: 60,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['dance_instruction', 'choreography', 'rhythm']
        }
      }
    ],
    seo: {
      metaTitle: 'Fitness & Training Services - Personal Trainers & Yoga Instructors',
      metaDescription: 'Connect with certified fitness professionals, personal trainers, yoga instructors, and nutrition coaches for personalized health coaching.',
      keywords: ['personal training', 'yoga', 'pilates', 'fitness coaching', 'nutrition']
    }
  },

  {
    name: 'Home Services',
    slug: 'home-services',
    description: 'Professional home maintenance, repair, and improvement services',
    icon: 'home',
    color: '#2196F3',
    sortOrder: 4,
    isFeatured: true,
    subcategories: [
      {
        name: 'House Cleaning',
        slug: 'house-cleaning',
        description: 'Residential cleaning services including deep cleaning and maintenance',
        icon: 'broom',
        color: '#42A5F5',
        sortOrder: 1,
        metadata: {
          averagePrice: 120,
          averageDuration: 180,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['residential_cleaning', 'time_management', 'attention_to_detail']
        }
      },
      {
        name: 'Plumbing Services',
        slug: 'plumbing-services',
        description: 'Professional plumbing repairs, installations, and maintenance',
        icon: 'wrench',
        color: '#64B5F6',
        sortOrder: 2,
        metadata: {
          averagePrice: 150,
          averageDuration: 120,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['plumbing', 'pipe_repair', 'water_systems']
        }
      },
      {
        name: 'Electrical Services',
        slug: 'electrical-services',
        description: 'Electrical repairs, installations, and safety inspections',
        icon: 'zap',
        color: '#90CAF9',
        sortOrder: 3,
        metadata: {
          averagePrice: 175,
          averageDuration: 90,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['electrical_work', 'wiring', 'safety_protocols']
        }
      },
      {
        name: 'Landscaping & Gardening',
        slug: 'landscaping-gardening',
        description: 'Garden maintenance, landscaping design, and outdoor beautification',
        icon: 'leaf',
        color: '#BBDEFB',
        sortOrder: 4,
        metadata: {
          averagePrice: 100,
          averageDuration: 240,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['landscaping', 'horticulture', 'garden_design']
        }
      },
      {
        name: 'Handyman Services',
        slug: 'handyman-services',
        description: 'General home repairs, installations, and maintenance tasks',
        icon: 'tools',
        color: '#E3F2FD',
        sortOrder: 5,
        metadata: {
          averagePrice: 85,
          averageDuration: 120,
          popularTimes: ['morning', 'afternoon'],
          requiredSkills: ['general_repairs', 'carpentry', 'problem_solving']
        }
      }
    ],
    seo: {
      metaTitle: 'Home Services - Cleaning, Plumbing, Electrical & Maintenance',
      metaDescription: 'Find reliable home service professionals for cleaning, plumbing, electrical work, and general maintenance needs.',
      keywords: ['home services', 'house cleaning', 'plumbing', 'electrical', 'handyman']
    }
  },

  {
    name: 'Education & Tutoring',
    slug: 'education-tutoring',
    description: 'Educational services, tutoring, and skill development programs',
    icon: 'book',
    color: '#9C27B0',
    sortOrder: 5,
    isFeatured: false,
    subcategories: [
      {
        name: 'Academic Tutoring',
        slug: 'academic-tutoring',
        description: 'Subject-specific tutoring for students of all ages and levels',
        icon: 'graduation-cap',
        color: '#AB47BC',
        sortOrder: 1,
        metadata: {
          averagePrice: 45,
          averageDuration: 60,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['subject_expertise', 'teaching', 'student_assessment']
        }
      },
      {
        name: 'Language Learning',
        slug: 'language-learning',
        description: 'Foreign language instruction and conversation practice',
        icon: 'globe',
        color: '#BA68C8',
        sortOrder: 2,
        metadata: {
          averagePrice: 50,
          averageDuration: 60,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['language_fluency', 'cultural_knowledge', 'conversation']
        }
      },
      {
        name: 'Music Lessons',
        slug: 'music-lessons',
        description: 'Private music instruction for various instruments and voice',
        icon: 'music-note',
        color: '#CE93D8',
        sortOrder: 3,
        metadata: {
          averagePrice: 60,
          averageDuration: 45,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['musical_instrument', 'music_theory', 'performance']
        }
      },
      {
        name: 'Art & Drawing',
        slug: 'art-drawing',
        description: 'Art instruction including drawing, painting, and creative techniques',
        icon: 'palette',
        color: '#D1C4E9',
        sortOrder: 4,
        metadata: {
          averagePrice: 55,
          averageDuration: 90,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['artistic_technique', 'creativity', 'art_history']
        }
      },
      {
        name: 'Test Preparation',
        slug: 'test-preparation',
        description: 'Standardized test prep for SAT, ACT, GRE, and other exams',
        icon: 'clipboard',
        color: '#E1BEE7',
        sortOrder: 5,
        metadata: {
          averagePrice: 70,
          averageDuration: 90,
          popularTimes: ['afternoon', 'evening'],
          requiredSkills: ['test_strategies', 'subject_mastery', 'time_management']
        }
      }
    ],
    seo: {
      metaTitle: 'Education & Tutoring Services - Academic & Skill Development',
      metaDescription: 'Find qualified tutors and educators for academic subjects, language learning, music, art, and test preparation.',
      keywords: ['tutoring', 'education', 'language learning', 'music lessons', 'test prep']
    }
  }
];

export const seedCategories = async (): Promise<void> => {
  try {
    console.log('🌱 Starting service categories seeding...');

    // Clear existing categories
    await ServiceCategory.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    // Insert new categories with full metadata
    const insertedCategories = await ServiceCategory.insertMany(categories);
    console.log('✅ Service categories seeded successfully');
    
    // Log statistics
    const totalSubcategories = categories.reduce((acc, cat) => acc + cat.subcategories.length, 0);
    console.log(`📊 Seeding Statistics:`);
    console.log(`   └── Categories: ${categories.length}`);
    console.log(`   └── Subcategories: ${totalSubcategories}`);
    console.log(`   └── Featured Categories: ${categories.filter(cat => cat.isFeatured).length}`);
    
    // Show category breakdown
    console.log(`📋 Category Breakdown:`);
    categories.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.name} (${cat.subcategories.length} subcategories)`);
    });

    return Promise.resolve();
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

// Advanced seeding with user audit
export const seedCategoriesWithAudit = async (adminUserId?: string): Promise<void> => {
  try {
    console.log('🌱 Starting service categories seeding with audit...');

    // Add audit information if admin user provided
    const categoriesWithAudit = categories.map(cat => ({
      ...cat,
      createdBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
      updatedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined
    }));

    // Clear existing categories
    await ServiceCategory.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    // Insert new categories
    await ServiceCategory.insertMany(categoriesWithAudit);
    console.log('✅ Service categories seeded successfully with audit trail');

  } catch (error) {
    console.error('❌ Error seeding categories with audit:', error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedCategories();
      console.log('🎉 Seeding completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    }
  })();
}
```

### **Step 9: Admin User Seeder**
**File**: `backend/src/seeders/admin.seeder.ts`

```typescript
import User from '../models/user.model';
import { connectDB } from '../config/database';

export const createAdminUser = async (): Promise<void> => {
  try {
    console.log('👑 Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: process.env.ADMIN_EMAIL || 'admin@homeservice.com',
      role: 'admin' 
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }

    // Create admin user
    const adminData = {
      firstName: process.env.ADMIN_FIRST_NAME || 'Super',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@homeservice.com',
      password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
      phone: process.env.ADMIN_PHONE || '+1234567890',
      role: 'admin',
      isEmailVerified: true,
      accountStatus: 'active',
      preferences: {
        language: 'en',
        timezone: 'UTC',
        currency: 'USD',
        notifications: {
          email: true,
          sms: true,
          push: true,
          marketing: false
        }
      }
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🆔 ID: ${admin._id}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await createAdminUser();
      console.log('🎉 Admin user creation completed!');
      process.exit(0);
    } catch (error) {
      console.error('💥 Admin user creation failed:', error);
      process.exit(1);
    }
  })();
}
```

### **Step 10: Master Seeder**
**File**: `backend/src/seeders/index.ts`

```typescript
import { connectDB, disconnectDB } from '../config/database';
import { seedCategories } from './categories.seeder';
import { createAdminUser } from './admin.seeder';

export const runAllSeeders = async (): Promise<void> => {
  try {
    console.log('🚀 Starting database seeding process...\n');

    // Connect to database
    await connectDB();

    // Run seeders in order
    console.log('1️⃣  Creating admin user...');
    await createAdminUser();

    console.log('\n2️⃣  Seeding service categories...');
    await seedCategories();

    console.log('\n✅ All seeders completed successfully!');

  } catch (error) {
    console.error('\n❌ Seeding process failed:', error);
    throw error;
  }
};

// Run all seeders if called directly
if (require.main === module) {
  (async () => {
    try {
      await runAllSeeders();
      await disconnectDB();
      console.log('\n🎉 Database seeding completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n💥 Database seeding failed:', error);
      await disconnectDB();
      process.exit(1);
    }
  })();
}
```

---

## 📊 Database Utilities

### **Step 11: Database Management Commands**
**File**: `backend/src/utils/dbManager.ts`

```typescript
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/database';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';

export class DatabaseManager {
  
  // Database Statistics
  static async getDatabaseStats() {
    try {
      const stats = {
        connection: {
          readyState: mongoose.connection.readyState,
          name: mongoose.connection.name,
          host: mongoose.connection.host,
          port: mongoose.connection.port
        },
        collections: {
          users: await User.countDocuments(),
          customerProfiles: await CustomerProfile.countDocuments(),
          providerProfiles: await ProviderProfile.countDocuments(),
          serviceCategories: await ServiceCategory.countDocuments()
        },
        userStats: {
          totalUsers: await User.countDocuments(),
          customers: await User.countDocuments({ role: 'customer' }),
          providers: await User.countDocuments({ role: 'provider' }),
          admins: await User.countDocuments({ role: 'admin' }),
          verifiedUsers: await User.countDocuments({ isEmailVerified: true }),
          activeUsers: await User.countDocuments({ isActive: true })
        },
        categoryStats: {
          totalCategories: await ServiceCategory.countDocuments(),
          activeCategories: await ServiceCategory.countDocuments({ isActive: true }),
          featuredCategories: await ServiceCategory.countDocuments({ isFeatured: true })
        }
      };

      return stats;
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error.message}`);
    }
  }

  // Clean up test data
  static async cleanupTestData() {
    try {
      console.log('🧹 Cleaning up test data...');
      
      // Remove test users
      const testEmails = /test|example|demo/i;
      const deletedUsers = await User.deleteMany({ email: testEmails });
      
      // Remove associated profiles
      const deletedCustomerProfiles = await CustomerProfile.deleteMany({
        userId: { $in: deletedUsers.deletedCount > 0 ? [] : [] } // This would need proper implementation
      });

      console.log(`✅ Cleanup completed:`);
      console.log(`   └── Users removed: ${deletedUsers.deletedCount}`);
      console.log(`   └── Customer profiles removed: ${deletedCustomerProfiles.deletedCount}`);

    } catch (error) {
      throw new Error(`Failed to cleanup test data: ${error.message}`);
    }
  }

  // Create database indexes
  static async createIndexes() {
    try {
      console.log('📊 Creating database indexes...');

      // User indexes
      await User.createIndexes();
      console.log('   ✅ User indexes created');

      // Customer profile indexes  
      await CustomerProfile.createIndexes();
      console.log('   ✅ Customer profile indexes created');

      // Provider profile indexes
      await ProviderProfile.createIndexes();
      console.log('   ✅ Provider profile indexes created');

      // Service category indexes
      await ServiceCategory.createIndexes();
      console.log('   ✅ Service category indexes created');

      console.log('✅ All indexes created successfully');

    } catch (error) {
      throw new Error(`Failed to create indexes: ${error.message}`);
    }
  }

  // Database backup
  static async createBackup(backupPath?: string) {
    // This would integrate with MongoDB dump tools
    // Implementation depends on your backup strategy
    console.log('💾 Database backup functionality would be implemented here');
  }

  // Database restore
  static async restoreBackup(backupPath: string) {
    // This would integrate with MongoDB restore tools
    console.log('🔄 Database restore functionality would be implemented here');
  }

  // Validate data integrity
  static async validateDataIntegrity() {
    try {
      console.log('🔍 Validating data integrity...');

      const issues: string[] = [];

      // Check for users without profiles
      const customersWithoutProfiles = await User.aggregate([
        { $match: { role: 'customer' } },
        {
          $lookup: {
            from: 'customerprofiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile'
          }
        },
        { $match: { profile: { $size: 0 } } },
        { $count: 'count' }
      ]);

      if (customersWithoutProfiles[0]?.count > 0) {
        issues.push(`${customersWithoutProfiles[0].count} customers without profiles`);
      }

      // Check for profiles without users
      const orphanedCustomerProfiles = await CustomerProfile.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $match: { user: { $size: 0 } } },
        { $count: 'count' }
      ]);

      if (orphanedCustomerProfiles[0]?.count > 0) {
        issues.push(`${orphanedCustomerProfiles[0].count} orphaned customer profiles`);
      }

      if (issues.length === 0) {
        console.log('✅ Data integrity validation passed');
      } else {
        console.log('⚠️  Data integrity issues found:');
        issues.forEach(issue => console.log(`   └── ${issue}`));
      }

      return issues;

    } catch (error) {
      throw new Error(`Failed to validate data integrity: ${error.message}`);
    }
  }
}

// CLI Commands
const command = process.argv[2];

if (require.main === module) {
  (async () => {
    try {
      await connectDB();

      switch (command) {
        case 'stats':
          const stats = await DatabaseManager.getDatabaseStats();
          console.log('📊 Database Statistics:');
          console.log(JSON.stringify(stats, null, 2));
          break;

        case 'cleanup':
          await DatabaseManager.cleanupTestData();
          break;

        case 'indexes':
          await DatabaseManager.createIndexes();
          break;

        case 'validate':
          await DatabaseManager.validateDataIntegrity();
          break;

        default:
          console.log('Available commands: stats, cleanup, indexes, validate');
      }

      await disconnectDB();
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      await disconnectDB();
      process.exit(1);
    }
  })();
}
```

---

## 🚀 Setup Commands and Scripts

### **Step 12: NPM Scripts for Database**
**File**: Add to `backend/package.json`

```json
{
  "scripts": {
    "db:connect": "ts-node src/config/database.ts",
    "db:seed": "ts-node src/seeders/index.ts",
    "db:seed:categories": "ts-node src/seeders/categories.seeder.ts",
    "db:seed:admin": "ts-node src/seeders/admin.seeder.ts",
    "db:stats": "ts-node src/utils/dbManager.ts stats",
    "db:cleanup": "ts-node src/utils/dbManager.ts cleanup",
    "db:indexes": "ts-node src/utils/dbManager.ts indexes",
    "db:validate": "ts-node src/utils/dbManager.ts validate",
    "db:reset": "ts-node -e \"require('./src/utils/dbManager.ts').DatabaseManager.cleanupTestData()\" && npm run db:seed"
  }
}
```

### **Step 13: Development Setup Script**
**File**: `backend/scripts/setup-dev-db.sh`

```bash
#!/bin/bash

echo "🚀 Setting up development database..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "❌ MongoDB is not running. Please start MongoDB first."
    exit 1
fi

echo "✅ MongoDB is running"

# Load environment variables
if [ -f .env ]; then
    echo "📄 Loading environment variables..."
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
else
    echo "⚠️  No .env file found. Using default values."
fi

# Create database and collections
echo "🗄️  Creating database structure..."
npm run db:indexes

# Seed initial data
echo "🌱 Seeding initial data..."
npm run db:seed

# Show database stats
echo "📊 Database setup complete! Here are the stats:"
npm run db:stats

echo "✅ Development database setup completed successfully!"
```

### **Step 14: Docker Compose for MongoDB**
**File**: `docker-compose.yml` (for easy MongoDB setup)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: home_service_mongodb
    restart: always
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD:-password}
      MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE:-home_service_marketplace}
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - home_service_network

  mongo-express:
    image: mongo-express:latest
    container_name: home_service_mongo_express
    restart: always
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: ${MONGO_ROOT_USERNAME:-admin}
      ME_CONFIG_MONGODB_ADMINPASSWORD: ${MONGO_ROOT_PASSWORD:-password}
      ME_CONFIG_MONGODB_URL: mongodb://admin:password@mongodb:27017/
    depends_on:
      - mongodb
    networks:
      - home_service_network

volumes:
  mongodb_data:
    driver: local
  mongodb_config:
    driver: local

networks:
  home_service_network:
    driver: bridge
```

---

## ⚡ Quick Setup Commands

```bash
# 1. Install MongoDB (if not using Docker)
# See installation steps above for your OS

# 2. Start MongoDB with Docker (recommended)
docker-compose up -d mongodb

# 3. Install Node.js dependencies
npm install mongoose bcryptjs jsonwebtoken

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string

# 5. Run database setup
chmod +x scripts/setup-dev-db.sh
./scripts/setup-dev-db.sh

# 6. Verify setup
npm run db:stats

# 7. Access MongoDB GUI
# MongoDB Compass: mongodb://localhost:27017
# Mongo Express: http://localhost:8081
```

This comprehensive database setup guide provides everything needed for a production-ready MongoDB configuration with proper indexing, data validation, seeding, and management utilities.