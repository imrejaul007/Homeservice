import mongoose, { Schema, Document } from 'mongoose';
import logger from '../utils/logger';

// Transaction status state machine type
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

// Maximum number of transactions to keep in wallet history (most recent)
// Can be overridden by importing and reassigning
export const MAX_TRANSACTION_HISTORY = 1000;

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
    // FIX: Add audit fields to transactions
    processedBy?: mongoose.Types.ObjectId; // Admin/system that processed
    reason?: string; // Reason for transaction
  }>;
  pendingBalance: number; // Pending withdrawals/topups
  totalEarned: number; // Lifetime earnings
  totalSpent: number; // Lifetime spending

  // FIX: Add missing audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId; // Who created the wallet
  updatedBy?: mongoose.Types.ObjectId; // Who last updated

  // FIX: Add soft delete support
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  // FIX: Add wallet status for security
  isFrozen: boolean;
  frozenAt?: Date;
  frozenBy?: mongoose.Types.ObjectId;
  freezeReason?: string;

  // FIX: Add version for optimistic locking
  version: number;
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
  // FIX: Add audit fields to transactions
  processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
}, { _id: false });

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

    // FIX: Add missing audit fields
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    // FIX: Add soft delete support
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    // FIX: Add wallet status for security
    isFrozen: {
      type: Boolean,
      default: false,
      index: true
    },
    frozenAt: Date,
    frozenBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    freezeReason: String,

    // FIX: Add version for optimistic locking
    version: {
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

// FIX: Add indexes for new audit and security fields
walletSchema.index({ tenantId: 1, isDeleted: 1 });
walletSchema.index({ tenantId: 1, isFrozen: 1 });
walletSchema.index({ isDeleted: 1, balance: 1 });

// FIX: Add index for transaction type queries (audit trail)
walletSchema.index({ 'transactions.referenceType': 1, 'transactions.createdAt': -1 });

// FIX: Add index for transaction status queries
walletSchema.index({ 'transactions.status': 1, 'transactions.createdAt': -1 });

// FIX: Add index for frozen wallets audit
walletSchema.index({ frozenAt: -1, isFrozen: 1 });

// FIX: Pre-save hook to limit unbounded transactions array (max 1000)
walletSchema.pre('save', function(next) {
  // Limit transactions to most recent entries to prevent document size growth
  // Uses exported MAX_TRANSACTION_HISTORY constant for external configurability
  if (this.transactions && this.transactions.length > MAX_TRANSACTION_HISTORY) {
    // Sort by createdAt descending and keep the most recent
    const sortedTransactions = [...this.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.transactions = sortedTransactions.slice(0, MAX_TRANSACTION_HISTORY);
  }
  next();
});

// FIX: Pre-save hook for debugging only - NOT atomic, DO NOT use for concurrency control
// The service layer implements proper atomic optimistic locking
// with findOneAndUpdate + $inc: { version: 1 }
// This hook only logs modifications for debugging/monitoring purposes
walletSchema.pre('save', function(next) {
  if (this.isModified()) {
    logger.debug('Wallet modified', {
      walletId: this._id,
      version: this.version,
      modifiedPaths: this.modifiedPaths(),
      action: 'WALLET_MODIFIED_DEBUG',
    });
    // NOTE: We intentionally do NOT increment version here
    // Version increment is handled atomically in the service layer
  }
  next();
});

// FIX: Add instance methods for wallet operations
walletSchema.methods.freeze = function(reason: string, frozenBy: mongoose.Types.ObjectId) {
  this.isFrozen = true;
  this.frozenAt = new Date();
  this.frozenBy = frozenBy;
  this.freezeReason = reason;
};

walletSchema.methods.unfreeze = function(unfrozenBy: mongoose.Types.ObjectId) {
  this.isFrozen = false;
  this.frozenAt = undefined;
  this.frozenBy = undefined;
  this.freezeReason = undefined;
};

walletSchema.methods.softDelete = function(deletedBy: mongoose.Types.ObjectId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
};

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
