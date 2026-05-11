import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBooking extends Document {
  // Core Booking Information
  _id: mongoose.Types.ObjectId;
  bookingNumber: string; // Unique booking reference (e.g., "RZ-20240117-001")
  customerId?: mongoose.Types.ObjectId; // Reference to User (customer) - optional for guest bookings
  providerId: mongoose.Types.ObjectId; // Reference to User (provider)
  serviceId: mongoose.Types.ObjectId; // Reference to Service

  // Guest Booking Fields
  isGuestBooking: boolean;
  guestInfo?: {
    name: string;
    email: string;
    phone: string;
  };

  // Booking Details
  scheduledDate: Date;
  scheduledTime: string; // "14:30" format
  duration: number; // in minutes
  estimatedEndTime: Date;

  // New Booking Flow Fields
  locationType: 'at_home' | 'hotel';
  selectedDuration: number; // User-selected duration from service options
  professionalPreference: 'male' | 'female' | 'no_preference';
  paymentMethod: 'apple_pay' | 'credit_card' | 'cash';

  // Location Information
  location: {
    type: 'customer_address' | 'provider_location' | 'online';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      coordinates?: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
      };
    };
    notes?: string; // Special location instructions
  };

  // Booking Status Workflow
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    reason?: string;
    updatedBy: 'customer' | 'provider' | 'system' | 'admin';
    notes?: string;
  }>;

  // Pricing Information
  pricing: {
    basePrice: number;
    addOns: Array<{
      name: string;
      price: number;
    }>;
    discounts: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
    subtotal: number;
    tax: number;
    totalAmount: number;
    currency: string;
  };

  // Customer Information (snapshot at time of booking)
  customerInfo: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    specialRequests?: string;
    accessInstructions?: string;
  };

  // Provider Response
  providerResponse: {
    acceptedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
    estimatedArrival?: Date;
    arrivalTime?: Date;
    completedAt?: Date;
    notes?: string;
  };

  // Communication Thread
  messages: Array<{
    _id: mongoose.Types.ObjectId;
    from: mongoose.Types.ObjectId; // User ID
    message: string;
    timestamp: Date;
    type: 'text' | 'system' | 'update';
    isRead: boolean;
  }>;

  // Cancellation Policy & Management
  cancellationPolicy: {
    allowedUntil: Date; // When customer can cancel without fee
    refundPercentage: number; // Based on timing
    cancellationFee: number;
  };

  cancellationDetails?: {
    cancelledBy: 'customer' | 'provider' | 'admin' | 'system';
    cancelledAt: Date;
    reason: string;
    refundAmount: number;
    refundStatus: 'pending' | 'processed' | 'failed';
  };

  // Payment Integration (for future payment system)
  payment: {
    status: 'pending' | 'paid' | 'refunded' | 'failed';
    method?: string; // 'card', 'cash', 'digital_wallet'
    transactionId?: string;
    paidAt?: Date;
    refundedAt?: Date;
  };

  // Metadata & Analytics
  metadata: {
    bookingSource: 'search' | 'profile' | 'recommendation' | 'repeat';
    deviceType: 'mobile' | 'desktop' | 'tablet';
    userAgent?: string;
    sessionId?: string;
  };

  // Review References (populated after completion)
  customerReview?: mongoose.Types.ObjectId;
  providerReview?: mongoose.Types.ObjectId;

  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Virtual Properties
  customer?: any; // Will be populated from User
  provider?: any; // Will be populated from User
  service?: any; // Will be populated from Service
  totalDuration: number; // Including buffer time
  isActive: boolean; // Not cancelled or completed
  canBeCancelled: boolean; // Based on cancellation policy
  timeUntilService: number; // Minutes until scheduled time

  // Instance Methods
  generateBookingNumber(): string;
  updateStatus(newStatus: string, updatedBy: string, reason?: string, notes?: string): Promise<void>;
  addMessage(from: mongoose.Types.ObjectId, message: string, type?: string): Promise<void>;
  calculateRefund(): number;
  canCustomerCancel(): boolean;
  canProviderCancel(): boolean;
  markAsCompleted(): Promise<void>;
  sendNotification(type: string, recipient: 'customer' | 'provider' | 'both'): Promise<void>;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingNumber: {
      type: String,
      unique: true,
      required: [true, 'Booking number is required'],
      index: true
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },

    // Guest Booking Fields
    isGuestBooking: {
      type: Boolean,
      default: false
    },

    guestInfo: {
      name: { type: String },
      email: { type: String },
      phone: { type: String }
    },

    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider ID is required'],
      index: true
    },

    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true
    },

    // Booking Details
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
      index: true
    },

    scheduledTime: {
      type: String,
      required: [true, 'Scheduled time is required'],
      validate: {
        validator: function(time: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
        },
        message: 'Invalid time format. Use HH:MM format'
      }
    },

    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [15, 'Duration must be at least 15 minutes'],
      max: [480, 'Duration cannot exceed 8 hours']
    },

    estimatedEndTime: {
      type: Date,
      required: [true, 'Estimated end time is required']
    },

    // New Booking Flow Fields
    locationType: {
      type: String,
      enum: ['at_home', 'hotel'],
      default: 'at_home'
    },

    selectedDuration: {
      type: Number,
      min: [15, 'Duration must be at least 15 minutes'],
      max: [480, 'Duration cannot exceed 8 hours']
    },

    professionalPreference: {
      type: String,
      enum: ['male', 'female', 'no_preference'],
      default: 'no_preference'
    },

    paymentMethod: {
      type: String,
      enum: ['apple_pay', 'credit_card', 'cash'],
      default: 'credit_card'
    },

    // Location Information
    location: {
      type: {
        type: String,
        enum: ['customer_address', 'provider_location', 'online'],
        required: [true, 'Location type is required']
      },
      address: {
        street: {
          type: String,
          required: function(this: any) {
            return this.location.type === 'customer_address';
          }
        },
        city: {
          type: String,
          required: function(this: any) {
            return this.location.type === 'customer_address';
          }
        },
        state: {
          type: String,
          required: function(this: any) {
            return this.location.type === 'customer_address';
          }
        },
        zipCode: {
          type: String,
          required: function(this: any) {
            return this.location.type === 'customer_address';
          }
        },
        country: { type: String, default: 'AE' },
        coordinates: {
          type: {
            type: String,
            enum: ['Point']
          },
          coordinates: {
            type: [Number], // [longitude, latitude]
            validate: {
              validator: function(coords: number[]) {
                return coords && coords.length === 2 &&
                       coords[0] >= -180 && coords[0] <= 180 && // longitude
                       coords[1] >= -90 && coords[1] <= 90;    // latitude
              },
              message: 'Invalid coordinates'
            }
          }
        }
      },
      notes: String
    },

    // Booking Status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'pending',
      required: [true, 'Status is required'],
      index: true
    },

    statusHistory: [{
      status: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now,
        required: true
      },
      reason: String,
      updatedBy: {
        type: String,
        enum: ['customer', 'provider', 'system', 'admin'],
        required: true
      },
      notes: String
    }],

    // Pricing Information
    pricing: {
      basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
        min: [0, 'Base price cannot be negative']
      },
      addOns: [{
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 }
      }],
      discounts: [{
        type: { type: String, required: true },
        amount: { type: Number, required: true },
        description: { type: String, required: true }
      }],
      subtotal: {
        type: Number,
        required: [true, 'Subtotal is required'],
        min: [0, 'Subtotal cannot be negative']
      },
      tax: {
        type: Number,
        default: 0,
        min: [0, 'Tax cannot be negative']
      },
      totalAmount: {
        type: Number,
        required: [true, 'Total amount is required'],
        min: [0, 'Total amount cannot be negative']
      },
      currency: {
        type: String,
        default: 'AED',
        enum: ['AED', 'USD', 'INR', 'EUR', 'GBP']
      }
    },

    // Customer Information Snapshot
    customerInfo: {
      firstName: { type: String },
      lastName: { type: String },
      email: {
        type: String,
        validate: {
          validator: function(email: string) {
            if (!email) return true; // Allow empty
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          },
          message: 'Invalid email format'
        }
      },
      phone: {
        type: String,
        validate: {
          validator: function(phone: string) {
            if (!phone) return true; // Allow empty
            return /^\+?[\d\s\-\(\)]{7,}$/.test(phone);
          },
          message: 'Invalid phone format'
        }
      },
      specialRequests: String,
      accessInstructions: String
    },

    // Provider Response
    providerResponse: {
      acceptedAt: Date,
      rejectedAt: Date,
      rejectionReason: String,
      estimatedArrival: Date,
      arrivalTime: Date,
      completedAt: Date,
      notes: String
    },

    // Communication Messages
    messages: [{
      _id: {
        type: Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId()
      },
      from: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      message: {
        type: String,
        required: [true, 'Message content is required'],
        maxlength: [1000, 'Message cannot exceed 1000 characters']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      type: {
        type: String,
        enum: ['text', 'system', 'update'],
        default: 'text'
      },
      isRead: {
        type: Boolean,
        default: false
      }
    }],

    // Cancellation Policy
    cancellationPolicy: {
      allowedUntil: {
        type: Date,
        required: [true, 'Cancellation deadline is required']
      },
      refundPercentage: {
        type: Number,
        default: 100,
        min: [0, 'Refund percentage cannot be negative'],
        max: [100, 'Refund percentage cannot exceed 100']
      },
      cancellationFee: {
        type: Number,
        default: 0,
        min: [0, 'Cancellation fee cannot be negative']
      }
    },

    // Cancellation Details (optional)
    cancellationDetails: {
      cancelledBy: {
        type: String,
        enum: ['customer', 'provider', 'admin', 'system']
      },
      cancelledAt: Date,
      reason: String,
      refundAmount: {
        type: Number,
        min: [0, 'Refund amount cannot be negative']
      },
      refundStatus: {
        type: String,
        enum: ['pending', 'processed', 'failed'],
        default: 'pending'
      }
    },

    // Payment Information
    payment: {
      status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed'],
        default: 'pending'
      },
      method: String,
      transactionId: String,
      paidAt: Date,
      refundedAt: Date
    },

    // Metadata & Analytics
    metadata: {
      bookingSource: {
        type: String,
        enum: ['search', 'profile', 'recommendation', 'repeat'],
        default: 'search'
      },
      deviceType: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet'],
        default: 'desktop'
      },
      userAgent: String,
      sessionId: String
    },

    // Review References
    customerReview: {
      type: Schema.Types.ObjectId,
      ref: 'Review'
    },

    providerReview: {
      type: Schema.Types.ObjectId,
      ref: 'Review'
    },

    // Audit Fields
    completedAt: Date,
    cancelledAt: Date
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ===================================
// INDEXES FOR PERFORMANCE OPTIMIZATION
// ===================================

