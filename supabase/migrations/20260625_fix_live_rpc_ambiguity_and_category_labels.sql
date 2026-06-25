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
declare
  v_user_id text;
  v_coins integer;
begin
  insert into public.wallets as w (user_id, coins)
  values (target_user_id, 0)
  on conflict on constraint wallets_pkey do nothing;

  update public.wallets as w
    set coins = w.coins + coin_delta,
        updated_at = now()
    where w.user_id = target_user_id
      and w.coins + coin_delta >= 0
  returning w.user_id, w.coins
  into v_user_id, v_coins;

  if not found then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  insert into public.coin_logs (id, user_id, admin_id, amount, reason, created_at)
  values (gen_random_uuid()::text, target_user_id, '', coin_delta, reason, now());

  return query select v_user_id, v_coins;
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
declare
  v_product_id text;
  v_stock integer;
begin
  update public.products as p
    set stock = p.stock + stock_delta,
        updated_at = now()
    where p.id = target_product_id
      and p.stock + stock_delta >= 0
  returning p.id, p.stock
  into v_product_id, v_stock;

  if not found then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into public.stock_movements (product_id, delta, reason)
  values (target_product_id, stock_delta, 'adjustment');

  return query select v_product_id, v_stock;
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
declare
  v_user_id text;
  v_product_id text;
  v_next_balance integer;
  v_next_stock integer;
begin
  insert into public.wallets as w (user_id, coins)
  values (target_user_id, 0)
  on conflict on constraint wallets_pkey do nothing;

  update public.wallets as w
    set coins = w.coins - price_coin,
        updated_at = now()
    where w.user_id = target_user_id
      and w.coins >= price_coin
  returning w.user_id, w.coins
  into v_user_id, v_next_balance;

  if not found then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  update public.products as p
    set stock = p.stock - 1,
        updated_at = now()
    where p.id = target_product_id
      and p.stock > 0
  returning p.id, p.stock
  into v_product_id, v_next_stock;

  if not found then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into public.stock_movements (product_id, delta, reason)
  values (target_product_id, -1, 'purchase');

  return query select v_user_id, v_product_id, v_next_balance, v_next_stock;
end;
$$;

grant execute on function public.adjust_wallet_balance(text, integer, text) to service_role;
grant execute on function public.adjust_product_stock(text, integer) to service_role;
grant execute on function public.purchase_product_atomic(text, text, integer) to service_role;

insert into public.product_categories (id, label, created_at, updated_at)
values
  ('gachapon', 'กาชาปอง', now(), now()),
  ('figure', 'ฟิกเกอร์/โมเดล', now(), now()),
  ('plush', 'ตุ๊กตา', now(), now())
on conflict (id) do update
set label = excluded.label,
    updated_at = now();
