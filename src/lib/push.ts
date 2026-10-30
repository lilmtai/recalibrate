import type { NotifyPrefs, State } from "../types";
import { addDays, parseKey, today } from "./time";
import { cuesFor } from "./plan";

/** Public half of the Web Push key pair. The private half lives only in Supabase secrets. */
export const VAPID_PUBLIC_KEY = "BFm8J_2xZfC__a5h1W1dn1okcRT9PTKfDeYL1FkP1NqhKrg1p1L7Cjx5YndvIadd3toaW3Ftd4q_XKBdHFKAIHQ";

export const DEFAULT_NOTIFY: NotifyPrefs = { enabled: true, start: true, mid: true, end: true, fix: true };

export interface QueueItem { send_at: string; title: string; body: string; url: string; tag: string; kind: string }

/** Every notification your plan calls for over the next week, as rows for Supabase. */
export function buildQueue(s: State, days = 7): QueueItem[] {
  const prefs = { ...DEFAULT_NOTIFY, ...s.notify };
  if (!prefs.enabled) return [];
  const soon = Date.now() + 30_000;
  const out: QueueItem[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today(), i);
    const midnight = parseKey(d).getTime();
    for (const c of cuesFor(s, d)) {
      const kind = c.kind === "transition" ? "start" : c.kind;
      if (!prefs[kind as keyof NotifyPrefs]) continue;
      const at = midnight + c.at * 60_000;
      if (at < soon) continue;
      const link = c.taskId ? `./?task=${encodeURIComponent(c.taskId)}&date=${d}` : `./?date=${d}`;
      const [title, body] =
        kind === "start" ? [`${c.forTask} in 5 min`, "Wrap up and get ready. On it?"]
        : kind === "mid" ? [`Halfway through ${c.forTask}`, "Still on it?"]
        : kind === "end" ? [`${c.forTask} just ended`, "Done?"]
        : [c.text, `For ${c.tomorrow ? "tomorrow's " : ""}${c.forTask}`];
      out.push({ send_at: new Date(at).toISOString(), title, body, url: link, tag: `${d}|${c.key}|${c.at}`, kind });
    }
  }
  return out.slice(0, 400);
}

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
export const applicationServerKey = () => b64ToBytes(VAPID_PUBLIC_KEY);