// Core booking queries
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ providerId: 1, scheduledDate: 1 });
bookingSchema.index({ serviceId: 1 });
bookingSchema.index({ bookingNumber: 1 }, { unique: true });
bookingSchema.index({ status: 1, scheduledDate: 1 });

// Location-based queries
bookingSchema.index({ 'location.address.coordinates': '2dsphere' });

// Time-based queries
bookingSchema.index({ scheduledDate: 1, status: 1 });
bookingSchema.index({ createdAt: -1 }); // For newest first
bookingSchema.index({ updatedAt: -1 }); // For recently updated

// Payment and completion tracking
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ completedAt: -1 }, { sparse: true });

// Provider dashboard queries
bookingSchema.index({ providerId: 1, status: 1, scheduledDate: 1 });

// Customer dashboard queries
bookingSchema.index({ customerId: 1, scheduledDate: -1 });

// Admin oversight queries
bookingSchema.index({ status: 1, createdAt: -1 });

// ===================================
// VIRTUAL PROPERTIES
// ===================================

// Populate customer information
bookingSchema.virtual('customer', {
  ref: 'User',
  localField: 'customerId',
  foreignField: '_id',
  justOne: true
});

// Populate provider information
bookingSchema.virtual('provider', {
  ref: 'User',
  localField: 'providerId',
  foreignField: '_id',
  justOne: true
});

