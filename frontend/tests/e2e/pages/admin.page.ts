/**
 * Page Object: Admin Dashboard Pages
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AdminDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/admin/dashboard');
  }

  // Dashboard stats
  readonly statsCards = this.page.locator('[data-testid^="admin-stat-"]');
  readonly totalUsers = this.getByTestId('total-users');
  readonly totalBookings = this.getByTestId('total-bookings');
  readonly totalRevenue = this.getByTestId('total-revenue');
  readonly activeProviders = this.getByTestId('active-providers');

  // Navigation
  readonly overviewTab = this.page.locator('text=Overview');
  readonly usersTab = this.page.locator('text=Users');
  readonly providersTab = this.page.locator('text=Providers');
  readonly bookingsTab = this.page.locator('text=Bookings');
  readonly servicesTab = this.page.locator('text=Services');
  readonly offersTab = this.page.locator('text=Offers');
  readonly reportsTab = this.page.locator('text=Reports');
  readonly settingsTab = this.page.locator('text=Settings');
}

export class AdminUsersPage extends BasePage {
  constructor(page: Page) {
    super(page, '/admin/users');
  }

  readonly userSearch = this.getByPlaceholder(/search users/i);
  readonly userTable = this.getByTestId('users-table');
  readonly userRows = this.page.locator('[data-testid^="user-row-"]');
  readonly addUserButton = this.getByRole('button', /add user/i);

  async searchUser(query: string): Promise<void> {
    await this.userSearch.fill(query);
    await this.page.waitForTimeout(500);
  }

  async viewUser(userId: string): Promise<void> {
    await this.page.locator(`[data-testid="view-user-${userId}"]`).click();
  }

  async suspendUser(userId: string): Promise<void> {
    await this.page.locator(`[data-testid="suspend-user-${userId}"]`).click();
    await this.page.locator('[data-testid="confirm-suspend"]').click();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.page.locator(`[data-testid="delete-user-${userId}"]`).click();
    await this.page.locator('[data-testid="confirm-delete"]').click();
  }
}

export class AdminProvidersPage extends BasePage {
  constructor(page: Page) {
    super(page, '/admin/providers');
  }

  readonly providerSearch = this.getByPlaceholder(/search providers/i);
  readonly statusFilter = this.getByTestId('provider-status-filter');
  readonly providersTable = this.getByTestId('providers-table');
  readonly pendingApproval = this.page.locator('[data-testid^="pending-provider-"]');

  async approveProvider(providerId: string): Promise<void> {
    await this.page.locator(`[data-testid="approve-provider-${providerId}"]`).click();
    await this.page.locator('[data-testid="confirm-approve"]').click();
  }

  async rejectProvider(providerId: string, reason: string): Promise<void> {
    await this.page.locator(`[data-testid="reject-provider-${providerId}"]`).click();
    await this.page.locator('[data-testid="reject-reason"]').fill(reason);
    await this.page.locator('[data-testid="confirm-reject"]').click();
  }
}

export class AdminBookingsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/admin/bookings');
  }

  readonly bookingSearch = this.getByPlaceholder(/search bookings/i);
  readonly statusFilter = this.getByTestId('booking-status-filter');
  readonly bookingsTable = this.getByTestId('bookings-table');
  readonly bookingRows = this.page.locator('[data-testid^="booking-row-"]');

  async viewBooking(bookingId: string): Promise<void> {
    await this.page.locator(`[data-testid="view-booking-${bookingId}"]`).click();
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await this.page.locator(`[data-testid="cancel-booking-${bookingId}"]`).click();
    await this.page.locator('[data-testid="confirm-cancel"]').click();
  }
}

export class AdminOffersPage extends BasePage {
  constructor(page: Page) {
    super(page, '/admin/offers');
  }

  readonly offersList = this.getByTestId('offers-list');
  readonly addOfferButton = this.getByRole('button', /add offer/i);
  readonly editOfferButton = this.getByTestId('edit-offer');
  readonly toggleOfferButton = this.getByTestId('toggle-offer');

  // Offer form
  readonly offerCode = this.getByLabel(/offer code/i);
  readonly discountType = this.getByLabel(/discount type/i);
  readonly discountValue = this.getByLabel(/discount value/i);
  readonly minOrderValue = this.getByLabel(/minimum order/i);
  readonly maxUses = this.getByLabel(/maximum uses/i);
  readonly validFrom = this.getByLabel(/valid from/i);
  readonly validUntil = this.getByLabel(/valid until/i);
  readonly saveButton = this.getByRole('button', /save/i);

  async createOffer(data: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minOrder?: number;
    maxUses?: number;
    validFrom: string;
    validUntil: string;
  }): Promise<void> {
    await this.addOfferButton.click();
    await this.offerCode.fill(data.code);
    await this.discountType.selectOption(data.discountType);
    await this.discountValue.fill(data.discountValue.toString());
    if (data.minOrder) {
      await this.minOrderValue.fill(data.minOrder.toString());
    }
    if (data.maxUses) {
      await this.maxUses.fill(data.maxUses.toString());
    }
    await this.validFrom.fill(data.validFrom);
    await this.validUntil.fill(data.validUntil);
    await this.saveButton.click();
  }
}

export class AdminReportsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/admin/reports');
  }

  readonly dateRangePicker = this.getByTestId('date-range');
  readonly reportType = this.getByTestId('report-type');
  readonly generateButton = this.getByRole('button', /generate report/i);
  readonly exportButton = this.getByRole('button', /export/i);
  readonly reportTable = this.getByTestId('report-table');
  readonly downloadLink = this.getByTestId('download-report');

  async generateReport(type: string, startDate: string, endDate: string): Promise<void> {
    await this.reportType.selectOption(type);
    await this.dateRangePicker.locator('[data-testid="start-date"]').fill(startDate);
    await this.dateRangePicker.locator('[data-testid="end-date"]').fill(endDate);
    await this.generateButton.click();
  }
}
