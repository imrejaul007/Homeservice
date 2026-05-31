import crypto from 'crypto';

/**
 * Generate a secure cancellation token for guest bookings
 * This token is sent via email and used to authorize cancellation without login
 */
export function generateBookingCancellationToken(bookingId: string, email: string): string {
  const payload = `${bookingId}:${email.toLowerCase()}:${Date.now()}`;
  const secret = process.env.JWT_SECRET || process.env.TOKEN_SECRET || 'default-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Verify a booking cancellation token
 */
export function hashBookingCancellationToken(bookingId: string, email: string): string {
  const payload = `${bookingId}:${email.toLowerCase()}`;
  const secret = process.env.JWT_SECRET || process.env.TOKEN_SECRET || 'default-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Verify a cancellation token against expected value
 */
export function verifyBookingCancellationToken(
  bookingId: string,
  email: string,
  token: string
): boolean {
  const expected = hashBookingCancellationToken(bookingId, email);
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected)
  );
}
