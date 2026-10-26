import { useEffect, useRef, useState } from "react";
import type { State } from "./types";
import { cuesFor } from "./lib/plan";
import { today } from "./lib/time";

/**
 * Fires prep cues and 5-minute transition warnings while the app is open.
 * Uses system notifications when allowed, and always shows an in-app toast.
 */
export function useReminders(state: State, now: number, toast: (m: string) => void) {
  const fired = useRef<Set<string>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useEffect(() => {
    const d = today();
    const storeKey = "recalibrate.fired." + d;
    try {
      JSON.parse(localStorage.getItem(storeKey) || "[]").forEach((k: string) => fired.current.add(k));
    } catch { /* ignore */ }
    for (const c of cuesFor(state, d)) {
      const id = d + c.key + c.at;
      if (fired.current.has(id) || now < c.at || now > c.at + 2) continue;
      fired.current.add(id);
      const msg = c.kind === "transition" ? `Heads up: ${c.text}` : `${c.text} (for ${c.tomorrow ? "tomorrow's " : ""}${c.forTask})`;
      toast(msg);
      if (permission === "granted") {
        try { new Notification("Recalibrate", { body: msg }); } catch { /* some browsers need a service worker */ }
      }
    }
    try { localStorage.setItem(storeKey, JSON.stringify([...fired.current].filter((k) => k.startsWith(d)))); } catch { /* ignore */ }
  }, [state, now, permission, toast]);

  const enable = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };
  return { permission, enable };
}
