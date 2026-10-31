-- Recalibrate: "what really happened" history in its own table (Sprint 0 · F-5).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Until this exists, the app keeps history inside planner_state as before.

create table if not exists public.execution_log (
  id          text primary key,                        -- the app's entry id
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  start_min   int  not null check (start_min between 0 and 1440),
  end_min     int  check (end_min between 0 and 1440),  -- null while still running ("now doing")
  title       text not null,
  kind        text not null,                           -- plan | instead | free
  category    text,
  instead_key text,
  task_id     text,
  prompt_key  text,                                    -- e.g. wyd:2026-11-04:600 → one answer per prompt
  auto        boolean not null default false,          -- written from a block outcome
  deleted     boolean not null default false,          -- soft delete, so other devices learn about it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, prompt_key)                         -- two devices can't log the same prompt twice
);
create index if not exists execution_log_sync on public.execution_log (user_id, updated_at);
create index if not exists execution_log_day  on public.execution_log (user_id, day);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists execution_log_touch on public.execution_log;
create trigger execution_log_touch before update on public.execution_log
  for each row execute function public.touch_updated_at();

alter table public.execution_log enable row level security;
drop policy if exists "own history read" on public.execution_log;
create policy "own history read" on public.execution_log for select using (auth.uid() = user_id);
drop policy if exists "own history write" on public.execution_log;
create policy "own history write" on public.execution_log for insert with check (auth.uid() = user_id);
drop policy if exists "own history update" on public.execution_log;
create policy "own history update" on public.execution_log for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- no delete policy: entries are soft-deleted (deleted = true) so history is kept
