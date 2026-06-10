import mongoose, { Schema } from 'mongoose';

/**
 * Atomic counter for refund number generation
 * Uses MongoDB's findOneAndUpdate with $inc for atomic increment
 * Eliminates the O(n) countDocuments() scan that was in generateRefundNumberForCancellation()
 *
 * Key format: "YYYYMMDD" for daily sequence
 * Each day starts fresh at sequence 1
 */
export interface IRefundCounter {
  _id: string; // Date key in format "YYYYMMDD"
  sequence: number;
}

const RefundCounterSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
      unique: true,
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    autoIndex: true,
    versionKey: false,
  }
);

// No generic type on model() call — matches bookingCounter.model.ts pattern
const RefundCounter = mongoose.models.RefundCounter ||
  mongoose.model('RefundCounter', RefundCounterSchema);

export default RefundCounter;

/**
 * Generate next refund number using atomic increment
 * Returns: "REF-YYMMDD-0001", "REF-YYMMDD-0002", etc.
 *
 * Uses findOneAndUpdate with $inc - atomic in MongoDB.
 * No two concurrent requests can receive the same sequence value.
 */
export async function generateRefundNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const counter = await (RefundCounter.findOneAndUpdate as any)(
    { _id: dateStr },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequenceNumber = String(counter.sequence).padStart(4, '0');
  return `REF-${year}${month}${day}-${sequenceNumber}`;
}
