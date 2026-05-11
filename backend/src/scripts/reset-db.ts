import database from '../config/database';
import { seedCategories } from '../seeders/categories.seeder';
import { createAdminUser } from '../seeders/admin.seeder';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';

async function resetDatabase() {
  try {
    console.log('🔄 Resetting database...\n');
    
    await database.connect();
    
    // Confirm with user (if running interactively)
    if (process.env.NODE_ENV !== 'test') {
      console.log('⚠️  WARNING: This will delete all data in the database!');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('🗑️  Clearing collections...');
    
    // Drop all collections
    const collections = [
      { name: 'users', model: User },
      { name: 'customerprofiles', model: CustomerProfile },
      { name: 'providerprofiles', model: ProviderProfile },
      { name: 'servicecategories', model: ServiceCategory }
    ];
    
    for (const { name, model } of collections) {
      try {
        const count = await model.countDocuments();
        await (model as any).deleteMany({});
        console.log(`   ✅ Cleared ${name}: ${count} documents removed`);
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not clear ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log('\n🌱 Reseeding database...');
    
    // Reseed data
    console.log('   📊 Creating service categories...');
    await seedCategories();
    console.log('   ✅ Service categories created');
    
    console.log('   👤 Creating admin user...');
    await createAdminUser();
    console.log('   ✅ Admin user created');
    
    console.log('\n📊 Final statistics:');
    const stats = await Promise.all([
      User.countDocuments(),
      CustomerProfile.countDocuments(),
      ProviderProfile.countDocuments(),
      ServiceCategory.countDocuments()
    ]);
    
    console.log(`   Users: ${stats[0]}`);
    console.log(`   Customer Profiles: ${stats[1]}`);
    console.log(`   Provider Profiles: ${stats[2]}`);
    console.log(`   Service Categories: ${stats[3]}`);
    
    console.log('\n✅ Database reset completed successfully!');
    
    await database.disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', (error as Error).message);
    process.exit(1);
  }
}

resetDatabase();