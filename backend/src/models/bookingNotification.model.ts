import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBookingNotification extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId; // Reference to Booking
  recipientId: mongoose.Types.ObjectId; // User ID (customer, provider, or admin)

  // Notification Classification
  type: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'booking_reminder' |
        'booking_completed' | 'booking_rejected' | 'booking_updated' | 'payment_received' |
        'review_request' | 'provider_arrived' | 'service_started' | 'message_received' |
        'schedule_changed' | 'cancellation_request';

  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'booking' | 'payment' | 'communication' | 'reminder' | 'update';

  // Notification Content
  title: string;
  message: string;
  actionText?: string; // e.g., "View Booking", "Accept Request"
  actionUrl?: string;  // Deep link or web URL

  // Rich Content Support
  metadata: {
    bookingNumber?: string;
    serviceName?: string;
    providerName?: string;
    customerName?: string;
    scheduledDate?: Date;
    totalAmount?: number;
    currency?: string;
    customData?: any; // Additional context data
  };

  // Multi-Channel Delivery
  channels: {
    email: {
      enabled: boolean;
      sent: boolean;
      sentAt?: Date;
      templateId?: string;
      templateData?: any;
      errorMessage?: string;
      clickCount?: number;
      openCount?: number;
    };
    sms: {
      enabled: boolean;
      sent: boolean;
      sentAt?: Date;
      phoneNumber?: string;
      messageId?: string;
      errorMessage?: string;
      deliveryStatus?: 'pending' | 'delivered' | 'failed' | 'undelivered';
    };
    push: {
      enabled: boolean;
      sent: boolean;
      sentAt?: Date;
      deviceTokens?: string[];
      notificationId?: string;
      errorMessage?: string;
      clickCount?: number;
    };
    inApp: {
      enabled: boolean;
      sent: boolean;
      sentAt?: Date;
      read: boolean;
      readAt?: Date;
      dismissed: boolean;
      dismissedAt?: Date;
    };
  };

  // Scheduling and Delivery Management
  scheduled: boolean;
  scheduledFor?: Date;
  deliveredAt?: Date;

  // Retry Logic for Failed Deliveries
  retryAttempts: number;
  maxRetryAttempts: number;
  nextRetryAt?: Date;
  lastRetryAt?: Date;

  // User Interaction Tracking
  interactions: Array<{
    type: 'opened' | 'clicked' | 'dismissed' | 'replied';
    timestamp: Date;
    channel: 'email' | 'sms' | 'push' | 'in_app';
    metadata?: any;
  }>;

  // Delivery Status and Analytics
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  failureReason?: string;

  // User Preferences Integration
  respectsUserPreferences: boolean;
  bypassPreferences: boolean; // For critical notifications

  // Audit and Compliance
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  expiresAt?: Date; // For temporary notifications

  // Virtual Properties
  booking?: any; // Will be populated from Booking
  recipient?: any; // Will be populated from User
  isDelivered: boolean;
  hasBeenRead: boolean;
  deliveryChannels: string[];
  effectiveDeliveryTime: Date | null;

  // Instance Methods
  markAsSent(channel: string): Promise<void>;
  markAsDelivered(channel: string): Promise<void>;
  markAsRead(): Promise<void>;
  markAsFailed(channel: string, error: string): Promise<void>;
  scheduleRetry(): Promise<void>;
  addInteraction(type: string, channel: string, metadata?: any): Promise<void>;
  shouldSendToChannel(channel: string): boolean;
  getEffectiveContent(): { title: string; message: string };
  canBeRetried(): boolean;
}

