-- Reached: base schema, settings and profiles.
-- Times are timestamptz; Ghana is UTC+0 with no DST, so Accra local == UTC.

create extension if not exists pgcrypto with schema extensions;

-- pg_net is available on Supabase. Locally (tests) a stub schema is created
-- by scripts/db/supabase_shim.sql instead.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available (%), using existing net schema', sqlerrm;
end $$;

create schema if not exists private;
revoke all on schema private from public;

-- Non-secret runtime settings (URLs, feature flags). Secrets live in Vault /
-- Edge Function env, never here.
create table private.settings (
  key text primary key,
  value text not null
);

insert into private.settings (key, value) values
  ('live_base_url', 'https://reached.app/l/'),
  ('functions_url', 'http://127.0.0.1:54321/functions/v1'),
  ('messaging_mode', 'fake');

create or replace function private.setting(p_key text, p_default text default null)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from private.settings where key = p_key), p_default);
$$;

-- "8:42am", the clock style used in every SMS template.
create or replace function private.clock(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(to_char(p_at at time zone 'Africa/Accra', 'FMHH12:MIam'));
$$;

-- 8-character base62 token for live links.
create or replace function private.random_token(p_len int default 8)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(p_len);
  out text := '';
begin
  for i in 0 .. p_len - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function private.is_ghana_e164(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p ~ '^\+233(20|23|24|25|26|27|28|50|53|54|55|56|57|59)[0-9]{7}$';
$$;

-- Plan limits (mirrors packages/core/src/plans.ts).
create or replace function private.plan_limit(p_plan text, p_kind text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'contacts' then case p_plan when 'free' then 5 else 15 end
    when 'places'   then case p_plan when 'free' then 10 else 15 end
    when 'sms'      then case p_plan when 'free' then 30 when 'premium' then 300 else 1000 end
  end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) between 1 and 40),
  phone text not null check (private.is_ghana_e164(phone)),
  email text,
  photo_path text,
  -- Arrivals
  arrival_mode text not null default 'auto' check (arrival_mode in ('auto', 'ask')),
  ask_timeout_min int default 5 check (ask_timeout_min in (5, 10)), -- null = never send
  default_message text check (char_length(default_message) <= 160),
  grace_minutes int not null default 15 check (grace_minutes in (10, 15, 30, 60)),
  auto_detect boolean not null default false,
  heading_out_prompts boolean not null default false,
  -- Safety
  sos_hold_seconds int not null default 3 check (sos_hold_seconds between 2 and 5),
  sos_countdown_seconds int not null default 5 check (sos_countdown_seconds in (5, 10)),
  also_alert_police boolean not null default false,
  -- Notifications
  notify_arrivals boolean not null default true,
  notify_requests boolean not null default true,
  notify_tips boolean not null default false,
  -- Privacy
  retention_days int not null default 30 check (retention_days in (7, 30)),
  -- App
  language text not null default 'en' check (language in ('en', 'tw', 'ga', 'ee')),
  appearance text not null default 'system' check (appearance in ('light', 'dark', 'system')),
  plan text not null default 'free' check (plan in ('free', 'premium', 'family')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per Reached user (auth.users). Phone in +233 E.164.';

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Supabase Auth stores phones without "+"; normalise when creating the profile.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := new.phone;
begin
  if v_phone is null then
    return new;
  end if;
  if left(v_phone, 1) <> '+' then
    v_phone := '+' || v_phone;
  end if;
  insert into public.profiles (id, phone) values (new.id, v_phone)
  on conflict (id) do update set phone = excluded.phone;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger on_auth_user_phone_changed after update of phone on auth.users
  for each row when (old.phone is distinct from new.phone)
  execute function private.handle_new_user();
