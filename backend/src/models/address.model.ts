import mongoose, { Schema, Document, Model } from 'mongoose';

// GeoJSON Point interface for coordinates
export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IAddress {
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault: boolean;
  location?: IGeoPoint; // GeoJSON format for geospatial queries
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AddressDocument extends Document, IAddress {}

// 2dsphere index requires GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
const addressSchema = new Schema<AddressDocument>({
  userId: { type: String, required: true, index: true },
  label: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true, default: 'India' },
  zipCode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  instructions: { type: String },
}, { timestamps: true });

// Create 2dsphere index for geospatial queries (near, within, etc.)
addressSchema.index({ location: '2dsphere' });

// Ensure only one default address per user
addressSchema.pre('save', async function() {
  if (this.isDefault) {
    const AddressModel = this.constructor as Model<AddressDocument>;
    await AddressModel.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
});

// Compound index for efficient queries on user addresses with default filter
addressSchema.index({ userId: 1, isDefault: 1 });

// Helper to convert lat/lng to GeoJSON format (for backward compatibility)
addressSchema.methods.setCoordinates = function(lat: number, lng: number): void {
  (this as any).location = {
    type: 'Point',
    coordinates: [lng, lat], // GeoJSON order: [longitude, latitude]
  };
};

// Helper to get latitude and longitude from GeoJSON
addressSchema.methods.getCoordinates = function(): { lat: number; lng: number } | null {
  if ((this as any).location?.coordinates) {
    const [lng, lat] = (this as any).location.coordinates;
    return { lat, lng };
  }
  return null;
};

const Address = mongoose.model<AddressDocument>('Address', addressSchema);

export default Address;
