-- v13: edit mode (?edit on a chapter page). The admin's text changes, handwritten notes and answer fixes,
-- saved per chapter so they show on every device. Only the admin can read or write them. Safe to run again.
create table if not exists public.edits (
  chapter    text not null,
  key        text not null,          -- which block: "s6.t3" = section 6, block 3; "s6.q2.a1" = question 2, answer 1
  kind       text not null check (kind in ('text','note','correct')),
  sec        int,
  orig       text,                   -- the original text, to find the place again later
  val        text,                   -- new text (html) / the note / the right answer's number
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (chapter, key, kind)
);
alter table public.edits enable row level security;
drop policy if exists "admin edits" on public.edits;
create policy "admin edits" on public.edits for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.edits from anon;
grant select, insert, update, delete on public.edits to authenticated;
