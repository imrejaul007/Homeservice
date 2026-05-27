/**
 * Page Object: Base Page
 * Base class for all page objects
 */

import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;
  protected url: string;

  constructor(page: Page, url = '/') {
    this.page = page;
    this.url = url;
  }

  async navigate(): Promise<void> {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async waitForUrl(pattern: RegExp | string, timeout = 15000): Promise<void> {
    await this.page.waitForURL(pattern, { timeout });
  }

  // Common elements
  protected getByTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  protected getByRole(role: 'button' | 'link' | 'textbox', name: string | RegExp): Locator {
    return this.page.getByRole(role, { name });
  }

  protected getByText(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }

  protected getByLabel(label: string): Locator {
    return this.page.getByLabel(label);
  }

  protected getByPlaceholder(placeholder: string): Locator {
    return this.page.getByPlaceholder(placeholder);
  }

  // Assertions
  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.url));
  }

  async assertTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  async assertElementVisible(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toBeVisible({ timeout: 10000 });
  }

  async assertElementHidden(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toBeHidden({ timeout: 5000 });
  }

  async assertTextVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 10000 });
  }

  // Actions
  async click(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.click();
  }

  async fill(selector: string | Locator, value: string): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.fill(value);
  }

  async selectOption(selector: string | Locator, value: string | { label?: string; value?: string }): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.selectOption(value);
  }

  // Waiting
  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  // Navigation
  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  // Screenshot
  async screenshot(name: string, fullPage = true): Promise<void> {
    await this.page.screenshot({ fullPage, name: `${name}.png` });
  }
}
