import mongoose, { Schema, Document } from 'mongoose';

/**
 * IAAgent Categories
 */
export enum IAAgentCategory {
  Admin = 'Admin',
  Provider = 'Provider',
  Client = 'Client',
  Partner = 'Partner',
}

/**
 * IAAgent Types
 */
export enum IAAgentType {
  Assistant = 'Assistant',
  Recherche = 'Recherche',
  Support = 'Support',
  FAQ = 'FAQ',
}

/**
 * Agent Deployment Status
 */
export enum IAAgentStatus {
  Draft = 'Draft',
  Testing = 'Testing',
  Deployed = 'Deployed',
  Suspended = 'Suspended',
  Archived = 'Archived',
}

/**
 * Agent Configuration Schema
 */
export interface IIAAgentConfiguration {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  contextWindow?: number;
  streaming?: boolean;
}

/**
 * Agent Knowledge Base Entry
 */
export interface IKnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * IAAgent Interface
 */
export interface IIAAgent extends Document {
  name: string;
  description: string;
  category: IAAgentCategory;
  type: IAAgentType;
  status: IAAgentStatus;
  configuration: IIAAgentConfiguration;
  instructions: string;
  knowledgeBase: IKnowledgeBaseEntry[];
  deployedAt?: Date;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  deploy(): Promise<IIAAgent>;
  suspend(): Promise<IIAAgent>;
  addKnowledgeEntry(entry: Omit<IKnowledgeBaseEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<IIAAgent>;
}

/**
 * Knowledge Base Entry Schema
 */
const knowledgeBaseEntrySchema = new Schema<IKnowledgeBaseEntry>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    source: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * IAAgent Schema
 */
const iaAgentSchema = new Schema<IIAAgent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: Object.values(IAAgentCategory),
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(IAAgentType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(IAAgentStatus),
      default: IAAgentStatus.Draft,
      index: true,
    },
    configuration: {
      model: { type: String },
      temperature: { type: Number, min: 0, max: 2 },
      maxTokens: { type: Number, min: 1 },
      topP: { type: Number, min: 0, max: 1 },
      frequencyPenalty: { type: Number, min: 0, max: 2 },
      presencePenalty: { type: Number, min: 0, max: 2 },
      stopSequences: [{ type: String }],
      systemPrompt: { type: String },
      contextWindow: { type: Number },
      streaming: { type: Boolean, default: false },
    },
    instructions: {
      type: String,
      required: true,
    },
    knowledgeBase: {
      type: [knowledgeBaseEntrySchema],
      default: [],
    },
    deployedAt: {
      type: Date,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
iaAgentSchema.index({ category: 1, type: 1 });
iaAgentSchema.index({ category: 1, status: 1 });
iaAgentSchema.index({ type: 1, status: 1 });
iaAgentSchema.index({ isActive: 1, status: 1 });

/**
 * Pre-save hook to update deployedAt when status changes to Deployed
 */
iaAgentSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === IAAgentStatus.Deployed && !this.deployedAt) {
    this.deployedAt = new Date();
  }
  next();
});

/**
 * Instance method to deploy agent
 */
iaAgentSchema.methods.deploy = async function (): Promise<IIAAgent> {
  const agent = this as unknown as IIAAgent;
  if (agent.status === IAAgentStatus.Draft || agent.status === IAAgentStatus.Testing) {
    agent.status = IAAgentStatus.Deployed;
    agent.deployedAt = new Date();
    agent.version += 1;
    await (this as any).save();
  }
  return agent;
};

/**
 * Instance method to suspend agent
 */
iaAgentSchema.methods.suspend = async function (): Promise<IIAAgent> {
  const agent = this as unknown as IIAAgent;
  if (agent.status === IAAgentStatus.Deployed) {
    agent.status = IAAgentStatus.Suspended;
    await (this as any).save();
  }
  return agent;
};

/**
 * Instance method to add knowledge base entry
 */
iaAgentSchema.methods.addKnowledgeEntry = async function (
  entry: Omit<IKnowledgeBaseEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IIAAgent> {
  const agent = this as unknown as IIAAgent;
  const entryId = new mongoose.Types.ObjectId().toString();
  agent.knowledgeBase.push({
    ...entry,
    id: entryId,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as IKnowledgeBaseEntry);
  await (this as any).save();
  return agent;
};

/**
 * Static method to find active agents by category
 */
iaAgentSchema.statics.findActiveByCategory = function (
  category: IAAgentCategory
): Promise<IIAAgent[]> {
  return this.find({ category, isActive: true, status: IAAgentStatus.Deployed });
};

/**
 * Static method to find agent by type and category
 */
iaAgentSchema.statics.findByTypeAndCategory = function (
  type: IAAgentType,
  category: IAAgentCategory
): Promise<IIAAgent | null> {
  return this.findOne({ type, category, isActive: true });
};

export const IAAgent = mongoose.model<IIAAgent>('IAAgent', iaAgentSchema);

export default { IAAgent, IAAgentCategory, IAAgentType, IAAgentStatus };
