begin;
select plan(12);

select tests.create_user('+233241110061', 'Ama') as ama \gset
select tests.create_user('+233241110062', 'Esi') as esi \gset
select tests.add_contact(:'ama', 'Mom', '+233201110061') as mom \gset
select tests.add_contact(:'esi', 'Mom', '+233201110062') as esi_mom \gset
update public.profiles set retention_days = 7 where id = :'esi';

insert into public.location_pings (user_id, lat, lng, created_at) values
  (:'ama', 5.6, -0.18, now() - interval '31 days'),
  (:'ama', 5.6, -0.18, now() - interval '29 days');
update public.events set created_at = now() - interval '10 days';

select is(public.cleanup_data() ->> 'pings', '1', 'pings older than 30 days deleted');
select is((select count(*)::int from public.events where user_id = :'esi'), 0, '7-day retention removes 10-day-old activity');
select is((select count(*)::int from public.events where user_id = :'ama'), 1, '30-day retention keeps it');
select is((select count(*)::int from cron.job where jobname = 'reached-cleanup'), 1, 'cleanup scheduled daily');

select tests.login(:'ama');
select ok(public.export_my_data() ? 'profile', 'export includes profile');
select is(jsonb_array_length(public.export_my_data() -> 'contacts'), 1, 'export includes contacts');
select is(jsonb_array_length(public.export_my_data() -> 'location_pings'), 1, 'export includes location history');
select ok(not (public.export_my_data() -> 'trips' @> '[{"live_token": ""}]'), 'export omits live tokens');
select public.delete_my_activity();
select is((select count(*)::int from public.events), 0, 'Delete my activity clears events');
select is((select count(*)::int from public.location_pings), 0, '…and location history');
select is((select count(*)::int from public.contacts), 1, '…but keeps contacts');
reset role;

-- Delete account: deleting the auth user removes everything.
delete from auth.users where id = :'ama';
select is((select count(*)::int from public.contacts where user_id = :'ama'), 0, 'account deletion cascades');

select * from finish();
rollback;