const notificationSchema = new Schema<IBookingNotification>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true
    },

    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true
    },

    // Notification Classification
    type: {
      type: String,
      enum: [
        'booking_request', 'booking_confirmed', 'booking_cancelled', 'booking_reminder',
        'booking_completed', 'booking_rejected', 'booking_updated', 'payment_received',
        'review_request', 'provider_arrived', 'service_started', 'message_received',
        'schedule_changed', 'cancellation_request'
      ],
      required: [true, 'Notification type is required'],
      index: true
    },

    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true
    },

    category: {
      type: String,
      enum: ['booking', 'payment', 'communication', 'reminder', 'update'],
      default: 'booking',
      index: true
    },

    // Content
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },

    message: {
      type: String,
      required: [true, 'Notification message is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },

    actionText: {
      type: String,
      maxlength: [50, 'Action text cannot exceed 50 characters']
    },

    actionUrl: {
      type: String,
      validate: {
        validator: function(url: string) {
          if (!url) return true; // Optional field
          return /^(https?:\/\/|\/|#)/.test(url);
        },
        message: 'Invalid URL format'
      }
    },

    // Rich Metadata
    metadata: {
      bookingNumber: String,
      serviceName: String,
      providerName: String,
      customerName: String,
      scheduledDate: Date,
      totalAmount: Number,
      currency: {
        type: String,
        enum: ['USD', 'INR', 'EUR', 'GBP', 'AED'],
        default: 'AED'
      },
      customData: Schema.Types.Mixed
    },

    // Multi-Channel Configuration
    channels: {
      email: {
        enabled: { type: Boolean, default: true },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        templateId: String,
        templateData: Schema.Types.Mixed,
        errorMessage: String,
        clickCount: { type: Number, default: 0 },
        openCount: { type: Number, default: 0 }
      },
      sms: {
        enabled: { type: Boolean, default: true },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        phoneNumber: String,
        messageId: String,
        errorMessage: String,
        deliveryStatus: {
          type: String,
          enum: ['pending', 'delivered', 'failed', 'undelivered'],
          default: 'pending'
        }
      },
      push: {
        enabled: { type: Boolean, default: true },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        deviceTokens: [String],
        notificationId: String,
        errorMessage: String,
        clickCount: { type: Number, default: 0 }
      },
      inApp: {
        enabled: { type: Boolean, default: true },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        read: { type: Boolean, default: false },
        readAt: Date,
        dismissed: { type: Boolean, default: false },
        dismissedAt: Date
      }
    },

    // Scheduling
    scheduled: {
      type: Boolean,
      default: false,
      index: true
    },

    scheduledFor: {
      type: Date,
      index: true
    },

    deliveredAt: Date,

    // Retry Management
    retryAttempts: {
      type: Number,
      default: 0,
      min: [0, 'Retry attempts cannot be negative']
    },

    maxRetryAttempts: {
      type: Number,
      default: 3,
      min: [0, 'Max retry attempts cannot be negative'],
      max: [10, 'Max retry attempts cannot exceed 10']
    },

    nextRetryAt: {
      type: Date,
      index: true
    },

    lastRetryAt: Date,

    // User Interactions
    interactions: [{
      type: {
        type: String,
        enum: ['opened', 'clicked', 'dismissed', 'replied'],
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now,
        required: true
      },
      channel: {
        type: String,
        enum: ['email', 'sms', 'push', 'in_app'],
        required: true
      },
      metadata: Schema.Types.Mixed
    }],

    // Status Management
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled'],
      default: 'pending',
      required: [true, 'Status is required'],
      index: true
    },

    failureReason: String,

    // User Preferences
    respectsUserPreferences: {
      type: Boolean,
      default: true
    },

    bypassPreferences: {
      type: Boolean,
      default: false
    },

    // Audit Fields
    processedAt: Date,
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 } // TTL index for automatic cleanup
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ===================================
// INDEXES FOR PERFORMANCE
// ===================================

// Core notification queries
notificationSchema.index({ recipientId: 1, status: 1 });
notificationSchema.index({ bookingId: 1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ priority: 1, status: 1 });

// Scheduling and delivery
notificationSchema.index({ scheduled: 1, scheduledFor: 1 });
notificationSchema.index({ status: 1, nextRetryAt: 1 });
notificationSchema.index({ createdAt: -1 });

// Analytics and reporting
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ 'channels.email.sent': 1 });
notificationSchema.index({ 'channels.sms.deliveryStatus': 1 });

// Cleanup and maintenance
notificationSchema.index({ expiresAt: 1 });

// Composite indexes for complex queries
notificationSchema.index({ recipientId: 1, type: 1, status: 1 });
notificationSchema.index({ bookingId: 1, type: 1 });

