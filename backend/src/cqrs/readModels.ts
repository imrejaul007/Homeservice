import mongoose, { Schema, Document } from 'mongoose';

// Read model for analytics dashboard
interface IBookingReadModel extends Document {
  bookingId: string;
  customerId: string;
  providerId: string;
  serviceId: string;
  status: string;
  totalAmount: number;
  scheduledDate: Date;
  completedAt?: Date;
  createdAt: Date;
  analytics: {
    day: string;
    hour: number;
    region?: string;
  };
}

const bookingReadModelSchema = new Schema<IBookingReadModel>({
  bookingId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  providerId: { type: String, required: true, index: true },
  serviceId: { type: String, required: true, index: true },
  status: { type: String, required: true, index: true },
  totalAmount: { type: Number, required: true },
  scheduledDate: { type: Date, required: true },
  completedAt: Date,
  analytics: {
    day: String,
    hour: Number,
    region: String,
  },
}, { timestamps: true });

bookingReadModelSchema.index({ createdAt: -1 });
bookingReadModelSchema.index({ 'analytics.day': 1 });
bookingReadModelSchema.index({ status: 1, createdAt: -1 });

const BookingReadModel = mongoose.model<IBookingReadModel>('BookingReadModel', bookingReadModelSchema);

// Projection handlers
export const projections = {
  BookingReadModel: {
    onBookingCreated: async (event: any) => {
      const readModel = new BookingReadModel({
        bookingId: event.payload.bookingId,
        customerId: event.payload.customerId,
        providerId: event.payload.providerId,
        serviceId: event.payload.serviceId,
        status: 'pending',
        totalAmount: event.payload.totalAmount || 0,
        scheduledDate: event.payload.scheduledDate,
        analytics: {
          day: new Date().toISOString().split('T')[0],
          hour: new Date().getHours(),
          region: event.payload.region,
        },
      });
      await readModel.save();
      return readModel;
    },

    onBookingCompleted: async (event: any) => {
      await BookingReadModel.findOneAndUpdate(
        { bookingId: event.payload.bookingId },
        {
          status: 'completed',
          completedAt: new Date(),
        }
      );
    },

    onBookingCancelled: async (event: any) => {
      await BookingReadModel.findOneAndUpdate(
        { bookingId: event.payload.bookingId },
        { status: 'cancelled' }
      );
    },
  },
};

export { BookingReadModel };
