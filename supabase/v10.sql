-- v10: lets a user undo the latest reset of their own quiz (deletes that row of quiz_resets). Needs v8 first.
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
drop policy if exists "own resets delete" on public.quiz_resets;
create policy "own resets delete" on public.quiz_resets for delete using (user_id = auth.uid());
grant delete on public.quiz_resets to authenticated;