// Populate service information
bookingSchema.virtual('service', {
  ref: 'Service',
  localField: 'serviceId',
  foreignField: '_id',
  justOne: true
});

// Calculate total duration including potential buffer
bookingSchema.virtual('totalDuration').get(function() {
  // Will be enhanced with service buffer time when service is populated
  return this.duration;
});

// Check if booking is currently active
bookingSchema.virtual('isActive').get(function() {
  return !['completed', 'cancelled', 'no_show'].includes(this.status);
});

// Check if booking can be cancelled
bookingSchema.virtual('canBeCancelled').get(function() {
  const now = new Date();
  return this.isActive && now < this.cancellationPolicy.allowedUntil;
});

// Calculate time until service
bookingSchema.virtual('timeUntilService').get(function() {
  const now = new Date();
  const serviceTime = new Date(this.scheduledDate);
  const diffMs = serviceTime.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
});

// ===================================
// INSTANCE METHODS
// ===================================

// Generate unique booking number with provider initials
bookingSchema.methods.generateBookingNumber = async function(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Get provider's business name initials or fallback to RZ
  let providerInitials = 'RZ'; // Default

  try {
    const User = mongoose.model('User');
    const provider = await User.findById(this.providerId).populate('providerProfile');

    if (provider?.providerProfile?.businessInfo?.businessName) {
      // Extract initials from business name
      const businessName = provider.providerProfile.businessInfo.businessName;
      const words = businessName.split(' ').filter((word: string) => word.length > 0);
      if (words.length >= 2) {
        providerInitials = words.slice(0, 2).map((word: string) => word.charAt(0).toUpperCase()).join('');
      } else if (words.length === 1) {
        providerInitials = words[0].substring(0, 2).toUpperCase();
      }
    }
  } catch (error) {
    console.log('Could not fetch provider initials, using default RZ');
  }

  // Generate unique sequential number for the day
  const startOfDay = new Date(year, date.getMonth(), date.getDate());
  const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);

  const todayBookingsCount = await mongoose.model('Booking').countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  const sequenceNumber = String(todayBookingsCount + 1).padStart(3, '0');

  return `${providerInitials}-${year}${month}${day}-${sequenceNumber}`;
};

