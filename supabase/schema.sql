create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  pin text not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id text primary key references public.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  image text not null default '/hero-machine.png',
  images jsonb not null default '[]'::jsonb,
  stock integer not null default 0 check (stock >= 0),
  price_coin integer not null default 0 check (price_coin >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  type text not null default 'random' check (type in ('random', 'sale')),
  category_id text not null default 'gachapon',
  description text not null default '',
  badges jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  discount_disabled boolean not null default false,
  drop_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  delta integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id text primary key,
  user_id text not null,
  reward_id text not null,
  name text not null,
  image text not null default '/hero-machine.png',
  quantity integer not null default 1 check (quantity >= 1),
  status text not null default 'pending' check (status in ('pending', 'shipping', 'shipped')),
  selected_for_shipping boolean not null default false,
  selected_quantity integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  user_id text not null,
  username text not null default '',
  items jsonb not null default '[]'::jsonb,
  receiver_name text not null default '',
  phone text not null default '',
  address text not null default '',
  tracking_number text not null default '',
  status text not null default 'pending' check (status in ('pending', 'shipping', 'shipped')),
  shipping_fee integer not null default 0,
  coupon_code text,
  coupon_type text check (coupon_type in ('discount', 'freeShipping')),
  coupon_discount_percent integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_orders (
  id text primary key,
  order_id text not null,
  user_id text not null,
  status text not null default 'pending' check (status in ('pending', 'shipping', 'shipped')),
  tracking_number text not null default '',
  pdf_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.popup_ads (
  id text primary key,
  image text not null,
  title text not null,
  placement text not null default 'banner' check (placement in ('banner', 'popup')),
  dismiss_hours integer not null default 1 check (dismiss_hours >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_addresses (
  user_id text primary key,
  receiver_name text not null default '',
  phone text not null default '',
  detail text not null default '',
  house_no text not null default '',
  road text not null default '',
  province text not null default '',
  district text not null default '',
  subdistrict text not null default '',
  postal_code text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id text primary key,
  code text not null unique,
  type text not null check (type in ('discount', 'freeShipping')),
  discount_percent integer not null default 100,
  max_uses integer not null default 1,
  claimed_by_user_ids jsonb not null default '[]'::jsonb,
  used_by_user_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.coin_logs (
  id text primary key,
  user_id text not null,
  admin_id text not null default '',
  amount integer not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.topup_logs (
  id text primary key,
  user_id text not null,
  amount integer not null default 0,
  status text not null default 'success' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.roll_history (
  id text primary key,
  user_id text not null,
  reward_name text not null default '',
  machine_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id text primary key,
  type text not null check (type in ('order', 'coin', 'stock', 'auth')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.adjust_wallet_balance(
  target_user_id text,
  coin_delta integer,
  reason text default ''
)
returns table(user_id text, coins integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, coins)
  values (target_user_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets
    set coins = coins + coin_delta,
        updated_at = now()
    where wallets.user_id = target_user_id
      and coins + coin_delta >= 0
  returning wallets.user_id, wallets.coins
  into user_id, coins;

  if not found then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  insert into public.coin_logs (id, user_id, admin_id, amount, reason, created_at)
  values (gen_random_uuid()::text, target_user_id, '', coin_delta, reason, now());

  return next;
end;
$$;

create or replace function public.adjust_product_stock(
  target_product_id text,
  stock_delta integer
)
returns table(product_id text, stock integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
    set stock = stock + stock_delta,
        updated_at = now()
    where id = target_product_id
      and stock + stock_delta >= 0
  returning id, stock
  into product_id, stock;

  if not found then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into public.stock_movements (product_id, delta, reason)
  values (target_product_id, stock_delta, 'adjustment');

  return next;
end;
$$;

create or replace function public.purchase_product_atomic(
  target_user_id text,
  target_product_id text,
  price_coin integer
)
returns table(user_id text, product_id text, next_balance integer, next_stock integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, coins)
  values (target_user_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets
    set coins = coins - price_coin,
        updated_at = now()
    where wallets.user_id = target_user_id
      and coins >= price_coin
  returning wallets.user_id, wallets.coins
  into user_id, next_balance;

  if not found then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  update public.products
    set stock = stock - 1,
        updated_at = now()
    where id = target_product_id
      and stock > 0
  returning id, stock
  into product_id, next_stock;

  if not found then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into public.stock_movements (product_id, delta, reason)
  values (target_product_id, -1, 'purchase');

  return next;
end;
$$;

grant execute on function public.adjust_wallet_balance(text, integer, text) to service_role;
grant execute on function public.adjust_product_stock(text, integer) to service_role;
grant execute on function public.purchase_product_atomic(text, text, integer) to service_role;

grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.users,
  public.wallets,
  public.product_categories,
  public.products,
  public.stock_movements,
  public.inventory,
  public.orders,
  public.shipping_orders,
  public.popup_ads,
  public.admin_settings,
  public.shipping_addresses,
  public.coupons,
  public.coin_logs,
  public.topup_logs,
  public.roll_history,
  public.admin_notifications
to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.shipping_orders enable row level security;
alter table public.popup_ads enable row level security;
alter table public.admin_settings enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.coupons enable row level security;
alter table public.coin_logs enable row level security;
alter table public.topup_logs enable row level security;
alter table public.roll_history enable row level security;
alter table public.admin_notifications enable row level security;
