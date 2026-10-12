-- v5: the text of private chapters ("סדר ליל החתונה") lives here, not in the site files,
-- so only readers with a live permission (or the admin) can read it.
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again. Needs v4.sql first.

create table if not exists public.chapter_text (
  chapter text not null,
  section int not null,
  html text not null,
  primary key (chapter, section)
);
alter table public.chapter_text enable row level security;
drop policy if exists "read with permission" on public.chapter_text;
create policy "read with permission" on public.chapter_text for select using (
  public.is_admin() or exists (
    select 1 from public.grants g
    where g.user_id = auth.uid() and g.path = chapter_text.chapter
      and (g.expires_at is null or g.expires_at > now())));
revoke all on public.chapter_text from anon, authenticated;
grant select on public.chapter_text to authenticated;
