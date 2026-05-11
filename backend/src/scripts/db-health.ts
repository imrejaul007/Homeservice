import database from '../config/database';
import { checkDatabaseHealth } from '../utils/dbHealthCheck';

async function checkHealth() {
  try {
    console.log('🏥 Running database health check...\n');
    
    await database.connect();
    
    const healthResult = await checkDatabaseHealth();
    
    // Display connection info
    console.log('🔌 Connection Status:');
    console.log(`   State: ${healthResult.connection.readyStateName} (${healthResult.connection.readyState})`);
    console.log(`   Host: ${healthResult.connection.host}`);
    console.log(`   Database: ${healthResult.connection.name}\n`);
    
    // Display performance metrics
    console.log('⚡ Performance:');
    console.log(`   Ping time: ${healthResult.performance.pingTime}ms`);
    console.log(`   Query time: ${healthResult.performance.queryTime}ms\n`);
    
    // Display collection info
    console.log('📊 Collections:');
    healthResult.collections.forEach(collection => {
      console.log(`   ${collection.name}: ${collection.count} documents, ${collection.indexes} indexes`);
    });
    console.log('');
    
    // Display overall status
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '❌'
    };
    
    console.log(`${statusEmoji[healthResult.status]} Overall Status: ${healthResult.status.toUpperCase()}`);
    
    // Display issues if any
    if (healthResult.issues.length > 0) {
      console.log('\n🚨 Issues:');
      healthResult.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
    
    await database.disconnect();
    
    process.exit(healthResult.status === 'critical' ? 1 : 0);
  } catch (error) {
    console.error('❌ Health check failed:', (error as Error).message);
    process.exit(1);
  }
}

checkHealth();