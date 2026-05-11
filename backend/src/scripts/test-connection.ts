import database from '../config/database';

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    await database.connect();
    
    const status = database.getConnectionStatus();
    
    console.log('✅ Database connection successful!');
    console.log(`📍 Connected to: ${status.host}`);
    console.log(`🗄️  Database name: ${status.name}`);
    console.log(`🔌 Connection state: ${status.readyState === 1 ? 'Connected' : 'Not Connected'}`);
    
    // Test a simple ping
    const pingResult = await database.ping();
    console.log('🏓 Ping test:', pingResult ? 'Success' : 'Failed');
    
    await database.disconnect();
    console.log('🔌 Disconnected from database');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    process.exit(1);
  }
}

testConnection();