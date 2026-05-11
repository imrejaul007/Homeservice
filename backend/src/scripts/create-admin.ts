#!/usr/bin/env ts-node

/**
 * Quick Admin User Creation Script
 * Creates an admin user for immediate use
 */

import database from '../config/database';
import { createAdminUser } from '../seeders/admin.seeder';

const createAdmin = async (): Promise<void> => {
  try {
    console.log('🚀 Creating admin user for deployed backend...\n');

    // Connect to database
    await database.connect();
    console.log('✅ Database connected successfully\n');

    // Create admin user
    await createAdminUser();

    console.log('\n🎉 Admin user creation completed!');
    console.log('You can now login with the admin credentials from your .env file:\n');
    console.log(`📧 Email: ${process.env.ADMIN_EMAIL || 'admin@homeservice.com'}`);
    console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD || 'AdminPassword123!'}`);
    console.log(`👤 Name: ${process.env.ADMIN_FIRST_NAME || 'Super'} ${process.env.ADMIN_LAST_NAME || 'Admin'}`);
    console.log(`📱 Phone: ${process.env.ADMIN_PHONE || '+1234567890'}\n`);

  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n💡 Admin user already exists! You can login with:');
      console.log(`📧 Email: ${process.env.ADMIN_EMAIL || 'admin@homeservice.com'}`);
      console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD || 'AdminPassword123!'}\n`);
    }
  } finally {
    // Disconnect from database
    await database.disconnect();
    console.log('📡 Database disconnected');
    process.exit(0);
  }
};

// Execute the script
if (require.main === module) {
  createAdmin().catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export default createAdmin;