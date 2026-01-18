/**
 * Service Worker for Push Notifications
 * 
 * Handles background push notifications and click actions.
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Install event
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification received
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon || "/icons/notification-icon.png",
      badge: data.badge || "/icons/notification-badge.png",
      image: data.image,
      data: data.data,
      tag: data.tag || `notification-${Date.now()}`,
      renotify: true,
      requireInteraction: data.priority === "high" || data.priority === "urgent",
      actions: data.actions || [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
      vibrate: data.priority === "urgent" ? [200, 100, 200] : [100],
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error("[Service Worker] Push notification error:", error);
  }
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === "dismiss") {
    return;
  }

  // Default action or "view" action
  const urlToOpen = data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            payload: { url: urlToOpen, data },
          });
          return client.focus();
        }
      }
      
      // Open new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close
self.addEventListener("notificationclose", (event) => {
  // Track notification dismissal if needed
  const data = event.notification.data;
  
  // Could send analytics event here
  console.log("[Service Worker] Notification closed:", data?.id);
});

// Background sync for offline notifications
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-notifications") {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications(): Promise<void> {
  try {
    // Sync any pending notification actions
    const cache = await caches.open("notification-actions");
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        await fetch(request);
        await cache.delete(request);
      } catch {
        // Will retry on next sync
      }
    }
  } catch (error) {
    console.error("[Service Worker] Sync error:", error);
  }
}

// Message handler for communication with main thread
self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
      
    case "GET_SUBSCRIPTION":
      self.registration.pushManager.getSubscription().then((subscription) => {
        event.ports[0]?.postMessage({ subscription: subscription?.toJSON() });
      });
      break;
      
    case "SHOW_NOTIFICATION":
      self.registration.showNotification(payload.title, payload.options);
      break;
  }
});

export {};
