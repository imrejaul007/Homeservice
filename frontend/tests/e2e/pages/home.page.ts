/**
 * Page Object: Home Page
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page, '/');
  }

  // Selectors
  readonly heroSection = this.getByTestId('hero-section');
  readonly searchInput = this.getByPlaceholder(/search/i);
  readonly categorySection = this.getByTestId('category-section');
  readonly featuredServices = this.getByTestId('featured-services');
  readonly footer = this.getByTestId('footer');

  // Navigation
  readonly signUpButton = this.getByRole('button', /sign up/i);
  readonly loginButton = this.getByRole('button', /log in/i);
  readonly getStartedButton = this.getByRole('button', /get started/i);

  // Categories
  readonly categories = this.page.locator('[data-testid^="category-"]');

  async goto(): Promise<void> {
    await this.navigate();
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForLoadState('networkidle');
  }

  async clickCategory(categoryName: string): Promise<void> {
    await this.page.locator(`[data-testid="category-${categoryName.toLowerCase()}"]`).click();
  }

  async clickSignUp(): Promise<void> {
    await this.signUpButton.click();
    await this.waitForUrl(/\/register/);
  }

  async clickLogin(): Promise<void> {
    await this.loginButton.click();
    await this.waitForUrl(/\/login/);
  }
}
