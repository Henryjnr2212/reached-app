-- Reached: server-side state machine. Every state change a user can make goes
-- through these functions; the overdue check, ask-me-first timeout and data
-- cleanup run from pg_cron (see 20261006000500_cron.sql).

-------------------------------------------------------------------------------
-- Internal helpers
-------------------------------------------------------------------------------

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v;
end $$;

create or replace function private.live_link(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.setting('live_base_url', 'https://reached.app/l/') || p_token;
$$;

create or replace function private.first_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(first_name, ''), 'Your contact') from public.profiles where id = p_user;
$$;

-- SMS sent this calendar month that count toward the plan allowance.
create or replace function private.sms_used_this_month(p_user uuid, p_now timestamptz default now())
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.messages
  where user_id = p_user and channel = 'sms' and not is_safety
    and status in ('pending', 'sending', 'sent', 'delivered')
    and created_at >= date_trunc('month', p_now at time zone 'Africa/Accra') at time zone 'Africa/Accra';
$$;

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_prefs record;
begin
  select notify_arrivals, notify_requests, notify_tips into v_prefs from public.profiles where id = p_user;
  -- Late check-ins and safety notifications are always on (SPEC §10).
  if (p_kind = 'arrival_sent' and not coalesce(v_prefs.notify_arrivals, true))
     or (p_kind = 'contact_request' and not coalesce(v_prefs.notify_requests, true))
     or (p_kind = 'tip' and not coalesce(v_prefs.notify_tips, false)) then
    return null;
  end if;
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, p_data)
  returning id into v_id;
  return v_id;
end $$;

