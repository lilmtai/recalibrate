-- Recalibrate: notifications that arrive when the app is closed.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Replace PASTE_CRON_SECRET_HERE (bottom) with the same CRON_SECRET you set on the function.

-- 1. Each device that turned on notifications
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Upcoming notifications, written by the app from your plan
create table if not exists public.push_queue (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  send_at    timestamptz not null,
  title      text not null,
  body       text,
  url        text,
  tag        text not null,
  kind       text,
  sent       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, tag)
);
create index if not exists push_queue_due on public.push_queue (sent, send_at);
alter table public.push_queue enable row level security;
drop policy if exists "own queue" on public.push_queue;
create policy "own queue" on public.push_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Replace your unsent notifications in one step (safe when phone and laptop both update it)
create or replace function public.replace_push_queue(items jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from push_queue where user_id = auth.uid() and sent = false and coalesce(kind, '') <> 'test';
  insert into push_queue (user_id, send_at, title, body, url, tag, kind)
  select auth.uid(), (i->>'send_at')::timestamptz, i->>'title', i->>'body', i->>'url', i->>'tag', i->>'kind'
  from jsonb_array_elements(items) as i
  on conflict (user_id, tag) do nothing;
end $$;
grant execute on function public.replace_push_queue(jsonb) to authenticated;

-- 3. Every minute, ask the send-push function to deliver what's due
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('recalibrate-push') where exists (select 1 from cron.job where jobname = 'recalibrate-push');
select cron.schedule(
  'recalibrate-push',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://lhrxjgzgyxlfzitrjzxp.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "PASTE_CRON_SECRET_HERE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
