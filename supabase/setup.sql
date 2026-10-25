-- Full setup in one go: works on an empty project and on one that already has some of it. Safe to re-run; keeps existing data.
-- Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);

-- A grant opens a path and everything under it. mode: 'study' (text + quiz), 'read' (text only) or 'quiz' (quiz only, older).
create table if not exists public.grants (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  path text not null,
  mode text not null check (mode in ('study','read','quiz')),
  created_at timestamptz not null default now(),
  unique (user_id, path)
);

create table if not exists public.reads (
  user_id uuid not null references public.profiles on delete cascade,
  chapter text not null,
  section int not null,
  read_at timestamptz not null default now(),
  primary key (user_id, chapter, section)
);

create table if not exists public.quiz_results (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  chapter text not null,
  section int not null,
  score int not null,
  total int not null,
  taken_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;


alter table public.profiles enable row level security;
alter table public.grants enable row level security;
alter table public.reads enable row level security;
alter table public.quiz_results enable row level security;

-- Users see and touch only their own rows; the admin sees everything and manages grants.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "own grants" on public.grants;
create policy "own grants" on public.grants for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin grants" on public.grants;
create policy "admin grants" on public.grants for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "own reads" on public.reads;
create policy "own reads" on public.reads for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());
drop policy if exists "own results read" on public.quiz_results;
create policy "own results read" on public.quiz_results for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own results write" on public.quiz_results;
create policy "own results write" on public.quiz_results for insert with check (user_id = auth.uid());

-- New tables are not exposed automatically in this project, so grant access explicitly (RLS still decides rows).
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, last_seen) on public.profiles to authenticated;  -- is_admin stays out of reach
grant select, insert, update, delete on public.grants to authenticated;
grant select, insert, update, delete on public.reads to authenticated;
grant select, insert on public.quiz_results to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 1. Profile details from the sign-up form.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists note text,
  add column if not exists invited boolean not null default false;

-- Users may edit their own details, never is_admin.
drop policy if exists "touch last_seen" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, first_name, last_name, phone, note, last_seen) on public.profiles to authenticated;

-- 2. Pre-registration: the admin adds a person by email with the access they get.
-- When that email signs up (password or Google), the access is applied at once.
create table if not exists public.invites (
  email text primary key,
  first_name text,
  last_name text,
  phone text,
  note text,
  grants jsonb not null default '[]',   -- [{"path":"halacha","mode":"study"}, ...]
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.invites enable row level security;
drop policy if exists "admin invites" on public.invites;
create policy "admin invites" on public.invites for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.invites to authenticated;

-- 3. Private settings (e.g. the notification channel). No grants: only server functions read it.
create table if not exists public.settings (key text primary key, value text);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

create extension if not exists pg_net with schema extensions;

-- Sends a push notification through ntfy.sh to the topic stored in settings (if any).
create or replace function public.notify_admin(title text, msg text) returns void
language plpgsql security definer set search_path = public as $$
declare topic text;
begin
  select value into topic from public.settings where key = 'ntfy_topic';
  if topic is null or topic = '' then return; end if;
  perform net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object('topic', topic, 'title', title, 'message', msg,
                               'click', 'https://my-site-c18.pages.dev/admin/', 'tags', jsonb_build_array('bust_in_silhouette'))
  );
end $$;
revoke execute on function public.notify_admin(text, text) from public, anon, authenticated;

-- 4. New sign-ups: build the profile, apply a matching invite, notify the admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  inv public.invites;
  g jsonb;
  fname text;
