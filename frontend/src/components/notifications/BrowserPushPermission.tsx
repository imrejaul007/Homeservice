/**
 * Browser Push Permission Component
 * UI for requesting and managing browser push notification permissions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Bell, BellOff, Check, X, Loader2, Globe, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface BrowserPushPermissionProps {
  publicKey: string;
  onSubscribe: (subscription: PushSubscriptionJSON) => Promise<void>;
  onUnsubscribe: () => Promise<void>;
  currentSubscription?: PushSubscriptionJSON | null;
  onPermissionRequest?: () => Promise<NotificationPermission>;
  className?: string;
}

export const BrowserPushPermission: React.FC<BrowserPushPermissionProps> = ({
  publicKey,
  onSubscribe,
  onUnsubscribe,
  currentSubscription,
  onPermissionRequest,
  className,
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check current permission state on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!('Notification' in window)) {
        setPermissionState('unsupported');
        return;
      }

      const permission = Notification.permission;
      if (permission === 'granted') {
        setPermissionState('granted');
      } else if (permission === 'denied') {
        setPermissionState('denied');
      } else {
        setPermissionState('default');
      }
    };

    checkPermission();
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let permission: NotificationPermission;

      if (onPermissionRequest) {
        permission = await onPermissionRequest();
      } else {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        setPermissionState('granted');
        // Subscribe to push
        await subscribeToPush();
      } else if (permission === 'denied') {
        setPermissionState('denied');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request permission');
    } finally {
      setIsLoading(false);
    }
  }, [onPermissionRequest]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not supported in this browser');
      return;
    }

    try {
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.ready;

      // Check if service worker is ready
      if (!registration.active) {
        throw new Error('Service worker is not active');
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // Send subscription to server
      await onSubscribe(subscription.toJSON());

      setPermissionState('granted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe to push notifications');
      setPermissionState('denied');
    }
  }, [publicKey, onSubscribe]);

  // Unsubscribe from push notifications
  const handleUnsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (currentSubscription) {
        // Get the actual subscription to unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      await onUnsubscribe();
      setPermissionState('default');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setIsLoading(false);
    }
  }, [currentSubscription, onUnsubscribe]);

  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Render different states
  const renderContent = () => {
    switch (permissionState) {
      case 'unsupported':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Browser Not Supported</h3>
            <p className="text-sm text-gray-600">
              Your browser doesn't support push notifications. Please use a modern browser
              like Chrome, Firefox, or Safari.
            </p>
          </div>
        );

      case 'denied':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Notifications Blocked</h3>
            <p className="text-sm text-gray-600 mb-4">
              Push notifications are blocked for this site. To enable them:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-700">
              <p className="font-medium mb-2">In Chrome/Edge:</p>
              <p className="mb-3">Click the lock icon in the address bar → Notifications → Allow</p>
              <p className="font-medium mb-2">In Firefox:</p>
              <p>Click the site settings icon → Permissions → Notifications → Allow</p>
            </div>
          </div>
        );

      case 'granted':
        return (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Notifications Enabled</h3>
                <p className="text-sm text-gray-600">You're all set to receive updates</p>
              </div>
            </div>

            {currentSubscription && (
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-green-700">
                  Active subscription detected
                </p>
              </div>
            )}

            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className={cn(
                'w-full py-3 px-4 rounded-lg font-medium transition-all',
                'bg-gray-100 text-gray-700 hover:bg-gray-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Disabling...
                </span>
              ) : (
                'Disable Push Notifications'
              )}
            </button>
          </div>
        );

      default:
        return (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#E8B4A8]/20 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#E8B4A8]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Enable Push Notifications</h3>
                <p className="text-sm text-gray-600">Get instant updates in your browser</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#E8B4A8]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-[#E8B4A8]">1</span>
                </div>
                <p className="text-sm text-gray-600">
                  Receive booking updates even when the app is closed
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#E8B4A8]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-[#E8B4A8]">2</span>
                </div>
                <p className="text-sm text-gray-600">
                  Get real-time alerts for service status changes
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#E8B4A8]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-[#E8B4A8]">3</span>
                </div>
                <p className="text-sm text-gray-600">
                  Customize which notifications you want to receive
                </p>
              </div>
            </div>

            <button
              onClick={requestPermission}
              disabled={isLoading}
              className={cn(
                'w-full py-3 px-4 rounded-lg font-medium transition-all',
                'bg-gradient-to-r from-[#E8B4A8] to-[#D4A5A5] text-white',
                'hover:opacity-90 active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enabling...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Bell className="w-4 h-4" />
                  Enable Browser Notifications
                </span>
              )}
            </button>
          </div>
        );
    }
  };

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#E8B4A8] to-[#D4A5A5] p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Browser Push</h3>
            <p className="text-white/80 text-sm">Desktop notifications</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
};

export default BrowserPushPermission;