// ===================================
// VIRTUAL PROPERTIES
// ===================================

// Populate booking information
notificationSchema.virtual('booking', {
  ref: 'Booking',
  localField: 'bookingId',
  foreignField: '_id',
  justOne: true
});

// Populate recipient information
notificationSchema.virtual('recipient', {
  ref: 'User',
  localField: 'recipientId',
  foreignField: '_id',
  justOne: true
});

// Check if notification has been delivered to any channel
notificationSchema.virtual('isDelivered').get(function() {
  return this.channels.email.sent ||
         this.channels.sms.sent ||
         this.channels.push.sent ||
         this.channels.inApp.sent;
});

// Check if notification has been read
notificationSchema.virtual('hasBeenRead').get(function() {
  return this.channels.inApp.read ||
         (this.channels.email?.openCount || 0) > 0 ||
         (this.channels.push?.clickCount || 0) > 0;
});

// Get active delivery channels
notificationSchema.virtual('deliveryChannels').get(function() {
  const channels: string[] = [];
  if (this.channels.email.enabled) channels.push('email');
  if (this.channels.sms.enabled) channels.push('sms');
  if (this.channels.push.enabled) channels.push('push');
  if (this.channels.inApp.enabled) channels.push('inApp');
  return channels;
});

// Get effective delivery time (first successful delivery)
notificationSchema.virtual('effectiveDeliveryTime').get(function() {
  const deliveryTimes = [
    this.channels.email.sentAt,
    this.channels.sms.sentAt,
    this.channels.push.sentAt,
    this.channels.inApp.sentAt
  ].filter(Boolean);

  return deliveryTimes.length > 0 ? new Date(Math.min(...deliveryTimes.map(d => d?.getTime() || Date.now()))) : null;
});

// ===================================
// INSTANCE METHODS
// ===================================

// Mark specific channel as sent
notificationSchema.methods.markAsSent = async function(channel: string): Promise<void> {
  if (this.channels[channel]) {
    this.channels[channel].sent = true;
    this.channels[channel].sentAt = new Date();

    // Update overall status if this is the first successful send
    if (this.status === 'pending' || this.status === 'processing') {
      this.status = 'sent';
    }

    await this.save();
  }
};

// Mark specific channel as delivered
notificationSchema.methods.markAsDelivered = async function(channel: string): Promise<void> {
  if (this.channels[channel]) {
    this.channels[channel].sent = true;
    if (channel === 'sms') {
      this.channels[channel].deliveryStatus = 'delivered';
    }

    this.status = 'delivered';
    this.deliveredAt = new Date();

    await this.save();
  }
};

// Mark in-app notification as read
notificationSchema.methods.markAsRead = async function(): Promise<void> {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = new Date();

  await this.addInteraction('opened', 'in_app');
  await this.save();
};

// Mark channel as failed
notificationSchema.methods.markAsFailed = async function(channel: string, error: string): Promise<void> {
  if (this.channels[channel]) {
    this.channels[channel].errorMessage = error;
    if (channel === 'sms') {
      this.channels[channel].deliveryStatus = 'failed';
    }
  }

  // Check if all enabled channels have failed
  const enabledChannels = this.deliveryChannels;
  const failedChannels = enabledChannels.filter((ch: any) =>
    this.channels[ch].errorMessage ||
    (ch === 'sms' && this.channels[ch].deliveryStatus === 'failed')
  );

  if (failedChannels.length === enabledChannels.length) {
    this.status = 'failed';
    this.failureReason = `All channels failed: ${error}`;
  }

  await this.save();
};

// Schedule retry attempt
notificationSchema.methods.scheduleRetry = async function(): Promise<void> {
  if (this.canBeRetried()) {
    this.retryAttempts += 1;
    this.lastRetryAt = new Date();

    // Exponential backoff: 5min, 15min, 30min, 1hr
    const backoffMinutes = Math.min(5 * Math.pow(2, this.retryAttempts - 1), 60);
    this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    this.status = 'pending';

    await this.save();
  }
};

