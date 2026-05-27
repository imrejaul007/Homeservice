import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// Type Definitions
// ============================================

export type ContractStatus = 'draft' | 'pending' | 'active' | 'suspended' | 'expired' | 'terminated';
export type SLAPriority = 'standard' | 'express' | 'premium';
export type PricingModel = 'fixed' | 'hourly' | 'per_service' | 'tiered';
export type TeamMemberRole = 'manager' | 'technician' | 'coordinator' | 'backup';
export type ChurnRisk = 'low' | 'medium' | 'high';

// ============================================
// Interface Definitions
// ============================================

export interface IClientAddress {
  street: string;
  city: string;
  emirate: string;
  postalCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface IServiceScope {
  serviceIds: string[];
  categories: string[];
  maxMonthlyServices: number;
  excludedServices: string[];
}

export interface ISLATerms {
  responseTimeMinutes: number;
  completionTimeHours: number;
  availabilityPercentage: number;
  priority: SLAPriority;
  penaltyClauses: string;
  escalationPath: string[];
}

export interface IVolumeDiscount {
  minServices: number;
  discountPercentage: number;
}

export interface IPricingDetails {
  model: PricingModel;
  monthlyFee: number;
  currency: string;
  overtimeRate?: number;
  volumeDiscounts?: IVolumeDiscount[];
  minimumCommitmentMonths: number;
}

export interface ITeamMember {
  userId?: string;
  name: string;
  email: string;
  phone: string;
  role: TeamMemberRole;
  assignedAt: Date;
  isActive: boolean;
}

export interface ISLACompliance {
  totalBookings: number;
  compliantBookings: number;
  responseTimeBreaches: number;
  completionTimeBreaches: number;
  availabilityBreaches: number;
  complianceRate: number;
  lastCalculatedAt: Date;
}

export interface IContractMetrics {
  totalRevenue: number;
  totalBookings: number;
  averageRating: number;
  totalClients: number;
  churnRisk: ChurnRisk;
  lastCalculatedAt: Date;
}

export interface IContractDocument {
  name: string;
  url: string;
  type: string;
  uploadedAt: Date;
}

export interface IHistoryEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  details?: string;
}

export interface IManagedContract extends Document {
  contractNumber: string;
  providerId: mongoose.Types.ObjectId;
  clientName: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: IClientAddress;
  status: ContractStatus;
  serviceScope: IServiceScope;
  slaTerms: ISLATerms;
  pricing: IPricingDetails;
  teamMembers: ITeamMember[];
  primaryContactId?: string;
  slaCompliance: ISLACompliance;
  startDate: Date;
  endDate: Date;
  renewalDate?: Date;
  autoRenew: boolean;
  documents: IContractDocument[];
  metrics: IContractMetrics;
  internalNotes: string;
  clientNotes: string;
  terminatedAt?: Date;
  terminationReason?: string;
  history: IHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Schema Definition
// ============================================

const clientAddressSchema = new Schema<IClientAddress>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    emirate: { type: String, required: true },
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  { _id: false }
);

const serviceScopeSchema = new Schema<IServiceScope>(
  {
    serviceIds: [{ type: String }],
    categories: [{ type: String }],
    maxMonthlyServices: { type: Number, default: 100 },
    excludedServices: [{ type: String }],
  },
  { _id: false }
);

const slaTermsSchema = new Schema<ISLATerms>(
  {
    responseTimeMinutes: { type: Number, default: 60 },
    completionTimeHours: { type: Number, default: 24 },
    availabilityPercentage: { type: Number, default: 99 },
    priority: {
      type: String,
      enum: ['standard', 'express', 'premium'],
      default: 'standard',
    },
    penaltyClauses: { type: String, default: '' },
    escalationPath: [{ type: String }],
  },
  { _id: false }
);

const volumeDiscountSchema = new Schema<IVolumeDiscount>(
  {
    minServices: { type: Number, required: true },
    discountPercentage: { type: Number, required: true },
  },
  { _id: false }
);

