/* Recalibrate service worker: offline app shell + push notifications. */
const CACHE = "recalibrate-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Pages: network first (so updates arrive), cached copy when offline.
// Built assets have hashed names, so they are cached on first use.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); }
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

// A scheduled reminder arrives from Supabase.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Recalibrate", body: event.data && event.data.text() }; }
  const actions =
    d.kind === "mid" ? [{ action: "on", title: "On it" }, { action: "check", title: "Doing something else" }]
    : d.kind === "end" ? [{ action: "log", title: "Log it" }]
    : [];
  event.waitUntil(
    self.registration.showNotification(d.title || "Recalibrate", {
      body: d.body || "",
      tag: d.tag,
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: d.url || "./", kind: d.kind },
      actions,
      requireInteraction: d.kind === "end",
    }),
  );
});

// Tapping a notification opens the app on the right panel.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || "./", self.registration.scope);
  const action = event.action || (data.kind === "mid" ? "check" : data.kind === "end" ? "log" : "");
  if (action) url.searchParams.set("do", action);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.registration.scope) && "focus" in w) {
          return w.navigate(url.href).then((c) => (c || w).focus());
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
