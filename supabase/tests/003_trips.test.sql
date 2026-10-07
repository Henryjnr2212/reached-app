begin;
select plan(24);

select tests.create_user('+233241110011', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110011') as mom \gset
select tests.add_contact(:'ama', 'Dad', '+233201110012') as dad \gset
select tests.add_place(:'ama', 'Work') as work \gset

select private.clock(now() + interval '30 minutes') as due30, private.clock(now() + interval '60 minutes') as due60 \gset
select tests.login(:'ama');

select throws_ok($$select public.start_trip('{"dest_name":"Work","contact_ids":[]}')$$, 'P0001', 'no_contacts', 'trip needs a contact');
select throws_ok(format($$select public.start_trip('{"place_id":"%s","contact_ids":["%s"],"check_on_me":true,"expected_at":"2000-01-01T00:00:00Z"}')$$, :'work', :'mom'),
  'P0001', 'bad_expected_time', 'expected time must be in the future');

select (public.start_trip(jsonb_build_object(
  'place_id', :'work', 'contact_ids', jsonb_build_array(:'mom', :'dad'), 'tell_leaving', true,
  'check_on_me', true, 'expected_at', now() + interval '30 minutes', 'grace_minutes', 15,
  'contact_messages', jsonb_build_object(:'dad', '{name} made it to {place}, Dad!')
))).id as trip \gset

select is((select dest_name from public.trips where id = :'trip'), 'Work', 'destination copied from place');
select is((select status from public.trips where id = :'trip'), 'active', 'trip is active');
select is((select count(*)::int from public.trip_contacts where trip_id = :'trip'), 2, 'two contacts on the trip');
select is((select count(*)::int from public.messages m join public.events e on e.id = m.event_id where e.kind = 'on_the_way'), 2,
  '"Tell them I''m leaving now" queues an on-the-way message per contact');
select is((select params ->> 'due' from public.messages m join public.events e on e.id = m.event_id where e.kind = 'on_the_way' limit 1),
  :'due30', 'on-the-way message carries the expected time');

select throws_ok(format($$select public.start_trip('{"dest_name":"Gym","contact_ids":["%s"],"check_on_me":false}')$$, :'mom'),
  'P0001', 'trip_in_progress', 'only one live trip at a time');

-- Running late +30 and tell them.
select public.extend_trip(:'trip', 30, true);
select ok((select expected_at from public.trips where id = :'trip') = now() + interval '60 minutes', 'expected time moved by 30 min');
select is((select count(*)::int from public.events where kind = 'running_late'), 1, 'running-late event created');
select is((select params ->> 'due' from public.messages m join public.events e on e.id = m.event_id where e.kind = 'running_late' limit 1),
  :'due60', 'running-late message has the new time');

select trip_checkin from public.trip_checkin(:'trip', 5.62, -0.17, 12, 64);
select is((select battery_pct from public.trips where id = :'trip'), 64, 'check-in stores battery');
select is((select count(*)::int from public.location_pings where trip_id = :'trip'), 1, 'check-in stores a ping');

-- I've arrived.
select public.arrive_trip(:'trip', 5.6211, -0.1739, 'manual') as arrival \gset
select is((select status from public.trips where id = :'trip'), 'arrived', 'trip arrived');
select is((select count(*)::int from public.messages where event_id = :'arrival'), 2, 'arrival message per contact');
select is((select template from public.messages where event_id = :'arrival' and contact_id = :'mom'), 'arrived', 'Mom gets the standard template');
select is((select template from public.messages where event_id = :'arrival' and contact_id = :'dad'), 'custom', 'Dad gets the per-contact wording');
select is((select params ->> 'custom' from public.messages where event_id = :'arrival' and contact_id = :'dad'), '{name} made it to {place}, Dad!', '…with the edited text');
select is((select status from public.messages where event_id = :'arrival' limit 1), 'pending', 'messages queued for dispatch');
select is((select count(*)::int from public.notifications where kind = 'arrival_sent'), 0, 'manual arrival needs no push');
select throws_ok(format($$select public.arrive_trip(%L)$$, :'trip'), 'P0001', 'trip_not_live', 'cannot arrive twice');

-- Cancel and tell them plans changed.
select (public.start_trip(jsonb_build_object('dest_name', 'Gym', 'contact_ids', jsonb_build_array(:'mom'), 'check_on_me', false))).id as trip2 \gset
select public.cancel_trip(:'trip2', true);
select is((select status from public.trips where id = :'trip2'), 'cancelled', 'trip cancelled');
select is((select template from public.messages m join public.events e on e.id = m.event_id where e.kind = 'plans_changed'), 'plans_changed',
  'plans-changed message queued');

-- Cancel quietly.
select (public.start_trip(jsonb_build_object('dest_name', 'Church', 'contact_ids', jsonb_build_array(:'mom'), 'check_on_me', false))).id as trip3 \gset
select public.cancel_trip(:'trip3', false);
select is((select count(*)::int from public.events where trip_id = :'trip3'), 0, 'quiet cancel sends nothing');
reset role;

select * from finish();
rollback;
