-- v4: chapters that open for a limited time ("סדר ליל החתונה" opens for one week), and access requests.
-- Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

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
