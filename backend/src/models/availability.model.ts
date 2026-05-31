import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAvailability extends Document {
  _id: mongoose.Types.ObjectId;

  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  providerId: mongoose.Types.ObjectId;

  // Weekly Schedule
  weeklySchedule: {
    monday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
    tuesday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
    wednesday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
    thursday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
    friday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
    saturday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
    sunday: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
  };

  // Date Overrides
  dateOverrides: Array<{
    date: Date;
    isAvailable: boolean;
    timeSlots?: Array<{
      start: string;
      end: string;
      isActive: boolean;
    }>;
    reason?: string;
    notes?: string;
    createdAt: Date;
  }>;

  // Blocked Periods
  blockedPeriods: Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
    title: string;
    notes?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;

  // Settings
  timezone: string;
  bufferTime: {
    beforeBooking: number;
    afterBooking: number;
    minimumGap: number;
  };
  maxAdvanceBookingDays: number;
  autoAcceptBookings: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Create time slot sub-schema
const TimeSlotSchema = new Schema({
  start: { type: String, required: true },
  end: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { _id: false });

// Create day schedule sub-schema
const DayScheduleSchema = new Schema({
  isAvailable: { type: Boolean, default: false },
  timeSlots: [TimeSlotSchema]
}, { _id: false });

// Create date override sub-schema
const DateOverrideSchema = new Schema({
  date: { type: Date, required: true },
  isAvailable: { type: Boolean, required: true },
  timeSlots: [TimeSlotSchema],
  reason: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Create blocked period sub-schema
const BlockedPeriodSchema = new Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  title: { type: String, required: true },
  notes: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Main availability schema
const AvailabilitySchema = new Schema<IAvailability>({
  // Multi-tenant support
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  providerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  weeklySchedule: {
    monday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } },
    tuesday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } },
    wednesday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } },
    thursday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } },
    friday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } },
    saturday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } },
    sunday: { type: DayScheduleSchema, default: { isAvailable: false, timeSlots: [] } }
  },

  dateOverrides: [DateOverrideSchema],

  blockedPeriods: [BlockedPeriodSchema],

  timezone: {
    type: String,
    default: 'Asia/Dubai'
  },

  bufferTime: {
    beforeBooking: {
      type: Number,
      default: 15 // minutes
    },
    afterBooking: {
      type: Number,
      default: 15 // minutes
    },
    minimumGap: {
      type: Number,
      default: 30 // minutes
    }
  },

  maxAdvanceBookingDays: {
    type: Number,
    default: 30 // days
  },

  autoAcceptBookings: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'availabilities'
});

// Indexes for query optimization
AvailabilitySchema.index({ providerId: 1 }, { unique: true });

// Tenant isolation indexes
AvailabilitySchema.index({ tenantId: 1, providerId: 1 });

// FIX: Add index for date override queries (efficient lookup by date)
AvailabilitySchema.index({ 'dateOverrides.date': 1 });

// FIX: Add index for blocked period queries
AvailabilitySchema.index({ 'blockedPeriods.startDate': 1, 'blockedPeriods.endDate': 1 });

// FIX: Add TTL index for auto-cleanup of old blocked periods (after 1 year)
AvailabilitySchema.index({ 'blockedPeriods.createdAt': 1 }, { expireAfterSeconds: 31536000, partialFilterExpression: {} });

// Pre-save hook to clean up expired blocked periods
AvailabilitySchema.pre('save', function(next) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Filter out old blocked periods
  if (this.blockedPeriods && this.blockedPeriods.length > 0) {
    this.blockedPeriods = this.blockedPeriods.filter(
      (period: any) => period.createdAt > oneYearAgo
    );
  }

  next();
});

// Create and export the model
const Availability: Model<IAvailability> = mongoose.model<IAvailability>('Availability', AvailabilitySchema);

export default Availability;