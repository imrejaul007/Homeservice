/**
 * Beauty Services Seeder
 * Run: npm run seed:beauty
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BeautyCategory from '../models/beautyCategory.model';

dotenv.config();

const beautyCategories = [
  {
    name: 'Hair Styling',
    slug: 'hair-styling',
    description: 'Haircuts, coloring, keratin, and styling services',
    icon: 'scissors',
    color: '#E91E63',
    displayOrder: 1,
  },
  {
    name: 'Nail Art',
    slug: 'nail-art',
    description: 'Manicure, pedicure, and nail art services',
    icon: 'palette',
    color: '#9C27B0',
    displayOrder: 2,
  },
  {
    name: 'Spa & Wellness',
    slug: 'spa-wellness',
    description: 'Massage, facials, and wellness treatments',
    icon: 'spa',
    color: '#00BCD4',
    displayOrder: 3,
  },
  {
    name: 'Bridal Packages',
    slug: 'bridal-packages',
    description: 'Complete bridal beauty packages for your special day',
    icon: 'diamond',
    color: '#FF9800',
    displayOrder: 4,
  },
  {
    name: "Men's Grooming",
    slug: 'mens-grooming',
    description: 'Barbershop services and men\'s grooming',
    icon: 'content-cut',
    color: '#3F51B5',
    displayOrder: 5,
  },
  {
    name: 'Makeup Artistry',
    slug: 'makeup-artistry',
    description: 'Professional makeup for all occasions',
    icon: 'brush',
    color: '#F44336',
    displayOrder: 6,
  },
];

const seedBeautyCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');

    // Clear existing
    await BeautyCategory.deleteMany({});

    // Insert new
    const result = await BeautyCategory.insertMany(beautyCategories);

    console.log(`Seeded ${result.length} beauty categories`);
    console.log('Categories:', result.map(c => c.name).join(', '));

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedBeautyCategories();
