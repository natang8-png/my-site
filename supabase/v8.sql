-- v8: quiz answers are kept for good, and the whole quiz can be reset (a new round; nothing is deleted).
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
alter table public.quiz_results add column if not exists answers jsonb;  -- the chosen option of each question

create table if not exists public.quiz_resets (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  chapter text not null,
  reset_at timestamptz not null default now()
);
alter table public.quiz_resets enable row level security;
drop policy if exists "own resets read" on public.quiz_resets;
create policy "own resets read" on public.quiz_resets for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own resets write" on public.quiz_resets;
create policy "own resets write" on public.quiz_resets for insert with check (user_id = auth.uid());
grant select, insert on public.quiz_resets to authenticated;
grant usage, select on all sequences in schema public to authenticated;