// Update booking status with history tracking
bookingSchema.methods.updateStatus = async function(
  newStatus: string,
  updatedBy: string,
  reason?: string,
  notes?: string
): Promise<void> {
  // const oldStatus = this.status; // Could be used for logging or validation
  this.status = newStatus;

  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    reason,
    updatedBy,
    notes
  });

  // Update specific timestamps based on status
  switch (newStatus) {
    case 'confirmed':
      this.providerResponse.acceptedAt = new Date();
      break;
    case 'completed':
      this.providerResponse.completedAt = new Date();
      this.completedAt = new Date();
      break;
    case 'cancelled':
      this.cancelledAt = new Date();
      break;
  }

  await this.save();

  // Trigger notifications (to be implemented with notification service)
  await this.sendNotification(`booking_${newStatus}`, 'both');
};

// Add message to booking communication thread
bookingSchema.methods.addMessage = async function(
  from: mongoose.Types.ObjectId,
  message: string,
  type: string = 'text'
): Promise<void> {
  this.messages.push({
    _id: new mongoose.Types.ObjectId(),
    from,
    message,
    timestamp: new Date(),
    type,
    isRead: false
  });

  await this.save();
};

// Calculate refund amount based on cancellation timing
bookingSchema.methods.calculateRefund = function(): number {
  const now = new Date();
  const scheduledTime = new Date(this.scheduledDate);
  const hoursUntilService = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  let refundPercentage = this.cancellationPolicy.refundPercentage;

  // Reduce refund percentage based on how close to service time
  if (hoursUntilService < 2) {
    refundPercentage = 0; // No refund within 2 hours
  } else if (hoursUntilService < 24) {
    refundPercentage = Math.max(0, refundPercentage - 50); // 50% penalty within 24 hours
  }

  const refundAmount = (this.pricing.totalAmount * refundPercentage / 100) - this.cancellationPolicy.cancellationFee;
  return Math.max(0, refundAmount);
};

