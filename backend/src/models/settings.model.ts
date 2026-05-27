import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPlatformSettings extends Document {
  // General Settings
  platformName: string;
  platformLogo: string;
  platformLogoPublicId?: string; // For Cloudinary
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceEstimatedDuration?: string;
  maintenanceUpdatedAt?: Date;
  maintenanceUpdatedBy?: mongoose.Types.ObjectId;

  // Fee & Commission
  commissionRate: number;
  paymentProcessingFee: number;
  minimumWithdrawalAmount: number;
  platformFeeType: 'percentage' | 'fixed' | 'both';

  // Booking Settings
  defaultBookingBufferMinutes: number;
  cancellationWindowHours: number;
  autoAssignmentEnabled: boolean;
  maxBookingAdvanceDays: number;
  minBookingAdvanceHours: number;

  // Notification Settings
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;

  // Email Configuration
  emailConfig: {
    provider: 'smtp' | 'ses' | 'sendgrid' | 'resend';
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string; // Encrypted
    };
    ses?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };
    sendgrid?: {
      apiKey: string;
    };
    resend?: {
      apiKey: string;
    };
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };

  // SMS Configuration
  smsConfig: {
    provider: 'twilio' | 'vonage' | 'nexmo' | 'msg91';
    twilio?: {
      accountSid: string;
      authToken: string; // Encrypted
      fromNumber: string;
    };
    vonage?: {
      apiKey: string;
      apiSecret: string;
      fromNumber: string;
    };
    msg91?: {
      authKey: string;
      templateId: string;
      senderId: string;
    };
    enabled: boolean;
  };

  // Email Templates
  emailTemplates: {
    bookingConfirmation: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    bookingReminder: {
      subject: string;
      body: string;
      enabled: boolean;
      hoursBefore: number;
    };
    bookingCancellation: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    bookingCompletion: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    providerApproval: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    providerRejection: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    passwordReset: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    emailVerification: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    welcomeEmail: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    paymentReceipt: {
      subject: string;
      body: string;
      enabled: boolean;
    };
    providerApplication: {
      subject: string;
      body: string;
      enabled: boolean;
    };
  };

  // Security Settings
  require2FA: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumber: boolean;
  passwordRequireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;

  // System Settings
  cacheTTLSeconds: number;
  rateLimitRequestsPerMinute: number;
  apiRateLimitPerHour: number;
  maxFileUploadSizeMB: number;
  allowedFileTypes: string[];

  // Meta
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
  history: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    reason?: string;
  }>;
}

export interface IPlatformSettingsModel extends Model<IPlatformSettings> {
  getSettings(): Promise<IPlatformSettings>;
}

