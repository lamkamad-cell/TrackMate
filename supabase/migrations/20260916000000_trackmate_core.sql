create extension if not exists pgcrypto;

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  monitor_id text not null,
  target_id text not null,
  active boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint watches_monitor_id_check check (length(monitor_id) between 6 and 64),
  constraint watches_target_id_check check (length(target_id) between 3 and 32),
  constraint watches_monitor_target_unique unique (monitor_id, target_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  monitor_id text not null,
  endpoint text not null,
  subscription jsonb not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_monitor_id_check check (length(monitor_id) between 6 and 64)
);

create table if not exists public.heartbeats (
  peer_id text primary key,
  connected_to text,
  location_shared boolean not null default false,
  lat double precision,
  lng double precision,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint heartbeats_peer_id_check check (length(peer_id) between 3 and 32),
  constraint heartbeats_lat_check check (lat is null or lat between -90 and 90),
  constraint heartbeats_lng_check check (lng is null or lng between -180 and 180)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  monitor_id text not null,
  target_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),

  constraint notification_events_event_type_check check (
    event_type in ('heartbeat_lost', 'sos', 'check_in')
  )
);

create index if not exists watches_active_target_id_idx
  on public.watches (target_id)
  where active = true;

create index if not exists watches_monitor_id_idx
  on public.watches (monitor_id);

create index if not exists push_subscriptions_monitor_id_active_idx
  on public.push_subscriptions (monitor_id)
  where active = true;

create index if not exists heartbeats_received_at_idx
  on public.heartbeats (received_at);

create index if not exists notification_events_monitor_target_type_sent_idx
  on public.notification_events (monitor_id, target_id, event_type, sent_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists watches_set_updated_at on public.watches;
create trigger watches_set_updated_at
before update on public.watches
for each row execute function public.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists heartbeats_set_updated_at on public.heartbeats;
create trigger heartbeats_set_updated_at
before update on public.heartbeats
for each row execute function public.set_updated_at();

alter table public.watches enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.heartbeats enable row level security;
alter table public.notification_events enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.watches to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.heartbeats to service_role;
grant select, insert, update, delete on public.notification_events to service_role;