begin
  select * into inv from public.invites where lower(email) = lower(new.email) and used_at is null;
  fname := coalesce(nullif(m->>'full_name', ''), nullif(m->>'name', ''));
  insert into public.profiles (id, email, full_name, first_name, last_name, phone, note, invited)
  values (
    new.id, new.email,
    coalesce(fname, nullif(trim(concat_ws(' ', inv.first_name, inv.last_name)), '')),
    coalesce(nullif(m->>'first_name', ''), inv.first_name, split_part(fname, ' ', 1)),
    coalesce(nullif(m->>'last_name', ''), inv.last_name, nullif(substr(fname, length(split_part(fname, ' ', 1)) + 2), '')),
    coalesce(nullif(m->>'phone', ''), inv.phone),
    coalesce(nullif(m->>'note', ''), inv.note),
    inv.email is not null
  );
  if inv.email is not null then
    for g in select * from jsonb_array_elements(inv.grants) loop
      insert into public.grants (user_id, path, mode) values (new.id, g->>'path', g->>'mode')
      on conflict (user_id, path) do nothing;
    end loop;
    update public.invites set used_at = now() where email = inv.email;
  end if;
  if m ? 'created_by_admin' then return new; end if;  -- the admin added this person; no alert needed
  begin
    perform public.notify_admin(
      case when inv.email is not null then 'נרשם/ה (הוזמן/ה מראש)' else 'הרשמה חדשה ממתינה לאישור' end,
      coalesce(fname, nullif(trim(concat_ws(' ', inv.first_name, inv.last_name)), ''), new.email) || ' · ' || new.email || coalesce(' · ' || coalesce(nullif(m->>'phone', ''), inv.phone), ''));
  exception when others then null;  -- a notification problem must never block a sign-up
  end;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles add column if not exists must_change_pw boolean not null default false;
grant update (must_change_pw) on public.profiles to authenticated;

-- Creates a login for a student (admin only). Password starts as the given default; the site forces a change on first login.
create or replace function public.admin_create_user(
  p_email text, p_password text, p_first text, p_last text, p_phone text, p_note text, p_path text, p_mode text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); e text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'רק מנהל יכול להוסיף משתמשים'; end if;
  if e is null or e = '' then raise exception 'חסר מייל'; end if;
  if exists (select 1 from auth.users where lower(email) = e) then raise exception 'המייל הזה כבר רשום באתר'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', e,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('first_name', p_first, 'last_name', p_last, 'phone', p_phone, 'note', p_note,
                       'full_name', trim(concat_ws(' ', p_first, p_last)), 'created_by_admin', true),
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', e, 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set must_change_pw = true, invited = true where id = uid;
  if p_path is not null and p_path <> '' then
    insert into public.grants (user_id, path, mode) values (uid, p_path, coalesce(p_mode, 'study'))
    on conflict (user_id, path) do nothing;
  end if;
  return uid;
end $$;
revoke execute on function public.admin_create_user(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text, text, text, text, text) to authenticated;


-- v4: time-limited chapters and access requests.

-- A grant may now end. Empty = open with no end date (as before).
alter table public.grants add column if not exists expires_at timestamptz;

-- A student asks for a chapter; the admin approves or declines on the admin page.
create table if not exists public.access_requests (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  approved boolean
);
-- One open request per person per chapter.
create unique index if not exists access_requests_open on public.access_requests (user_id, path) where handled_at is null;

alter table public.access_requests enable row level security;
drop policy if exists "own requests" on public.access_requests;
create policy "own requests" on public.access_requests for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "ask" on public.access_requests;
create policy "ask" on public.access_requests for insert with check (user_id = auth.uid() and handled_at is null);
drop policy if exists "admin requests" on public.access_requests;
create policy "admin requests" on public.access_requests for update using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.access_requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- A phone alert to the admin for every new request.
create or replace function public.notify_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.user_id;
  begin
    perform public.notify_admin('בקשת גישה: ' || case new.path when 'leil-hachatuna' then 'סדר ליל החתונה' else new.path end,
      coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.full_name, p.email) || ' · ' || p.email);
  exception when others then null;  -- a notification problem must never block a request
  end;
  return new;
end $$;
revoke execute on function public.notify_request() from public, anon, authenticated;
drop trigger if exists on_access_request on public.access_requests;
create trigger on_access_request after insert on public.access_requests
  for each row execute function public.notify_request();

-- v5: text of private chapters.

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

-- v6: a "reading only" permission level ('read') next to reading + quiz ('study').
-- Older 'quiz' (quiz only) grants keep working.
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
drop policy if exists "own resets delete" on public.quiz_resets;
create policy "own resets delete" on public.quiz_resets for delete using (user_id = auth.uid());
grant delete on public.quiz_resets to authenticated;

drop policy if exists "admin resets write" on public.quiz_resets;
create policy "admin resets write" on public.quiz_resets for insert with check (public.is_admin());
drop policy if exists "admin resets delete" on public.quiz_resets;
create policy "admin resets delete" on public.quiz_resets for delete using (public.is_admin());