// Add user interaction
notificationSchema.methods.addInteraction = async function(
  type: string,
  channel: string,
  metadata?: any
): Promise<void> {
  this.interactions.push({
    type,
    timestamp: new Date(),
    channel,
    metadata
  });

  // Update channel-specific counters
  if (type === 'clicked' && this.channels[channel]) {
    if (channel === 'email' || channel === 'push') {
      this.channels[channel].clickCount = (this.channels[channel].clickCount || 0) + 1;
    }
  }

  if (type === 'opened' && channel === 'email') {
    this.channels.email.openCount = (this.channels.email.openCount || 0) + 1;
  }

  await this.save();
};

// Check if should send to specific channel based on user preferences
notificationSchema.methods.shouldSendToChannel = function(channel: string): boolean {
  // Always send if bypassing preferences
  if (this.bypassPreferences) {
    return this.channels[channel]?.enabled || false;
  }

  // Check user's communication preferences (integrate with existing User model)
  // This would be populated when the notification is created
  return this.channels[channel]?.enabled || false;
};

// Get effective content with personalization
notificationSchema.methods.getEffectiveContent = function(): { title: string; message: string } {
  let title = this.title;
  let message = this.message;

  // Replace placeholders with metadata
  const replacements = {
    '{{bookingNumber}}': this.metadata.bookingNumber || '',
    '{{serviceName}}': this.metadata.serviceName || '',
    '{{providerName}}': this.metadata.providerName || '',
    '{{customerName}}': this.metadata.customerName || '',
    '{{amount}}': this.metadata.totalAmount ?
      `${this.metadata.currency || 'AED'} ${this.metadata.totalAmount}` : '',
    '{{scheduledDate}}': this.metadata.scheduledDate ?
      this.metadata.scheduledDate.toLocaleDateString() : ''
  };

  Object.entries(replacements).forEach(([placeholder, value]) => {
    title = title.replace(new RegExp(placeholder, 'g'), value);
    message = message.replace(new RegExp(placeholder, 'g'), value);
  });

  return { title, message };
};

// Check if notification can be retried
notificationSchema.methods.canBeRetried = function(): boolean {
  return this.retryAttempts < this.maxRetryAttempts &&
         this.status === 'failed' &&
         (!this.expiresAt || this.expiresAt > new Date());
};

// ===================================
// PRE-SAVE MIDDLEWARE
// ===================================

// Set expiration for temporary notifications
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set default expiration based on notification type
    const expirationDays = this.type.includes('reminder') ? 1 : 30;
    this.expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
  }

  next();
});

// Auto-schedule immediate notifications
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.scheduled && !this.scheduledFor) {
    // Schedule for immediate delivery
    this.scheduledFor = new Date();
    this.scheduled = true;
  }

  next();
});

// ===================================
// STATIC METHODS
// ===================================

// Find pending notifications ready for delivery
notificationSchema.statics.findReadyForDelivery = function(limit: number = 100) {
  const now = new Date();
  return this.find({
    status: 'pending',
    scheduled: true,
    scheduledFor: { $lte: now },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: now } }
    ]
  })
  .sort({ priority: -1, scheduledFor: 1 })
  .limit(limit);
};

// Find failed notifications ready for retry
notificationSchema.statics.findReadyForRetry = function(limit: number = 50) {
  const now = new Date();
  return this.find({
    status: 'failed',
    retryAttempts: { $lt: '$maxRetryAttempts' },
    nextRetryAt: { $lte: now },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: now } }
    ]
  })
  .sort({ nextRetryAt: 1 })
  .limit(limit);
};

// Get notification analytics
notificationSchema.statics.getAnalytics = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          status: '$status'
        },
        count: { $sum: 1 },
        avgDeliveryTime: {
          $avg: {
            $subtract: ['$deliveredAt', '$createdAt']
          }
        }
      }
    }
  ]);
};

// Cleanup expired notifications
notificationSchema.statics.cleanupExpired = function() {
  const now = new Date();
  return this.deleteMany({
    expiresAt: { $lt: now }
  });
};

const BookingNotification: Model<IBookingNotification> = mongoose.model<IBookingNotification>('BookingNotification', notificationSchema);

export default BookingNotification;