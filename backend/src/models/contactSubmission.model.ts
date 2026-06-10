import mongoose, { Document, Schema, Model } from 'mongoose';

export type ContactSubject =
  | 'booking'
  | 'payment'
  | 'refund'
  | 'provider'
  | 'suggestion'
  | 'other';

export type ContactDepartment = 'client_support' | 'provider_support' | 'general';
export type ContactSubmissionStatus = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'spam';

export interface IContactSubmission extends Document {
  submissionId: string;
  name: string;
  email: string;
  subject: string;
  subjectCategory: ContactSubject;
  message: string;
  department: ContactDepartment;
  routedTeam: string;
  routedEmail: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: ContactSubmissionStatus;
  userId?: mongoose.Types.ObjectId;
  ticketId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  spamScore: number;
  isSpam: boolean;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactSubmissionModel extends Model<IContactSubmission> {
  generateSubmissionId(): Promise<string>;
}

const ContactSubmissionSchema = new Schema<IContactSubmission>(
  {
    submissionId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    subjectCategory: {
      type: String,
      enum: ['booking', 'payment', 'refund', 'provider', 'suggestion', 'other'],
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    department: {
      type: String,
      enum: ['client_support', 'provider_support', 'general'],
      required: true,
      index: true,
    },
    routedTeam: { type: String, required: true },
    routedEmail: { type: String, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'assigned', 'in_progress', 'resolved', 'closed', 'spam'],
      default: 'new',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String, maxlength: 500 },
    source: {
      type: String,
      default: 'contact_page',
      index: true,
    },
    spamScore: { type: Number, default: 0 },
    isSpam: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

ContactSubmissionSchema.index({ email: 1, createdAt: -1 });
ContactSubmissionSchema.index({ status: 1, priority: -1, createdAt: -1 });
ContactSubmissionSchema.index({ department: 1, status: 1 });
ContactSubmissionSchema.index({ createdAt: -1 });

ContactSubmissionSchema.statics.generateSubmissionId = async function (): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CS-${dateStr}`;

  const last = await this.findOne({ submissionId: new RegExp(`^${prefix}`) })
    .sort({ submissionId: -1 })
    .select('submissionId')
    .lean();

  let sequence = 1;
  if (last?.submissionId) {
    const lastSeq = parseInt(last.submissionId.split('-').pop() || '0', 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
};

const ContactSubmission = mongoose.model<IContactSubmission, IContactSubmissionModel>(
  'ContactSubmission',
  ContactSubmissionSchema
);

export default ContactSubmission;
