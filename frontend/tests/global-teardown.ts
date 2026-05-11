import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...');
  
  try {
    // Clean up test data
    try {
      console.log('🗄️  Cleaning up test database...');
      const response = await fetch('http://localhost:5000/api/test/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        console.log('✅ Test database cleanup complete');
      } else {
        console.log('⚠️  Test database cleanup endpoint not available');
      }
    } catch (error) {
      console.log('⚠️  Could not clean test database:', error.message);
    }

    // Additional cleanup if needed
    console.log('🧽 Performing additional cleanup...');
    
    // Clear any temporary files or caches created during tests
    // This is where you would add any custom cleanup logic

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error.message);
    // Don't throw here - we don't want to fail the test run due to cleanup issues
  }
}

export default globalTeardown;