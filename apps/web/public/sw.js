// NamiVerse Progressive Web App (PWA) Service Worker & Push Receiver
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push Notifications from Mascot Nami
self.addEventListener("push", (event) => {
  let data = {
    title: "🍊 Nami's Broadcast Alert! ⛵",
    body: "Yosh! Episode update available on NamiVerse!",
    icon: "/nami-wano-avatar.jpg",
    badge: "/icons/icon-192x192.png",
    url: "/calendar"
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (_) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/nami-wano-avatar.jpg",
    badge: data.badge || "/icons/icon-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/calendar"
    },
    actions: [
      { action: "open", title: "View Schedule 📅" },
      { action: "dismiss", title: "Dismiss ✕" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click action
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/calendar";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
