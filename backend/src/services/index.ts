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
} from './email.service';
