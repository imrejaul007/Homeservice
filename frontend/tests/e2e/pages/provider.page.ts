/**
 * Page Object: Provider Dashboard Pages
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ProviderDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/provider/dashboard');
  }

  // Dashboard widgets
  readonly statsCards = this.page.locator('[data-testid^="stat-card-"]');
  readonly pendingBookingsCount = this.getByTestId('pending-bookings-count');
  readonly todayBookingsCount = this.getByTestId('today-bookings-count');
  readonly earningsThisMonth = this.getByTestId('earnings-month');
  readonly rating = this.getByTestId('provider-rating');

  // Navigation tabs
  readonly dashboardTab = this.page.locator('text=Dashboard');
  readonly bookingsTab = this.page.locator('text=Bookings');
  readonly servicesTab = this.page.locator('text=Services');
  readonly scheduleTab = this.page.locator('text=Schedule');
  readonly earningsTab = this.page.locator('text=Earnings');
  readonly reviewsTab = this.page.locator('text=Reviews');
  readonly settingsTab = this.page.locator('text=Settings');

  // Quick actions
  readonly acceptBookingButton = this.getByRole('button', /accept/i);
  readonly declineBookingButton = this.getByRole('button', /decline/i);

  // Bookings section
  readonly bookingsList = this.getByTestId('bookings-list');
  readonly pendingBookings = this.page.locator('[data-testid^="pending-booking-"]');
  readonly upcomingBookings = this.page.locator('[data-testid^="upcoming-booking-"]');
  readonly pastBookings = this.page.locator('[data-testid^="past-booking-"]');

  async acceptBooking(bookingId: string): Promise<void> {
    await this.page.locator(`[data-testid="accept-booking-${bookingId}"]`).click();
  }

  async declineBooking(bookingId: string, reason?: string): Promise<void> {
    await this.page.locator(`[data-testid="decline-booking-${bookingId}"]`).click();
    if (reason) {
      await this.page.locator('[data-testid="decline-reason"]').fill(reason);
    }
    await this.page.locator('[data-testid="confirm-decline"]').click();
  }

  async goToBookings(): Promise<void> {
    await this.bookingsTab.click();
    await this.waitForUrl(/\/provider\/bookings/);
  }

  async goToServices(): Promise<void> {
    await this.servicesTab.click();
    await this.waitForUrl(/\/provider\/services/);
  }
}

export class ProviderServicesPage extends BasePage {
  constructor(page: Page) {
    super(page, '/provider/services');
  }

  readonly servicesList = this.getByTestId('services-list');
  readonly serviceCards = this.page.locator('[data-testid^="provider-service-"]');
  readonly addServiceButton = this.getByRole('button', /add service/i);
  readonly editServiceButton = this.getByTestId('edit-service');
  readonly deleteServiceButton = this.getByTestId('delete-service');
  readonly toggleActiveButton = this.getByTestId('toggle-active');

  // Add/Edit service form
  readonly serviceNameInput = this.getByLabel(/service name/i);
  readonly serviceDescription = this.getByLabel(/description/i);
  readonly servicePrice = this.getByLabel(/price/i);
  readonly serviceDuration = this.getByLabel(/duration/i);
  readonly categorySelect = this.getByLabel(/category/i);
  readonly saveButton = this.getByRole('button', /save/i);
  readonly cancelButton = this.getByRole('button', /cancel/i);

  async addService(data: {
    name: string;
    description: string;
    price: number;
    duration: number;
    category: string;
  }): Promise<void> {
    await this.addServiceButton.click();
    await this.serviceNameInput.fill(data.name);
    await this.serviceDescription.fill(data.description);
    await this.servicePrice.fill(data.price.toString());
    await this.serviceDuration.fill(data.duration.toString());
    await this.categorySelect.selectOption(data.category);
    await this.saveButton.click();
  }

  async toggleServiceActive(serviceId: string): Promise<void> {
    await this.page.locator(`[data-testid="toggle-${serviceId}"]`).click();
  }

  async deleteService(serviceId: string): Promise<void> {
    await this.page.locator(`[data-testid="delete-${serviceId}"]`).click();
    await this.page.locator('[data-testid="confirm-delete"]').click();
  }
}

export class ProviderSchedulePage extends BasePage {
  constructor(page: Page) {
    super(page, '/provider/schedule');
  }

  readonly weeklyCalendar = this.getByTestId('weekly-calendar');
  readonly dailyCalendar = this.getByTestId('daily-calendar');
  readonly addAvailabilityButton = this.getByRole('button', /add availability/i);
  readonly timeSlots = this.page.locator('[data-testid^="timeslot-"]');
  readonly bookedSlots = this.page.locator('[data-testid^="booked-"]');

  async addAvailability(data: { day: string; startTime: string; endTime: string }): Promise<void> {
    await this.addAvailabilityButton.click();
    await this.page.locator(`[data-testid="day-${data.day}"]`).click();
    await this.page.locator('[data-testid="start-time"]').fill(data.startTime);
    await this.page.locator('[data-testid="end-time"]').fill(data.endTime);
    await this.page.locator('[data-testid="save-availability"]').click();
  }

  async removeAvailability(slotId: string): Promise<void> {
    await this.page.locator(`[data-testid="remove-${slotId}"]`).click();
  }
}

export class ProviderEarningsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/provider/earnings');
  }

  readonly earningsSummary = this.getByTestId('earnings-summary');
  readonly totalEarnings = this.getByTestId('total-earnings');
  readonly pendingPayout = this.getByTestId('pending-payout');
  readonly completedPayout = this.getByTestId('completed-payout');
  readonly earningsChart = this.getByTestId('earnings-chart');
  readonly transactionsList = this.getByTestId('transactions-list');
  readonly transactionItems = this.page.locator('[data-testid^="transaction-"]');
  readonly requestPayoutButton = this.getByRole('button', /request payout/i);

  async requestPayout(): Promise<void> {
    await this.requestPayoutButton.click();
    await this.page.locator('[data-testid="confirm-payout"]').click();
  }
}

export class ProviderReviewsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/provider/reviews');
  }

  readonly averageRating = this.getByTestId('average-rating');
  readonly ratingBreakdown = this.getByTestId('rating-breakdown');
  readonly reviewsList = this.getByTestId('reviews-list');
  readonly reviewItems = this.page.locator('[data-testid^="review-"]');
  readonly replyButton = this.getByTestId('reply-review');
  readonly filterStars = this.page.locator('[data-testid^="filter-stars-"]');

  async replyToReview(reviewId: string, reply: string): Promise<void> {
    await this.page.locator(`[data-testid="reply-${reviewId}"]`).click();
    await this.page.locator('[data-testid="reply-input"]').fill(reply);
    await this.page.locator('[data-testid="submit-reply"]').click();
  }
}
