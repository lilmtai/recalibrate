/* Recalibrate service worker: offline app shell + push notifications. */
const CACHE = "recalibrate-v3";
// answers given straight from a notification, applied by the app when it next runs
const PENDING = "recalibrate-pending";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PENDING).map((k) => caches.delete(k))))
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
  // one-tap answers: the first button never opens the app
  const actions =
    d.kind === "start" ? [{ action: "on", title: "I'm on it" }, { action: "check", title: "Not doing it" }]
    : d.kind === "mid" ? [{ action: "on", title: "Still on it" }, { action: "check", title: "Doing something else" }]
    : d.kind === "end" ? [{ action: "done", title: "Done" }, { action: "log", title: "Not done" }]
    : [];
  event.waitUntil(
    self.registration.showNotification(d.title || "Recalibrate", {
      body: d.body || "",
      tag: d.tag,
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: d.url || "./", kind: d.kind },
      actions,
      requireInteraction: d.kind === "end" || d.kind === "mid",
    }),
  );
});

// Save a one-tap answer for the app and tell any open window right away.
async function remember(action, url) {
  const answer = { act: action, task: url.searchParams.get("task"), date: url.searchParams.get("date"), at: Date.now() };
  const cache = await caches.open(PENDING);
  await cache.put(new Request(`pending/${answer.at}-${Math.random().toString(36).slice(2, 8)}`), new Response(JSON.stringify(answer)));
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  wins.forEach((w) => w.postMessage({ type: "pending-answers" }));
}

// Notification buttons and taps.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || "./", self.registration.scope);
  // "I'm on it" / "Still on it" / "Done": log it quietly, don't open the app
  if (event.action === "on" || event.action === "done") {
    event.waitUntil(remember(event.action, url));
    return;
  }
  // a tap on the notification itself (iPhone has no buttons): open a one-tap question
  const action = event.action || (data.kind === "start" || data.kind === "mid" || data.kind === "end" ? "ask" : "");
  if (action) url.searchParams.set("do", action);
  if (data.kind) url.searchParams.set("kind", data.kind);
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
