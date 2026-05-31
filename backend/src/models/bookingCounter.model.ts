import mongoose, { Schema, Document } from 'mongoose';

/**
 * Atomic counter for booking number generation
 * Uses MongoDB's findOneAndUpdate with $inc for atomic increment
 * Key format: "YYYYMMDD" for daily sequence
 */
export interface IBookingCounter {
  _id: string; // Date key in format "YYYYMMDD"
  sequence: number;
}

const BookingCounterSchema = new Schema(
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
    // Ensure the _id field is indexed
    autoIndex: true,
    versionKey: false,
  }
);

const BookingCounter = mongoose.models.BookingCounter ||
  mongoose.model('BookingCounter', BookingCounterSchema);

export default BookingCounter;
