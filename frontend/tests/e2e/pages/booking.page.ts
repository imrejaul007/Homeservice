/**
 * Page Object: Booking Pages
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ServicesPage extends BasePage {
  constructor(page: Page) {
    super(page, '/services');
  }

  readonly searchInput = this.getByPlaceholder(/search services/i);
  readonly categoryFilter = this.getByTestId('category-filter');
  readonly priceFilter = this.getByTestId('price-filter');
  readonly ratingFilter = this.getByTestId('rating-filter');
  readonly serviceList = this.getByTestId('service-list');
  readonly serviceCards = this.page.locator('[data-testid^="service-card-"]');
  readonly bookButton = this.getByRole('button', /book/i);

  async searchService(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForLoadState('networkidle');
  }

  async clickServiceCard(serviceId: string): Promise<void> {
    await this.page.locator(`[data-testid="service-card-${serviceId}"]`).click();
  }

  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.click();
    await this.page.locator(`text=${category}`).click();
  }

  async bookService(serviceId: string): Promise<void> {
    await this.page.locator(`[data-testid="book-button-${serviceId}"]`).click();
  }
}

export class BookingPage extends BasePage {
  constructor(page: Page) {
    super(page, '/booking');
  }

  // Service selection
  readonly serviceSelector = this.getByTestId('service-selector');
  readonly providerSelector = this.getByTestId('provider-selector');

  // Date & Time
  readonly datePicker = this.getByTestId('date-picker');
  readonly timeSlots = this.page.locator('[data-testid^="time-slot-"]');
  readonly selectedTimeSlot = this.getByTestId('selected-time-slot');

  // Location
  readonly locationType = this.getByTestId('location-type');
  readonly addressForm = this.getByTestId('address-form');
  readonly streetInput = this.getByLabel(/street/i);
  readonly cityInput = this.getByLabel(/city/i);

  // Summary
  readonly bookingSummary = this.getByTestId('booking-summary');
  readonly serviceName = this.getByTestId('service-name');
  readonly providerName = this.getByTestId('provider-name');
  readonly dateTime = this.getByTestId('date-time');
  readonly totalPrice = this.getByTestId('total-price');

  // Actions
  readonly continueButton = this.getByRole('button', /continue|next/i);
  readonly backButton = this.getByRole('button', /back/i);
  readonly cancelButton = this.getByRole('button', /cancel/i);

  async selectService(serviceId: string): Promise<void> {
    await this.serviceSelector.click();
    await this.page.locator(`[data-testid="service-option-${serviceId}"]`).click();
  }

  async selectProvider(providerId: string): Promise<void> {
    await this.providerSelector.click();
    await this.page.locator(`[data-testid="provider-option-${providerId}"]`).click();
  }

  async selectDate(date: string): Promise<void> {
    await this.datePicker.click();
    await this.page.locator(`[data-date="${date}"]`).click();
  }

  async selectTimeSlot(time: string): Promise<void> {
    await this.page.locator(`[data-testid="time-slot-${time.replace(/[:\s]/g, '')}"]`).click();
  }

  async fillAddress(data: { street: string; city: string }): Promise<void> {
    await this.streetInput.fill(data.street);
    await this.cityInput.fill(data.city);
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

export class CheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page, '/checkout');
  }

  // Order summary
  readonly orderSummary = this.getByTestId('order-summary');
  readonly subtotal = this.getByTestId('subtotal');
  readonly discount = this.getByTestId('discount');
  readonly total = this.getByTestId('total');

  // Promo code
  readonly promoInput = this.getByTestId('promo-input');
  readonly applyPromoButton = this.getByRole('button', /apply/i);
  readonly promoSuccess = this.getByTestId('promo-success');
  readonly promoError = this.getByTestId('promo-error');

  // Payment methods
  readonly paymentMethods = this.getByTestId('payment-methods');
  readonly creditCardOption = this.getByTestId('payment-card');
  readonly walletOption = this.getByTestId('payment-wallet');
  readonly applePayOption = this.getByTestId('payment-apple-pay');

  // Stripe elements
  readonly stripeFrame = this.page.frameLocator('iframe[name^="__privateStripeFrame"]');
  readonly cardNumberInput = this.stripeFrame.locator('[name="cardnumber"]');
  readonly cardExpiryInput = this.stripeFrame.locator('[name="exp-date"]');
  readonly cardCvcInput = this.stripeFrame.locator('[name="cvc"]');

  // Actions
  readonly payButton = this.getByRole('button', /pay|confirm/i);
  readonly backButton = this.getByRole('button', /back/i);

  async applyPromoCode(code: string): Promise<void> {
    await this.promoInput.fill(code);
    await this.applyPromoButton.click();
    await this.waitForTimeout(1000);
  }

  async selectPaymentMethod(method: 'card' | 'wallet' | 'apple-pay'): Promise<void> {
    switch (method) {
      case 'card':
        await this.creditCardOption.click();
        break;
      case 'wallet':
        await this.walletOption.click();
        break;
      case 'apple-pay':
        await this.applePayOption.click();
        break;
    }
  }

  async enterCardDetails(data: { number: string; expiry: string; cvc: string }): Promise<void> {
    await this.stripeFrame.locator('[name="cardnumber"]').fill(data.number);
    await this.stripeFrame.locator('[name="exp-date"]').fill(data.expiry);
    await this.stripeFrame.locator('[name="cvc"]').fill(data.cvc);
  }

  async pay(): Promise<void> {
    await this.payButton.click();
  }
}

export class BookingConfirmationPage extends BasePage {
  constructor(page: Page) {
    super(page, '/booking/confirmation');
  }

  readonly confirmationCard = this.getByTestId('confirmation-card');
  readonly bookingNumber = this.getByTestId('booking-number');
  readonly bookingStatus = this.getByTestId('booking-status');
  readonly serviceDetails = this.getByTestId('service-details');
  readonly providerDetails = this.getByTestId('provider-details');
  readonly paymentReceipt = this.getByTestId('payment-receipt');
  readonly viewBookingsButton = this.getByRole('button', /view bookings/i);
  readonly bookAnotherButton = this.getByRole('button', /book another/i);

  async getBookingNumber(): Promise<string> {
    return this.bookingNumber.textContent() || '';
  }

  async viewBookings(): Promise<void> {
    await this.viewBookingsButton.click();
    await this.waitForUrl(/\/bookings/);
  }
}

export class MyBookingsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/bookings');
  }

  readonly bookingTabs = this.getByTestId('booking-tabs');
  readonly upcomingTab = this.page.locator('text=Upcoming');
  readonly pastTab = this.page.locator('text=Past');
  readonly cancelledTab = this.page.locator('text=Cancelled');
  readonly bookingList = this.getByTestId('booking-list');
  readonly bookingItems = this.page.locator('[data-testid^="booking-item-"]');
  readonly emptyState = this.getByTestId('empty-state');

  // Booking item details
  async getBookingStatus(bookingId: string): Promise<string> {
    return this.page.locator(`[data-testid="booking-status-${bookingId}"]`).textContent() || '';
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await this.page.locator(`[data-testid="cancel-button-${bookingId}"]`).click();
    await this.page.locator('[data-testid="confirm-cancel"]').click();
  }

  async viewBookingDetails(bookingId: string): Promise<void> {
    await this.page.locator(`[data-testid="booking-item-${bookingId}"]`).click();
  }
}

export class BookingDetailsPage extends BasePage {
  constructor(page: Page, bookingId?: string) {
    super(page, bookingId ? `/bookings/${bookingId}` : '/bookings/details');
  }

  readonly bookingHeader = this.getByTestId('booking-header');
  readonly statusBadge = this.getByTestId('status-badge');
  readonly serviceInfo = this.getByTestId('service-info');
  readonly providerInfo = this.getByTestId('provider-info');
  readonly customerInfo = this.getByTestId('customer-info');
  readonly locationInfo = this.getByTestId('location-info');
  readonly paymentInfo = this.getByTestId('payment-info');
  readonly timeline = this.getByTestId('booking-timeline');
  readonly actions = this.getByTestId('booking-actions');

  // Action buttons
  readonly cancelButton = this.getByRole('button', /cancel booking/i);
  readonly rescheduleButton = this.getByRole('button', /reschedule/i);
  readonly contactProviderButton = this.getByRole('button', /contact provider/i);
  readonly leaveReviewButton = this.getByRole('button', /leave review/i);

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.locator('[data-testid="confirm-cancel"]').click();
  }

  async reschedule(): Promise<void> {
    await this.rescheduleButton.click();
  }

  async contactProvider(): Promise<void> {
    await this.contactProviderButton.click();
  }

  async leaveReview(): Promise<void> {
    await this.leaveReviewButton.click();
  }
}
