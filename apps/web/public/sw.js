/**
 * ConTigo Service Worker
 * Enables offline functionality and push notifications
 */

const CACHE_NAME = 'contigo-v3';
const OFFLINE_URL = '/offline';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/logo.png',
  '/logo-final.png',
];

// API routes that should be network-first
const API_ROUTES = [
  '/api/',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Cache static assets
      await cache.addAll(STATIC_ASSETS);
      
      // Immediately activate
      await self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      // Take control of all clients
      await self.clients.claim();
    })()
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - network first
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Navigation requests (HTML pages) and Next.js chunks - network first
  // to avoid serving stale HTML that references outdated chunk hashes after rebuilds
  if (request.mode === 'navigate' || url.pathname.startsWith('/_next/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other static assets (images, fonts, icons) - cache first
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Refresh cache in background
    fetchAndCache(request);
    return cachedResponse;
  }

  return fetchAndCache(request);
}

// Network-first strategy
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache on network failure
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    throw error;
  }
}

// Fetch and cache helper
async function fetchAndCache(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  
  const options: NotificationOptions = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data.data,
    },
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ConTigo', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  
  // Handle action clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        // Open the URL
        break;
      case 'dismiss':
        return;
      default:
        break;
    }
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await (client as WindowClient).navigate(url);
          }
          return;
        }
      }

      // Open new window
      await self.clients.openWindow(url);
    })()
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-contracts') {
    event.waitUntil(syncContracts());
  }
});

async function syncContracts(): Promise<void> {
  // Sync any pending contract updates
  const cache = await caches.open('contigo-pending');
  const requests = await cache.keys();

  for (const request of requests) {
    try {
      const cachedResponse = await cache.match(request);
      if (!cachedResponse) continue;

      const body = await cachedResponse.text();
      
      await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      });

      await cache.delete(request);
    } catch (error) {
      console.error('Sync failed for request:', request.url);
    }
  }
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-renewals') {
    event.waitUntil(checkRenewals());
  }
});

async function checkRenewals(): Promise<void> {
  try {
    const response = await fetch('/api/renewals?urgent=true');
    const data = await response.json();

    if (data.urgentCount > 0) {
      await self.registration.showNotification('Contract Renewals', {
        body: `You have ${data.urgentCount} contracts requiring urgent attention`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'renewal-check',
        data: { url: '/renewals' },
      });
    }
  } catch (error) {
    console.error('Failed to check renewals:', error);
  }
}

export {};
