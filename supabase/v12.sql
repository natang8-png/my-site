-- v12: the admin can reset a student's quiz from the "ממוצע" button on the admin page (a new round; nothing is deleted).
-- (v11's "admin resets write" policy covers this too.) Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
drop policy if exists "own resets write" on public.quiz_resets;
create policy "own resets write" on public.quiz_resets for insert with check (user_id = auth.uid() or public.is_admin());
