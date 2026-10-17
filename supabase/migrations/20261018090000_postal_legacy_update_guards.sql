-- T-4.08b: NOT VALID checks still apply to every UPDATE. Preserve historical
-- missing data without preventing fulfillment or unrelated profile changes.
-- Fresh databases retain orders.ship_postal_code NOT NULL from T-4.08.
alter table public.orders drop constraint if exists orders_ship_postal_code_not_null;
alter table public.profiles drop constraint if exists profiles_address_postal_code_required;

create or replace function public.guard_order_postal_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.ship_postal_code is not distinct from old.ship_postal_code then
      return new;
    end if;
  end if;
  if new.ship_postal_code is null or new.ship_postal_code !~ '^[0-9]{5}$' then
    raise exception 'Postal code required for a new order'
      using errcode = '23514', hint = 'ORD-012';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_order_postal_code() from public, anon, authenticated;
create trigger require_order_postal_code
before insert or update on public.orders
for each row execute function public.guard_order_postal_code();

create or replace function public.guard_profile_postal_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Registration and erasure may leave the entire delivery address absent.
  if new.address is null and new.governorate_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if row(new.governorate_id, new.city, new.district, new.address,
           new.floor, new.apartment, new.landmark, new.postal_code)
       is not distinct from
       row(old.governorate_id, old.city, old.district, old.address,
           old.floor, old.apartment, old.landmark, old.postal_code) then
      return new;
    end if;
  end if;
  if new.postal_code is null or new.postal_code !~ '^[0-9]{5}$' then
    raise exception 'Postal code required for a saved address'
      using errcode = '23514', hint = 'ORD-012';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_postal_code() from public, anon, authenticated;
create trigger require_profile_postal_code
before insert or update on public.profiles
for each row execute function public.guard_profile_postal_code();

-- Restore the v2 API's safe AUTH-004 response. The function checks auth.uid()
-- before performing writes; anon still cannot place an order or write tables.
revoke all on function public.place_order(jsonb, public.delivery_method, public.payment_method, jsonb) from public;
grant execute on function public.place_order(jsonb, public.delivery_method, public.payment_method, jsonb) to anon, authenticated;