const SettingsSchema = new Schema<IPlatformSettings>(
  {
    // General Settings
    platformName: {
      type: String,
      default: 'Homeservice',
      trim: true,
      maxlength: [100, 'Platform name cannot exceed 100 characters']
    },
    platformLogo: {
      type: String,
      default: '',
    },
    platformLogoPublicId: {
      type: String,
      default: '',
    },
    supportEmail: {
      type: String,
      default: 'support@homeservice.com',
    },
    supportPhone: {
      type: String,
      default: '',
      trim: true
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    maintenanceMessage: {
      type: String,
      default: 'The platform is currently under maintenance. Please try again later.',
      maxlength: [500, 'Maintenance message cannot exceed 500 characters']
    },
    maintenanceEstimatedDuration: {
      type: String,
      default: '',
    },

    // Fee & Commission
    commissionRate: {
      type: Number,
      default: 15,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%']
    },
    paymentProcessingFee: {
      type: Number,
      default: 2.9,
      min: [0, 'Processing fee cannot be negative'],
      max: [100, 'Processing fee cannot exceed 100%']
    },
    minimumWithdrawalAmount: {
      type: Number,
      default: 50,
      min: [0, 'Minimum withdrawal cannot be negative']
    },
    platformFeeType: {
      type: String,
      enum: ['percentage', 'fixed', 'both'],
      default: 'percentage'
    },

    // Booking Settings
    defaultBookingBufferMinutes: {
      type: Number,
      default: 30,
      min: [0, 'Buffer time cannot be negative']
    },
    cancellationWindowHours: {
      type: Number,
      default: 24,
      min: [0, 'Cancellation window cannot be negative']
    },
    autoAssignmentEnabled: {
      type: Boolean,
      default: false
    },
    maxBookingAdvanceDays: {
      type: Number,
      default: 30,
      min: [1, 'Must be at least 1 day']
    },
    minBookingAdvanceHours: {
      type: Number,
      default: 2,
      min: [0, 'Must be at least 0 hours']
    },

    // Notification Settings
    emailNotificationsEnabled: {
      type: Boolean,
      default: true
    },
    smsNotificationsEnabled: {
      type: Boolean,
      default: true
    },
    pushNotificationsEnabled: {
      type: Boolean,
      default: true
    },

    // Email Configuration
    emailConfig: {
      type: {
        provider: {
          type: String,
          enum: ['smtp', 'ses', 'sendgrid', 'resend'],
          default: 'resend'
        },
        smtp: {
          host: String,
          port: Number,
          secure: Boolean,
          user: String,
          pass: String,
        },
        ses: {
          accessKeyId: String,
          secretAccessKey: String,
          region: String,
        },
        sendgrid: {
          apiKey: String,
        },
        resend: {
          apiKey: String,
        },
        fromEmail: String,
        fromName: String,
        replyToEmail: String,
      },
      default: () => ({
        provider: 'resend',
        fromEmail: 'noreply@homeservice.com',
        fromName: 'Homeservice',
        replyToEmail: 'support@homeservice.com'
      })
    },

    // SMS Configuration
    smsConfig: {
      type: {
        provider: {
          type: String,
          enum: ['twilio', 'vonage', 'nexmo', 'msg91'],
          default: 'twilio'
        },
        twilio: {
          accountSid: String,
          authToken: String,
          fromNumber: String,
        },
        vonage: {
          apiKey: String,
          apiSecret: String,
          fromNumber: String,
        },
        msg91: {
          authKey: String,
          templateId: String,
          senderId: String,
        },
        enabled: {
          type: Boolean,
          default: false
        }
      },
      default: () => ({
        provider: 'twilio',
        enabled: false
      })
    },

    // Email Templates
    emailTemplates: {
      type: {
        bookingConfirmation: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        bookingReminder: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true },
          hoursBefore: { type: Number, default: 24 }
        },
        bookingCancellation: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        bookingCompletion: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        providerApproval: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        providerRejection: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        passwordReset: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        emailVerification: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
        welcomeEmail: {
          subject: String,
          body: String,
          enabled: { type: Boolean, default: true }
        },
      },
      default: () => ({
        bookingConfirmation: {
          subject: 'Booking Confirmed - {{bookingId}}',
          body: 'Dear {{customerName}},\n\nYour booking #{{bookingId}} has been confirmed.\n\nService: {{serviceName}}\nProvider: {{providerName}}\nDate: {{bookingDate}}\nTime: {{bookingTime}}\n\nThank you for choosing Homeservice!',
          enabled: true
        },
        bookingReminder: {
          subject: 'Reminder: Booking Tomorrow',
          body: 'Dear {{customerName}},\n\nThis is a reminder that your booking #{{bookingId}} is scheduled for tomorrow.\n\nService: {{serviceName}}\nTime: {{bookingTime}}\n\nSee you soon!',
          enabled: true,
          hoursBefore: 24
        },
        bookingCancellation: {
          subject: 'Booking Cancelled - {{bookingId}}',
          body: 'Dear {{customerName}},\n\nYour booking #{{bookingId}} has been cancelled.\n\nIf you have any questions, please contact our support team.',
          enabled: true
        },
        bookingCompletion: {
          subject: 'Service Completed - {{bookingId}}',
          body: 'Dear {{customerName}},\n\nYour service has been completed. We hope you enjoyed the experience!\n\nPlease take a moment to rate your provider.',
          enabled: true
        },
        providerApproval: {
          subject: 'Congratulations! Your provider account is approved',
          body: 'Dear {{providerName}},\n\nYour provider application has been approved! You can now start accepting bookings.\n\nWelcome to Homeservice!',
          enabled: true
        },
        providerRejection: {
          subject: 'Provider Application Update',
          body: 'Dear {{providerName}},\n\nAfter review, we are unable to approve your provider application at this time.\n\nPlease contact support for more information.',
          enabled: true
        },
        passwordReset: {
          subject: 'Password Reset Request',
          body: 'Dear {{userName}},\n\nClick the link below to reset your password:\n\n{{resetLink}}\n\nThis link expires in 1 hour.\n\nIf you did not request this, please ignore this email.',
          enabled: true
        },
        emailVerification: {
          subject: 'Verify Your Email',
          body: 'Dear {{userName}},\n\nClick the link below to verify your email:\n\n{{verificationLink}}\n\nThis link expires in 24 hours.',
          enabled: true
        },
        welcomeEmail: {
          subject: 'Welcome to Homeservice!',
          body: 'Dear {{userName}},\n\nWelcome to Homeservice! We\'re excited to have you join our community.\n\nGet started by exploring our services and booking your first appointment.',
          enabled: true
        },
        paymentReceipt: {
          subject: 'Payment Receipt - {{transactionId}}',
          body: 'Dear {{userName}},\n\nYour payment has been processed successfully.\n\nTransaction ID: {{transactionId}}\nAmount: {{amount}}\nPayment Method: {{paymentMethod}}\nBooking ID: {{bookingId}}\nDate: {{date}}\n\nThank you for choosing Homeservice!',
          enabled: true
        },
        providerApplication: {
          subject: 'Provider Application Update',
          body: 'Dear {{providerName}},\n\nYour provider application status has been updated.\n\nStatus: {{status}}\nComments: {{comments}}\nNext Steps: {{nextSteps}}\n\nThank you for your interest in joining Homeservice!',
          enabled: true
        }
      })
    },

    // Security Settings
    require2FA: {
      type: Boolean,
      default: false
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 480,
      min: [15, 'Session timeout must be at least 15 minutes'],
      max: [1440, 'Session timeout cannot exceed 24 hours']
    },
    passwordMinLength: {
      type: Number,
      default: 8,
      min: [6, 'Password must be at least 6 characters'],
      max: [128, 'Password length cannot exceed 128 characters']
    },
    passwordRequireSpecialChar: {
      type: Boolean,
      default: true
    },
    passwordRequireNumber: {
      type: Boolean,
      default: true
    },
    passwordRequireUppercase: {
      type: Boolean,
      default: true
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
      min: [3, 'Must be at least 3 attempts']
    },
    lockoutDurationMinutes: {
      type: Number,
      default: 30,
      min: [5, 'Must be at least 5 minutes']
    },

    // System Settings
    cacheTTLSeconds: {
      type: Number,
      default: 300,
      min: [60, 'Cache TTL must be at least 60 seconds'],
      max: [86400, 'Cache TTL cannot exceed 24 hours']
    },
    rateLimitRequestsPerMinute: {
      type: Number,
      default: 100,
      min: [10, 'Rate limit must be at least 10'],
      max: [10000, 'Rate limit cannot exceed 10000']
    },
    apiRateLimitPerHour: {
      type: Number,
      default: 1000,
      min: [100, 'API rate limit must be at least 100'],
      max: [100000, 'API rate limit cannot exceed 100000']
    },
    maxFileUploadSizeMB: {
      type: Number,
      default: 10,
      min: [1, 'Must be at least 1 MB'],
      max: [100, 'Cannot exceed 100 MB']
    },
    allowedFileTypes: {
      type: [String],
      default: () => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    },

    // Meta
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      select: false
    },
    history: [{
      field: String,
      oldValue: Schema.Types.Mixed,
      newValue: Schema.Types.Mixed,
      changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      changedAt: { type: Date, default: Date.now },
      reason: String
    }]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(_doc, ret) {
        delete (ret as any).__v;
        // Mask sensitive data
        if (ret.emailConfig?.smtp?.pass) {
          ret.emailConfig.smtp.pass = '***MASKED***';
        }
        if (ret.emailConfig?.ses?.secretAccessKey) {
          ret.emailConfig.ses.secretAccessKey = '***MASKED***';
        }
        if (ret.smsConfig?.twilio?.authToken) {
          ret.smsConfig.twilio.authToken = '***MASKED***';
        }
        return ret;
      }
    }
  }
);

// Singleton pattern - ensure only one settings document exists
SettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Index for efficient queries
SettingsSchema.index({ maintenanceMode: 1 });

const PlatformSettings = mongoose.model<IPlatformSettings, IPlatformSettingsModel>('PlatformSettings', SettingsSchema);

export default PlatformSettings;
