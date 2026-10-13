-- v7: permission levels and scheduling.
-- 'read' = reading only, 'study' = reading + quiz ('quiz' = quiz only, older grants).
-- starts_at = scheduled opening (closed until then); expires_at = scheduled closing.
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again. Includes v6.
alter table public.grants drop constraint if exists grants_mode_check;
alter table public.grants add constraint grants_mode_check check (mode in ('study','read','quiz'));
alter table public.grants add column if not exists starts_at timestamptz;
drop policy if exists "read with permission" on public.chapter_text;
create policy "read with permission" on public.chapter_text for select using (
  public.is_admin() or exists (
    select 1 from public.grants g
    where g.user_id = auth.uid() and g.path = chapter_text.chapter
      and (g.starts_at is null or g.starts_at <= now())
      and (g.expires_at is null or g.expires_at > now())));
