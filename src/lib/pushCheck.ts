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
export async function checkNotifications(userId: string | null, onUpdate: (steps: CheckStep[]) => void) {
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
  if (!saved.data) { push({ label: "Phone saved in Supabase", status: "fail", note: "Not saved. Tap Turn off on this device, then Turn on notifications again." }); return; }
  push({ label: "Phone saved in Supabase", status: "ok" });

  const queued = await supabase.from("push_queue").select("id", { count: "exact", head: true }).eq("sent", false).gte("send_at", new Date().toISOString());
  if (queued.error) push({ label: "Reminders scheduled", status: "fail", note: errText(queued.error) });
  else push({ label: "Reminders scheduled", status: queued.count ? "ok" : "skip", note: queued.count ? `${queued.count} upcoming` : "None upcoming (no open blocks in the next 7 days, or they haven't uploaded yet)." });

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
