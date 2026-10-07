begin;
select plan(22);

select has_table('public', t, t || ' exists') from unnest(array[
  'profiles', 'contacts', 'places', 'rules', 'rule_contacts', 'trips', 'trip_contacts', 'sos_alerts',
  'location_pings', 'events', 'messages', 'fake_messages', 'notifications', 'contact_requests']) t;

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS is enabled on every public table');

select ok(private.is_ghana_e164('+233241234567'), 'E.164 Ghana accepted');
select ok(not private.is_ghana_e164('0241234567'), 'local format rejected by the column check');
select ok(not private.is_ghana_e164('+233211234567'), 'non-mobile prefix rejected');

select is(private.clock('2026-10-06 08:42:00+00'), '8:42am', 'clock formats like the templates');
select is(private.clock('2026-10-06 18:30:00+00'), '6:30pm', 'clock formats pm');

-- Profile is created from auth.users with + prefix.
select tests.create_user('+233241110000', 'Ama');
select is((select phone from public.profiles where first_name = 'Ama'), '+233241110000', 'profile phone normalised to E.164');

select throws_ok(
  $$insert into public.places (user_id, name, lat, lng, radius_m) values ((select id from public.profiles where first_name = 'Ama'), 'X', 5.6, -0.18, 50)$$,
  '23514', null, 'zone smaller than 100 m rejected');

select * from finish();
rollback;
