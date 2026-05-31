/// <reference lib="webworker" />

const CACHE_NAME = 'nilin-v1';
const STATIC_CACHE = 'nilin-static-v1';
const DYNAMIC_CACHE = 'nilin-dynamic-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// Install event - precache assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  (self as any).skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  (self as any).clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests
  if (url.pathname.startsWith('/api')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Skip external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // For HTML pages, use network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // For static assets, use cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Network-first strategy
async function networkFirst(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    return new Response('Offline', { status: 503 });
  }
}

// Cache-first strategy
async function cacheFirst(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// ============================================================
// PUSH NOTIFICATION HANDLING
// ============================================================

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  image?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: {
    notificationId?: string;
    bookingId?: string;
    type?: string;
    [key: string]: any;
  };
  vibrate?: number[];
  requireInteraction?: boolean;
  silent?: boolean;
}

// Default notification options
const DEFAULT_OPTIONS = {
  icon: '/icons/icon-192x192.png',
  badge: '/icons/badge-72x72.png',
  vibrate: [100, 50, 100],
  requireInteraction: false,
  silent: false,
};

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push event received');

  let payload: NotificationPayload;

  try {
    if (event.data) {
      payload = event.data.json();
    } else {
      // Fallback for plain text push
      payload = {
        title: 'NILIN',
        body: 'You have a new notification',
      };
    }
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
    payload = {
      title: 'NILIN',
      body: 'You have a new notification',
    };
  }

  // Don't show notification if silent
  if (payload.silent) {
    console.log('[SW] Silent push, skipping notification');
    // Still update badge count
    event.waitUntil(updateBadgeCount());
    return;
  }

  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || DEFAULT_OPTIONS.icon,
    badge: payload.badge || DEFAULT_OPTIONS.badge,
    tag: payload.tag || 'default',
    data: {
      ...payload.data,
      url: payload.url || '/',
      dateOfArrival: Date.now(),
      notificationId: payload.data?.notificationId,
      bookingId: payload.data?.bookingId,
      type: payload.type || 'notification',
    },
    actions: payload.actions || getDefaultActions(payload.data?.type),
    vibrate: payload.vibrate || DEFAULT_OPTIONS.vibrate,
    requireInteraction: payload.requireInteraction ?? DEFAULT_OPTIONS.requireInteraction,
    silent: payload.silent ?? DEFAULT_OPTIONS.silent,
  };

  // Add image if provided
  if (payload.image) {
    (options as any).image = payload.image;
  }

  // Add badge count
  event.waitUntil(
    updateBadgeCount().then(() => {
      return self.registration.showNotification(payload.title || 'NILIN', options);
    })
  );
});

// Get default actions based on notification type
function getDefaultActions(type?: string): Array<{ action: string; title: string; icon?: string }> {
  const baseActions = [
    { action: 'view', title: 'View', icon: '/icons/view.png' },
    { action: 'dismiss', title: 'Dismiss', icon: '/icons/close.png' },
  ];

  switch (type) {
    case 'booking':
      return [
        { action: 'view', title: 'View Booking', icon: '/icons/view.png' },
        { action: 'accept', title: 'Accept', icon: '/icons/check.png' },
        { action: 'decline', title: 'Decline', icon: '/icons/close.png' },
      ];
    case 'payment':
      return [
        { action: 'view', title: 'View Payment', icon: '/icons/view.png' },
        { action: 'receipt', title: 'Receipt', icon: '/icons/document.png' },
      ];
    case 'message':
      return [
        { action: 'reply', title: 'Reply', icon: '/icons/reply.png' },
        { action: 'view', title: 'View', icon: '/icons/view.png' },
      ];
    case 'review':
      return [
        { action: 'view', title: 'View Review', icon: '/icons/view.png' },
        { action: 'reply', title: 'Reply', icon: '/icons/reply.png' },
      ];
    default:
      return baseActions;
  }
}

// Update badge count
async function updateBadgeCount(): Promise<void> {
  try {
    // Get unread count from IndexedDB or cache
    const unreadCount = await getUnreadCount();

    // Set badge count
    if ('setAppBadge' in navigator) {
      // Use App Badge API if available
      await (navigator as any).setAppBadge(unreadCount);
    } else {
      // For browsers that don't support App Badge API
      // Update badge icon using the browser's badge mechanism
      if (self.registration) {
        // Update the badge for the app
        await self.registration.update();
      }
    }

    console.log('[SW] Badge count updated:', unreadCount);
  } catch (error) {
    console.error('[SW] Error updating badge count:', error);
  }
}

// Get unread notification count (from IndexedDB or cache)
async function getUnreadCount(): Promise<number> {
  // Try to get from cache first
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = await cache.match('/api/notifications/unread-count');
    if (response) {
      const data = await response.json();
      return data.data?.count || 0;
    }
  } catch (error) {
    console.log('[SW] Could not get unread count from cache');
  }

  // Try to get from IndexedDB
  try {
    const db = await openNotificationDB();
    const count = await getUnreadCountFromDB(db);
    return count;
  } catch (error) {
    console.log('[SW] Could not get unread count from IndexedDB');
  }

  return 0;
}

// IndexedDB helpers for notification storage
function openNotificationDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NILINNotifications', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id' });
        store.createIndex('isRead', 'isRead', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
}

