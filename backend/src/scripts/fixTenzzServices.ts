import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from '../models/service.model';

dotenv.config();

async function fixTenzzServices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service');
    console.log('Connected to MongoDB');

    // Fix "Hair Services" -> "Hair"
    const hairResult = await Service.updateMany(
      { subcategory: 'Hair Services' },
      { $set: { subcategory: 'Hair' } }
    );
    console.log(`Updated ${hairResult.modifiedCount} services: Hair Services -> Hair`);

    // Fix "Makeup & Beauty" -> "Makeup"
    const makeupResult = await Service.updateMany(
      { subcategory: 'Makeup & Beauty' },
      { $set: { subcategory: 'Makeup' } }
    );
    console.log(`Updated ${makeupResult.modifiedCount} services: Makeup & Beauty -> Makeup`);

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixTenzzServices();
