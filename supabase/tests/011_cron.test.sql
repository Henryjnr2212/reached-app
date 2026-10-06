begin;
select plan(8);

select results_eq($$select jobname from cron.job where jobname like 'reached-%' order by 1$$,
  array['reached-ask-first', 'reached-cleanup', 'reached-dispatch', 'reached-overdue', 'reached-requests', 'reached-subscriptions'],
  'all jobs scheduled');
select is((select schedule from cron.job where jobname = 'reached-overdue'), '* * * * *', 'overdue check runs every minute');
select is((select command from cron.job where jobname = 'reached-overdue'), 'select public.check_overdue_trips()', 'overdue job calls the server check');

-- Queuing a message kicks the dispatcher over pg_net.
delete from net.requests;
select tests.create_user('+233241110091', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110091');
select ok((select count(*) from net.requests) >= 1, 'dispatch kicked when messages are queued');
select is((select url from net.requests order by id desc limit 1), 'http://127.0.0.1:54321/functions/v1/dispatch', 'kick goes to the dispatch function');
select ok((select headers ? 'x-dispatch-secret' from net.requests order by id desc limit 1), 'kick carries the dispatch secret header');

-- Phone dies mid-trip: the server still runs the check with no check-ins.
select tests.login(:'ama');
select (public.start_trip(jsonb_build_object('dest_name', 'Work', 'contact_ids',
  (select jsonb_agg(id) from public.contacts), 'check_on_me', true, 'expected_at', now() + interval '1 minute'))).id as trip \gset
reset role;
update public.trips set last_checkin_at = null where id = :'trip';
select public.check_overdue_trips(now() + interval '20 minutes');
select public.check_overdue_trips(now() + interval '26 minutes');
select is((select status from public.trips where id = :'trip'), 'alerted', 'alert sent with no check-ins at all');
select is((select params ->> 'lastSeen' from public.messages where template = 'overdue_alert' limit 1), 'unknown', 'last seen unknown');

select * from finish();
rollback;
