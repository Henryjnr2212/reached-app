begin;
select plan(26);

select tests.create_user('+233241110021', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110021', true) as mom \gset
select tests.add_contact(:'ama', 'Kofi', '+233201110022', false) as kofi \gset
select tests.add_contact(:'ama', 'Aunty', '+233201110023', true) as aunty \gset

select tests.login(:'ama');
select (public.start_trip(jsonb_build_object('dest_name', 'Work', 'contact_ids', jsonb_build_array(:'kofi'),
  'check_on_me', true, 'expected_at', now() + interval '1 minute', 'grace_minutes', 15))).id as trip \gset
reset role;

select is(public.check_overdue_trips(now() + interval '15 minutes'), '{"alerted": 0, "prompted": 0}'::jsonb, 'nothing before expected + grace');
select is(public.check_overdue_trips(now() + interval '16 minutes'), '{"alerted": 0, "prompted": 1}'::jsonb, 'prompted at expected + grace');
select is((select status from public.trips where id = :'trip'), 'overdue', 'trip is overdue');
select is((select count(*)::int from public.notifications where kind = 'are_you_okay' and user_id = :'ama'), 1, '"Are you okay?" push queued');
select is(public.check_overdue_trips(now() + interval '20 minutes'), '{"alerted": 0, "prompted": 0}'::jsonb, 'no alert inside 5 minutes');
select is(public.check_overdue_trips(now() + interval '20 minutes'), '{"alerted": 0, "prompted": 0}'::jsonb, 'idempotent');

-- No answer: alert emergency contacts (not Kofi, who is only a trip contact).
update public.trips set last_checkin_at = now() - interval '30 minutes', last_lat = 5.6, last_lng = -0.18 where id = :'trip';
select is(public.check_overdue_trips(now() + interval '21 minutes'), '{"alerted": 1, "prompted": 0}'::jsonb, 'alerted after 5 minutes');
select is((select status from public.trips where id = :'trip'), 'alerted', 'trip is alerted');
select results_eq(
  $$select contact_name from public.messages m join public.events e on e.id = m.event_id where e.kind = 'overdue_alert' order by contact_name$$,
  array['Aunty', 'Mom'], 'overdue alert goes to emergency contacts');
select is((select is_safety from public.messages m join public.events e on e.id = m.event_id where e.kind = 'overdue_alert' limit 1), true,
  'overdue alerts are safety messages');
select is((select params ->> 'phoneMayBeOff' from public.messages m join public.events e on e.id = m.event_id where e.kind = 'overdue_alert' limit 1),
  'true', 'stale check-ins add "phone may be off"');
select ok((select params ->> 'link' from public.messages m join public.events e on e.id = m.event_id where e.kind = 'overdue_alert' limit 1)
  like 'https://reached.app/l/%', 'alert carries the live link');
select is((select count(*)::int from public.notifications where kind = 'alert_sent'), 1, '"Alert sent to your contacts" push queued');

-- I'm safe now → All clear to the people who were alerted.
select tests.login(:'ama');
select throws_ok(format($$select public.extend_trip(%L, 15)$$, :'trip'), 'P0001', 'trip_alerted', 'cannot quietly extend after an alert');
select public.im_safe() as clear \gset
select results_eq($$select contact_name from public.messages where event_id = (select id from public.events where kind = 'all_clear') order by 1$$,
  array['Aunty', 'Mom'], 'all clear goes to the alerted contacts');
select is((select status from public.trips where id = :'trip'), 'cancelled', 'trip ended after all clear');
select throws_ok($$select public.im_safe()$$, 'P0001', 'nothing_to_clear', 'nothing left to clear');

-- Answers within 5 minutes.
select (public.start_trip(jsonb_build_object('dest_name', 'Gym', 'contact_ids', jsonb_build_array(:'mom'),
  'check_on_me', true, 'expected_at', now() + interval '1 minute', 'grace_minutes', 10))).id as t2 \gset
reset role;
select public.check_overdue_trips(now() + interval '12 minutes');
select tests.login(:'ama');
select is(public.respond_overdue(:'t2', 'more_time', 30), '{"status": "active"}'::jsonb, 'Need more time keeps watching');
select is((select status from public.trips where id = :'t2'), 'active', 'back to active');
select is((select overdue_prompted_at from public.trips where id = :'t2'), null, 'prompt cleared');
select is(public.respond_overdue(:'t2', 'still_going'), '{"status": "active"}'::jsonb, 'Still on the way keeps the trip going');
select ok((public.respond_overdue(:'t2', 'arrived') ->> 'event_id') is not null, 'I''m okay → arrived sends a normal arrival');
select is((select status from public.trips where id = :'t2'), 'arrived', 'trip arrived');
select is((select count(*)::int from public.events where trip_id = :'t2' and kind = 'overdue_alert'), 0, 'no alert sent');

-- Get help → immediate SOS-style alert.
select (public.start_trip(jsonb_build_object('dest_name', 'Market', 'contact_ids', jsonb_build_array(:'mom'),
  'check_on_me', true, 'expected_at', now() + interval '1 minute'))).id as t3 \gset
select ok((public.respond_overdue(:'t3', 'get_help') ->> 'sos_id') is not null, 'Get help raises an SOS');
select is((select count(*)::int from public.messages m join public.events e on e.id = m.event_id where e.kind = 'sos'), 2,
  'emergency contacts alerted immediately');
reset role;

select * from finish();
rollback;
