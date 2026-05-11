import mongoose, { Schema, Document } from 'mongoose';

// Beauty service categories
export const BEAUTY_CATEGORIES = {
  HAIR: 'hair_styling',
  SPA_WELLNESS: 'spa_wellness',
  NAILS: 'nail_art',
  BRIDAL: 'bridal_packages',
  MENS_GROOMING: 'mens_grooming',
  MAKEUP_ARTISTRY: 'makeup_artistry',
  SKINCARE: 'skincare_facials',
  EYELASH_BROWS: 'eyelash_brows',
  AESTHETICIAN: 'aesthetician',
  WELLNESS_YOGA: 'wellness_yoga',
} as const;

export interface IServiceCategory extends Document {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  displayOrder: number;
}

const beautyCategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: String,
  icon: String,
  color: String,
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
});

export const BeautyCategory = mongoose.model('BeautyCategory', beautyCategorySchema);
export default BeautyCategory;
