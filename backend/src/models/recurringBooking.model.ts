import mongoose, { Schema, Document } from 'mongoose';

// Recurring booking subscription status
export type RecurringBookingStatus = 'active' | 'paused' | 'cancelled';

// Recurring frequency options
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

// Document interface
export interface IRecurringBooking extends Document {
  customerId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  frequency: RecurringFrequency;
  interval: number;
  startDate: Date;
  nextRun: Date;
  endDate?: Date;
  status: RecurringBookingStatus;
  price: number;
  discount: number;
  preferredTime: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  paymentMethodId?: string;
  notes?: string;
  lastBookingId?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const recurringBookingSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'],
      default: 'monthly',
    },
    interval: {
      type: Number,
      default: 1,
      min: 1,
    },
    startDate: {
      type: Date,
      required: true,
    },
    nextRun: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled'],
      default: 'active',
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    preferredTime: {
      type: String,
      default: '09:00',
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    paymentMethodId: {
      type: String,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    lastBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
recurringBookingSchema.index({ customerId: 1, status: 1 });
recurringBookingSchema.index({ providerId: 1, status: 1 });
recurringBookingSchema.index({ customerId: 1, serviceId: 1 });

// Index for finding subscriptions due for next booking
recurringBookingSchema.index({ status: 1, nextRun: 1 });

const RecurringBooking = mongoose.model<IRecurringBooking>('RecurringBooking', recurringBookingSchema);

export default RecurringBooking;