const pricingDetailsSchema = new Schema<IPricingDetails>(
  {
    model: {
      type: String,
      enum: ['fixed', 'hourly', 'per_service', 'tiered'],
      default: 'fixed',
    },
    monthlyFee: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'AED' },
    overtimeRate: Number,
    volumeDiscounts: [volumeDiscountSchema],
    minimumCommitmentMonths: { type: Number, default: 1 },
  },
  { _id: false }
);

const teamMemberSchema = new Schema<ITeamMember>(
  {
    userId: String,
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    role: {
      type: String,
      enum: ['manager', 'technician', 'coordinator', 'backup'],
      default: 'technician',
    },
    assignedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const slaComplianceSchema = new Schema<ISLACompliance>(
  {
    totalBookings: { type: Number, default: 0 },
    compliantBookings: { type: Number, default: 0 },
    responseTimeBreaches: { type: Number, default: 0 },
    completionTimeBreaches: { type: Number, default: 0 },
    availabilityBreaches: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const contractMetricsSchema = new Schema<IContractMetrics>(
  {
    totalRevenue: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalClients: { type: Number, default: 1 },
    churnRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const contractDocumentSchema = new Schema<IContractDocument>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const historyEntrySchema = new Schema<IHistoryEntry>(
  {
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    performedAt: { type: Date, default: Date.now },
    details: String,
  },
  { _id: false }
);

const managedContractSchema = new Schema<IManagedContract>(
  {
    contractNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientContactName: {
      type: String,
      required: true,
      trim: true,
    },
    clientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    clientPhone: {
      type: String,
      required: true,
      trim: true,
    },
    clientAddress: {
      type: clientAddressSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'suspended', 'expired', 'terminated'],
      default: 'draft',
      index: true,
    },
    serviceScope: {
      type: serviceScopeSchema,
      default: () => ({
        serviceIds: [],
        categories: [],
        maxMonthlyServices: 100,
        excludedServices: [],
      }),
    },
    slaTerms: {
      type: slaTermsSchema,
      default: () => ({}),
    },
    pricing: {
      type: pricingDetailsSchema,
      required: true,
    },
    teamMembers: [teamMemberSchema],
    primaryContactId: String,
    slaCompliance: {
      type: slaComplianceSchema,
      default: () => ({}),
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    renewalDate: Date,
    autoRenew: {
      type: Boolean,
      default: true,
    },
    documents: [contractDocumentSchema],
    metrics: {
      type: contractMetricsSchema,
      default: () => ({}),
    },
    internalNotes: {
      type: String,
      default: '',
    },
    clientNotes: {
      type: String,
      default: '',
    },
    terminatedAt: Date,
    terminationReason: String,
    history: [historyEntrySchema],
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes
// ============================================

managedContractSchema.index({ providerId: 1, status: 1 });
managedContractSchema.index({ providerId: 1, startDate: 1 });
managedContractSchema.index({ providerId: 1, endDate: 1 });
managedContractSchema.index({ 'pricing.monthlyFee': 1 });
managedContractSchema.index({ endDate: 1, status: 1 });

// ============================================
// Helper function to generate contract number
// ============================================

const generateContractNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `MC-${year}${month}-${random}`;
};

// ============================================
// Pre-save hook for contract number
// ============================================

managedContractSchema.pre('save', async function (next) {
  if (this.isNew && !this.contractNumber) {
    let contractNumber = await generateContractNumber();
    // Ensure uniqueness
    let exists = await mongoose
      .model('ManagedContract')
      .findOne({ contractNumber })
      .lean();

    while (exists) {
      contractNumber = await generateContractNumber();
      exists = await mongoose
        .model('ManagedContract')
        .findOne({ contractNumber })
        .lean();
    }

    this.contractNumber = contractNumber;
  }
  next();
});

// ============================================
// Model Export
// ============================================

const ManagedContract = mongoose.model<IManagedContract>(
  'ManagedContract',
  managedContractSchema
);

export default ManagedContract;
