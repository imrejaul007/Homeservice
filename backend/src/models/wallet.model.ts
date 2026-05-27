import mongoose, { Schema, Document } from 'mongoose';

// Transaction status state machine type
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

export interface IWallet extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;
  balance: number; // Current wallet balance
  currency: string;
  transactions: Array<{
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    reference: string; // booking ID, payment ID, etc.
    referenceType: 'booking' | 'refund' | 'bonus' | 'payout' | 'topup' | 'commission';
    status: TransactionStatus;
    balanceAfter: number;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt?: Date;
  }>;
  pendingBalance: number; // Pending withdrawals/topups
  totalEarned: number; // Lifetime earnings
  totalSpent: number; // Lifetime spending
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  reference: { type: String, required: true },
  referenceType: {
    type: String,
    enum: ['booking', 'refund', 'bonus', 'payout', 'topup', 'commission'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
    default: 'completed',
  },
  balanceAfter: { type: Number, required: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const walletSchema = new Schema<IWallet>(
  {
    // Multi-tenant
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    transactions: [walletTransactionSchema],
    pendingBalance: {
      type: Number,
      default: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for transaction history queries
walletSchema.index({ 'transactions.createdAt': -1 });

// Compound index for user wallet queries with transaction history
walletSchema.index({ userId: 1, 'transactions.createdAt': -1 });

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
