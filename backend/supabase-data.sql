-- ============================================================
-- NEMTEK Inventory - shared DATA tables (run ONCE in Supabase SQL Editor)
-- This makes products, stock, suppliers, purchase orders and sales
-- shared live across every device and signed-in user.
-- Safe to re-run.
-- ============================================================

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  contact text, phone text, email text,
  lead_days int default 7,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id text primary key,
  sku text, name text not null, brand text, category text,
  cost numeric default 0, price numeric default 0, stock int default 0,
  reorder_level int default 5, reorder_qty int default 20,
  supplier_id text, location text, barcode text, image text,
  updated_at timestamptz default now()
);

create table if not exists public.stock_movements (
  id text primary key,
  date timestamptz default now(),
  item_id text, item_name text, type text, qty int, note text, by_name text
);

create table if not exists public.purchase_orders (
  id text primary key,
  supplier_id text, date timestamptz default now(), expected text,
  status text default 'draft', lines jsonb default '[]'::jsonb, note text,
  created_by text, received_date timestamptz
);

create table if not exists public.sales (
  id text primary key,
  date timestamptz default now(), cashier_id text, cashier_name text,
  items jsonb default '[]'::jsonb, subtotal numeric, discount numeric, total numeric,
  cost numeric, profit numeric, payment text, customer text, tendered numeric, change numeric
);

-- Row Level Security: any signed-in staff member can read/write operational data.
do $$
declare t text;
begin
  foreach t in array array['suppliers','products','stock_movements','purchase_orders','sales'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "staff all %1$s" on public.%1$s;', t);
    execute format(
      'create policy "staff all %1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Realtime: broadcast changes so other devices update live.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.stock_movements;
alter publication supabase_realtime add table public.purchase_orders;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.suppliers;
