import mongoose, { Document, Schema, Model } from 'mongoose';

export type CallbackStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_answer';

export type CallbackCategory =
  | 'general'
  | 'technical'
  | 'billing'
  | 'booking'
  | 'complaint';

export interface ICallbackRequest extends Document {
  requestId: string;
  userId: mongoose.Types.ObjectId;
  userName?: string;
  userEmail?: string;
  phoneNumber: string;
  preferredTime: Date;
  alternateTime?: Date;
  reason: string;
  category: CallbackCategory;
  status: CallbackStatus;
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAgentName?: string;
  scheduledAt?: Date;
  completedAt?: Date;
  notes?: string;
  tenantId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICallbackRequestModel extends Model<ICallbackRequest> {
  generateRequestId(): Promise<string>;
}

const CallbackRequestSchema = new Schema<ICallbackRequest>(
  {
    requestId: { type: String, unique: true, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String },
    userEmail: { type: String },
    phoneNumber: { type: String, required: true },
    preferredTime: { type: Date, required: true },
    alternateTime: { type: Date },
    reason: { type: String, required: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ['general', 'technical', 'billing', 'booking', 'complaint'],
      default: 'general',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_answer'],
      default: 'pending',
      index: true,
    },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAgentName: { type: String },
    scheduledAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String, maxlength: 2000 },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
  },
  { timestamps: true }
);

CallbackRequestSchema.index({ userId: 1, createdAt: -1 });
CallbackRequestSchema.index({ status: 1, preferredTime: 1 });

CallbackRequestSchema.statics.generateRequestId = async function (): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CB-${date}`;
  const last = await this.findOne({ requestId: new RegExp(`^${prefix}`) })
    .sort({ requestId: -1 })
    .select('requestId')
    .lean();
  let seq = 1;
  if (last?.requestId) {
    seq = parseInt(last.requestId.split('-').pop() || '0', 10) + 1;
  }
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
};

const CallbackRequest = mongoose.model<ICallbackRequest, ICallbackRequestModel>(
  'CallbackRequest',
  CallbackRequestSchema
);

export default CallbackRequest;
