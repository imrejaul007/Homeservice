/**
 * Page Object: Authentication Pages
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, '/login');
  }

  // Form fields
  readonly emailInput = this.getByLabel(/email/i);
  readonly passwordInput = this.getByLabel(/password/i);
  readonly submitButton = this.getByRole('button', { name: /log in|sign in/i });
  readonly forgotPasswordLink = this.getByRole('link', /forgot password/i);

  // Messages
  readonly errorMessage = this.getByTestId('error-message');
  readonly successMessage = this.getByTestId('success-message');

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.waitForUrl(/\/forgot-password/);
  }
}

export class RegisterPage extends BasePage {
  constructor(page: Page) {
    super(page, '/register');
  }

  // Form fields
  readonly firstNameInput = this.getByLabel(/first name/i);
  readonly lastNameInput = this.getByLabel(/last name/i);
  readonly emailInput = this.getByLabel(/email/i);
  readonly passwordInput = this.getByLabel(/^password$/i);
  readonly confirmPasswordInput = this.getByLabel(/confirm password/i);
  readonly phoneInput = this.getByLabel(/phone/i);
  readonly submitButton = this.getByRole('button', /sign up|register/i);

  // Messages
  readonly errorMessage = this.getByTestId('error-message');
  readonly validationErrors = this.page.locator('[data-testid="field-error"]');

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
  }): Promise<void> {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.password);
    await this.phoneInput.fill(data.phone);
    await this.submitButton.click();
  }
}

export class ForgotPasswordPage extends BasePage {
  constructor(page: Page) {
    super(page, '/forgot-password');
  }

  readonly emailInput = this.getByLabel(/email/i);
  readonly submitButton = this.getByRole('button', /send|submit/i);
  readonly successMessage = this.getByTestId('success-message');

  async requestReset(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }
}

export class ResetPasswordPage extends BasePage {
  constructor(page: Page, token?: string) {
    super(page, token ? `/reset-password?token=${token}` : '/reset-password');
  }

  readonly newPasswordInput = this.getByLabel(/new password/i);
  readonly confirmPasswordInput = this.getByLabel(/confirm password/i);
  readonly submitButton = this.getByRole('button', /reset|update/i);

  async resetPassword(newPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.submitButton.click();
  }
}
