/**
 * SECURE TOKEN STORAGE SERVICE
 *
 * IMPORTANT: This provides better security than sessionStorage/localStorage
 * For production, tokens should be stored in httpOnly cookies by the backend
 * This is a frontend improvement that reduces XSS attack surface
 *
 * Current: sessionStorage (accessible by JS)
 * Production: httpOnly cookies (inaccessible by JS)
 */

import { Capacitor } from '@capacitor/core';

// In-memory storage for tokens (more secure than sessionStorage)
// Tokens are cleared on page refresh
class SecureTokenStorage {
  private memoryStorage: Map<string, string> = new Map();
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  // Get token from memory
  getItem(key: string): string | null {
    return this.memoryStorage.get(key) || null;
  }

  // Store token in memory only
  setItem(key: string, value: string): void {
    this.memoryStorage.set(key, value);
  }

  // Remove token from memory
  removeItem(key: string): void {
    this.memoryStorage.delete(key);
  }

  // Clear all tokens
  clear(): void {
    this.memoryStorage.clear();
  }

  // Check if storage has tokens
  hasTokens(): boolean {
    return this.memoryStorage.size > 0;
  }

  // Get all keys
  keys(): string[] {
    return Array.from(this.memoryStorage.keys());
  }
}

// Singleton instance
export const secureTokenStorage = new SecureTokenStorage();

// Auth state manager that doesn't persist tokens to browser storage
export class SecureAuthState {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: any = null;
  private listeners: Set<() => void> = new Set();

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (token) {
      secureTokenStorage.setItem('access_token', token);
    } else {
      secureTokenStorage.removeItem('access_token');
    }
    this.notifyListeners();
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
    if (token) {
      secureTokenStorage.setItem('refresh_token', token);
    } else {
      secureTokenStorage.removeItem('refresh_token');
    }
    this.notifyListeners();
  }

  getUser(): any {
    return this.user;
  }

  setUser(user: any): void {
    this.user = user;
    this.notifyListeners();
  }

  // Clear all auth state
  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    secureTokenStorage.clear();
    this.notifyListeners();
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.user;
  }

  // Subscribe to auth state changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // Restore tokens from memory (for page refresh scenarios)
  restore(): void {
    this.accessToken = secureTokenStorage.getItem('access_token');
    this.refreshToken = secureTokenStorage.getItem('refresh_token');
  }
}

export const secureAuthState = new SecureAuthState();

export default secureTokenStorage;
