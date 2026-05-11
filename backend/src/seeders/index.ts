import database from '../config/database';
import { seedCategories } from './categories.seeder';
import { createAdminUser } from './admin.seeder';

export const runAllSeeders = async (): Promise<void> => {
  try {
    console.log('🚀 Starting database seeding process...\n');

    // Connect to database
    await database.connect();

    // Run seeders in order
    console.log('1️⃣  Creating admin user...');
    await createAdminUser();

    console.log('\n2️⃣  Seeding service categories...');
    await seedCategories();

    console.log('\n✅ All seeders completed successfully!');

  } catch (error) {
    console.error('\n❌ Seeding process failed:', error);
    throw error;
  }
};

// Run all seeders if called directly
if (require.main === module) {
  (async () => {
    try {
      await runAllSeeders();
      await database.disconnect();
      console.log('\n🎉 Database seeding completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n💥 Database seeding failed:', error);
      await database.disconnect();
      process.exit(1);
    }
  })();
}