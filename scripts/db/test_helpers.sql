-- Helpers for pgTAP tests (loaded after migrations by scripts/test-db.sh).
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

create or replace function tests.create_user(p_phone text, p_name text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v uuid;
begin
  insert into auth.users (phone) values (ltrim(p_phone, '+')) returning id into v;
  if p_name is not null then
    update public.profiles set first_name = p_name, onboarded_at = now() where id = v;
  end if;
  return v;
end $$;

create or replace function tests.login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.login_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

-- Add a contact as the given user (bypasses RLS, still runs triggers).
create or replace function tests.add_contact(p_user uuid, p_name text, p_phone text, p_emergency boolean default true,
  p_channel text default 'sms')
returns uuid
language plpgsql
security definer
as $$
declare
  v uuid;
begin
  insert into public.contacts (user_id, name, phone, relationship, is_emergency, channel)
  values (p_user, p_name, p_phone, 'Other', p_emergency, p_channel) returning id into v;
  return v;
end $$;

create or replace function tests.add_place(p_user uuid, p_name text, p_lat double precision default 5.6211,
  p_lng double precision default -0.1739)
returns uuid
language plpgsql
security definer
as $$
declare
  v uuid;
begin
  insert into public.places (user_id, name, lat, lng) values (p_user, p_name, p_lat, p_lng) returning id into v;
  return v;
end $$;

create or replace function tests.add_rule(p_user uuid, p_place uuid, p_contacts uuid[], p_event text default 'arrive',
  p_days smallint[] default '{0,1,2,3,4,5,6}', p_start time default null, p_end time default null, p_message text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v uuid;
begin
  insert into public.rules (user_id, place_id, event, days, window_start, window_end, message)
  values (p_user, p_place, p_event, p_days, p_start, p_end, p_message) returning id into v;
  insert into public.rule_contacts (rule_id, contact_id) select v, unnest(p_contacts);
  return v;
end $$;

grant execute on all functions in schema tests to authenticated, anon;
