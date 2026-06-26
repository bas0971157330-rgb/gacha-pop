alter table public.users
  add column if not exists phone text not null default '',
  add column if not exists avatar_url text not null default '/avatars/hamster.png';

create index if not exists idx_users_phone on public.users(phone);
