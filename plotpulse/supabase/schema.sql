-- PlotPulse database (Supabase / Postgres)
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- One Supabase project per colony keeps every builder's data separate.

-- ---------- Tables ----------

-- Anonymous activity from the public page. No names, phones, IPs or locations.
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  type        text not null check (type in ('page_view','plot_view','whatsapp_click','tour_view','map_view','doc_view')),
  plot_no     text check (char_length(plot_no) <= 12),
  anon_id     text not null check (char_length(anon_id) <= 40),
  source      text not null default 'direct' check (char_length(source) <= 40)
);
create index if not exists events_created_at_idx on public.events (created_at);
create index if not exists events_plot_idx on public.events (plot_no, type, created_at);

-- Status the builder changes from the dashboard. Plots not listed here use the
-- status in colony/plots.json.
create table if not exists public.plot_status (
  plot_no     text primary key,
  status      text not null check (status in ('available','allotted')),
  updated_at  timestamptz not null default now()
);

-- Demand rules (one row)
create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),
  window_days  int not null default 7  check (window_days between 1 and 90),
  top_percent  int not null default 20 check (top_percent between 1 and 100),
  min_to_show  int not null default 10 check (min_to_show between 0 and 1000)
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- Public read of aggregated demand only ----------
-- Visitors can see "how many people viewed each plot", never the raw rows.
create or replace function public.plot_demand(days int default 7)
returns table (plot_no text, viewers int, enquiries int)
language sql
security definer
set search_path = public
stable
as $$
  select e.plot_no,
         count(distinct e.anon_id) filter (where e.type = 'plot_view')::int as viewers,
         count(distinct e.anon_id) filter (where e.type = 'whatsapp_click')::int as enquiries
  from public.events e
  where e.plot_no is not null
    and e.created_at >= now() - make_interval(days => least(greatest(days, 1), 365))
  group by e.plot_no;
$$;
revoke all on function public.plot_demand(int) from public;
grant execute on function public.plot_demand(int) to anon, authenticated;

-- ---------- Row level security ----------
alter table public.events      enable row level security;
alter table public.plot_status enable row level security;
alter table public.settings    enable row level security;

-- Anyone (the public page) may add an event, but not read, change or delete them.
drop policy if exists "public can log events" on public.events;
create policy "public can log events" on public.events
  for insert to anon, authenticated with check (true);

-- Only the signed-in builder can read raw events (for the dashboard).
drop policy if exists "builder reads events" on public.events;
create policy "builder reads events" on public.events
  for select to authenticated using (true);

-- Everyone can see plot status (the public map needs it); only the builder changes it.
drop policy if exists "everyone reads status" on public.plot_status;
create policy "everyone reads status" on public.plot_status
  for select to anon, authenticated using (true);
drop policy if exists "builder writes status" on public.plot_status;
create policy "builder writes status" on public.plot_status
  for all to authenticated using (true) with check (true);

-- Everyone reads settings; only the builder changes them.
drop policy if exists "everyone reads settings" on public.settings;
create policy "everyone reads settings" on public.settings
  for select to anon, authenticated using (true);
drop policy if exists "builder writes settings" on public.settings;
create policy "builder writes settings" on public.settings
  for all to authenticated using (true) with check (true);

-- IMPORTANT: "authenticated" means any signed-in user. In Supabase go to
-- Authentication → Sign In / Providers and turn OFF "Allow new users to sign up",
-- then create the builder's login yourself under Authentication → Users.
