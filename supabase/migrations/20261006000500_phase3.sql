-- Phase 3: police partnership, plans and payments, partner API, admin.

-- Nearest police stations (SPEC Phase 3). Plain haversine: no PostGIS needed.
create or replace function public.nearest_police_stations(p_lat double precision, p_lng double precision, p_limit int default 5)
returns table (id uuid, name text, region text, district text, phone text, lat double precision, lng double precision,
  verified boolean, distance_m double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.region, s.district, s.phone, s.lat, s.lng, s.verified,
    2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(s.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)
    ))) as distance_m
  from public.police_stations s
  order by distance_m
  limit least(greatest(p_limit, 1), 20);
$$;

-- Live SOS alerts for approved officers, only from users who switched on
-- "Also alert the police". Cleared alerts stay visible for 2 hours so police
-- see cancellations (false-alarm protection).
create or replace function public.police_feed()
returns table (sos_id uuid, status text, sent_at timestamptz, cleared_at timestamptz, first_name text, phone text,
  lat double precision, lng double precision, last_ping_at timestamptz, battery_pct int,
  destination text, transport_type text, plate text, driver_name text, car text, ride_link text, plate_photo_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_police() then
    raise exception 'not_police' using errcode = '42501';
  end if;
  return query
  select s.id, s.status, s.sent_at, s.cleared_at, p.first_name, p.phone, s.last_lat, s.last_lng, s.last_ping_at,
    s.battery_pct, t.dest_name, t.transport_type, t.plate, t.driver_name, t.car, t.ride_link, t.plate_photo_path
  from public.sos_alerts s
  join public.profiles p on p.id = s.user_id
  left join public.trips t on t.id = s.trip_id
  where p.also_alert_police
    and (s.status = 'sent' or s.cleared_at > now() - interval '2 hours')
  order by s.sent_at desc;
end $$;

-- Subscriptions: the app starts a payment, the payments webhook activates it.
create or replace function public.start_subscription(p_plan text, p_method text, p_pay_phone text default null)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_sub public.subscriptions;
begin
  if p_plan not in ('premium', 'family') then
    raise exception 'bad_plan';
  end if;
  if p_method <> 'card' and (p_pay_phone is null or not private.is_ghana_e164(p_pay_phone)) then
    raise exception 'bad_pay_phone' using hint = 'Enter the mobile money number to charge.';
  end if;
  insert into public.subscriptions (user_id, plan, payment_method, pay_phone, amount_ghs, provider_ref)
  values (v_user, p_plan, p_method, p_pay_phone, case p_plan when 'premium' then 15 else 40 end,
    'rch_' || private.random_token(16))
  returning * into v_sub;
  return v_sub;
end $$;

create or replace function public.activate_subscription(p_provider_ref text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where provider_ref = p_provider_ref for update;
  if not found or v_sub.status <> 'pending' then
    return; -- idempotent webhook
  end if;
  if not p_success then
    update public.subscriptions set status = 'failed' where id = v_sub.id;
    return;
  end if;
  update public.subscriptions set status = 'active', current_period_end = now() + interval '1 month' where id = v_sub.id;
  update public.profiles set plan = v_sub.plan where id = v_sub.user_id;
  if v_sub.plan = 'family' then
    update public.profiles p set plan = 'family'
    from public.family_members f
    where f.owner_id = v_sub.user_id and f.status = 'active' and f.member_id = p.id;
  end if;
end $$;

-- Downgrade lapsed plans (runs daily).
create or replace function public.expire_subscriptions(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with lapsed as (
    update public.subscriptions set status = 'cancelled'
    where status = 'active' and current_period_end < p_now
    returning id, user_id
  )
  update public.profiles p set plan = 'free' from lapsed l
  where p.id = l.user_id
    and not exists (select 1 from public.subscriptions s
                    where s.user_id = p.id and s.status = 'active' and s.id not in (select id from lapsed));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Family members join when they sign up with the invited number.
create or replace function private.link_family_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.family_members set member_id = new.id, status = 'active'
  where member_phone = new.phone and member_id is null;
  if exists (select 1 from public.family_members f join public.profiles o on o.id = f.owner_id
             where f.member_id = new.id and o.plan = 'family') then
    update public.profiles set plan = 'family' where id = new.id;
  end if;
  return new;
end $$;
create trigger profiles_family_link after insert on public.profiles
  for each row execute function private.link_family_member();

-- Partner API: a ride app pushes driver details onto the linked rider's live trip.
create or replace function public.partner_update_trip(p_partner_id uuid, p_link_code text, p_details jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.partner_links set linked_at = coalesce(linked_at, now()),
    external_rider_id = coalesce(p_details ->> 'rider_id', external_rider_id)
  where partner_id = p_partner_id and link_code = p_link_code
  returning user_id into v_user;
  if v_user is null then
    return false;
  end if;
  update public.trips set
    transport_type = 'ride_hailing',
    plate = coalesce(nullif(p_details ->> 'plate', ''), plate),
    driver_name = coalesce(nullif(p_details ->> 'driver_name', ''), driver_name),
    car = coalesce(nullif(p_details ->> 'car', ''), car),
    ride_link = coalesce(nullif(p_details ->> 'ride_link', ''), ride_link),
    ride_provider = coalesce(p_details ->> 'provider', ride_provider)
  where user_id = v_user and status in ('active', 'overdue', 'alerted');
  return found;
end $$;

create or replace function public.create_partner_link(p_partner_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_partner uuid;
  v_code text;
begin
  select id into v_partner from public.partners where name = p_partner_name and active;
  if v_partner is null then
    raise exception 'partner_not_found';
  end if;
  insert into public.partner_links (user_id, partner_id) values (v_user, v_partner)
  on conflict (user_id, partner_id) do update set link_code = private.random_token(10), linked_at = null
  returning link_code into v_code;
  return v_code;
end $$;

-- Admin dashboard numbers. No personal data.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
    'plans', (select coalesce(jsonb_object_agg(plan, n), '{}') from (select plan, count(*) n from public.profiles group by plan) x),
    'live_trips', (select count(*) from public.trips where status in ('active', 'overdue', 'alerted')),
    'open_sos', (select count(*) from public.sos_alerts where status = 'sent'),
    'messages_7d', (select coalesce(jsonb_object_agg(status, n), '{}') from (
      select status, count(*) n from public.messages where created_at > now() - interval '7 days' group by status) x),
    'arrivals_7d', (select count(*) from public.events where kind = 'arrival' and created_at > now() - interval '7 days'),
    'feedback_7d', (select coalesce(jsonb_object_agg(feedback, n), '{}') from (
      select feedback, count(*) n from public.events where feedback is not null and created_at > now() - interval '7 days' group by feedback) x),
    'problem_reports_7d', (select count(*) from public.problem_reports where created_at > now() - interval '7 days')
  );
end $$;

revoke execute on function public.activate_subscription(text, boolean), public.expire_subscriptions(timestamptz),
  public.partner_update_trip(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.nearest_police_stations(double precision, double precision, int), public.police_feed(),
  public.start_subscription(text, text, text), public.create_partner_link(text), public.admin_stats() from public, anon;
grant execute on function public.nearest_police_stations(double precision, double precision, int), public.police_feed(),
  public.start_subscription(text, text, text), public.create_partner_link(text), public.admin_stats() to authenticated;
grant execute on all functions in schema public to service_role;
revoke execute on function private.link_family_member() from public, anon, authenticated;
