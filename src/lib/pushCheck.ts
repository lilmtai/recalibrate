import { supabase } from "./supabase";

export type CheckStatus = "ok" | "fail" | "wait" | "skip";
export interface CheckStep { label: string; status: CheckStatus; note?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errText = (e: unknown) => {
  const x = e as { message?: string; code?: string };
  return [x?.code, x?.message].filter(Boolean).join(" · ") || String(e);
};

/**
 * Walks the whole notification chain from this device and reports the first broken link:
 * permission → this phone's subscription → saved in Supabase → reminders scheduled →
 * the every-minute timer + send-push function actually send a test.
 */
export async function checkNotifications(
  userId: string | null,
  onUpdate: (steps: CheckStep[]) => void,
  opts: { remindersOn: boolean; turnOnReminders: () => void; uploadQueue: (force?: boolean) => Promise<{ count: number; error: string | null }> },
) {
  const steps: CheckStep[] = [];
  const push = (s: CheckStep) => { steps.push(s); onUpdate([...steps]); return steps.length - 1; };
  const set = (i: number, s: Partial<CheckStep>) => { steps[i] = { ...steps[i], ...s }; onUpdate([...steps]); };

  if (!userId) { push({ label: "Signed in", status: "fail", note: "Sign in first (Me → Account & sync)." }); return; }
  push({ label: "Signed in", status: "ok" });

  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) { push({ label: "Notifications supported here", status: "fail", note: "On iPhone, open Recalibrate from the Home Screen (iOS 16.4+), not Safari." }); return; }
  if (Notification.permission !== "granted") {
    push({ label: "Notifications allowed", status: "fail", note: Notification.permission === "denied" ? "Blocked. iPhone: Settings → Notifications → Recalibrate → Allow." : "Not allowed yet. Tap Turn on notifications." });
    return;
  }
  push({ label: "Notifications allowed", status: "ok" });

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) { push({ label: "This phone is subscribed", status: "fail", note: "Tap Turn on notifications again." }); return; }
  push({ label: "This phone is subscribed", status: "ok" });

  const saved = await supabase.from("push_subscriptions").select("endpoint").eq("endpoint", sub.endpoint).maybeSingle();
  if (saved.error) {
    const missing = /does not exist|schema cache|PGRST205|42P01/i.test(errText(saved.error));
    push({ label: "Phone saved in Supabase", status: "fail", note: missing ? "The notifications tables are missing. Run supabase/push.sql in the SQL Editor." : errText(saved.error) });
    return;
  }
  if (!saved.data) {
    // repair: save this phone now, and show the exact reason if Supabase refuses
    const j = sub.toJSON();
    const fix = await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
    if (fix.error) {
      const t = errText(fix.error);
      push({ label: "Phone saved in Supabase", status: "fail", note:
        /row-level security|42501|permission/i.test(t) ? `Supabase refused to save it (permissions). Run supabase/push.sql again in the SQL Editor. Details: ${t}`
        : `Supabase refused to save it. Details: ${t}` });
      return;
    }
    push({ label: "Phone saved in Supabase", status: "ok", note: "It wasn't saved before; saved it now." });
  } else push({ label: "Phone saved in Supabase", status: "ok" });

  // reminders for your plan: make sure they're switched on and uploaded now
  if (!opts.remindersOn) { opts.turnOnReminders(); await sleep(400); }
  const up = await opts.uploadQueue(true);
  if (up.error) push({ label: "Reminders scheduled", status: "fail", note: up.error });
  else {
    const queued = await supabase.from("push_queue").select("send_at, title").eq("sent", false).neq("kind", "test").gte("send_at", new Date().toISOString()).order("send_at").limit(1);
    const next = queued.data?.[0];
    push({ label: "Reminders scheduled", status: up.count ? "ok" : "skip",
      note: up.count ? `${up.count} in the next 7 days${next ? `. Next: “${next.title}” at ${new Date(next.send_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}${!opts.remindersOn ? " (they were switched off; now on)" : ""}`
        : "Nothing to remind you about in the next 7 days. Add a block or routine with a time." });
  }

  // send a test and watch whether the server picks it up
  const tag = `test|${Date.now()}`;
  const ins = await supabase.from("push_queue").insert({
    user_id: userId, send_at: new Date().toISOString(), title: "Recalibrate test", body: "Notifications work. You're all set.", url: "./", tag, kind: "test",
  });
  if (ins.error) { push({ label: "Test queued", status: "fail", note: errText(ins.error) }); return; }
  const i = push({ label: "Server sends the test", status: "wait", note: "Waiting for the every-minute timer (up to 90 seconds)…" });
  for (let t = 0; t < 18; t++) {
    await sleep(5000);
    const r = await supabase.from("push_queue").select("sent").eq("tag", tag).maybeSingle();
    if (r.data?.sent) {
      set(i, { status: "ok", note: "Supabase sent it. If nothing appeared on your phone, check: iPhone Settings → Notifications → Recalibrate (Allow, Banners), Focus / Do Not Disturb off, and Supabase → Edge Functions → send-push → Logs for “push errors”." });
      return;
    }
  }
  set(i, {
    status: "fail",
    note: "Nothing picked it up. In Supabase check: (1) Edge Functions has a function named exactly send-push; (2) its Verify JWT setting is OFF; (3) the 4 secrets are set; (4) push.sql was run with your cron secret in place of PASTE_CRON_SECRET_HERE (same value as the CRON_SECRET secret). Then look at send-push → Logs.",
  });
}
