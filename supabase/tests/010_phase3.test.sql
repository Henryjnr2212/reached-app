begin;
select plan(18);

select tests.create_user('+233241110081', 'Ama') as ama \gset
select tests.create_user('+233241110082', 'Officer') as cop \gset
select tests.create_user('+233241110083', 'Admin') as admin \gset
select tests.add_contact(:'ama', 'Mom', '+233201110081') as mom \gset
insert into public.police_officers (user_id, name, approved) values (:'cop', 'Insp. Mensah', true);
insert into public.admins (user_id) values (:'admin');

-- Police station finder.
select tests.login(:'ama');
select is((select name from public.nearest_police_stations(5.556, -0.18, 1)), 'Osu Police Station', 'nearest station first');
select is((select count(*)::int from public.nearest_police_stations(5.6, -0.18, 3)), 3, 'limit honoured');
select throws_ok($$select * from public.police_feed()$$, '42501', 'not_police', 'users cannot read the police feed');
select throws_ok($$select public.admin_stats()$$, '42501', 'not_admin', 'users cannot read admin stats');

-- SOS only appears for police when "Also alert the police" is on.
select public.trigger_sos(5.6, -0.18, 50);
reset role;
select tests.login(:'cop');
select is((select count(*)::int from public.police_feed()), 0, 'police see nothing without consent');
reset role;
update public.profiles set also_alert_police = true where id = :'ama';
select tests.login(:'cop');
select is((select first_name from public.police_feed()), 'Ama', 'police see the live SOS');
reset role;
select tests.login(:'ama');
select public.im_safe();
reset role;
select tests.login(:'cop');
select is((select status from public.police_feed()), 'cleared', 'police see the cancellation');
reset role;

-- Plans and payments.
select tests.login(:'ama');
select throws_ok($$select public.start_subscription('premium', 'mtn_momo')$$, 'P0001', 'bad_pay_phone', 'MoMo needs a number');
select (public.start_subscription('premium', 'mtn_momo', '+233241110081')).provider_ref as ref \gset
select is((select plan from public.profiles), 'free', 'still free until paid');
reset role;
select public.activate_subscription(:'ref', true);
select is((select plan from public.profiles where id = :'ama'), 'premium', 'payment webhook activates premium');
select public.activate_subscription(:'ref', true);
select is((select count(*)::int from public.subscriptions where status = 'active'), 1, 'webhook is idempotent');
select is(public.expire_subscriptions(now() + interval '2 months'), 1, 'lapsed subscription downgraded');
select is((select plan from public.profiles where id = :'ama'), 'free', 'back to free');

-- Limits: free plan allows 5 contacts.
select tests.add_contact(:'ama', 'C' || i, '+23320111009' || i) from generate_series(2, 5) i;
select throws_ok(format($$select tests.add_contact(%L, 'Six', '+233201110099')$$, :'ama'), 'P0001', 'contact_limit', 'free plan contact limit');

-- Partner API.
insert into public.partners (id, name, key_hash) values ('00000000-0000-0000-0000-00000000b011', 'TestRide', 'hash');
select tests.login(:'ama');
select public.create_partner_link('TestRide') as code \gset
select public.start_trip(jsonb_build_object('dest_name', 'Airport', 'contact_ids', jsonb_build_array(:'mom'), 'check_on_me', false));
reset role;
select ok(public.partner_update_trip('00000000-0000-0000-0000-00000000b011', :'code',
  '{"plate":"GR 4512-23","driver_name":"Kwame","car":"Toyota Corolla","provider":"bolt"}'), 'partner pushes driver details');
select is((select plate || ' / ' || driver_name from public.trips where user_id = :'ama'), 'GR 4512-23 / Kwame', 'trip details stored');
select ok(not public.partner_update_trip('00000000-0000-0000-0000-00000000b011', 'wrong', '{}'), 'bad link code rejected');

select tests.login(:'admin');
select ok((public.admin_stats() ->> 'users')::int >= 3, 'admin sees aggregate stats');
reset role;

select * from finish();
rollback;
