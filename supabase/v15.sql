-- v15 (2026-11-18): שער הדרכה - a separate permission for each מדור (Natan).
--   hadracha-halacha  = הלכה        (sections 24-40 of /halacha/leil-hachatuna/)
--   hadracha-hashkafa = השקפה       (sections 16-23)
--   leil-hachatuna    = ליל הכלולות (sections 1-15)
-- The policy on chapter_text already lets a reader see only rows whose chapter = a live grant's path,
-- so moving each tab's rows under its own path is all the server needs.
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

-- 1. Each tab's text under its own permission path.
update public.chapter_text set chapter = 'hadracha-halacha'  where chapter = 'leil-hachatuna' and section between 24 and 40;
update public.chapter_text set chapter = 'hadracha-hashkafa' where chapter = 'leil-hachatuna' and section between 16 and 23;

-- 2. Whoever had the whole chapter open keeps all three מדורים, until the same date.
insert into public.grants (user_id, path, mode, starts_at, expires_at)
select g.user_id, p.path, g.mode, g.starts_at, g.expires_at
from public.grants g cross join (values ('hadracha-halacha'), ('hadracha-hashkafa')) as p(path)
where g.path = 'leil-hachatuna' and (g.expires_at is null or g.expires_at > now())
on conflict (user_id, path) do nothing;

-- 3. The phone alert names the מדור that was requested.
create or replace function public.notify_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.user_id;
  begin
    perform public.notify_admin('בקשת גישה: ' || case new.path
        when 'leil-hachatuna' then 'הדרכה - ליל הכלולות'
        when 'hadracha-halacha' then 'הדרכה - הלכה'
        when 'hadracha-hashkafa' then 'הדרכה - השקפה'
        when 'tumat-betulim' then 'טומאת בתולים'
        else new.path end,
      coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.full_name, p.email) || ' · ' || p.email);
  exception when others then null;  -- a notification problem must never block a request
  end;
  return new;
end $$;
revoke execute on function public.notify_request() from public, anon, authenticated;
