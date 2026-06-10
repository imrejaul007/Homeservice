import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ContactPage extends BasePage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly subjectSelect: Locator;
  readonly messageInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly emailMethod: Locator;
  readonly phoneMethod: Locator;
  readonly chatMethod: Locator;

  constructor(page: Page) {
    super(page, '/contact');
    this.heading = page.getByRole('heading', { name: 'Contact Us' });
    this.form = page.getByTestId('contact-form');
    this.nameInput = page.getByTestId('contact-name');
    this.emailInput = page.getByTestId('contact-email');
    this.subjectSelect = page.getByTestId('contact-subject');
    this.messageInput = page.getByTestId('contact-message');
    this.submitButton = page.getByTestId('contact-submit');
    this.successMessage = page.getByTestId('contact-success');
    this.emailMethod = page.getByTestId('contact-email-method');
    this.phoneMethod = page.getByTestId('contact-phone-method');
    this.chatMethod = page.getByTestId('contact-chat-method');
  }

  async assertPageLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.form).toBeVisible();
  }

  async fillForm(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.subjectSelect.selectOption(data.subject);
    await this.messageInput.fill(data.message);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  async assertSubmissionSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 15000 });
    await expect(this.page.getByText('Message Sent!')).toBeVisible();
  }
}
