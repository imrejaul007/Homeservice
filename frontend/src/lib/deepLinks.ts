/**
 * Deep linking utilities for NILIN app
 * Handles both nilin:// and https://nilin.app URL schemes
 */

export interface DeepLink {
  type: 'service' | 'provider' | 'booking' | 'category' | 'invite';
  id?: string;
  params?: Record<string, string>;
}

/**
 * Parse a deep link URL into a structured DeepLink object
 * Supports both nilin:// and https://nilin.app URL schemes
 *
 * Examples:
 * - nilin://service/123 -> { type: 'service', id: '123' }
 * - https://nilin.app/provider/456 -> { type: 'provider', id: '456' }
 * - https://nilin.app/invite/REFCODE -> { type: 'invite', params: { referralCode: 'REFCODE' } }
 */
export function parseDeepLink(url: string): DeepLink | null {
  try {
    // Handle both nilin:// and https://nilin.app URLs
    let path = url;

    // Remove scheme for nilin:// URLs
    if (url.startsWith('nilin://')) {
      path = url.replace('nilin://', '/');
    }
    // Remove host for https://nilin.app URLs
    else if (url.startsWith('https://nilin.app')) {
      path = url.replace('https://nilin.app', '');
    }
    // Handle web URLs with www.nilin.app
    else if (url.includes('nilin.app')) {
      const match = url.match(/nilin\.app(\/.*)$/);
      if (match) {
        path = match[1];
      }
    }

    // Handle referral/invite codes
    if (path.startsWith('/invite/')) {
      const code = path.split('/invite/')[1]?.split('?')[0];
      return { type: 'invite', params: { referralCode: code } };
    }

    // Handle service links
    if (path.startsWith('/service/')) {
      const id = path.split('/service/')[1]?.split('?')[0];
      return { type: 'service', id };
    }

    // Handle provider links
    if (path.startsWith('/provider/')) {
      const id = path.split('/provider/')[1]?.split('?')[0];
      return { type: 'provider', id };
    }

    // Handle booking links
    if (path.startsWith('/booking/')) {
      const id = path.split('/booking/')[1]?.split('?')[0];
      return { type: 'booking', id };
    }

    // Handle category links
    if (path.startsWith('/category/')) {
      const id = path.split('/category/')[1]?.split('?')[0];
      return { type: 'category', id };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a deep link URL for sharing
 *
 * @param type - The type of deep link (service, provider, booking, category)
 * @param id - Optional ID for the resource
 * @param params - Optional query parameters (e.g., referralCode)
 * @returns A full deep link URL
 *
 * Examples:
 * - generateDeepLink('service', '123') -> 'https://nilin.app/service/123'
 * - generateDeepLink('invite', undefined, { referralCode: 'ABC123' }) -> 'https://nilin.app/invite/ABC123'
 */
export function generateDeepLink(
  type: DeepLink['type'],
  id?: string,
  params?: Record<string, string>
): string {
  let path = '';

  switch (type) {
    case 'service':
      path = `/service/${id}`;
      break;
    case 'provider':
      path = `/provider/${id}`;
      break;
    case 'booking':
      path = `/booking/${id}`;
      break;
    case 'category':
      path = `/category/${id}`;
      break;
    case 'invite':
      path = `/invite/${params?.referralCode || ''}`;
      break;
  }

  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return `https://nilin.app${path}${query}`;
}

/**
 * Map deep link types to app routes
 */
export const DEEP_LINK_ROUTES: Record<DeepLink['type'], string> = {
  service: '/services/:id',
  provider: '/provider/:id',
  booking: '/customer/bookings/:id',
  category: '/category/:slug',
  invite: '/',
};

/**
 * Convert a DeepLink to an app route path
 */
export function deepLinkToRoute(deepLink: DeepLink): string {
  const routeTemplate = DEEP_LINK_ROUTES[deepLink.type];

  if (!routeTemplate || !deepLink.id) {
    return '/';
  }

  return routeTemplate.replace(':id', deepLink.id).replace(':slug', deepLink.id);
}

/**
 * Generate a native app deep link URL (nilin:// scheme)
 * Use this for internal navigation or when nilin:// is preferred
 */
export function generateNativeDeepLink(
  type: DeepLink['type'],
  id?: string,
  params?: Record<string, string>
): string {
  let path = '';

  switch (type) {
    case 'service':
      path = `nilin://service/${id}`;
      break;
    case 'provider':
      path = `nilin://provider/${id}`;
      break;
    case 'booking':
      path = `nilin://booking/${id}`;
      break;
    case 'category':
      path = `nilin://category/${id}`;
      break;
    case 'invite':
      path = `nilin://invite/${params?.referralCode || ''}`;
      break;
  }

  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return `${path}${query}`;
}

/**
 * Check if a URL is a valid deep link
 */
export function isValidDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);
  return parsed !== null;
}

/**
 * Extract referral code from URL if present
 */
export function extractReferralCode(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('ref') || urlObj.searchParams.get('referralCode') || null;
  } catch {
    return null;
  }
}
