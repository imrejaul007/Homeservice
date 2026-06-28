/**
 * Incident Model
 *
 * Platform incident tracking for admin dashboard
 * Updated to match frontend expectations (IncidentManagement.tsx)
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IIncident extends Document {
  // Frontend-compatible fields
  ticketNumber: string;
  type: 'complaint' | 'dispute' | 'technical' | 'billing' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  category: string;
  subject: string;
  description: string;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  providerId?: mongoose.Types.ObjectId;
  providerName?: string;
  bookingId?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: 'customer' | 'provider' | 'admin';
    message: string;
    timestamp: Date;
  }>;
  resolution?: string;
  tags: string[];
  slaDeadline?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  // Legacy support fields
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affectedSystems?: string[];
  timeline?: Array<{
    status: string;
    message: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
}

// Generate unique ticket number
function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${timestamp}-${random}`;
}

const incidentSchema = new Schema<IIncident>(
  {
    ticketNumber: {
      type: String,
      default: generateTicketNumber,
      unique: true,
    },
    type: {
      type: String,
      enum: ['complaint', 'dispute', 'technical', 'billing', 'safety'],
      required: true,
      default: 'complaint',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'],
      required: true,
      default: 'open',
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    customerName: {
      type: String,
      trim: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    providerName: {
      type: String,
      trim: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resolvedAt: {
      type: Date,
    },
    messages: [{
      id: {
        type: String,
        required: true,
      },
      senderId: {
        type: String,
        required: true,
      },
      senderName: {
        type: String,
        required: true,
      },
      senderRole: {
        type: String,
        enum: ['customer', 'provider', 'admin'],
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
    resolution: {
      type: String,
      trim: true,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    slaDeadline: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Legacy fields for backward compatibility
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    affectedSystems: [{
      type: String,
      trim: true,
    }],
    timeline: [{
      status: {
        type: String,
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
incidentSchema.index({ status: 1, priority: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ ticketNumber: 1 });

const Incident = mongoose.model<IIncident>('Incident', incidentSchema);

export default Incident;
