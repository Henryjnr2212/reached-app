begin;
select plan(13);

select tests.create_user('+233241110071', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110071') as mom \gset
update public.contacts set can_request_location = true where id = :'mom';

-- Contact texts REACHED.
select is(public.handle_inbound('+233201110071', 'REACHED'), '[]'::jsonb, 'request accepted for processing');
select is((select status from public.contact_requests where contact_id = :'mom'), 'pending', 'request created');
select is((select title from public.notifications where kind = 'contact_request'), 'Mom wants to know when you reach', 'user notified');
select public.handle_inbound('+233201110071', 'reached');
select is((select count(*)::int from public.contact_requests), 1, 'repeat requests while pending are ignored');

select is(public.handle_inbound('+233209999999', 'REACHED') -> 0 ->> 'template', 'request_unknown', 'unknown number gets a helpful reply');

-- Accept with a destination: starts a trip watching for arrival.
select tests.login(:'ama');
select public.respond_contact_request((select id from public.contact_requests), true,
  jsonb_build_object('dest_name', 'Home', 'check_on_me', false)) as resp \gset
select ok((:'resp'::jsonb ->> 'trip_id') is not null, 'accepting can start a trip');
select is((select template from public.messages m join public.events e on e.id = m.event_id where e.kind = 'contact_request'),
  'request_accept', 'contact told Ama will let them know');
select is((select source from public.trips), 'request', 'trip marked as from a request');
reset role;

-- Decline and expiry.
update public.trips set status = 'cancelled';
select public.handle_inbound('+233201110071', 'REACHED');
select tests.login(:'ama');
select public.respond_contact_request((select id from public.contact_requests where status = 'pending'), false);
select is((select count(*)::int from public.messages where template = 'request_decline'), 1, 'decline reply queued');
reset role;
select public.handle_inbound('+233201110071', 'REACHED');
select is(public.expire_contact_requests(now() + interval '14 minutes'), 0, 'not expired before 15 minutes');
select is(public.expire_contact_requests(now() + interval '15 minutes'), 1, 'expired at 15 minutes');
select is((select count(*)::int from public.messages where template = 'request_pending'), 1, '"Ama hasn''t responded yet" queued');

-- Contacts who may not ask get a polite decline.
update public.contacts set can_request_location = false where id = :'mom';
select is(public.handle_inbound('+233201110071', 'REACHED') -> 0 ->> 'template', 'request_decline', 'not allowed → can''t share right now');

select * from finish();
rollback;
