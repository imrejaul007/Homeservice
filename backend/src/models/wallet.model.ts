import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
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
    status: 'pending' | 'completed' | 'failed' | 'reversed';
    balanceAfter: number;
    metadata?: Record<string, unknown>;
    createdAt: Date;
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
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'completed',
  },
  balanceAfter: { type: Number, required: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

const walletSchema = new Schema<IWallet>(
  {
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

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
