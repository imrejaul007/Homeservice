import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAddress {
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AddressDocument extends Document, IAddress {}

const addressSchema = new Schema<AddressDocument>({
  userId: { type: String, required: true, index: true },
  label: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true, default: 'India' },
  zipCode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  instructions: { type: String },
}, { timestamps: true });

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

const Address = mongoose.model<AddressDocument>('Address', addressSchema);

export default Address;
