-- ============================================================
-- NEMTEK Inventory - Shops & approval workflow (run ONCE in Supabase SQL Editor)
-- Adds: a "shops" table, shop + approval columns on profiles, and updates the
-- sign-up trigger so Managers are auto-approved while Sales Leaders / Assistants
-- start as "pending" until the Manager approves them.
-- Safe to re-run.
-- ============================================================

-- SHOPS ------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  team_size int default 0,
  created_at timestamptz default now()
);
alter table public.shops enable row level security;

drop policy if exists "shops public read" on public.shops;
create policy "shops public read" on public.shops for select using (true); -- listed on the sign-up screen

drop policy if exists "shops owner write" on public.shops;
create policy "shops owner write" on public.shops for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- PROFILES: shop membership + approval ----------------------
alter table public.profiles add column if not exists shop_id uuid;
alter table public.profiles add column if not exists approved boolean not null default true;

-- SIGN-UP TRIGGER -------------------------------------------
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare existing int; chosen text; is_first boolean; v_shop uuid; v_meta jsonb;
begin
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  select count(*) into existing from public.profiles;
  is_first := existing = 0;
  chosen := case
    when is_first then 'owner'                                        -- first account = Manager (shop owner)
    when v_meta->>'role' in ('owner','manager','staff') then v_meta->>'role'
    else 'staff' end;

  if chosen = 'owner' then
    -- a Manager creates their shop at sign-up (name + team size)
    insert into public.shops (name, owner_id, team_size)
    values (coalesce(nullif(v_meta->>'shop_name',''), 'My Shop'), new.id, coalesce((v_meta->>'team_size')::int, 0))
    returning id into v_shop;
  else
    v_shop := nullif(v_meta->>'shop_id','')::uuid;                     -- Leaders/Assistants join an existing shop
  end if;

  insert into public.profiles (id, email, full_name, role, shop_id, approved)
  values (
    new.id, new.email,
    coalesce(v_meta->>'full_name', split_part(new.email,'@',1)),
    chosen, v_shop,
    case when chosen = 'owner' then true else false end               -- Leaders/Assistants need approval
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- REALTIME: push approval / decline changes to the affected worker instantly
alter table public.profiles replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
