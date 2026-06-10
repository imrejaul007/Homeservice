import { FullConfig } from '@playwright/test';
import { Page } from '@playwright/test';

/**
 * Login helper function for E2E tests
 */
export async function loginTestUser(page: Page, email: string, password: string): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect or success
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');
}

/**
 * Logout helper function for E2E tests
 */
export async function logoutTestUser(page: Page): Promise<void> {
  // Click logout button or navigate to logout
  await page.click('button:has-text("Logout")').catch(() => {
    // Try alternative logout paths
  });
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for chat widget to be ready
 */
export async function waitForChatWidget(page: Page): Promise<void> {
  await page.waitForSelector('[aria-label="Open chat assistant"]', { state: 'visible' });
}

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');
  
  try {
    // Wait for backend to be ready
    console.log('⏳ Waiting for backend server...');
    const maxRetries = 30;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await fetch('http://localhost:5000/health');
        if (response.ok) {
          console.log('✅ Backend server is ready');
          break;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      retries++;
      if (retries >= maxRetries) {
        throw new Error('Backend server failed to start within timeout');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Wait for frontend to be ready
    console.log('⏳ Waiting for frontend server...');
    retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await fetch('http://localhost:3000');
        if (response.ok || response.status === 404) { // 404 is fine, means server is running
          console.log('✅ Frontend server is ready');
          break;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      retries++;
      if (retries >= maxRetries) {
        throw new Error('Frontend server failed to start within timeout');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Setup test database if needed
    try {
      console.log('🗄️  Setting up test database...');
      const response = await fetch('http://localhost:5000/api/test/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true })
      });
      
      if (response.ok) {
        console.log('✅ Test database setup complete');
      } else {
        console.log('⚠️  Test database setup endpoint not available');
      }
    } catch (error) {
      console.log('⚠️  Could not setup test database:', error.message);
    }

    console.log('🎉 Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    throw error;
  }
}

export default globalSetup;