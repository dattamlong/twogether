const SAFE_PATH = /^\/[A-Za-z0-9/_?=&%.-]*$/;

function safeUrl(value) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.startsWith("//") || value.length > 200) return "/home";
  const url = new URL(value, self.location.origin);
  return url.origin === self.location.origin ? url.pathname + url.search : "/home";
}

function text(value, max, fallback) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = text(data.title, 120, "TWOGETHER");
  const options = {
    body: text(data.body, 300, "Something sweet is waiting for you 💗"),
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: typeof data.id === "string" ? data.id.slice(0, 64) : undefined,
    data: { url: safeUrl(data.url), id: typeof data.id === "string" ? data.id : null },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeUrl(event.notification.data && event.notification.data.url);
  const id = event.notification.data && event.notification.data.id;
  const destination = id ? `${target}${target.includes("?") ? "&" : "?"}notification=${encodeURIComponent(id)}` : target;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "twogether:navigate", url: destination });
        return;
      }
      await self.clients.openWindow(destination);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription && event.oldSubscription.options;
      if (!options || !options.applicationServerKey) return;
      const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey });
      const json = subscription.toJSON();
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, label: "Renewed subscription" }),
      });
    })(),
  );
});
