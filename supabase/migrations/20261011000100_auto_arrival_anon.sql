-- Supabase grants new functions to anon by default, so revoking from public
-- in phase2 left report_auto_arrival callable without signing in.
revoke execute on function public.report_auto_arrival(text, double precision, double precision) from anon;
