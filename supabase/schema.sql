-- Recalibrate: one row per person holding their whole planner.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.planner_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_state enable row level security;

-- Each person can only see and change their own planner.
drop policy if exists "read own planner" on public.planner_state;
create policy "read own planner" on public.planner_state
  for select using (auth.uid() = user_id);

drop policy if exists "insert own planner" on public.planner_state;
create policy "insert own planner" on public.planner_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own planner" on public.planner_state;
create policy "update own planner" on public.planner_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
