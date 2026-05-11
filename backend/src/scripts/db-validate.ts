import database from '../config/database';
import { validateDataIntegrity } from '../utils/dbHealthCheck';

async function validateData() {
  try {
    console.log('🔍 Validating data integrity...\n');
    
    await database.connect();
    
    const result = await validateDataIntegrity();
    
    console.log('📋 Data Integrity Checks:');
    console.log('========================\n');
    
    result.checks.forEach(check => {
      const emoji = check.status === 'pass' ? '✅' : '❌';
      console.log(`${emoji} ${check.name}`);
      console.log(`   ${check.message}\n`);
    });
    
    console.log('📊 Summary:');
    const passedChecks = result.checks.filter(check => check.status === 'pass').length;
    const totalChecks = result.checks.length;
    
    console.log(`   Passed: ${passedChecks}/${totalChecks} checks`);
    console.log(`   Status: ${result.status === 'valid' ? '✅ VALID' : '❌ ISSUES FOUND'}`);
    
    if (result.status === 'issues') {
      console.log('\n⚠️  Recommendations:');
      console.log('   • Run database seeding: npm run db:seed');
      console.log('   • Check for orphaned records');
      console.log('   • Verify user registration process');
    }
    
    await database.disconnect();
    
    process.exit(result.status === 'issues' ? 1 : 0);
  } catch (error) {
    console.error('❌ Data validation failed:', (error as Error).message);
    process.exit(1);
  }
}

validateData();