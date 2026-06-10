// Booking Configuration
export const BOOKING_CONFIG = {
  // Tax rate (e.g., 0.05 = 5% UAE VAT)
  taxRate: 0.05,

  // Default cancellation window in hours
  cancellationWindowHours: 24,

  // Maximum advance booking days
  maxAdvanceBookingDays: 90,

  // Minimum advance booking hours
  minAdvanceBookingHours: 2,
} as const;

export default BOOKING_CONFIG;
