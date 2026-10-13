-- v6: a "reading only" permission level ('read') next to reading + quiz ('study').
-- Older 'quiz' (quiz only) grants keep working.
alter table public.grants drop constraint if exists grants_mode_check;
alter table public.grants add constraint grants_mode_check check (mode in ('study','read','quiz'));
