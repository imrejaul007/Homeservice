import { useCallback, useState } from 'react';
import { notificationApi } from '../services/notificationApi';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPushRegistration() {
  const [isRegistering, setIsRegistering] = useState(false);

  const registerWebPush = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    setIsRegistering(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const keyResponse = await notificationApi.getWebPushPublicKey();
      const publicKey = keyResponse.data?.publicKey;
      if (!publicKey) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      await notificationApi.subscribeWebPush(subscription.toJSON() as any);
      return true;
    } catch {
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  const unregisterWebPush = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await notificationApi.unsubscribeWebPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } catch {
      // non-fatal
    }
  }, []);

  return { registerWebPush, unregisterWebPush, isRegistering };
}
