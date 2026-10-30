import { useEffect, useRef, useState } from "react";
import type { Cue, State } from "./types";
import type { ToastAction } from "./ctx";
import { cuesFor } from "./lib/plan";
import { today } from "./lib/time";

/**
 * Fires reminders while the app is open: fix reminders, 5-minute transition
 * warnings, a halfway check-in and an end-of-block "log it" prompt.
 * Uses system notifications when allowed, and always shows an in-app toast.
 */
export function useReminders(
  state: State,
  now: number,
  toast: (m: string, a?: ToastAction) => void,
  onCue: (c: Cue) => void,
  /** false when push notifications already cover this device, to avoid doubles */
  systemNotify = true,
) {
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
      const msg =
        c.kind === "transition" ? `Heads up: ${c.text}`
        : c.kind === "fix" ? `${c.text} (for ${c.tomorrow ? "tomorrow's " : ""}${c.forTask})`
        : c.text;
      const action = c.kind === "mid" || c.kind === "transition" ? { label: "Answer", run: () => onCue(c) }
        : c.kind === "end" ? { label: "Done?", run: () => onCue(c) }
        : undefined;
      toast(msg, action);
      if (permission === "granted" && systemNotify) {
        try {
          const n = new Notification("Recalibrate", { body: msg, tag: id });
          n.onclick = () => { window.focus(); if (action) action.run(); n.close(); };
        } catch { /* some browsers need a service worker */ }
      }
    }
    try { localStorage.setItem(storeKey, JSON.stringify([...fired.current].filter((k) => k.startsWith(d)))); } catch { /* ignore */ }
  }, [state, now, permission, toast, onCue, systemNotify]);

  const enable = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };
  return { permission, enable };
}
