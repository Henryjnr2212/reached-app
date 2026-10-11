-- messages_kick fired on every statement that updated messages.status, even
-- when no row changed. claim_messages (called by dispatch) is such a
-- statement, so each dispatch run kicked the next one: an endless loop of
-- function calls. Only kick when the statement actually leaves a message
-- waiting to be sent.
drop trigger if exists messages_kick on public.messages;

create or replace function private.after_messages_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from new_rows where status = 'pending') then
    perform private.kick_dispatch();
  end if;
  return null;
end $$;

create trigger messages_kick_insert after insert on public.messages
  referencing new table as new_rows
  for each statement execute function private.after_messages_changed();

create trigger messages_kick_update after update on public.messages
  referencing new table as new_rows
  for each statement execute function private.after_messages_changed();

revoke execute on function private.after_messages_changed() from public, anon, authenticated;
