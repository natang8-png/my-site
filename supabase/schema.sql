-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Content is addressed by path: 'halacha', 'halacha/<topic>', 'halacha/<topic>/<chapter>'.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);

-- A grant opens a path and everything under it. mode: 'study' (text + quiz) or 'quiz' (quiz only).
create table public.grants (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  path text not null,
  mode text not null check (mode in ('study','quiz')),
  created_at timestamptz not null default now(),
  unique (user_id, path)
);

create table public.reads (
  user_id uuid not null references public.profiles on delete cascade,
  chapter text not null,
  section int not null,
  read_at timestamptz not null default now(),
  primary key (user_id, chapter, section)
);

create table public.quiz_results (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  chapter text not null,
  section int not null,
  score int not null,
  total int not null,
  taken_at timestamptz not null default now()
);

-- New sign-ups get a profile row automatically.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

alter table public.profiles enable row level security;
alter table public.grants enable row level security;
alter table public.reads enable row level security;
alter table public.quiz_results enable row level security;

-- Users see and touch only their own rows; the admin sees everything and manages grants.
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "touch last_seen" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));
create policy "own grants" on public.grants for select using (user_id = auth.uid() or public.is_admin());
create policy "admin grants" on public.grants for all using (public.is_admin()) with check (public.is_admin());
create policy "own reads" on public.reads for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());
create policy "own results read" on public.quiz_results for select using (user_id = auth.uid() or public.is_admin());
create policy "own results write" on public.quiz_results for insert with check (user_id = auth.uid());

-- After Natan signs up on the site once, make him admin:
-- update public.profiles set is_admin = true where email = '<his email>';