-- "Mom", "Mom and Dad", "Mom and 2 others"
create or replace function private.told_who(p_names text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(cardinality(p_names), 0)
    when 0 then 'nobody'
    when 1 then p_names[1]
    when 2 then p_names[1] || ' and ' || p_names[2]
    else p_names[1] || ' and ' || (cardinality(p_names) - 1) || ' others'
  end;
$$;

/*
 * Queue one message per contact per channel for an event.
 * p_kind: 'arrival' (counts toward the SMS allowance), 'safety' (always sent),
 * 'system' (intro / test / replies).
 * p_custom: user wording with {name} {place} {time}; rendered by the dispatcher.
 * p_custom_by_contact: per-contact wording overrides (trip "Edit" per contact).
 */
create or replace function private.enqueue(
  p_event_id uuid,
  p_template text,
  p_params jsonb,
  p_contact_ids uuid[],
  p_kind text default 'arrival',
  p_held boolean default false,
  p_custom text default null,
  p_custom_by_contact jsonb default '{}'
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_plan text;
  v_used int;
  v_allowance int;
  c record;
  v_channels text[];
  v_ch text;
  v_status text;
  v_reason text;
  v_template text;
  v_params jsonb;
  v_custom text;
  v_count int := 0;
begin
  select e.user_id, p.plan into v_user, v_plan
  from public.events e join public.profiles p on p.id = e.user_id
  where e.id = p_event_id;
  v_used := private.sms_used_this_month(v_user);
  v_allowance := private.plan_limit(v_plan, 'sms');

  for c in
    select * from public.contacts
    where user_id = v_user and id = any (p_contact_ids)
    order by created_at
  loop
    v_channels := case c.channel when 'both' then array['sms', 'whatsapp'] else array[c.channel] end;
    v_reason := null;
    -- SPEC §13: allowance used → arrivals move to WhatsApp where possible.
    if p_kind = 'arrival' and v_used >= v_allowance then
      if c.channel = 'sms' then
        v_reason := 'sms_allowance';
      else
        v_channels := array['whatsapp'];
      end if;
    end if;

    v_custom := coalesce(p_custom_by_contact ->> c.id::text, p_custom);
    if v_custom is not null and p_template in ('arrived', 'left') then
      v_template := 'custom';
      v_params := p_params || jsonb_build_object('custom', v_custom);
    else
      v_template := p_template;
      v_params := p_params;
    end if;

    foreach v_ch in array v_channels loop
      v_status := case
        when c.opted_out_at is not null then 'opted_out'
        when v_reason is not null then 'failed'
        when p_held then 'held'
        else 'pending'
      end;
      insert into public.messages (
        user_id, event_id, contact_id, contact_name, to_phone, channel, template, params,
        language, status, is_safety, failure_reason
      ) values (
        v_user, p_event_id, c.id, c.name, c.phone, v_ch, v_template, v_params,
        c.language, v_status, p_kind = 'safety',
        case when c.opted_out_at is not null then 'Replied STOP' else v_reason end
      );
      if v_ch = 'sms' and v_status = 'pending' and p_kind = 'arrival' then
        v_used := v_used + 1;
      end if;
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end $$;

-- Pick the wording for an arrival: per-trip text, then the user's default.
create or replace function private.arrival_custom(p_user uuid, p_trip_message text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_trip_message, (select default_message from public.profiles where id = p_user));
$$;

create or replace function private.rule_matches(
  p_days smallint[], p_start time, p_end time, p_at timestamptz
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Africa/Accra';
  v_dow int := extract(dow from v_local)::int;
  v_time time := v_local::time;
begin
  if p_start is null or p_end is null then
    return v_dow = any (p_days);
  end if;
  if p_start < p_end then
    return v_dow = any (p_days) and v_time >= p_start and v_time < p_end;
  end if;
  -- Overnight window: early-morning part belongs to the previous day's schedule.
  if v_time >= p_start then
    return v_dow = any (p_days);
  elsif v_time < p_end then
    return ((v_dow + 6) % 7) = any (p_days);
  end if;
  return false;
end $$;

-------------------------------------------------------------------------------
-- Contacts: intro SMS on add (SPEC §3.6, §11)
-------------------------------------------------------------------------------

create or replace function private.contact_intro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  insert into public.events (user_id, kind, source, place_name)
  values (new.user_id, 'intro', 'app', null)
  returning id into v_event;
  perform private.enqueue(v_event, 'intro', jsonb_build_object('name', private.first_name(new.user_id)),
    array[new.id], 'system');
  update public.contacts set intro_sent_at = now() where id = new.id;
  return new;
end $$;

create trigger contacts_intro after insert on public.contacts
  for each row execute function private.contact_intro();

-------------------------------------------------------------------------------
-- Trips
-------------------------------------------------------------------------------

create or replace function public.start_trip(p jsonb)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_trip public.trips;
  v_place public.places;
  v_contacts uuid[];
  v_expected timestamptz := (p ->> 'expected_at')::timestamptz;
  v_check boolean := coalesce((p ->> 'check_on_me')::boolean, v_expected is not null);
  v_event uuid;
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_user;

  select coalesce(array_agg(id), '{}') into v_contacts from public.contacts
  where user_id = v_user and id in (select jsonb_array_elements_text(coalesce(p -> 'contact_ids', '[]'))::uuid);
  if cardinality(v_contacts) = 0 then
    raise exception 'no_contacts' using hint = 'Choose at least one person to tell.';
  end if;

  if p ->> 'place_id' is not null then
    select * into v_place from public.places where id = (p ->> 'place_id')::uuid and user_id = v_user;
    if not found then
      raise exception 'place_not_found';
    end if;
  end if;

  if v_check and (v_expected is null or v_expected <= now()) then
    raise exception 'bad_expected_time' using hint = 'Choose a time in the future.';
  end if;

  if exists (select 1 from public.trips where user_id = v_user and status in ('active', 'overdue', 'alerted')) then
    raise exception 'trip_in_progress' using hint = 'Finish or cancel your current trip first.';
  end if;

  insert into public.trips (
    user_id, place_id, dest_name, dest_lat, dest_lng, radius_m, expected_at, grace_minutes,
    check_on_me, tell_leaving, message, transport_type, plate, plate_photo_path, driver_name, car,
    ride_provider, ride_link, source, last_checkin_at, last_lat, last_lng
  ) values (
    v_user,
    v_place.id,
    coalesce(v_place.name, nullif(p ->> 'dest_name', '')),
    coalesce(v_place.lat, (p ->> 'dest_lat')::double precision),
    coalesce(v_place.lng, (p ->> 'dest_lng')::double precision),
    coalesce(v_place.radius_m, (p ->> 'radius_m')::int, 150),
    v_expected,
    coalesce((p ->> 'grace_minutes')::int, v_profile.grace_minutes),
    v_check,
    coalesce((p ->> 'tell_leaving')::boolean, false),
    nullif(p ->> 'message', ''),
    p ->> 'transport_type',
    nullif(p ->> 'plate', ''),
    nullif(p ->> 'plate_photo_path', ''),
    nullif(p ->> 'driver_name', ''),
    nullif(p ->> 'car', ''),
    p ->> 'ride_provider',
    nullif(p ->> 'ride_link', ''),
    coalesce(p ->> 'source', 'manual'),
    now(),
    (p ->> 'here_lat')::double precision,
    (p ->> 'here_lng')::double precision
  ) returning * into v_trip;

  insert into public.trip_contacts (trip_id, contact_id, message)
  select v_trip.id, c, nullif(p -> 'contact_messages' ->> c::text, '')
  from unnest(v_contacts) c;

  if v_trip.tell_leaving then
    insert into public.events (user_id, kind, trip_id, place_id, place_name, source)
    values (v_user, 'on_the_way', v_trip.id, v_trip.place_id, v_trip.dest_name, 'trip')
    returning id into v_event;
    perform private.enqueue(v_event, 'on_the_way', jsonb_build_object(
      'name', private.first_name(v_user),
      'place', coalesce(v_trip.dest_name, 'their destination'),
      'due', case when v_trip.expected_at is null then 'soon' else private.clock(v_trip.expected_at) end
    ), v_contacts, 'arrival');
  end if;

  return v_trip;
end $$;

create or replace function private.live_trip(p_user uuid, p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.trips;
begin
  select * into v from public.trips where id = p_trip_id and user_id = p_user for update;
  if not found then
    raise exception 'trip_not_found';
  end if;
  if v.status not in ('active', 'overdue', 'alerted') then
    raise exception 'trip_not_live' using hint = 'This trip has already ended.';
  end if;
  return v;
end $$;

-- Shared by "I've arrived", detected arrival and the overdue "Yes, I've arrived".
create or replace function private.complete_trip(
  p_trip public.trips, p_lat double precision, p_lng double precision, p_source text,
  p_extra_contacts uuid[] default '{}', p_extra_custom text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_event uuid;
  v_contacts uuid[];
  v_overrides jsonb;
  v_held boolean;
  v_names text[];
begin
  select * into v_profile from public.profiles where id = p_trip.user_id;

  update public.trips set status = 'arrived', arrived_at = now(), ended_at = now(), live_expires_at = now(),
    last_lat = coalesce(p_lat, last_lat), last_lng = coalesce(p_lng, last_lng)
  where id = p_trip.id;

  select coalesce(array_agg(contact_id), '{}'),
         coalesce(jsonb_object_agg(contact_id::text, message) filter (where message is not null), '{}')
  into v_contacts, v_overrides
  from public.trip_contacts where trip_id = p_trip.id;
  v_contacts := array(select distinct unnest(v_contacts || p_extra_contacts));

  -- Ask me first applies to automatic detection only; a tap is already a yes.
  v_held := p_source = 'auto' and v_profile.arrival_mode = 'ask';

  insert into public.events (user_id, kind, status, trip_id, place_id, place_name, lat, lng, source, auto_send_at)
  values (p_trip.user_id, 'arrival', case when v_held then 'pending_confirmation' else 'sent' end,
    p_trip.id, p_trip.place_id, p_trip.dest_name, coalesce(p_lat, p_trip.last_lat), coalesce(p_lng, p_trip.last_lng),
    case when p_source = 'auto' then 'auto' else 'trip' end,
    case when v_held and v_profile.ask_timeout_min is not null then now() + make_interval(mins => v_profile.ask_timeout_min) end)
  returning id into v_event;

  perform private.enqueue(v_event, 'arrived', jsonb_build_object(
    'name', private.first_name(p_trip.user_id),
    'place', coalesce(p_trip.dest_name, 'their destination'),
    'time', private.clock(now())
  ), v_contacts, 'arrival', v_held,
  coalesce(p_trip.message, p_extra_custom, v_profile.default_message), v_overrides);

  select array_agg(name order by created_at) into v_names from public.contacts where id = any (v_contacts);
  if v_held then
    perform private.notify(p_trip.user_id, 'ask_first',
      'You''ve reached ' || coalesce(p_trip.dest_name, 'your destination') || '. Tell ' || private.told_who(v_names) || '?',
      'Tap Send to let them know.', jsonb_build_object('event_id', v_event));
  elsif p_source = 'auto' then
    perform private.notify(p_trip.user_id, 'arrival_sent',
      'Told ' || private.told_who(v_names) || ' you reached ' || coalesce(p_trip.dest_name, 'your destination'),
      'Tap to see delivery.', jsonb_build_object('event_id', v_event));
  end if;
  return v_event;
end $$;

create or replace function public.arrive_trip(
  p_trip_id uuid, p_lat double precision default null, p_lng double precision default null,
  p_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_trip public.trips := private.live_trip(v_user, p_trip_id);
begin
  if p_source not in ('manual', 'auto') then
    raise exception 'bad_source';
  end if;
  return private.complete_trip(v_trip, p_lat, p_lng, p_source);
end $$;

create or replace function public.extend_trip(p_trip_id uuid, p_minutes int, p_tell boolean default false)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_trip public.trips := private.live_trip(v_user, p_trip_id);
  v_event uuid;
  v_contacts uuid[];
begin
  if p_minutes is null or p_minutes < 1 or p_minutes > 24 * 60 then
    raise exception 'bad_minutes';
  end if;
  if v_trip.status = 'alerted' then
    raise exception 'trip_alerted' using hint = 'Your contacts were alerted. Tap I''m safe now first.';
  end if;
  update public.trips
  set expected_at = greatest(coalesce(expected_at, now()), now()) + make_interval(mins => p_minutes),
      check_on_me = true, status = 'active', overdue_prompted_at = null
  where id = p_trip_id
  returning * into v_trip;

  if p_tell then
    select array_agg(contact_id) into v_contacts from public.trip_contacts where trip_id = p_trip_id;
    insert into public.events (user_id, kind, trip_id, place_id, place_name, source)
    values (v_user, 'running_late', v_trip.id, v_trip.place_id, v_trip.dest_name, 'trip')
    returning id into v_event;
    perform private.enqueue(v_event, 'running_late', jsonb_build_object(
      'name', private.first_name(v_user), 'place', coalesce(v_trip.dest_name, 'their destination'),
      'due', private.clock(v_trip.expected_at)), v_contacts, 'arrival');
  end if;
  return v_trip;
end $$;

create or replace function public.cancel_trip(p_trip_id uuid, p_tell boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_trip public.trips := private.live_trip(v_user, p_trip_id);
  v_event uuid;
  v_contacts uuid[];
begin
  if v_trip.status = 'alerted' then
    raise exception 'trip_alerted' using hint = 'Your contacts were alerted. Tap I''m safe now instead.';
  end if;
  update public.trips set status = 'cancelled', ended_at = now(), live_expires_at = now() where id = p_trip_id;
  if p_tell then
    select array_agg(contact_id) into v_contacts from public.trip_contacts where trip_id = p_trip_id;
    insert into public.events (user_id, kind, trip_id, place_id, place_name, source)
    values (v_user, 'plans_changed', v_trip.id, v_trip.place_id, v_trip.dest_name, 'trip')
    returning id into v_event;
    perform private.enqueue(v_event, 'plans_changed', jsonb_build_object(
      'name', private.first_name(v_user), 'place', coalesce(v_trip.dest_name, 'their destination')),
      v_contacts, 'arrival');
  end if;
end $$;

-- Background location check-in. Returns the trip status so the app can show
-- "Are you okay?" even if the push was missed.
create or replace function public.trip_checkin(
  p_trip_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy real default null, p_battery int default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_trip public.trips := private.live_trip(v_user, p_trip_id);
begin
  update public.trips
  set last_checkin_at = now(), last_lat = p_lat, last_lng = p_lng, battery_pct = coalesce(p_battery, battery_pct)
  where id = p_trip_id;
  insert into public.location_pings (user_id, trip_id, lat, lng, accuracy_m, battery_pct)
  values (v_user, p_trip_id, p_lat, p_lng, p_accuracy, p_battery);
  return v_trip.status;
end $$;

-------------------------------------------------------------------------------
-- Overdue flow (SPEC §8)
-------------------------------------------------------------------------------

create or replace function private.alert_trip(p_trip public.trips)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_contacts uuid[];
begin
  update public.trips set status = 'alerted', alerted_at = now() where id = p_trip.id;

  select coalesce(array_agg(id), '{}') into v_contacts from public.contacts
  where user_id = p_trip.user_id and is_emergency;
  if cardinality(v_contacts) = 0 then
    select coalesce(array_agg(contact_id), '{}') into v_contacts from public.trip_contacts where trip_id = p_trip.id;
  end if;

  insert into public.events (user_id, kind, trip_id, place_id, place_name, lat, lng, source)
  values (p_trip.user_id, 'overdue_alert', p_trip.id, p_trip.place_id, p_trip.dest_name,
    p_trip.last_lat, p_trip.last_lng, 'server')
  returning id into v_event;

  perform private.enqueue(v_event, 'overdue_alert', jsonb_build_object(
    'name', private.first_name(p_trip.user_id),
    'place', coalesce(p_trip.dest_name, 'their destination'),
    'due', private.clock(p_trip.expected_at),
    'lastSeen', case when p_trip.last_checkin_at is null then 'unknown' else private.clock(p_trip.last_checkin_at) end,
    'link', private.live_link(p_trip.live_token),
    'phoneMayBeOff', p_trip.last_checkin_at is null or p_trip.last_checkin_at <= now() - interval '10 minutes'
  ), v_contacts, 'safety');

  perform private.notify(p_trip.user_id, 'alert_sent', 'Alert sent to your contacts',
    'We couldn''t reach you, so your emergency contacts were alerted. Tap I''m safe now if you''re okay.',
    jsonb_build_object('trip_id', p_trip.id, 'event_id', v_event));
  return v_event;
end $$;

-- Runs every minute from pg_cron.
create or replace function public.check_overdue_trips(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.trips;
  v_prompted int := 0;
  v_alerted int := 0;
begin
  for t in
    select * from public.trips
    where status = 'active' and check_on_me and expected_at is not null
      and expected_at + make_interval(mins => grace_minutes) <= p_now
    for update skip locked
  loop
    update public.trips set status = 'overdue', overdue_prompted_at = p_now where id = t.id;
    perform private.notify(t.user_id, 'are_you_okay', 'Are you okay?',
      'You haven''t reached ' || coalesce(t.dest_name, 'your destination') || ' yet. Tap to answer, or we''ll alert your contacts in 5 minutes.',
      jsonb_build_object('trip_id', t.id));
    v_prompted := v_prompted + 1;
  end loop;

  for t in
    select * from public.trips
    where status = 'overdue' and overdue_prompted_at <= p_now - interval '5 minutes'
    for update skip locked
  loop
    perform private.alert_trip(t);
    v_alerted := v_alerted + 1;
  end loop;

  return jsonb_build_object('prompted', v_prompted, 'alerted', v_alerted);
end $$;

-- Answers to "Are you okay?".
create or replace function public.respond_overdue(p_trip_id uuid, p_answer text, p_minutes int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_trip public.trips := private.live_trip(v_user, p_trip_id);
  v_sos public.sos_alerts;
begin
  case p_answer
    when 'arrived' then
      return jsonb_build_object('event_id', private.complete_trip(v_trip, null, null, 'manual'));
    when 'still_going' then
      if v_trip.status = 'alerted' then raise exception 'trip_alerted'; end if;
      perform public.extend_trip(p_trip_id, 15, false);
      return jsonb_build_object('status', 'active');
    when 'more_time' then
      if p_minutes not in (15, 30, 60) then raise exception 'bad_minutes'; end if;
      perform public.extend_trip(p_trip_id, p_minutes, false);
      return jsonb_build_object('status', 'active');
    when 'get_help' then
      v_sos := public.trigger_sos(v_trip.last_lat, v_trip.last_lng, v_trip.battery_pct, 'overdue_help');
      return jsonb_build_object('sos_id', v_sos.id);
    else
      raise exception 'bad_answer';
  end case;
end $$;

-------------------------------------------------------------------------------
-- Place rules (SPEC §6) and duplicate suppression (SPEC §13)
-------------------------------------------------------------------------------

create or replace function public.report_place_event(
  p_place_id uuid, p_event text, p_lat double precision default null, p_lng double precision default null,
  p_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_place public.places;
  v_profile public.profiles;
  v_contacts uuid[];
  v_custom text;
  v_trip public.trips;
  v_kind text := case p_event when 'arrive' then 'arrival' when 'leave' then 'departure' end;
  v_event uuid;
  v_held boolean;
  v_names text[];
begin
  if v_kind is null then
    raise exception 'bad_event';
  end if;
  select * into v_place from public.places where id = p_place_id and user_id = v_user;
  if not found then
    raise exception 'place_not_found';
  end if;
  select * into v_profile from public.profiles where id = v_user;

  -- Same place can't trigger the same message again within 1 hour.
  if exists (
    select 1 from public.events
    where user_id = v_user and place_id = p_place_id and kind = v_kind and status <> 'cancelled'
      and created_at > p_at - interval '1 hour'
  ) then
    return null;
  end if;

  select coalesce(array_agg(distinct rc.contact_id), '{}'),
         (array_agg(r.message order by r.created_at) filter (where r.message is not null))[1]
  into v_contacts, v_custom
  from public.rules r
  join public.rule_contacts rc on rc.rule_id = r.id
  where r.place_id = p_place_id and r.user_id = v_user and r.enabled and r.event = p_event
    and private.rule_matches(r.days, r.window_start, r.window_end, p_at);

  -- A live trip to this place arrives together with the rules: one combined
  -- message per contact.
  if p_event = 'arrive' then
    select * into v_trip from public.trips
    where user_id = v_user and place_id = p_place_id and status in ('active', 'overdue') for update;
    if found then
      return private.complete_trip(v_trip, p_lat, p_lng, 'auto', v_contacts, v_custom);
    end if;
  end if;

  if cardinality(v_contacts) = 0 then
    return null;
  end if;

  v_held := v_profile.arrival_mode = 'ask';
  insert into public.events (user_id, kind, status, place_id, place_name, lat, lng, source, auto_send_at)
  values (v_user, v_kind, case when v_held then 'pending_confirmation' else 'sent' end,
    p_place_id, v_place.name, p_lat, p_lng, 'rule',
    case when v_held and v_profile.ask_timeout_min is not null then now() + make_interval(mins => v_profile.ask_timeout_min) end)
  returning id into v_event;

  perform private.enqueue(v_event, case p_event when 'arrive' then 'arrived' else 'left' end,
    jsonb_build_object('name', private.first_name(v_user), 'place', v_place.name, 'time', private.clock(p_at)),
    v_contacts, 'arrival', v_held, coalesce(v_custom, case when p_event = 'arrive' then v_profile.default_message end));

  select array_agg(name order by created_at) into v_names from public.contacts where id = any (v_contacts);
  if v_held then
    perform private.notify(v_user, 'ask_first',
      'You''ve ' || case p_event when 'arrive' then 'reached ' else 'left ' end || v_place.name || '. Tell ' || private.told_who(v_names) || '?',
      'Tap Send to let them know.', jsonb_build_object('event_id', v_event));
  else
    perform private.notify(v_user, 'arrival_sent',
      'Told ' || private.told_who(v_names) || ' you ' || case p_event when 'arrive' then 'reached ' else 'left ' end || v_place.name,
      'Tap to see delivery.', jsonb_build_object('event_id', v_event));
  end if;
  return v_event;
end $$;

-- Ask me first: Send / Not now.
create or replace function public.confirm_event(p_event_id uuid, p_send boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  if not exists (select 1 from public.events where id = p_event_id and user_id = v_user and status = 'pending_confirmation') then
    raise exception 'event_not_pending';
  end if;
  perform private.release_event(p_event_id, p_send);
end $$;

create or replace function private.release_event(p_event_id uuid, p_send boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events set status = case when p_send then 'sent' else 'cancelled' end, auto_send_at = null
  where id = p_event_id;
  update public.messages set status = case when p_send then 'pending' else 'cancelled' end
  where event_id = p_event_id and status = 'held';
end $$;

create or replace function public.process_ask_first(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_count int := 0;
begin
  for e in select id from public.events
    where status = 'pending_confirmation' and auto_send_at is not null and auto_send_at <= p_now
    for update skip locked
  loop
    perform private.release_event(e.id, true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-------------------------------------------------------------------------------
-- One-off sends
-------------------------------------------------------------------------------

-- Home "Send I've reached now".
create or replace function public.send_reached_now(
  p_contact_ids uuid[], p_area text, p_lat double precision default null, p_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_event uuid;
  v_place_id uuid;
begin
  if coalesce(cardinality(p_contact_ids), 0) = 0 then
    raise exception 'no_contacts';
  end if;
  insert into public.events (user_id, kind, place_name, lat, lng, source)
  values (v_user, 'arrival', coalesce(nullif(trim(p_area), ''), 'their destination'), p_lat, p_lng, 'app')
  returning id into v_event;
  perform private.enqueue(v_event, 'arrived', jsonb_build_object(
    'name', private.first_name(v_user), 'place', coalesce(nullif(trim(p_area), ''), 'their destination'),
    'time', private.clock(now())), p_contact_ids, 'arrival', false,
    (select default_message from public.profiles where id = v_user));
  return v_event;
end $$;

create or replace function public.send_test_message(p_contact_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_event uuid;
begin
  if not exists (select 1 from public.contacts where id = p_contact_id and user_id = v_user) then
    raise exception 'contact_not_found';
  end if;
  insert into public.events (user_id, kind, source) values (v_user, 'test', 'test') returning id into v_event;
  perform private.enqueue(v_event, 'test', jsonb_build_object('name', private.first_name(v_user)),
    array[p_contact_id], 'system');
  return v_event;
end $$;

-- Settings → Run a test: simulates an arrival and texts only the user.
create or replace function public.run_self_test()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_profile public.profiles;
  v_event uuid;
begin
  select * into v_profile from public.profiles where id = v_user;
  insert into public.events (user_id, kind, place_name, source)
  values (v_user, 'test', 'Test place', 'test') returning id into v_event;
  insert into public.messages (user_id, event_id, contact_id, contact_name, to_phone, channel, template, params)
  values (v_user, v_event, null, 'You', v_profile.phone, 'sms', 'arrived',
    jsonb_build_object('name', coalesce(v_profile.first_name, 'You'), 'place', 'Test place', 'time', private.clock(now())));
  return v_event;
end $$;

create or replace function public.resend_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  update public.messages set status = 'pending', failure_reason = null
  where id = p_message_id and user_id = v_user and status = 'failed'
    and coalesce(failure_reason, '') <> 'sms_allowance';
  if not found then
    raise exception 'cannot_resend';
  end if;
end $$;

create or replace function public.event_feedback(p_event_id uuid, p_feedback text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  update public.events set feedback = p_feedback where id = p_event_id and user_id = v_user;
  if not found then
    raise exception 'event_not_found';
  end if;
end $$;

-------------------------------------------------------------------------------
-- SOS (SPEC §8)
-------------------------------------------------------------------------------

create or replace function public.trigger_sos(
  p_lat double precision default null, p_lng double precision default null, p_battery int default null,
  p_trigger text default 'shield'
)
returns public.sos_alerts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_sos public.sos_alerts;
  v_trip public.trips;
  v_event uuid;
  v_contacts uuid[];
begin
  select * into v_sos from public.sos_alerts where user_id = v_user and status = 'sent';
  if found then
    return v_sos; -- already raised; keep a single open alert
  end if;
  select * into v_trip from public.trips where user_id = v_user and status in ('active', 'overdue', 'alerted');

  insert into public.sos_alerts (user_id, trip_id, trigger, last_lat, last_lng, last_ping_at, battery_pct)
  values (v_user, v_trip.id, p_trigger, coalesce(p_lat, v_trip.last_lat), coalesce(p_lng, v_trip.last_lng),
    now(), p_battery)
  returning * into v_sos;

  if v_trip.id is not null then
    update public.trips set status = 'alerted', alerted_at = coalesce(alerted_at, now()) where id = v_trip.id;
  end if;
  if p_lat is not null then
    insert into public.location_pings (user_id, sos_id, trip_id, lat, lng, battery_pct)
    values (v_user, v_sos.id, v_trip.id, p_lat, p_lng, p_battery);
  end if;

  select coalesce(array_agg(id), '{}') into v_contacts from public.contacts where user_id = v_user and is_emergency;
  if cardinality(v_contacts) = 0 then
    select coalesce(array_agg(id), '{}') into v_contacts from public.contacts where user_id = v_user;
  end if;

  insert into public.events (user_id, kind, sos_id, trip_id, place_id, place_name, lat, lng, source)
  values (v_user, 'sos', v_sos.id, v_trip.id, v_trip.place_id, v_trip.dest_name, v_sos.last_lat, v_sos.last_lng, 'app')
  returning id into v_event;

  perform private.enqueue(v_event, 'sos', jsonb_build_object(
    'name', private.first_name(v_user), 'time', private.clock(v_sos.sent_at),
    'link', private.live_link(v_sos.live_token), 'emergencyNumber', '112'), v_contacts, 'safety');
  return v_sos;
end $$;

-- Location shared every 30 s until "I'm safe now".
create or replace function public.sos_ping(
  p_sos_id uuid, p_lat double precision, p_lng double precision, p_battery int default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  update public.sos_alerts set last_lat = p_lat, last_lng = p_lng, last_ping_at = now(),
    battery_pct = coalesce(p_battery, battery_pct)
  where id = p_sos_id and user_id = v_user and status = 'sent';
  if not found then
    raise exception 'sos_not_open';
  end if;
  insert into public.location_pings (user_id, sos_id, lat, lng, battery_pct)
  values (v_user, p_sos_id, p_lat, p_lng, p_battery);
end $$;

-- "I'm safe now" after an SOS or an overdue alert. The app verifies phone
-- unlock or the app PIN before calling this.
create or replace function public.im_safe()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_contacts uuid[];
  v_event uuid;
  v_sos_ids uuid[];
  v_trip_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_sos_ids from public.sos_alerts where user_id = v_user and status = 'sent';
  select coalesce(array_agg(id), '{}') into v_trip_ids from public.trips where user_id = v_user and status = 'alerted';
  if cardinality(v_sos_ids) = 0 and cardinality(v_trip_ids) = 0 then
    raise exception 'nothing_to_clear';
  end if;

  -- Tell exactly the people who were alerted.
  select coalesce(array_agg(distinct m.contact_id), '{}') into v_contacts
  from public.messages m join public.events e on e.id = m.event_id
  where e.user_id = v_user and e.kind in ('sos', 'overdue_alert') and m.contact_id is not null
    and (e.sos_id = any (v_sos_ids) or e.trip_id = any (v_trip_ids));

  update public.sos_alerts set status = 'cleared', cleared_at = now(), live_expires_at = now() + interval '2 hours'
  where id = any (v_sos_ids);
  update public.trips set status = 'cancelled', ended_at = now(), live_expires_at = now() + interval '2 hours'
  where id = any (v_trip_ids);

  insert into public.events (user_id, kind, sos_id, trip_id, source)
  values (v_user, 'all_clear', v_sos_ids[1], v_trip_ids[1], 'app')
  returning id into v_event;
  perform private.enqueue(v_event, 'all_clear', jsonb_build_object(
    'name', private.first_name(v_user), 'time', private.clock(now())), v_contacts, 'safety');
  return v_event;
end $$;

-------------------------------------------------------------------------------
-- Privacy and data (SPEC §10)
-------------------------------------------------------------------------------

create or replace function public.delete_my_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  delete from public.events where user_id = v_user;
  delete from public.location_pings where user_id = v_user;
  delete from public.notifications where user_id = v_user;
  delete from public.trips where user_id = v_user and status in ('arrived', 'cancelled');
  delete from public.sos_alerts where user_id = v_user and status = 'cleared';
end $$;

create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'contacts', coalesce((select jsonb_agg(to_jsonb(c)) from public.contacts c where user_id = v_user), '[]'),
    'places', coalesce((select jsonb_agg(to_jsonb(x)) from public.places x where user_id = v_user), '[]'),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('contact_ids',
        (select coalesce(jsonb_agg(contact_id), '[]') from public.rule_contacts where rule_id = r.id)))
      from public.rules r where user_id = v_user), '[]'),
    'trips', coalesce((select jsonb_agg(to_jsonb(t) - 'live_token') from public.trips t where user_id = v_user), '[]'),
    'events', coalesce((select jsonb_agg(to_jsonb(e)) from public.events e where user_id = v_user), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) - 'provider_message_id') from public.messages m where user_id = v_user), '[]'),
    'location_pings', coalesce((select jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'at', created_at))
      from public.location_pings where user_id = v_user), '[]')
  );
end $$;

-- Retention: pings after 30 days; activity after the user's 7/30-day setting.
create or replace function public.cleanup_data(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pings int;
  v_events int;
  v_trips int;
begin
  delete from public.location_pings where created_at < p_now - interval '30 days';
  get diagnostics v_pings = row_count;

  delete from public.events e using public.profiles p
  where p.id = e.user_id and e.created_at < p_now - make_interval(days => p.retention_days);
  get diagnostics v_events = row_count;

  delete from public.trips t using public.profiles p
  where p.id = t.user_id and t.status in ('arrived', 'cancelled')
    and coalesce(t.ended_at, t.created_at) < p_now - make_interval(days => p.retention_days);
  get diagnostics v_trips = row_count;

  delete from public.sos_alerts where status = 'cleared' and cleared_at < p_now - interval '30 days';
  delete from public.notifications where created_at < p_now - interval '30 days';
  delete from public.fake_messages where created_at < p_now - interval '7 days';

  return jsonb_build_object('pings', v_pings, 'events', v_events, 'trips', v_trips);
end $$;

-------------------------------------------------------------------------------
-- Server-only: outbox processing, delivery reports and inbound SMS
-------------------------------------------------------------------------------

create or replace function public.claim_messages(p_limit int default 50)
returns setof public.messages
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.messages m set status = 'sending', attempts = attempts + 1
  where m.id in (
    select id from public.messages where status = 'pending' order by created_at limit p_limit for update skip locked
  )
  returning m.*;
end $$;

create or replace function public.mark_message(
  p_id uuid, p_status text, p_body text default null, p_provider_id text default null, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
begin
  if p_status not in ('sent', 'delivered', 'failed', 'opted_out') then
    raise exception 'bad_status';
  end if;
  update public.messages set
    status = p_status,
    body = coalesce(p_body, body),
    provider_message_id = coalesce(p_provider_id, provider_message_id),
    failure_reason = case when p_status = 'failed' then p_reason else null end,
    sent_at = case when p_status in ('sent', 'delivered') then coalesce(sent_at, now()) else sent_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = p_id
  returning * into m;
  if m.id is not null and p_status = 'failed' then
    perform private.message_failed(m);
  end if;
end $$;

create or replace function private.message_failed(m public.messages)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if m.contact_id is not null then
    update public.contacts set last_failed_at = now() where id = m.contact_id;
  end if;
  perform private.notify(m.user_id, 'message_failed', 'Message to ' || m.contact_name || ' failed',
    coalesce(m.failure_reason, 'It wasn''t delivered.') || ' Tap Retry to send it again.',
    jsonb_build_object('event_id', m.event_id, 'message_id', m.id));
end $$;

-- Delivery report webhook (Africa's Talking / WhatsApp).
create or replace function public.update_message_status(p_provider_id text, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
begin
  select * into m from public.messages where provider_message_id = p_provider_id;
  if not found then
    return;
  end if;
  if p_status = 'delivered' then
    update public.messages set status = 'delivered', delivered_at = now() where id = m.id;
  elsif p_status = 'failed' and m.status <> 'failed' then
    perform public.mark_message(m.id, 'failed', null, null, coalesce(p_reason, 'Not delivered'));
  end if;
end $$;

/*
 * Inbound SMS / WhatsApp from a contact. Returns the replies to send:
 * [{ "to": "+233…", "template": "request_accept", "params": {…} }]
 */
create or replace function public.handle_inbound(p_from text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_word text := upper(split_part(trim(coalesce(p_body, '')), ' ', 1));
  v_rest text := lower(trim(substr(trim(coalesce(p_body, '')), length(split_part(trim(coalesce(p_body, '')), ' ', 1)) + 1)));
  c record;
  v_replies jsonb := '[]';
  v_req uuid;
  v_matches int;
begin
  if v_word in ('STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT') then
    for c in select * from public.contacts where phone = p_from and opted_out_at is null loop
      update public.contacts set opted_out_at = now() where id = c.id;
      if c.opt_out_notified_at is null then
        perform private.notify(c.user_id, 'opted_out', c.name || ' opted out',
          c.name || ' replied STOP, so Reached won''t text them any more. Choose someone else to notify.',
          jsonb_build_object('contact_id', c.id));
        update public.contacts set opt_out_notified_at = now() where id = c.id;
      end if;
    end loop;
    return v_replies;
  end if;

  if v_word in ('START', 'UNSTOP') then
    update public.contacts set opted_out_at = null, opt_out_notified_at = null where phone = p_from;
    return v_replies;
  end if;

  if v_word = 'REACHED' then
    -- "REACHED Ama" picks the user by first name if the number belongs to several.
    select count(*) into v_matches from public.contacts ct join public.profiles p on p.id = ct.user_id
    where ct.phone = p_from and (v_rest = '' or lower(p.first_name) = v_rest);
    if v_matches = 0 then
      return jsonb_build_array(jsonb_build_object('to', p_from, 'template', 'request_unknown', 'params', '{}'::jsonb));
    end if;
    for c in
      select ct.*, p.first_name from public.contacts ct join public.profiles p on p.id = ct.user_id
      where ct.phone = p_from and (v_rest = '' or lower(p.first_name) = v_rest)
    loop
      if not c.can_request_location or c.opted_out_at is not null then
        v_replies := v_replies || jsonb_build_object('to', p_from, 'template', 'request_decline',
          'params', jsonb_build_object('name', coalesce(c.first_name, 'They')));
        continue;
      end if;
      if exists (select 1 from public.contact_requests where contact_id = c.id and status = 'pending') then
        continue;
      end if;
      insert into public.contact_requests (user_id, contact_id) values (c.user_id, c.id) returning id into v_req;
      perform private.notify(c.user_id, 'contact_request', c.name || ' wants to know when you reach',
        'Accept to let ' || c.name || ' know when you arrive.', jsonb_build_object('request_id', v_req));
    end loop;
    return v_replies;
  end if;

  return v_replies;
end $$;

-------------------------------------------------------------------------------
-- Phase 2: contact requests
-------------------------------------------------------------------------------

create or replace function public.respond_contact_request(p_request_id uuid, p_accept boolean, p_trip jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_req public.contact_requests;
  v_event uuid;
  v_trip public.trips;
begin
  select * into v_req from public.contact_requests where id = p_request_id and user_id = v_user for update;
  if not found or v_req.status not in ('pending', 'expired') then
    raise exception 'request_not_pending';
  end if;

  insert into public.events (user_id, kind, source) values (v_user, 'contact_request', 'app') returning id into v_event;
  perform private.enqueue(v_event, case when p_accept then 'request_accept' else 'request_decline' end,
    jsonb_build_object('name', private.first_name(v_user)), array[v_req.contact_id], 'system');

  if p_accept and p_trip is not null then
    v_trip := public.start_trip(p_trip || jsonb_build_object('contact_ids', jsonb_build_array(v_req.contact_id), 'source', 'request'));
  end if;
  update public.contact_requests set status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now(), trip_id = v_trip.id
  where id = p_request_id;
  return jsonb_build_object('event_id', v_event, 'trip_id', v_trip.id);
end $$;

-- No answer in 15 min → tell the contact "Ama hasn't responded yet".
create or replace function public.expire_contact_requests(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_event uuid;
  v_count int := 0;
begin
  for r in select * from public.contact_requests
    where status = 'pending' and created_at <= p_now - interval '15 minutes' for update skip locked
  loop
    update public.contact_requests set status = 'expired', nudged_at = p_now where id = r.id;
    insert into public.events (user_id, kind, source) values (r.user_id, 'contact_request', 'server') returning id into v_event;
    perform private.enqueue(v_event, 'request_pending', jsonb_build_object('name', private.first_name(r.user_id)),
      array[r.contact_id], 'system');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-------------------------------------------------------------------------------
-- Permissions
-------------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.start_trip(jsonb),
  public.arrive_trip(uuid, double precision, double precision, text),
  public.extend_trip(uuid, int, boolean),
  public.cancel_trip(uuid, boolean),
  public.trip_checkin(uuid, double precision, double precision, real, int),
  public.respond_overdue(uuid, text, int),
  public.report_place_event(uuid, text, double precision, double precision, timestamptz),
  public.confirm_event(uuid, boolean),
  public.send_reached_now(uuid[], text, double precision, double precision),
  public.send_test_message(uuid),
  public.run_self_test(),
  public.resend_message(uuid),
  public.event_feedback(uuid, text),
  public.trigger_sos(double precision, double precision, int, text),
  public.sos_ping(uuid, double precision, double precision, int),
  public.im_safe(),
  public.delete_my_activity(),
  public.export_my_data(),
  public.respond_contact_request(uuid, boolean, jsonb)
to authenticated;

-- Server-only (service_role / pg_cron).
revoke execute on function
  public.check_overdue_trips(timestamptz),
  public.process_ask_first(timestamptz),
  public.cleanup_data(timestamptz),
  public.claim_messages(int),
  public.mark_message(uuid, text, text, text, text),
  public.update_message_status(text, text, text),
  public.handle_inbound(text, text),
  public.expire_contact_requests(timestamptz)
from authenticated;
grant execute on all functions in schema public to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

-- Functions used inside RLS policies and CHECK constraints run as the caller.
grant usage on schema private to authenticated;
grant execute on function private.is_ghana_e164(text), private.is_admin(), private.is_police(),
  private.random_token(int) to authenticated;
