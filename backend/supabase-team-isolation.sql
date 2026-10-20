-- ============================================================
-- Centric System Limited - Team isolation per shop (run in Supabase SQL Editor,
-- AFTER supabase-roles.sql, supabase-data.sql and supabase-tenant.sql).
-- Safe to re-run.
--
-- Makes the "profiles" (people) table shop-scoped: a Manager can only SEE and
-- MANAGE the Sales Leaders / Sales Assistants that signed up under THEIR shop.
-- No one ever sees people from another store.
-- ============================================================

-- Helpers (SECURITY DEFINER => they read profiles without triggering RLS, so no recursion)
create or replace function public.my_shop_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role() returns text
  language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;

-- Remove the old permissive policies (they let a Manager read every profile)
drop policy if exists "profiles self or admin read" on public.profiles;
drop policy if exists "profiles read own shop" on public.profiles;
drop policy if exists "profiles insert self" on public.profiles;
drop policy if exists "profiles update self or admin" on public.profiles;
drop policy if exists "profiles update own shop" on public.profiles;

-- SELECT: your own row, or anyone who belongs to your shop
create policy "profiles read own shop" on public.profiles for select to authenticated
  using (id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()));

-- INSERT: only your own row (the sign-up trigger creates it)
create policy "profiles insert self" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- UPDATE: your own row, or - only as the shop Manager - members of your shop
create policy "profiles update own shop" on public.profiles for update to authenticated
  using (id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id() and public.my_role() = 'owner'))
  with check (id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id() and public.my_role() = 'owner'));
