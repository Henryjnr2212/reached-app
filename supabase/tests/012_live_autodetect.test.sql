begin;
select plan(16);

select tests.create_user('+233241110101', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110101') as mom \gset
select tests.add_contact(:'ama', 'Kojo', '+233201110102') as kojo \gset
update public.contacts set is_default = false where id = :'kojo';

-- Auto-detect.
select tests.login(:'ama');
select throws_ok($$select public.report_auto_arrival('East Legon', 5.63, -0.16)$$, 'P0001', 'auto_detect_off', 'needs auto-detect on');
reset role;
update public.profiles set auto_detect = true where id = :'ama';
select tests.login(:'ama');
select public.report_auto_arrival('East Legon', 5.63, -0.16) as auto \gset
select results_eq(format($$select contact_name from public.messages where event_id = %L$$, :'auto'), array['Mom'], 'default contacts told');
select is((select params ->> 'place' from public.messages where event_id = :'auto'), 'East Legon', 'area name used');
select ok(public.report_auto_arrival('East Legon', 5.63, -0.16) is null, 'not repeated within an hour');

-- Live link for a trip.
select (public.start_trip(jsonb_build_object('dest_name', 'Work', 'contact_ids', jsonb_build_array(:'mom'),
  'check_on_me', true, 'expected_at', now() + interval '20 minutes', 'transport_type', 'taxi', 'plate', 'GR 4512-23'))) as trip \gset
select public.trip_checkin((:'trip'::public.trips).id, 5.61, -0.18, 10, 55);
reset role;
select (:'trip'::public.trips).live_token as token \gset

select tests.login_anon();
select is(public.get_live(:'token') ->> 'state', 'live', 'contacts can open the live page without login');
select is(public.get_live(:'token') ->> 'name', 'Ama', 'shows the name');
select is((public.get_live(:'token') ->> 'lat')::numeric, 5.61, 'shows the last location');
select ok(public.get_live(:'token') -> 'details' = 'null'::jsonb, 'trip details hidden when nothing is wrong');
select is(public.get_live('nope') ->> 'state', 'not_found', 'bad token');
select is(public.get_live('AAAAAAAA') ->> 'state', 'not_found', 'unknown token');
select throws_ok($$select * from public.trips$$, '42501', null, 'anon still cannot read tables');
reset role;

-- Emergency reveals trip details.
update public.trips set status = 'alerted' where live_token = :'token';
select tests.login_anon();
select is(public.get_live(:'token') -> 'details' ->> 'plate', 'GR 4512-23', 'plate shown in an emergency');
reset role;

-- Ends with the trip.
update public.trips set status = 'arrived', live_expires_at = now() - interval '1 second' where live_token = :'token';
select tests.login_anon();
select is(public.get_live(:'token') ->> 'state', 'ended', '"This trip has ended"');
select ok(not (public.get_live(:'token') ? 'lat'), 'no location once ended');
reset role;

-- SOS link stays 2 hours after all clear.
select tests.login(:'ama');
select (public.trigger_sos(5.6, -0.18, 30)).live_token as sos_token \gset
select public.im_safe();
reset role;
select tests.login_anon();
select is(public.get_live(:'sos_token') ->> 'cleared', 'true', 'cleared SOS still viewable, marked cleared');
reset role;
update public.sos_alerts set live_expires_at = now() - interval '1 minute';
select tests.login_anon();
select is(public.get_live(:'sos_token') ->> 'state', 'ended', 'expires 2 hours after all clear');
reset role;

select * from finish();
rollback;
