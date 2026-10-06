begin;
select plan(13);

select tests.create_user('+233241110051', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110051', true) as mom \gset
select tests.add_contact(:'ama', 'Kojo', '+233201110052', false) as kojo \gset

select tests.login(:'ama');
select (public.trigger_sos(5.6037, -0.187, 41)).id as sos \gset
select is((select status from public.sos_alerts where id = :'sos'), 'sent', 'SOS raised');
select results_eq($$select contact_name from public.messages m join public.events e on e.id = m.event_id where e.kind = 'sos'$$,
  array['Mom'], 'only emergency contacts alerted');
select is((select template from public.messages m join public.events e on e.id = m.event_id where e.kind = 'sos'), 'sos', 'SOS template');
select is((select params ->> 'emergencyNumber' from public.messages m join public.events e on e.id = m.event_id where e.kind = 'sos'), '112', 'message says call 112');
select is((public.trigger_sos(5.6, -0.18, 40)).id, :'sos'::uuid, 'second trigger returns the same open SOS');
select is((select count(*)::int from public.events where kind = 'sos'), 1, 'no duplicate alert');

-- Location every 30 s until I'm safe now.
select public.sos_ping(:'sos', 5.61, -0.19, 39);
select is((select count(*)::int from public.location_pings where sos_id = :'sos'), 2, 'pings recorded');
select is((select battery_pct from public.sos_alerts where id = :'sos'), 39, 'battery level updated');

select public.im_safe();
select is((select status from public.sos_alerts where id = :'sos'), 'cleared', 'SOS cleared');
select results_eq($$select contact_name from public.messages m join public.events e on e.id = m.event_id where e.kind = 'all_clear'$$,
  array['Mom'], 'all clear sent to the people alerted');
select throws_ok(format($$select public.sos_ping(%L, 5.6, -0.18)$$, :'sos'), 'P0001', 'sos_not_open', 'no pings after all clear');

-- With no emergency contacts, everyone is alerted.
reset role;
update public.contacts set is_emergency = false where user_id = :'ama';
select tests.login(:'ama');
select public.trigger_sos();
select is((select count(*)::int from public.messages m join public.events e on e.id = m.event_id where e.kind = 'sos'), 3,
  'falls back to all contacts');
reset role;
select ok((select live_expires_at from public.sos_alerts where id = :'sos') > now(), 'live link stays up 2 hours after all clear');

select * from finish();
rollback;
