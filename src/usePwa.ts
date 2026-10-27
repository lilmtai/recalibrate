import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { applicationServerKey, buildQueue, DEFAULT_NOTIFY } from "./lib/push";
import type { State } from "./types";

const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document);
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install app" support: Android/desktop give us a prompt; iPhone needs Share → Add to Home Screen. */
export function useInstall() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const r = await deferred.userChoice;
    if (r.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };
  return { installed, canPrompt: !!deferred, install, ios: isIOS };
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing || navigator.serviceWorker.register("./sw.js", { scope: "./" });
}

export type PushResult = "ok" | "signin" | "denied" | "unsupported" | "error";

/**
 * Push notifications that arrive when the app is closed.
 * This device subscribes; the plan's upcoming reminders are kept in Supabase's push_queue,
 * and a scheduled function sends them.
 */
export function usePush(userId: string | null, state: State, update: (fn: (s: State) => void) => void) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(supported ? Notification.permission : "unsupported");
  const lastQueue = useRef<string>("");

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => setSubscribed(!!s)).catch(() => {});
  }, [supported]);

  const enable = useCallback(async (): Promise<PushResult> => {
    if (!supported) return "unsupported";
    if (!userId) return "signin";
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return "denied";
    try {
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() }));
      const j = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
      if (error) return "error";
      setSubscribed(true);
      update((s) => { s.notify = { ...DEFAULT_NOTIFY, ...s.notify, enabled: true }; });
      lastQueue.current = ""; // force a fresh upload
      return "ok";
    } catch {
      return "error";
    }
  }, [supported, userId, update]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  const test = useCallback(async () => {
    if (!userId) return "signin";
    const { error } = await supabase.from("push_queue").insert({
      user_id: userId, send_at: new Date().toISOString(), title: "Recalibrate test", body: "Notifications work. You're all set.",
      url: "./", tag: `test|${Date.now()}`, kind: "test",
    });
    return error ? "error" : "ok";
  }, [userId]);

  // keep the server's schedule in step with the plan (any signed-in device does this)
  useEffect(() => {
    if (!userId || !state.notify) return;
    const t = setTimeout(async () => {
      const items = buildQueue(state);
      const key = JSON.stringify(items);
      if (key === lastQueue.current) return;
      const { error } = await supabase.rpc("replace_push_queue", { items });
      if (!error) lastQueue.current = key;
    }, 3000);
    return () => clearTimeout(t);
  }, [state, userId]);

  return { supported, subscribed, permission, enable, disable, test };
}
