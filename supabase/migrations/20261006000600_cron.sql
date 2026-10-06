-- Scheduled jobs. On Supabase pg_cron and pg_net are available; the dispatch
-- kick posts to the `dispatch` Edge Function so queued messages go out within
-- seconds instead of waiting for the next minute.

create or replace function private.kick_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := private.setting('functions_url');
  v_secret text := private.setting('dispatch_secret', '');
begin
  if v_url is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{}'::jsonb
  );
exception when others then
  -- Never block a user action because the HTTP kick failed; cron retries.
  raise warning 'kick_dispatch failed: %', sqlerrm;
end $$;

create or replace function private.after_message_queued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.kick_dispatch();
  return null;
end $$;

create trigger messages_kick after insert or update of status on public.messages
  for each statement execute function private.after_message_queued();

create trigger notifications_kick after insert on public.notifications
  for each statement execute function private.after_message_queued();

revoke execute on function private.kick_dispatch(), private.after_message_queued() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('reached-overdue', '* * * * *', 'select public.check_overdue_trips()');
    perform cron.schedule('reached-ask-first', '* * * * *', 'select public.process_ask_first()');
    perform cron.schedule('reached-requests', '* * * * *', 'select public.expire_contact_requests()');
    perform cron.schedule('reached-dispatch', '* * * * *', 'select private.kick_dispatch()');
    perform cron.schedule('reached-cleanup', '17 3 * * *', 'select public.cleanup_data()');
    perform cron.schedule('reached-subscriptions', '23 3 * * *', 'select public.expire_subscriptions()');
  else
    raise notice 'pg_cron not installed; jobs not scheduled';
  end if;
end $$;
