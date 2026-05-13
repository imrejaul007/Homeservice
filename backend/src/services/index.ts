// Service Layer Index
// Re-exports for cleaner imports

export { authService, AuthService } from './auth.service';
export { bookingService, BookingService } from './booking.service';
export { providerService, ProviderService } from './provider.service';
export { notificationService, NotificationService } from './notification.service';

// Email service exports
export {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingRequestEmail,
  sendBookingConfirmationEmail,
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendBookingRescheduled,
  sendProviderApproval,
  sendProviderRejection,
} from './email.service';

// Finance service exports
export {
  financeService,
  calculateProviderEarnings,
  calculateProviderEarningsFromBooking,
  calculatePayoutSchedule,
  calculatePlatformFees,
  getProviderPayoutSummary,
  getCommissionConfig,
  getCommissionTiers,
} from './finance';

// Trust & Safety service exports
export {
  trustSafetyService,
  calculateTrustScore,
  getTrustBreakdown,
  updateTrustScore,
  getTrustFactors,
  compareProvidersTrustScores,
  getTopTrustedProviders,
  getTrustThresholds,
} from './trust-safety';

// Marketplace service exports
export {
  marketplaceService,
  calculateSurgeMultiplier,
  getDemandLevel,
  getUpcomingSurges,
  getHighDemandZones,
  calculatePriceWithSurge,
  getSurgeConfiguration,
  clearSurgeCache,
  experimentBucket,
} from './marketplace';
