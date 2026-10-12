-- v3: the admin creates students directly (default password, must change it on first login).
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

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

-- Sign-up trigger: skip the phone alert for people the admin added.
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
