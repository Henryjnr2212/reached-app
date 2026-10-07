-- Row Level Security on every table. Users see and change only their own
-- rows; state transitions (trips, events, messages, SOS) go through
-- SECURITY DEFINER functions so the server stays the source of truth.

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.places enable row level security;
alter table public.rules enable row level security;
alter table public.rule_contacts enable row level security;
alter table public.trips enable row level security;
alter table public.trip_contacts enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.location_pings enable row level security;
alter table public.events enable row level security;
alter table public.messages enable row level security;
alter table public.fake_messages enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_requests enable row level security;
alter table public.police_stations enable row level security;
alter table public.police_officers enable row level security;
alter table public.admins enable row level security;
alter table public.subscriptions enable row level security;
alter table public.family_members enable row level security;
alter table public.partners enable row level security;
alter table public.partner_links enable row level security;
alter table public.problem_reports enable row level security;

-- Helper used in policies. (select auth.uid()) is evaluated once per query.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function private.is_police()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.police_officers where user_id = auth.uid() and approved);
$$;

-- profiles: read/update own. Columns users must not change are protected below.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'authenticated' then
    new.phone := old.phone;   -- changes only through Auth (OTP)
    new.plan := old.plan;     -- changes only through payments
    new.id := old.id;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function private.protect_profile_columns();

-- Simple owner-only tables.
create policy contacts_owner on public.contacts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy places_owner on public.places for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rules_owner on public.rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rule_contacts_owner on public.rule_contacts for all to authenticated
  using (exists (select 1 from public.rules r where r.id = rule_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.rules r where r.id = rule_id and r.user_id = (select auth.uid())));
create policy push_tokens_owner on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy problem_reports_insert on public.problem_reports for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy problem_reports_admin on public.problem_reports for select to authenticated
  using (private.is_admin());

-- Read-only for owners; writes happen through RPCs.
create policy trips_select on public.trips for select to authenticated
  using (user_id = (select auth.uid()));
create policy trip_contacts_select on public.trip_contacts for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));
create policy sos_select on public.sos_alerts for select to authenticated
  using (user_id = (select auth.uid()));
create policy pings_select on public.location_pings for select to authenticated
  using (user_id = (select auth.uid()));
create policy events_select on public.events for select to authenticated
  using (user_id = (select auth.uid()));
create policy messages_select on public.messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy contact_requests_select on public.contact_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy family_owner on public.family_members for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy family_member_select on public.family_members for select to authenticated
  using (member_id = (select auth.uid()));
create policy partner_links_owner on public.partner_links for select to authenticated
  using (user_id = (select auth.uid()));

-- Police stations are public reference data for signed-in users.
create policy police_stations_read on public.police_stations for select to authenticated using (true);
create policy police_stations_admin on public.police_stations for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy police_officers_self on public.police_officers for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy police_officers_admin on public.police_officers for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy admins_self on public.admins for select to authenticated
  using (user_id = (select auth.uid()));
create policy partners_admin on public.partners for select to authenticated using (private.is_admin());

-- fake_messages has RLS on, no policies and no grants: only service_role reads it.
revoke all on public.fake_messages from anon, authenticated;

-- Table privileges: anon gets nothing; authenticated gets what policies allow.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.contacts, public.places, public.rules, public.rule_contacts,
  public.push_tokens, public.family_members to authenticated;
grant select, update on public.profiles, public.notifications to authenticated;
grant select on public.trips, public.trip_contacts, public.sos_alerts, public.location_pings, public.events,
  public.messages, public.contact_requests, public.police_stations, public.police_officers, public.admins,
  public.subscriptions, public.partner_links, public.partners to authenticated;
grant insert on public.problem_reports to authenticated;
grant select on public.problem_reports to authenticated;
grant insert, update, delete on public.police_stations to authenticated;
grant update on public.police_officers to authenticated;
