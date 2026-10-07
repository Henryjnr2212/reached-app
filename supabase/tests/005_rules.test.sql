begin;
select plan(22);

select tests.create_user('+233241110031', 'Ama') as ama \gset
select tests.add_contact(:'ama', 'Mom', '+233201110031') as mom \gset
select tests.add_contact(:'ama', 'Dad', '+233201110032') as dad \gset
select tests.add_contact(:'ama', 'Kofi', '+233201110033') as kofi \gset
select tests.add_place(:'ama', 'Work') as work \gset
select tests.add_place(:'ama', 'Home', 5.5571, -0.1818) as home \gset

-- Monday 6 Oct 2026 08:42 Accra (UTC). Weekday rule 07:00–10:00 to Mom+Dad,
-- every-day rule to Mom with custom text, weekend rule to Kofi, leave rule to Dad.
select tests.add_rule(:'ama', :'work', array[:'mom', :'dad']::uuid[], 'arrive', '{1,2,3,4,5}', '07:00', '10:00') as r1 \gset
select tests.add_rule(:'ama', :'work', array[:'mom']::uuid[], 'arrive', '{0,1,2,3,4,5,6}', null, null, '{name} is at the office') as r2 \gset
select tests.add_rule(:'ama', :'work', array[:'kofi']::uuid[], 'arrive', '{0,6}') as r3 \gset
select tests.add_rule(:'ama', :'work', array[:'dad']::uuid[], 'leave') as r4 \gset

-- Rule matching (mirrors packages/core ruleMatches).
select ok(private.rule_matches('{1,2,3,4,5}', '07:00', '10:00', '2026-10-05 08:42+00'), 'weekday in window');
select ok(not private.rule_matches('{1,2,3,4,5}', '07:00', '10:00', '2026-10-05 10:00+00'), 'window end exclusive');
select ok(not private.rule_matches('{1,2,3,4,5}', null, null, '2026-10-10 08:42+00'), 'Saturday not a weekday');
select ok(private.rule_matches('{5}', '22:00', '06:00', '2026-10-10 01:00+00'), 'overnight window belongs to previous day');
select ok(not private.rule_matches('{5}', '22:00', '06:00', '2026-10-09 01:00+00'), 'overnight early morning of Friday is Thursday''s');

select tests.login(:'ama');
select public.report_place_event(:'work', 'arrive', 5.6211, -0.1739, '2026-10-05 08:42+00') as ev \gset
select ok(nullif(:'ev', '') is not null, 'arrival event created');
select results_eq(format($$select contact_name from public.messages where event_id = %L order by contact_name$$, :'ev'),
  array['Dad', 'Mom'], 'two rules fired, one combined message per contact; weekend rule skipped');
select is((select template from public.messages where event_id = :'ev' and contact_id = :'mom'), 'custom', 'rule wording used');
select is((select params ->> 'time' from public.messages where event_id = :'ev' limit 1), '8:42am', 'event time in the message');
select is((select title from public.notifications where kind = 'arrival_sent'), 'Told Mom and Dad you reached Work', 'push: Told Mom and Dad you reached Work');

-- Bouncing at the zone edge: same place, same message within 1 hour is suppressed.
select ok(public.report_place_event(:'work', 'arrive', null, null, now() + interval '30 minutes') is null, 'duplicate within 1 hour suppressed');
select ok(public.report_place_event(:'work', 'leave', null, null, now()) is not null, 'leaving is a different message');
select is((select template from public.messages m join public.events e on e.id = m.event_id where e.kind = 'departure'), 'left', 'left template');
select ok(public.report_place_event(:'home', 'arrive') is null, 'no rules → nothing sent');

-- Ask me first.
reset role;
update public.profiles set arrival_mode = 'ask', ask_timeout_min = 5 where id = :'ama';
delete from public.events where user_id = :'ama' and kind = 'arrival';
select tests.login(:'ama');
select public.report_place_event(:'work', 'arrive', null, null, '2026-10-05 08:50+00') as ask \gset
select is((select status from public.events where id = :'ask'), 'pending_confirmation', 'ask-first event waits');
select is((select count(*)::int from public.messages where event_id = :'ask' and status = 'held'), 2, 'messages held');
select is((select title from public.notifications where kind = 'ask_first'), 'You''ve reached Work. Tell Mom and Dad?', 'push asks first');
reset role;
select is(public.process_ask_first(now() + interval '4 minutes'), 0, 'not sent before the timeout');
select is(public.process_ask_first(now() + interval '5 minutes'), 1, 'sent anyway after 5 minutes');
select is((select count(*)::int from public.messages where event_id = :'ask' and status = 'pending'), 2, 'messages released');


-- Removing a contact removes them from every rule (spec §7).
select is((select count(*)::int from public.rule_contacts where contact_id = :'dad'), 2, 'Dad is in two rules');
delete from public.contacts where id = :'dad';
select is((select count(*)::int from public.rule_contacts where contact_id = :'dad'), 0, 'removed contact leaves no rules behind');

select * from finish();
rollback;
