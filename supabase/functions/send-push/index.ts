// Supabase Edge Function: sends due Recalibrate notifications with Web Push.
// Called every minute by pg_cron (see supabase/push.sql).
// Secrets to set: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET.
// Deploy with "Verify JWT" turned OFF; the x-cron-secret header protects it instead.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0, failed = 0;
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
          // the device unsubscribed or the app was removed
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    await db.from("push_queue").update({ sent: true }).in("id", due.map((d) => d.id));
  }
  // housekeeping: drop old rows
  await db.from("push_queue").delete().lt("send_at", new Date(now.getTime() - 2 * 86_400_000).toISOString());
  return Response.json({ due: due?.length || 0, sent, failed });
});
