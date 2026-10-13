-- ============================================================
-- NEMTEK Inventory - Supabase setup
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It creates the user "profiles" table, auto-creates a profile on sign-up
-- (the FIRST account becomes the Administrator), and lets managers/admins
-- assign roles.
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'staff' check (role in ('owner','manager','staff')),
  active       boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- helpers (security definer so they can read profiles inside policies)
create or replace function public.is_staff_admin() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'));
$$;

-- policies -------------------------------------------------------
drop policy if exists "profiles self or admin read" on public.profiles;
create policy "profiles self or admin read" on public.profiles
  for select using (id = auth.uid() or public.is_staff_admin());

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles update self or admin" on public.profiles;
create policy "profiles update self or admin" on public.profiles
  for update using (id = auth.uid() or public.is_staff_admin());

-- auto-create a profile whenever a new auth user signs up ---------
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare existing int;
begin
  select count(*) into existing from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case
      when existing = 0 then 'owner'  -- very first account is always the Administrator
      when new.raw_user_meta_data->>'role' in ('owner','manager','staff') then new.raw_user_meta_data->>'role'  -- role chosen at sign-up
      else 'staff'
    end
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- OPTIONAL: make a specific email the Administrator (run after they sign up)
-- update public.profiles set role = 'owner'
--   where email = 'davidarmah991@gmail.com';
