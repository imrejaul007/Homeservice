import DOMPurify from 'dompurify';

/**
 * DOMPurify configuration for XSS protection
 */
DOMPurify.setConfig({
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'hr',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'alt', 'src',
    'class', 'id', 'style',
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
});

/**
 * Sanitize HTML string to prevent XSS
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    RETURN_TRUSTED_TYPE: false,
  });
};

/**
 * Sanitize and return HTML with allowed formatting only
 */
export const sanitizeText = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
export const sanitizeUrl = (url: string): string => {
  const sanitized = DOMPurify.sanitize(url, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  // Additional URL validation
  if (sanitized.startsWith('javascript:') || sanitized.startsWith('data:')) {
    return '#';
  }

  return sanitized;
};

/**
 * Escape HTML entities for safe display
 */
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Generate a random secure string
 */
export const generateSecureId = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Secure token storage (uses sessionStorage as fallback)
 */
export const secureStorage = {
  setItem: (key: string, value: string): void => {
    try {
      // Try to use sessionStorage
      sessionStorage.setItem(key, value);
    } catch {
      // Fallback to memory storage
      (window as any).__secureStorage = (window as any).__secureStorage || {};
      (window as any).__secureStorage[key] = value;
    }
  },

  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      const storage = (window as any).__secureStorage || {};
      return storage[key] || null;
    }
  },

  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      const storage = (window as any).__secureStorage || {};
      delete storage[key];
    }
  },

  clear: (): void => {
    try {
      sessionStorage.clear();
    } catch {
      (window as any).__secureStorage = {};
    }
  },
};

/**
 * Check if running on localhost or HTTPS
 */
export const isSecureContext = (): boolean => {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'https:'
  );
};

/**
 * Detect if user is likely a bot
 */
export const detectBot = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper',
    'headless', 'phantom', 'selenium', 'puppeteer',
  ];

  return botPatterns.some((pattern) => userAgent.includes(pattern));
};

/**
 * Content Security Policy violation handler
 */
export const handleCSPViolation = (event: SecurityPolicyViolationEvent): void => {
  console.error('CSP Violation:', {
    blockedURI: event.blockedURI,
    violatedDirective: event.violatedDirective,
    originalPolicy: event.originalPolicy,
  });

  // Report to monitoring service (e.g., Sentry)
  if (import.meta.env.PROD) {
    // Sentry.captureMessage('CSP Violation', {
    //   extra: {
    //     blockedURI: event.blockedURI,
    //     violatedDirective: event.violatedDirective,
    //   },
    // });
  }
};

// Initialize CSP violation listener
if (typeof document !== 'undefined') {
  document.addEventListener('securitypolicyviolation', handleCSPViolation as EventListener);
}

export default {
  sanitizeHtml,
  sanitizeText,
  sanitizeUrl,
  escapeHtml,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  validatePassword,
  generateSecureId,
  secureStorage,
  isSecureContext,
  detectBot,
};
