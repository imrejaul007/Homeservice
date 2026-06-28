/**
 * ReportTemplate Model
 *
 * Custom report templates for admin analytics
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IReportTemplate extends Document {
  name: string;
  description: string;
  queryConfig: {
    dataSource: 'bookings' | 'customers' | 'providers' | 'revenue' | 'services' | 'reviews';
    metrics: string[];
    dimensions: string[];
    filters?: Record<string, unknown>;
    groupBy?: string[];
    orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    limit?: number;
  };
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    recipients: string[];
  };
  createdBy: mongoose.Types.ObjectId;
  isDefault: boolean;
  isActive: boolean;
  lastGeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportTemplateSchema = new Schema<IReportTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    queryConfig: {
      dataSource: {
        type: String,
        enum: ['bookings', 'customers', 'providers', 'revenue', 'services', 'reviews'],
        required: true,
      },
      metrics: [{
        type: String,
        required: true,
      }],
      dimensions: [{
        type: String,
        required: true,
      }],
      filters: {
        type: Schema.Types.Mixed,
      },
      groupBy: [{
        type: String,
      }],
      orderBy: [{
        field: { type: String, required: true },
        direction: { type: String, enum: ['asc', 'desc'], default: 'desc' },
      }],
      limit: {
        type: Number,
        min: 1,
        max: 1000,
        default: 100,
      },
    },
    schedule: {
      enabled: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly',
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
      time: {
        type: String,
        default: '09:00',
      },
      recipients: [{
        type: String,
        trim: true,
      }],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastGeneratedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
reportTemplateSchema.index({ createdBy: 1 });
reportTemplateSchema.index({ isDefault: 1, isActive: 1 });

const ReportTemplate = mongoose.model<IReportTemplate>('ReportTemplate', reportTemplateSchema);

export default ReportTemplate;
