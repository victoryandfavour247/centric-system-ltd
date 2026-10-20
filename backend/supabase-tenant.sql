-- ============================================================
-- Centric System Limited - Multi-tenant scoping (run ONCE, after the other SQL files)
-- Makes every shop's data (products, stock, suppliers, purchase orders, sales)
-- completely separate. Each user only ever sees their own shop's data.
-- Safe to re-run.
-- ============================================================

-- add shop scoping to every data table
alter table public.products          add column if not exists shop_id uuid;
alter table public.suppliers         add column if not exists shop_id uuid;
alter table public.stock_movements   add column if not exists shop_id uuid;
alter table public.purchase_orders   add column if not exists shop_id uuid;
alter table public.sales             add column if not exists shop_id uuid;

-- which shop does the current user belong to?
create or replace function public.my_shop_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

-- lock every data table to the caller's own shop
do $$
declare t text;
begin
  foreach t in array array['suppliers','products','stock_movements','purchase_orders','sales'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "staff all %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "shop scope %1$s" on public.%1$s;', t);
    execute format(
      'create policy "shop scope %1$s" on public.%1$s for all to authenticated using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());', t);
    execute format('create index if not exists idx_%1$s_shop on public.%1$s(shop_id);', t);
  end loop;
end $$;

-- OPTIONAL: clear any old shared/global demo rows (they have no shop and are now hidden anyway)
-- delete from public.products where shop_id is null;
-- delete from public.suppliers where shop_id is null;
-- delete from public.stock_movements where shop_id is null;
-- delete from public.purchase_orders where shop_id is null;
-- delete from public.sales where shop_id is null;
