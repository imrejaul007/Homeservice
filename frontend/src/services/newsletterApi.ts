import axios from 'axios';
import { getApiUrl } from '../lib/getApiUrl';

const API_URL = getApiUrl();

// ============================================
// Types
// ============================================

export interface NewsletterSubscribePayload {
  email: string;
  source?: string;
}

export interface NewsletterSubscribeResult {
  success: boolean;
  message: string;
  email?: string;
  alreadySubscribed?: boolean;
  reactivated?: boolean;
}

export interface NewsletterUnsubscribePayload {
  email: string;
  token?: string;
}

export interface NewsletterCheckResult {
  subscribed: boolean;
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained' | null;
  subscribedAt?: string;
  emailVerified?: boolean;
}

export interface NewsletterStats {
  total: number;
  unsubscribed: number;
  bounced: number;
  verified: number;
  unverified: number;
  growth: {
    newLast30Days: number;
    unsubscribedLast30Days: number;
    netGrowth: number;
  };
}

// ============================================
// API Functions
// ============================================

/**
 * Subscribe to newsletter
 * @param email - Email address to subscribe
 * @param source - Source of subscription (e.g., 'footer', 'landing_page')
 */
export async function subscribeToNewsletter(
  email: string,
  source: string = 'footer'
): Promise<NewsletterSubscribeResult> {
  const response = await axios.post<{ success: boolean; message: string; email?: string; alreadySubscribed?: boolean; reactivated?: boolean }>(
    `${API_URL}/newsletter/subscribe`,
    { email, source },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    success: response.data.success,
    message: response.data.message,
    email: response.data.email,
    alreadySubscribed: response.data.alreadySubscribed,
    reactivated: response.data.reactivated,
  };
}

/**
 * Unsubscribe from newsletter
 * @param email - Email address to unsubscribe
 * @param token - Optional unsubscribe token for verification
 */
export async function unsubscribeFromNewsletter(
  email: string,
  token?: string
): Promise<{ success: boolean; message: string }> {
  const response = await axios.post<{ success: boolean; message: string }>(
    `${API_URL}/newsletter/unsubscribe`,
    { email, token },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    success: response.data.success,
    message: response.data.message,
  };
}

/**
 * Check newsletter subscription status
 * @param email - Email address to check
 */
export async function checkNewsletterStatus(
  email: string
): Promise<NewsletterCheckResult> {
  const response = await axios.get<NewsletterCheckResult>(
    `${API_URL}/newsletter/check`,
    {
      timeout: 10000,
      params: { email },
    }
  );

  return response.data;
}

/**
 * Get newsletter statistics (admin only)
 */
export async function getNewsletterStats(): Promise<NewsletterStats> {
  const response = await axios.get<NewsletterStats>(
    `${API_URL}/newsletter/stats`,
    {
      timeout: 15000,
      withCredentials: true,
    }
  );

  return response.data;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get the verification URL for a token
 */
export function getVerificationUrl(token: string): string {
  return `${window.location.origin}/newsletter/verify/${token}`;
}

/**
 * Get the unsubscribe URL for a token
 */
export function getUnsubscribeUrl(token: string): string {
  return `${window.location.origin}/newsletter/unsubscribe?token=${token}`;
}