/**
 * E2E Test Helpers
 * Shared utilities for E2E test suite
 */

import { Page, BrowserContext, request } from '@playwright/test';

// ========================================
// EMAIL GENERATION
// ========================================

export function generateEmail(prefix = 'e2e'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}@test.com`;
}

export function generatePhone(): string {
  const prefix = '+97150';
  const suffix = Math.floor(Math.random() * 9000000 + 1000000);
  return `${prefix}${suffix}`;
}

// ========================================
// USER REGISTRATION HELPERS
// ========================================

export interface CustomerUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface ProviderUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  businessName?: string;
}

export async function registerCustomer(page: Page): Promise<CustomerUser> {
  const user: CustomerUser = {
    email: generateEmail('customer'),
    password: 'SecurePass@123',
    firstName: 'Test',
    lastName: 'Customer',
    phone: generatePhone(),
  };

  await page.goto('/register');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="firstName"]', user.firstName);
  await page.fill('input[name="lastName"]', user.lastName);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  await page.fill('input[name="phone"]', user.phone);

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|home)\/?/, { timeout: 15000 });

  return user;
}

export async function registerProvider(page: Page): Promise<ProviderUser> {
  const user: ProviderUser = {
    email: generateEmail('provider'),
    password: 'SecurePass@123',
    firstName: 'Test',
    lastName: 'Provider',
    phone: generatePhone(),
    businessName: 'Test Services LLC',
  };

  await page.goto('/register/provider');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="firstName"]', user.firstName);
  await page.fill('input[name="lastName"]', user.lastName);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  await page.fill('input[name="phone"]', user.phone);

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|provider)\/?/, { timeout: 15000 });

  return user;
}

export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|home)\/?/, { timeout: 15000 });
}

export async function logoutUser(page: Page): Promise<void> {
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]').first();
  if (await logoutButton.isVisible({ timeout: 3000 })) {
    await logoutButton.click();
    await page.waitForURL(/\/login\/?/, { timeout: 10000 });
  }
}

// ========================================
// API HELPERS
// ========================================

export interface ApiClient {
  baseUrl: string;
  headers: Record<string, string>;
}

export async function createApiClient(context?: BrowserContext): Promise<ApiClient> {
  const baseUrl = process.env.API_URL || 'http://localhost:5000/api';

  if (context) {
    // Get auth token from browser context
    const storageState = await context.storageState();
    const token = storageState?.cookies?.find(c => c.name === 'token')?.value;

    return {
      baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  }

  return {
    baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

export async function apiRequest<T>(
  client: ApiClient,
  endpoint: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { method = 'GET', body } = options;

  const response = await request.newContext({
    baseURL: client.baseUrl,
  });

  const requestOptions: Record<string, unknown> = {
    method,
    headers: client.headers,
  };

  if (body) {
    requestOptions.data = body;
  }

  const result = await response.fetch(endpoint, requestOptions as any);
  const data = await result.json();

  if (!result.ok()) {
    throw new Error(`API Error: ${result.status()} - ${JSON.stringify(data)}`);
  }

  return data as T;
}

// ========================================
// WAITING HELPERS
// ========================================

export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' } = {}
): Promise<void> {
  const { timeout = 10000, state = 'visible' } = options;
  await page.waitForSelector(selector, { state, timeout });
}

export async function waitForUrl(page: Page, pattern: RegExp | string, timeout = 15000): Promise<void> {
  await page.waitForURL(pattern, { timeout });
}

export async function waitForNetworkIdle(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

// ========================================
// ASSERTION HELPERS
// ========================================

export async function assertElementVisible(page: Page, selector: string, message?: string): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout: 10000 });
}

export async function assertElementHidden(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeHidden({ timeout: 5000 });
}

export async function assertTextVisible(page: Page, text: string): Promise<void> {
  const element = page.locator(`text=${text}`);
  await expect(element).toBeVisible({ timeout: 10000 });
}

export async function assertUrlContains(page: Page, substring: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(substring));
}

// ========================================
// FORM HELPERS
// ========================================

export async function fillFormField(page: Page, name: string, value: string): Promise<void> {
  const selector = `input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`;
  await page.fill(selector, value);
}

export async function submitForm(page: Page, formSelector = 'form'): Promise<void> {
  await page.click(`${formSelector} button[type="submit"]`);
}

export async function selectDropdownOption(page: Page, name: string, value: string): Promise<void> {
  await page.selectOption(`select[name="${name}"]`, value);
}

// ========================================
// DATE/TIME HELPERS
// ========================================

export function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export function getNextWeekDate(): string {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().split('T')[0];
}

export function formatTime12Hour(hour: number, minute: number = 0): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// ========================================
// TEST DATA HELPERS
// ========================================

export const TEST_ADDRESS = {
  street: '123 Test Street',
  city: 'Dubai',
  emirate: 'Dubai',
  postalCode: '12345',
  country: 'United Arab Emirates',
};

export const TEST_PAYMENT_CARD = {
  number: '4242424242424242', // Stripe test card
  expiryMonth: '12',
  expiryYear: '2030',
  cvc: '123',
};

export const TEST_PROMO_CODE = 'WELCOME10';

// ========================================
// CONTEXT/STORAGE HELPERS
// ========================================

export async function saveStorageState(context: BrowserContext, path: string): Promise<void> {
  await context.storageState({ path });
}

export async function loadStorageState(path: string): Promise<any> {
  const fs = await import('fs');
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  }
  return null;
}

// ========================================
// SCREENSHOT HELPERS
// ========================================

export async function takeScreenshot(page: Page, name: string, fullPage = true): Promise<Buffer> {
  return page.screenshot({ fullPage, name });
}

export async function takeElementScreenshot(page: Page, selector: string, name: string): Promise<Buffer> {
  const element = page.locator(selector);
  return element.screenshot({ name });
}

// ========================================
// CONSOLE/LOG HELPERS
// ========================================

export async function captureConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  return logs;
}

// Import expect from playwright
import { expect } from '@playwright/test';
