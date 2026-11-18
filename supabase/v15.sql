-- v15: the admin can put a student's password back to the temporary one (for a student who cannot get the reset mail).
-- The student is asked to choose a new password of their own on the next login. Safe to run again.
create or replace function public.admin_reset_password(p_user uuid, p_password text default '123456')
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'רק מנהל יכול לאפס סיסמה'; end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then raise exception 'אי אפשר לאפס כאן סיסמה של מנהל'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'סיסמה של 6 תווים לפחות'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
  if not found then raise exception 'המשתמש לא נמצא'; end if;
  update public.profiles set must_change_pw = true where id = p_user;
end $$;
revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
