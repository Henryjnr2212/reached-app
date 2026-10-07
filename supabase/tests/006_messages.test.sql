begin;
select plan(22);

select tests.create_user('+233241110041', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110041') as mom \gset

-- Intro SMS on add (SPEC §3.6).
select is((select template from public.messages where contact_id = :'mom'), 'intro', 'intro queued when a contact is added');
select is((select params ->> 'name' from public.messages where contact_id = :'mom'), 'Ama', 'intro names the user');
select isnt((select intro_sent_at from public.contacts where id = :'mom'), null, 'intro_sent_at recorded');

-- Dispatcher flow.
select is((select count(*)::int from public.claim_messages(10)), 1, 'dispatcher claims pending messages');
select is((select status from public.messages where contact_id = :'mom'), 'sending', 'claimed → sending');
select is((select count(*)::int from public.claim_messages(10)), 0, 'claimed messages are not claimed twice');
select public.mark_message((select id from public.messages where contact_id = :'mom'), 'sent', 'Hi, Ama added you…', 'ATXid_1');
select is((select status from public.messages where contact_id = :'mom'), 'sent', 'marked sent');
select public.update_message_status('ATXid_1', 'delivered');
select is((select status from public.messages where contact_id = :'mom'), 'delivered', 'delivery report → delivered');
select isnt((select delivered_at from public.messages where contact_id = :'mom'), null, 'delivered_at set');

-- Failure → push with Retry, then Resend.
select tests.login(:'ama');
select public.send_test_message(:'mom') as test_ev \gset
reset role;
select is((select template from public.messages where event_id = :'test_ev'), 'test', 'test message queued');
select public.claim_messages(10);
select public.mark_message((select id from public.messages where event_id = :'test_ev'), 'failed', null, null, 'Number unreachable');
select is((select title from public.notifications where kind = 'message_failed'), 'Message to Mom failed', 'failure push queued');
select isnt((select last_failed_at from public.contacts where id = :'mom'), null, 'contact marked Message failed');
select tests.login(:'ama');
select lives_ok(format($$select public.resend_message(id) from public.messages where event_id = %L$$, :'test_ev'), 'Resend allowed');
select is((select status from public.messages where event_id = :'test_ev'), 'pending', 'requeued');
reset role;

-- STOP opt-out (SPEC §13).
select is(public.handle_inbound('+233201110041', 'stop'), '[]'::jsonb, 'STOP handled');
select isnt((select opted_out_at from public.contacts where id = :'mom'), null, 'contact marked Opted out');
select public.handle_inbound('+233201110041', 'STOP');
select is((select count(*)::int from public.notifications where kind = 'opted_out'), 1, 'user told once');
select tests.login(:'ama');
select public.send_test_message(:'mom') as ev2 \gset
select is((select status from public.messages where event_id = :'ev2'), 'opted_out', 'opted-out contacts are skipped');
reset role;
select public.handle_inbound('+233201110041', 'START');
select is((select opted_out_at from public.contacts where id = :'mom'), null, 'START re-subscribes');

-- Free SMS allowance used → arrivals move to WhatsApp; safety messages still go (Phase 3).
select tests.add_contact(:'ama', 'Dad', '+233201110042', true, 'both') as dad \gset
insert into public.events (id, user_id, kind) values ('00000000-0000-0000-0000-0000000000a1', :'ama', 'arrival');
insert into public.messages (user_id, event_id, contact_name, to_phone, template, status)
select :'ama', '00000000-0000-0000-0000-0000000000a1', 'x', '+233201110041', 'arrived', 'sent' from generate_series(1, 30);
select tests.login(:'ama');
select public.send_reached_now(array[:'mom', :'dad']::uuid[], 'East Legon') as now_ev \gset
reset role;
select is((select status || ':' || coalesce(failure_reason, '') from public.messages where event_id = :'now_ev' and contact_id = :'mom'),
  'failed:sms_allowance', 'SMS-only contact not texted once the allowance is used');
select results_eq(format($$select channel from public.messages where event_id = %L and contact_id = %L$$, :'now_ev', :'dad'),
  array['whatsapp'], 'SMS+WhatsApp contact gets WhatsApp only');
select is((select params ->> 'place' from public.messages where event_id = :'now_ev' limit 1), 'East Legon', 'I''ve reached now uses the area name');

select * from finish();
rollback;
