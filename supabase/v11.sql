-- v11: lets the admin reset (and undo the reset of) any student's quiz. Needs v8 and v10 first.
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
drop policy if exists "admin resets write" on public.quiz_resets;
create policy "admin resets write" on public.quiz_resets for insert with check (public.is_admin());
drop policy if exists "admin resets delete" on public.quiz_resets;
create policy "admin resets delete" on public.quiz_resets for delete using (public.is_admin());
