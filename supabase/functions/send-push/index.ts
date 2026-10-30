// Supabase Edge Function "send-push": sends due Recalibrate notifications with Web Push.
// Called every minute by pg_cron (see supabase/push.sql).
// Secrets to set: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET.
// Deploy with "Verify JWT" turned OFF; the x-cron-secret header protects it instead.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";

// Works with both the older service_role key and the newer secret keys.
function adminKey(): string | undefined {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const many = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (many) {
    try {
      const parsed = JSON.parse(many);
      const first = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
      if (typeof first === "string") return first;
    } catch { /* not JSON */ }
  }
  return Deno.env.get("SUPABASE_SECRET_KEY");
}

Deno.serve(async (req) => {
  // Tell which settings are missing (names only, never values).
  const missing = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"].filter((k) => !Deno.env.get(k));
  const key = adminKey();
  if (!key) missing.push("SUPABASE admin key (service_role / secret key)");
  if (missing.length) return Response.json({ ok: false, missing }, { status: 500 });

  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
  const db = createClient(Deno.env.get("SUPABASE_URL")!, key!, { auth: { persistSession: false } });
  const now = new Date();
  const stale = new Date(now.getTime() - 15 * 60_000); // skip anything more than 15 min late

  const { data: due, error } = await db
    .from("push_queue")
    .select("id, user_id, title, body, url, tag, kind")
    .eq("sent", false)
    .lte("send_at", now.toISOString())
    .gte("send_at", stale.toISOString())
    .order("send_at")
    .limit(500);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0, failed = 0;
  const errors: string[] = [];
  if (due?.length) {
    const users = [...new Set(due.map((d) => d.user_id))];
    const { data: subs } = await db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth").in("user_id", users);
    for (const item of due) {
      const payload = JSON.stringify({ title: item.title, body: item.body, url: item.url, tag: item.tag, kind: item.kind });
      for (const s of (subs || []).filter((x) => x.user_id === item.user_id)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 900, urgency: "high" });
          sent++;
        } catch (e) {
          failed++;
          const code = (e as { statusCode?: number }).statusCode;
          errors.push(`${code ?? ""} ${(e as Error).message ?? e}`.trim());
          // the device unsubscribed or the app was removed
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    await db.from("push_queue").update({ sent: true }).in("id", due.map((d) => d.id));
  }
  // housekeeping: drop old rows
  await db.from("push_queue").delete().lt("send_at", new Date(now.getTime() - 2 * 86_400_000).toISOString());
  if (errors.length) console.error("push errors", errors.slice(0, 5));
  return Response.json({ ok: true, due: due?.length || 0, sent, failed });
});