// Check if customer can cancel
bookingSchema.methods.canCustomerCancel = function(): boolean {
  return this.canBeCancelled && ['pending', 'confirmed'].includes(this.status);
};

// Check if provider can cancel
bookingSchema.methods.canProviderCancel = function(): boolean {
  return this.isActive && ['pending', 'confirmed', 'in_progress'].includes(this.status);
};

// Mark booking as completed
bookingSchema.methods.markAsCompleted = async function(): Promise<void> {
  await this.updateStatus('completed', 'system', 'Service completed');

  // Update service booking count (integrate with existing Service model)
  const Service = mongoose.model('Service');
  await Service.findByIdAndUpdate(
    this.serviceId,
    {
      $inc: { 'searchMetadata.bookingCount': 1 }
    }
  );

  // Integrate with loyalty system - award points to customer
  try {
    const User = mongoose.model('User');
    const pointsEarned = Math.floor(this.pricing.totalAmount * 0.01); // 1% of booking value as points

    await User.findByIdAndUpdate(
      this.customerId,
      {
        $inc: {
          'loyaltySystem.coins': pointsEarned,
          'loyaltySystem.totalEarned': pointsEarned
        },
        $push: {
          'loyaltySystem.pointsHistory': {
            type: 'earned',
            amount: pointsEarned,
            description: `Points earned from booking ${this.bookingNumber}`,
            date: new Date(),
            relatedBooking: this._id
          }
        }
      }
    );

    console.log(`Awarded ${pointsEarned} loyalty points to customer ${this.customerId} for booking ${this.bookingNumber}`);
  } catch (error) {
    console.error('Error awarding loyalty points:', error);
    // Don't fail the booking completion if loyalty points fail
  }
};

// Send notification (placeholder for notification service integration)
bookingSchema.methods.sendNotification = async function(
  type: string,
  recipient: 'customer' | 'provider' | 'both'
): Promise<void> {
  // This will be implemented when we create the notification service
  console.log(`Sending ${type} notification to ${recipient} for booking ${this.bookingNumber}`);
};

// ===================================
// PRE-SAVE MIDDLEWARE
// ===================================

// Generate booking number before first save
bookingSchema.pre('save', async function(next) {
  if (this.isNew && !this.bookingNumber) {
    try {
      this.bookingNumber = await this.generateBookingNumber();
    } catch (error) {
      return next(error as Error);
    }
  }

  // Initialize status history on creation
  if (this.isNew) {
    this.statusHistory = [{
      status: this.status,
      timestamp: new Date(),
      updatedBy: 'system',
      reason: 'Booking created'
    }];
  }

  next();
});

// Update estimated end time when duration or scheduled time changes
bookingSchema.pre('save', function(next) {
  if (this.isModified('scheduledDate') || this.isModified('scheduledTime') || this.isModified('duration')) {
    const [hours, minutes] = this.scheduledTime.split(':').map(Number);
    const serviceStart = new Date(this.scheduledDate);
    serviceStart.setHours(hours, minutes, 0, 0);

    this.estimatedEndTime = new Date(serviceStart.getTime() + (this.duration * 60 * 1000));
  }

  next();
});

// ===================================
// STATIC METHODS
// ===================================

// Find bookings by date range
bookingSchema.statics.findByDateRange = function(startDate: Date, endDate: Date, filters: any = {}) {
  return this.find({
    scheduledDate: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  }).populate('customer provider service');
};

// Find upcoming bookings for a provider
bookingSchema.statics.findUpcomingForProvider = function(providerId: string, limit: number = 10) {
  const now = new Date();
  return this.find({
    providerId,
    scheduledDate: { $gte: now },
    status: { $in: ['confirmed', 'in_progress'] }
  })
  .sort({ scheduledDate: 1 })
  .limit(limit)
  .populate('customer service');
};

// Find booking history for a customer
bookingSchema.statics.findHistoryForCustomer = function(customerId: string, limit: number = 20) {
  return this.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('provider service');
};

// Admin analytics queries
bookingSchema.statics.getAnalytics = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);
};

const Booking: Model<IBooking> = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;