function getUnreadCountFromDB(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const index = store.index('isRead');
    const request = index.count(IDBKeyRange.only(false));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ============================================================
// NOTIFICATION CLICK HANDLING
// ============================================================

interface NotificationClickData {
  action?: string;
  notification?: Notification;
  url?: string;
}

// Handle notification click
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification click:', event.action);

  event.notification.close();

  const data = event.notification.data as NotificationClickData;
  let targetUrl = data?.url || '/';

  // Handle action-specific URLs
  switch (event.action) {
    case 'view':
    case 'open':
      // Default view action
      break;
    case 'accept':
      targetUrl = data?.url || `/bookings/${data?.bookingId || ''}/accept`;
      break;
    case 'decline':
      targetUrl = `/bookings/${data?.bookingId || ''}`;
      break;
    case 'reply':
      targetUrl = `/messages/${data?.bookingId || ''}`;
      break;
    case 'receipt':
      targetUrl = `/payments/${data?.notificationId || ''}`;
      break;
    case 'dismiss':
      // Just close, don't navigate
      return;
    default:
      // Check notification type for default action
      if (data?.type === 'booking' && data?.bookingId) {
        targetUrl = `/bookings/${data.bookingId}`;
      } else if (data?.type === 'payment' && data?.notificationId) {
        targetUrl = `/payments/${data.notificationId}`;
      }
  }

  // Ensure targetUrl is valid
  if (!targetUrl || targetUrl === '') {
    targetUrl = '/';
  }

  console.log('[SW] Navigating to:', targetUrl);

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the URL in the existing client
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      // Open a new window if none exists
      if ((self as any).clients.openWindow) {
        return (self as any).clients.openWindow(targetUrl);
      }
    })
  );
});

// ============================================================
// NOTIFICATION CLOSE HANDLING
// ============================================================

self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('[SW] Notification closed:', event.notification.tag);

  // Track notification close for analytics
  const data = event.notification.data;
  if (data?.notificationId) {
    event.waitUntil(
      trackNotificationEvent('close', data.notificationId).catch((err) => {
        console.error('[SW] Error tracking notification close:', err);
      })
    );
  }
});

// ============================================================
// BACKGROUND SYNC
// ============================================================

interface NotificationSyncData {
  type: 'mark-read' | 'mark-all-read' | 'delete' | 'dismiss';
  notificationId?: string;
  timestamp: number;
}

// Register background sync for offline actions
self.addEventListener('sync', (event: SyncEvent) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  } else if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  }
});

// Sync notifications when back online
async function syncNotifications(): Promise<void> {
  console.log('[SW] Syncing notifications...');

  try {
    const db = await openNotificationDB();
    const pendingActions = await getPendingActions(db);

    for (const action of pendingActions) {
      try {
        await processNotificationAction(action);
        await removePendingAction(db, action.id!);
        console.log('[SW] Synced action:', action.type);
      } catch (error) {
        console.error('[SW] Error syncing action:', action.type, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in notification sync:', error);
  }
}

function getPendingActions(db: IDBDatabase): Promise<NotificationSyncData[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingActions'], 'readonly');
    const store = transaction.objectStore('pendingActions');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

function removePendingAction(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function processNotificationAction(action: NotificationSyncData): Promise<void> {
  const baseUrl = self.location.origin;
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  switch (action.type) {
    case 'mark-read':
      await fetch(`${baseUrl}/api/notifications/${action.notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      break;

    case 'mark-all-read':
      await fetch(`${baseUrl}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      break;

    case 'delete':
      await fetch(`${baseUrl}/api/notifications/${action.notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      break;
  }
}

async function getAuthToken(): Promise<string | null> {
  // Try to get token from cache or IndexedDB
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = await cache.match('/auth/token');
    if (response) {
      const data = await response.json();
      return data.token;
    }
  } catch (error) {
    console.log('[SW] Could not get auth token from cache');
  }
  return null;
}

// Background sync for offline bookings
async function syncBookings(): Promise<void> {
  console.log('[SW] Syncing offline bookings...');
  // Implementation for syncing offline bookings
}

// ============================================================
// ANALYTICS
// ============================================================

async function trackNotificationEvent(
  event: 'impression' | 'click' | 'close' | 'action',
  notificationId: string,
  actionType?: string
): Promise<void> {
  try {
    const baseUrl = self.location.origin;
    const token = await getAuthToken();

    if (!token) {
      console.log('[SW] Not authenticated, skipping analytics');
      return;
    }

    await fetch(`${baseUrl}/api/notifications/analytics/event`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        event,
        actionType,
        timestamp: new Date().toISOString(),
        userAgent: self.navigator.userAgent,
      }),
    });

    console.log('[SW] Analytics tracked:', event, notificationId);
  } catch (error) {
    console.error('[SW] Error tracking analytics:', error);
  }
}

// ============================================================
// MESSAGE HANDLING
// ============================================================

self.addEventListener('message', (event: MessageEvent) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      (self as any).skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((names) =>
          Promise.all(names.map((name) => caches.delete(name)))
        )
      );
      break;

    case 'UPDATE_BADGE':
      updateBadgeCount().catch((err) => {
        console.error('[SW] Error updating badge:', err);
      });
      break;

    case 'SHOW_NOTIFICATION':
      if (payload) {
        self.registration.showNotification(payload.title, payload.options);
      }
      break;

    case 'CLEAR_NOTIFICATIONS':
      event.waitUntil(
        self.registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => notification.close());
        })
      );
      break;

    case 'GET_UNREAD_COUNT':
      event.ports[0]?.postMessage({ count: 0 }); // Placeholder
      updateBadgeCount().then((count) => {
        event.ports[0]?.postMessage({ count });
      });
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// ============================================================
// PERIODIC BACKGROUND SYNC (if supported)
// ============================================================

self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

export {};
