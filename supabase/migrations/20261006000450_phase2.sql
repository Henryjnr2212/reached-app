-- Phase 2: auto-detect arrivals and the public live location page.

-- "Arrived safely in East Legon": the app noticed the user left somewhere and
-- stopped somewhere new. Goes to default contacts, respects Ask me first.
create or replace function public.report_auto_arrival(
  p_area text, p_lat double precision, p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_profile public.profiles;
  v_contacts uuid[];
  v_event uuid;
  v_held boolean;
  v_area text := coalesce(nullif(trim(p_area), ''), 'their destination');
begin
  select * into v_profile from public.profiles where id = v_user;
  if not v_profile.auto_detect then
    raise exception 'auto_detect_off';
  end if;
  if exists (select 1 from public.events where user_id = v_user and kind = 'arrival' and source = 'auto'
             and place_name = v_area and created_at > now() - interval '1 hour') then
    return null;
  end if;
  select coalesce(array_agg(id), '{}') into v_contacts from public.contacts where user_id = v_user and is_default;
  if cardinality(v_contacts) = 0 then
    return null;
  end if;
  v_held := v_profile.arrival_mode = 'ask';
  insert into public.events (user_id, kind, status, place_name, lat, lng, source, auto_send_at)
  values (v_user, 'arrival', case when v_held then 'pending_confirmation' else 'sent' end, v_area, p_lat, p_lng, 'auto',
    case when v_held and v_profile.ask_timeout_min is not null then now() + make_interval(mins => v_profile.ask_timeout_min) end)
  returning id into v_event;
  perform private.enqueue(v_event, 'arrived', jsonb_build_object('name', private.first_name(v_user), 'place', v_area,
    'time', private.clock(now())), v_contacts, 'arrival', v_held, v_profile.default_message);
  perform private.notify(v_user, case when v_held then 'ask_first' else 'arrival_sent' end,
    case when v_held then 'You''ve reached ' || v_area || '. Tell your people?' else 'Told your people you reached ' || v_area end,
    'Auto-detect noticed you arrived.', jsonb_build_object('event_id', v_event));
  return v_event;
end $$;

/*
 * Public live location page (no login). Returns only what a contact needs.
 * Trip details (transport, plate, driver) are included only in emergencies.
 * Links expire when the trip ends, or 2 hours after an alert is cleared.
 */
create or replace function public.get_live(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.trips;
  s public.sos_alerts;
  p public.profiles;
  v_emergency boolean;
  v_live boolean;
  v_lat double precision;
  v_lng double precision;
  v_updated timestamptz;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9]{8}$' then
    return jsonb_build_object('state', 'not_found');
  end if;

  select * into s from public.sos_alerts where live_token = p_token;
  if found then
    select * into p from public.profiles where id = s.user_id;
    select * into t from public.trips where id = s.trip_id;
    v_live := s.status = 'sent' or (s.live_expires_at is not null and s.live_expires_at > now());
    v_emergency := s.status = 'sent';
    v_lat := s.last_lat; v_lng := s.last_lng; v_updated := s.last_ping_at;
  else
    select * into t from public.trips where live_token = p_token;
    if not found then
      return jsonb_build_object('state', 'not_found');
    end if;
    select * into p from public.profiles where id = t.user_id;
    v_live := t.status in ('active', 'overdue', 'alerted') or (t.live_expires_at is not null and t.live_expires_at > now());
    v_emergency := t.status = 'alerted';
    v_lat := t.last_lat; v_lng := t.last_lng; v_updated := t.last_checkin_at;
  end if;

  if not v_live then
    return jsonb_build_object('state', 'ended', 'name', p.first_name);
  end if;

  return jsonb_build_object(
    'state', 'live',
    'kind', case when s.id is not null then 'sos' else 'trip' end,
    'emergency', v_emergency,
    'cleared', (s.id is not null and s.status = 'cleared') or (s.id is null and t.status = 'cancelled'),
    'name', p.first_name,
    'phone', p.phone,
    'lat', v_lat,
    'lng', v_lng,
    'updated_at', v_updated,
    'battery_pct', coalesce(s.battery_pct, t.battery_pct),
    'trip_status', t.status,
    'destination', t.dest_name,
    'expected_at', t.expected_at,
    'details', case when v_emergency then jsonb_build_object(
      'transport', t.transport_type, 'plate', t.plate, 'driver', t.driver_name, 'car', t.car,
      'ride_link', t.ride_link, 'ride_provider', t.ride_provider, 'has_plate_photo', t.plate_photo_path is not null)
    end
  );
end $$;

revoke execute on function public.report_auto_arrival(text, double precision, double precision), public.get_live(text) from public;
grant execute on function public.report_auto_arrival(text, double precision, double precision) to authenticated;
grant execute on function public.get_live(text) to anon, authenticated;
