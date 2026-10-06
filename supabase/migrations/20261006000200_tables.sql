-- Reached: contacts, places, rules, trips, activity, outbox.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  phone text not null check (private.is_ghana_e164(phone)),
  relationship text not null default 'Other'
    check (relationship in ('Mom', 'Dad', 'Partner', 'Sibling', 'Friend', 'Other')),
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp', 'both')),
  language text not null default 'en' check (language in ('en', 'tw', 'ga', 'ee')),
  is_default boolean not null default true,
  is_emergency boolean not null default true,
  can_request_location boolean not null default false,
  opted_out_at timestamptz,
  opt_out_notified_at timestamptz,
  intro_sent_at timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, phone)
);
create index contacts_phone_idx on public.contacts (phone);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'pin',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m int not null default 150 check (radius_m between 100 and 500),
  address text,
  ghanapost_gps text check (ghanapost_gps ~ '^[A-Z]{2}-[0-9]{3,4}-[0-9]{4}$'),
  created_at timestamptz not null default now()
);
create index places_user_idx on public.places (user_id);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  event text not null default 'arrive' check (event in ('arrive', 'leave')),
  days smallint[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(days) between 1 and 7 and days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  window_start time,
  window_end time,
  message text check (char_length(message) <= 160),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check ((window_start is null) = (window_end is null)),
  check (window_start is null or window_start <> window_end)
);
create index rules_place_idx on public.rules (place_id);

create table public.rule_contacts (
  rule_id uuid not null references public.rules (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  primary key (rule_id, contact_id)
);
create index rule_contacts_contact_idx on public.rule_contacts (contact_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  dest_name text check (char_length(dest_name) <= 80),
  dest_lat double precision,
  dest_lng double precision,
  radius_m int not null default 150 check (radius_m between 100 and 500),
  status text not null default 'active' check (status in ('active', 'overdue', 'alerted', 'arrived', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'auto', 'heading_out', 'request')),
  started_at timestamptz not null default now(),
  expected_at timestamptz,
  grace_minutes int not null default 15 check (grace_minutes in (10, 15, 30, 60)),
  check_on_me boolean not null default true,
  tell_leaving boolean not null default false,
  message text check (char_length(message) <= 160),
  overdue_prompted_at timestamptz,
  alerted_at timestamptz,
  arrived_at timestamptz,
  ended_at timestamptz,
  last_checkin_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  battery_pct int check (battery_pct between 0 and 100),
  -- Phase 2 trip details: only shared if something goes wrong.
  transport_type text check (transport_type in ('trotro', 'taxi', 'ride_hailing', 'own_car', 'walking', 'motorbike')),
  plate text check (char_length(plate) <= 20),
  plate_photo_path text,
  driver_name text check (char_length(driver_name) <= 60),
  car text check (char_length(car) <= 60),
  ride_provider text check (ride_provider in ('uber', 'bolt', 'yango')),
  ride_link text check (ride_link ~ '^https://'),
  live_token text not null unique default private.random_token(8),
  live_expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (check_on_me = false or expected_at is not null),
  check ((dest_lat is null) = (dest_lng is null))
);
-- At most one live trip per user.
create unique index trips_one_live_per_user on public.trips (user_id)
  where status in ('active', 'overdue', 'alerted');
create index trips_overdue_scan on public.trips (status, expected_at) where status in ('active', 'overdue');

create table public.trip_contacts (
  trip_id uuid not null references public.trips (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  message text check (char_length(message) <= 160),
  primary key (trip_id, contact_id)
);

create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'cleared')),
  trigger text not null default 'shield' check (trigger in ('shield', 'notification', 'voice', 'power_button', 'shortcut', 'overdue_help')),
  sent_at timestamptz not null default now(),
  cleared_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_ping_at timestamptz,
  battery_pct int check (battery_pct between 0 and 100),
  live_token text not null unique default private.random_token(8),
  live_expires_at timestamptz
);
create unique index sos_one_open_per_user on public.sos_alerts (user_id) where status = 'sent';

create table public.location_pings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  sos_id uuid references public.sos_alerts (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  battery_pct int check (battery_pct between 0 and 100),
  created_at timestamptz not null default now()
);
create index location_pings_created_idx on public.location_pings (created_at);
create index location_pings_trip_idx on public.location_pings (trip_id, created_at desc);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'arrival', 'departure', 'on_the_way', 'running_late', 'plans_changed',
    'overdue_alert', 'sos', 'all_clear', 'test', 'intro', 'contact_request')),
  status text not null default 'sent' check (status in ('pending_confirmation', 'sent', 'cancelled')),
  place_id uuid references public.places (id) on delete set null,
  trip_id uuid references public.trips (id) on delete set null,
  sos_id uuid references public.sos_alerts (id) on delete set null,
  place_name text,
  lat double precision,
  lng double precision,
  source text not null default 'app' check (source in ('app', 'rule', 'trip', 'server', 'auto', 'test')),
  auto_send_at timestamptz,
  feedback text check (feedback in ('not_arrived', 'wrong_place', 'should_not_send')),
  created_at timestamptz not null default now()
);
create index events_user_created_idx on public.events (user_id, created_at desc);
create index events_dedupe_idx on public.events (user_id, place_id, kind, created_at desc);

