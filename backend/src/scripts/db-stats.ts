import database from '../config/database';
import { getDatabaseStats } from '../utils/dbHealthCheck';

async function showStats() {
  try {
    console.log('📊 Gathering database statistics...\n');
    
    await database.connect();
    
    const stats = await getDatabaseStats();
    
    console.log('👥 User Statistics:');
    console.log(`   Total Users: ${stats.users.total}`);
    console.log(`   Customers: ${stats.users.customers}`);
    console.log(`   Providers: ${stats.users.providers}`);
    console.log(`   Admins: ${stats.users.admins}`);
    console.log(`   Verified Users: ${stats.users.verified}`);
    console.log(`   Active Users: ${stats.users.active}\n`);
    
    console.log('🏷️  Service Categories:');
    console.log(`   Total Categories: ${stats.categories}\n`);
    
    console.log('💾 Database Information:');
    console.log(`   Size: ${stats.database.sizeInMB} MB`);
    console.log(`   Collections: ${stats.database.collections}`);
    console.log(`   Indexes: ${stats.database.indexes}`);
    console.log(`   Average Object Size: ${stats.database.avgObjSize} bytes\n`);
    
    // Calculate some additional metrics
    const verificationRate = stats.users.total > 0 ? 
      ((stats.users.verified / stats.users.total) * 100).toFixed(1) : '0';
    const activeRate = stats.users.total > 0 ? 
      ((stats.users.active / stats.users.total) * 100).toFixed(1) : '0';
    
    console.log('📈 Metrics:');
    console.log(`   Email Verification Rate: ${verificationRate}%`);
    console.log(`   Active User Rate: ${activeRate}%`);
    
    if (stats.users.providers > 0) {
      console.log(`   Customer to Provider Ratio: ${(stats.users.customers / stats.users.providers).toFixed(1)}:1`);
    }
    
    await database.disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to get database stats:', (error as Error).message);
    process.exit(1);
  }
}

showStats();