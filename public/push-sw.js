self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "usMoments", body: event.data.text() };
  }

  const {
    title = "usMoments",
    body = "You have a new notification",
    icon = "/pwa-icon-192.png",
    badge = "/pwa-icon-192.png",
    url = "/dashboard",
    tag = "usmoment-notification",
    requireInteraction = false,
    renotify = false,
    vibrate = [200, 100, 200],
    actions = [],
    data = {},
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify,
      requireInteraction,
      vibrate,
      actions,
      data: { url, ...data },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const baseUrl = notificationData.url || "/dashboard";
  const url = new URL(baseUrl, self.location.origin);
  const kind = notificationData.notificationKind;
  const callType = notificationData.callType;

  if (kind === "incoming-call" && callType) {
    if (event.action === "accept-call") {
      url.searchParams.set("callAction", "accept");
      url.searchParams.set("callType", callType);
    } else if (event.action === "decline-call") {
      url.searchParams.set("callAction", "decline");
      url.searchParams.set("callType", callType);
    }
  }

  const targetUrl = url.pathname + url.search + url.hash;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