-- Outbox: one row per contact per channel. Rendered and sent by the
-- `dispatch` Edge Function through the MessageProvider for MESSAGING_MODE.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  contact_name text not null,
  to_phone text not null check (private.is_ghana_e164(to_phone)),
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp')),
  template text not null,
  params jsonb not null default '{}',
  language text not null default 'en',
  body text,
  status text not null default 'pending'
    check (status in ('held', 'pending', 'sending', 'sent', 'delivered', 'failed', 'opted_out', 'cancelled')),
  is_safety boolean not null default false,
  provider_message_id text,
  failure_reason text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);
create index messages_event_idx on public.messages (event_id);
create index messages_pending_idx on public.messages (status, created_at) where status = 'pending';
create index messages_provider_idx on public.messages (provider_message_id);
create trigger messages_touch before update on public.messages
  for each row execute function private.touch_updated_at();

-- FakeProvider sink: every "sent" message in fake mode lands here.
create table public.fake_messages (
  id bigint generated always as identity primary key,
  to_phone text not null,
  channel text not null,
  body text not null,
  provider_message_id text not null,
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now()
);

-- Push outbox. The app also reads it for in-app banners.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'arrival_sent', 'ask_first', 'heading_out', 'are_you_okay', 'alert_sent', 'contact_request',
    'message_failed', 'permissions', 'trip_in_progress', 'opted_out', 'tip')),
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);
create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;

-- Phase 2: a contact texts REACHED to ask to be told when the user arrives.
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  nudged_at timestamptz
);
create index contact_requests_pending_idx on public.contact_requests (status, created_at) where status = 'pending';

-- Phase 3: police station finder and partnership.
create table public.police_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  district text,
  lat double precision not null,
  lng double precision not null,
  phone text,
  verified boolean not null default false
);

create table public.police_officers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  station_id uuid references public.police_stations (id),
  name text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Phase 3: plans and payments (mobile money and card).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('premium', 'family')),
  payment_method text not null check (payment_method in ('mtn_momo', 'telecel_cash', 'at_money', 'card')),
  pay_phone text check (pay_phone is null or private.is_ghana_e164(pay_phone)),
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'failed')),
  provider_ref text unique,
  amount_ghs numeric(10, 2) not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.family_members (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  member_phone text not null check (private.is_ghana_e164(member_phone)),
  member_id uuid references public.profiles (id) on delete set null,
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_phone)
);

-- Phase 3: ride-hailing partners push driver details through the Reached API.
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  key_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.partner_links (
  user_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  link_code text not null unique default private.random_token(10),
  external_rider_id text,
  linked_at timestamptz,
  primary key (user_id, partner_id)
);

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  logs text check (char_length(logs) <= 20000),
  created_at timestamptz not null default now()
);

-- Place cap (SPEC §6: 15, iOS region limit) and plan limits.
create or replace function private.enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_count int;
begin
  select plan into v_plan from public.profiles where id = new.user_id;
  if tg_table_name = 'places' then
    select count(*) into v_count from public.places where user_id = new.user_id;
    if v_count >= least(15, private.plan_limit(v_plan, 'places')) then
      raise exception 'place_limit' using hint = 'You can save up to ' || least(15, private.plan_limit(v_plan, 'places')) || ' places.';
    end if;
  else
    select count(*) into v_count from public.contacts where user_id = new.user_id;
    if v_count >= private.plan_limit(v_plan, 'contacts') then
      raise exception 'contact_limit' using hint = 'Your plan allows ' || private.plan_limit(v_plan, 'contacts') || ' people.';
    end if;
  end if;
  return new;
end $$;

create trigger places_limit before insert on public.places
  for each row execute function private.enforce_limits();
create trigger contacts_limit before insert on public.contacts
  for each row execute function private.enforce_limits();

-- A rule may only reference the owner's contacts and places.
create or replace function private.check_rule_contact_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.rules r join public.contacts c on c.user_id = r.user_id
    where r.id = new.rule_id and c.id = new.contact_id
  ) then
    raise exception 'contact does not belong to rule owner';
  end if;
  return new;
end $$;
create trigger rule_contacts_owner before insert or update on public.rule_contacts
  for each row execute function private.check_rule_contact_owner();

create or replace function private.check_rule_place_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.places p where p.id = new.place_id and p.user_id = new.user_id) then
    raise exception 'place does not belong to rule owner';
  end if;
  return new;
end $$;
create trigger rules_place_owner before insert or update on public.rules
  for each row execute function private.check_rule_place_owner();

create or replace function private.check_trip_contact_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.trips t join public.contacts c on c.user_id = t.user_id
    where t.id = new.trip_id and c.id = new.contact_id
  ) then
    raise exception 'contact does not belong to trip owner';
  end if;
  return new;
end $$;
create trigger trip_contacts_owner before insert or update on public.trip_contacts
  for each row execute function private.check_trip_contact_owner();
