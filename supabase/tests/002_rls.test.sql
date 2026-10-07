begin;
select plan(17);

select tests.create_user('+233241110001', 'Ama') as ama \gset
select tests.create_user('+233241110002', 'Kofi') as kofi \gset
select tests.add_contact(:'ama', 'Mom', '+233201110001') as ama_mom \gset
select tests.add_contact(:'kofi', 'Dad', '+233201110002') as kofi_dad \gset
select tests.add_place(:'ama', 'Work') as ama_work \gset
select tests.add_rule(:'ama', :'ama_work', array[:'ama_mom']::uuid[]) as ama_rule \gset

select tests.login(:'ama');
select is((select count(*)::int from public.contacts), 1, 'Ama sees only her contact');
select is((select name from public.contacts), 'Mom', '…and it is hers');
select is((select count(*)::int from public.profiles), 1, 'Ama sees only her profile');
select is((select count(*)::int from public.events), 1, 'Ama sees only her intro event');
select is((select count(*)::int from public.messages), 1, 'Ama sees only her messages');
select throws_ok($$select count(*) from public.fake_messages$$, '42501', null, 'fake provider sink is hidden');

select throws_ok(format($$insert into public.contacts (user_id, name, phone) values (%L, 'Sneaky', '+233241119999')$$, :'kofi'),
  '42501', null, 'cannot add a contact for someone else');
select throws_ok(format($$insert into public.rule_contacts (rule_id, contact_id) select id, %L from public.rules limit 1$$, :'kofi_dad'),
  'P0001', 'contact does not belong to rule owner', 'cannot attach another user''s contact');
select lives_ok($$update public.profiles set first_name = 'Ama B', phone = '+233249999999', plan = 'family'$$, 'profile update allowed');
select is((select phone from public.profiles), '+233241110001', 'phone cannot be changed directly');
select is((select plan from public.profiles), 'free', 'plan cannot be changed directly');
select throws_ok($$insert into public.trips (dest_name) values ('x')$$, '42501', null, 'trips are written only through RPCs');
select throws_ok($$update public.messages set status = 'delivered'$$, '42501', null, 'messages are read-only for users');
select throws_ok($$select public.check_overdue_trips()$$, '42501', null, 'users cannot run the overdue job');
select throws_ok($$select public.handle_inbound('+233201110001', 'STOP')$$, '42501', null, 'users cannot fake inbound SMS');
reset role;

select tests.login_anon();
select throws_ok($$select count(*) from public.contacts$$, '42501', null, 'anon has no table access');
select throws_ok($$select public.start_trip('{}')$$, '42501', null, 'anon cannot call RPCs');
reset role;

select * from finish();
rollback;
