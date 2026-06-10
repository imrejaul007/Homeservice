// Social Sharing Service - Handles all sharing operations with fallbacks
import { analytics } from '../product/AnalyticsService';
import { api as apiClient } from '../api';

export interface ShareData {
  title: string;
  text?: string;
  url: string;
  image?: string;
  itemType?: 'service' | 'package' | 'provider' | 'experience' | 'page';
  itemId?: string;
}

export type SharePlatform = 'whatsapp' | 'facebook' | 'twitter' | 'linkedin' | 'email' | 'sms' | 'copy' | 'native';

export interface ShareResult {
  success: boolean;
  platform?: SharePlatform;
  error?: string;
}

// Track share event on backend
async function trackShareOnBackend(
  platform: string,
  itemType: string,
  itemId: string
): Promise<void> {
  try {
    await apiClient.post('/share/track', {
      itemType,
      itemId,
      platform,
    });
  } catch (error) {
    // Don't fail the share if tracking fails
    console.debug('Failed to track share on backend:', error);
  }
}

// Get the current URL with any tracking parameters
function getShareUrl(url: string, platform?: SharePlatform): string {
  // Add UTM parameters for tracking
  const baseUrl = new URL(url, window.location.origin);
  baseUrl.searchParams.set('utm_source', platform || 'direct');
  baseUrl.searchParams.set('utm_medium', 'share');
  baseUrl.searchParams.set('utm_campaign', 'social_share');
  return baseUrl.toString();
}

// Build share message
export function buildShareMessage(title: string, text?: string): string {
  const parts = [];
  if (text) parts.push(text);
  parts.push(`Check out: ${title}`);
  return parts.join('\n\n');
}

// Check if native share is supported
export function isNativeShareSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
}

// Native share API
export async function nativeShare(data: ShareData): Promise<ShareResult> {
  if (!isNativeShareSupported()) {
    return { success: false, error: 'Native share not supported' };
  }

  const shareData: ShareData = {
    title: data.title,
    text: data.text,
    url: getShareUrl(data.url, 'native'),
  };

  // Check if data can be shared
  if (!navigator.canShare(shareData)) {
    return { success: false, error: 'Cannot share this content' };
  }

  try {
    await navigator.share(shareData);
    analytics.trackShareEvent('native_share', data.title);
    if (data.itemType && data.itemId) {
      trackShareOnBackend('native_share', data.itemType, data.itemId);
    }
    return { success: true, platform: 'native' };
  } catch (error: any) {
    // User cancelled or share failed
    if (error.name === 'AbortError') {
      return { success: false, error: 'Share cancelled' };
    }
    return { success: false, error: error.message };
  }
}

// WhatsApp sharing
export function shareToWhatsApp(title: string, text: string, url: string, data?: ShareData): void {
  const shareUrl = getShareUrl(url, 'whatsapp');
  const message = `${text}\n\n${shareUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank', 'width=600,height=400');
  analytics.trackShareEvent('whatsapp', title);
  if (data?.itemType && data?.itemId) {
    trackShareOnBackend('whatsapp', data.itemType, data.itemId);
  }
}

// Facebook sharing
export function shareToFacebook(title: string, url: string, data?: ShareData): void {
  const shareUrl = getShareUrl(url, 'facebook');
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  window.open(facebookUrl, '_blank', 'width=600,height=400');
  analytics.trackShareEvent('facebook', title);
  if (data?.itemType && data?.itemId) {
    trackShareOnBackend('facebook', data.itemType, data.itemId);
  }
}

// Twitter/X sharing
export function shareToTwitter(title: string, text: string, url: string, data?: ShareData): void {
  const shareUrl = getShareUrl(url, 'twitter');
  const tweetText = `${text} ${shareUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  window.open(twitterUrl, '_blank', 'width=600,height=400');
  analytics.trackShareEvent('twitter', title);
  if (data?.itemType && data?.itemId) {
    trackShareOnBackend('twitter', data.itemType, data.itemId);
  }
}

// LinkedIn sharing
export function shareToLinkedIn(title: string, url: string, data?: ShareData): void {
  const shareUrl = getShareUrl(url, 'linkedin');
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  window.open(linkedinUrl, '_blank', 'width=600,height=400');
  analytics.trackShareEvent('linkedin', title);
  if (data?.itemType && data?.itemId) {
    trackShareOnBackend('linkedin', data.itemType, data.itemId);
  }
}

// Email sharing
export function shareViaEmail(title: string, text: string, url: string, data?: ShareData): void {
  const shareUrl = getShareUrl(url, 'email');
  const subject = `Check out: ${title}`;
  const body = `${text}\n\nLink: ${shareUrl}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
  analytics.trackShareEvent('email', title);
  if (data?.itemType && data?.itemId) {
    trackShareOnBackend('email', data.itemType, data.itemId);
  }
}

// SMS sharing
export function shareViaSMS(title: string, url: string, data?: ShareData): void {
  const shareUrl = getShareUrl(url, 'sms');
  const message = `Check out: ${title} - ${shareUrl}`;
  const smsUrl = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? `sms:?body=${encodeURIComponent(message)}`
    : `sms:${message}`;
  window.open(smsUrl, '_self');
  analytics.trackShareEvent('sms', title);
  if (data?.itemType && data?.itemId) {
    trackShareOnBackend('sms', data.itemType, data.itemId);
  }
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

// Share to platform
export async function shareToPlatform(
  platform: SharePlatform,
  data: ShareData
): Promise<ShareResult> {
  const { title, text, url, itemType, itemId } = data;
  const shareText = text || title;
  const shareUrl = getShareUrl(url, platform);

  // Track on backend if item info is available
  if (itemType && itemId) {
    trackShareOnBackend(platform, itemType, itemId);
  }

  try {
    switch (platform) {
      case 'native':
        return await nativeShare(data);

      case 'whatsapp':
        shareToWhatsApp(title, shareText, url, data);
        return { success: true, platform: 'whatsapp' };

      case 'facebook':
        shareToFacebook(title, url, data);
        return { success: true, platform: 'facebook' };

      case 'twitter':
        shareToTwitter(title, shareText, url, data);
        return { success: true, platform: 'twitter' };

      case 'linkedin':
        shareToLinkedIn(title, url, data);
        return { success: true, platform: 'linkedin' };

      case 'email':
        shareViaEmail(title, shareText, url, data);
        return { success: true, platform: 'email' };

      case 'sms':
        shareViaSMS(title, url, data);
        return { success: true, platform: 'sms' };

      case 'copy':
        const success = await copyToClipboard(shareUrl);
        if (success) {
          analytics.trackShareEvent('copy_link', title);
          if (itemType && itemId) {
            trackShareOnBackend('copy', itemType, itemId);
          }
          return { success: true, platform: 'copy' };
        }
        return { success: false, error: 'Failed to copy to clipboard' };

      default:
        return { success: false, error: 'Unknown platform' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get all available platforms
export function getAvailablePlatforms(): SharePlatform[] {
  const platforms: SharePlatform[] = ['whatsapp', 'sms', 'email', 'copy'];

  // Add Facebook and Twitter (always available via web intents)
  if (typeof window !== 'undefined') {
    platforms.push('facebook', 'twitter');
  }

  // Add LinkedIn
  platforms.push('linkedin');

  return platforms;
}
