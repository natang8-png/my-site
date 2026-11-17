-- v14: "צור קשר". Messages written on the site (guests on the home page, signed-in readers on /contact/),
-- and the private contact details shown only to signed-in readers. Safe to run again.

-- 1. The messages. Nobody but the admin reads the table; writing goes through contact_save() below.
create table if not exists public.contact_messages (
  id         uuid primary key,                 -- chosen by the browser, so the same message can be completed later
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  name       text,
  phone      text,
  email      text,
  body       text not null,
  status     text not null default 'draft' check (status in ('draft','sent')),  -- draft = details window was opened and not finished
  notified   boolean not null default false,
  handled_at timestamptz
);
alter table public.contact_messages enable row level security;
drop policy if exists "admin contact" on public.contact_messages;
create policy "admin contact" on public.contact_messages for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.contact_messages from anon;
grant select, update, delete on public.contact_messages to authenticated;

-- 2. Saving a message. p_final=false keeps it as a draft (sender still filling in name / phone / email).
create or replace function public.contact_save(p_id uuid, p_body text, p_name text default null, p_phone text default null,
                                               p_email text default null, p_final boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pr  public.profiles;
  b   text := btrim(coalesce(p_body, ''));
  n   text := nullif(left(btrim(coalesce(p_name, '')), 120), '');
  ph  text := nullif(left(btrim(coalesce(p_phone, '')), 40), '');
  em  text := nullif(left(btrim(coalesce(p_email, '')), 200), '');
  row public.contact_messages;
begin
  if p_id is null or b = '' then raise exception 'empty message'; end if;
  if length(b) > 4000 then raise exception 'message too long'; end if;
  -- a simple brake against flooding
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') > 60 then
    raise exception 'too many messages, try later';
  end if;
  if uid is not null then
    select * into pr from public.profiles where id = uid;
    n  := coalesce(n, nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), ''), pr.full_name);
    ph := coalesce(ph, pr.phone);
    em := coalesce(em, pr.email);
  end if;
  insert into public.contact_messages as m (id, user_id, name, phone, email, body, status)
    values (p_id, uid, n, ph, em, b, case when p_final then 'sent' else 'draft' end)
  on conflict (id) do update
    set name = excluded.name, phone = excluded.phone, email = excluded.email, body = excluded.body,
        status = excluded.status, updated_at = now()
    where m.status = 'draft'            -- a message that was already sent cannot be changed
  returning * into row;
  if row.id is not null and row.status = 'sent' and not row.notified then
    update public.contact_messages set notified = true where id = row.id;
    perform public.notify_admin('הודעה חדשה מהאתר' || coalesce(' · ' || row.name, ''), left(row.body, 300));
  end if;
end $$;
revoke execute on function public.contact_save(uuid, text, text, text, text, boolean) from public;
grant execute on function public.contact_save(uuid, text, text, text, text, boolean) to anon, authenticated;

-- 3. Drafts nobody finished: after 5 minutes the admin is told about them too (marked as a draft).
create or replace function public.contact_notify_drafts() returns void
language plpgsql security definer set search_path = public as $$
declare r public.contact_messages;
begin
  for r in select * from public.contact_messages
           where status = 'draft' and not notified and updated_at < now() - interval '5 minutes' loop
    update public.contact_messages set notified = true where id = r.id;
    perform public.notify_admin('* טיוטת הודעה מהאתר' || coalesce(' · ' || r.name, ''), left(r.body, 300));
  end loop;
end $$;
revoke execute on function public.contact_notify_drafts() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('contact-drafts') where exists (select 1 from cron.job where jobname = 'contact-drafts');
  perform cron.schedule('contact-drafts', '*/5 * * * *', 'select public.contact_notify_drafts()');
exception when others then
  raise notice 'pg_cron not available: draft alerts are off (drafts still show on the admin page). %', sqlerrm;
end $$;

-- 4. The contact details (phone, WhatsApp, SMS, e-mail, office address). Kept in the private settings table,
--    not in the public code; handed only to signed-in readers.
--    To fill them in:  insert into public.settings (key, value) values ('contact_info',
--      '{"phone":"05x-xxxxxxx","whatsapp":"9725xxxxxxxx","sms":"05x-xxxxxxx","email":"...","address":"...","hours":"..."}')
--      on conflict (key) do update set value = excluded.value;
create or replace function public.contact_info() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null
              else (select value::jsonb from public.settings where key = 'contact_info') end
$$;
revoke execute on function public.contact_info() from public, anon;
grant execute on function public.contact_info() to authenticated;
