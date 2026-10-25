-- v9: the הרחקות chapter got a new section 2 ("סיפור מהגמרא"), so the old sections 2..25 are now 3..26.
-- This moves the saved "קראתי" marks and quiz results to the new numbers. Run it ONCE, right when the new site goes live.
-- It guards itself, so running it again does nothing. Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.migrations (name text primary key, done_at timestamptz not null default now());
alter table public.migrations enable row level security;  -- no policies: only the SQL Editor can touch it
do $$
begin
  if not exists (select 1 from public.migrations where name = 'v9-harchakot-section-shift') then
    -- two steps: reads has a primary key on (user, chapter, section), so a direct +1 could collide halfway
    update public.reads set section = -(section + 1) where chapter = 'harchakot' and section >= 2;
    update public.reads set section = -section where chapter = 'harchakot' and section < 0;
    update public.quiz_results set section = section + 1 where chapter = 'harchakot' and section >= 2;
    insert into public.migrations (name) values ('v9-harchakot-section-shift');
  end if;
end $$;
