-- ============================================================
-- Centric System Limited - Sign-up security (run in Supabase SQL Editor,
-- AFTER supabase-roles.sql). Safe to re-run.
--
-- What it does:
--   * Adds a private "app_settings" table holding a secret Manager access code.
--   * Only someone who enters the matching code can create a Manager (owner)
--     account. The very FIRST account is exempt so you can bootstrap.
--   * The check runs inside the sign-up trigger (server-side), so the code is
--     NEVER exposed in the browser/app bundle.
--
-- >>> IMPORTANT: change the code below from the default to your own secret. <<<
-- ============================================================

-- Private settings table (RLS on, no policies => only SECURITY DEFINER code can read it)
create table if not exists public.app_settings (
  key   text primary key,
  value text
);
alter table public.app_settings enable row level security;

-- Set / change your Manager access code here:
insert into public.app_settings (key, value)
values ('manager_signup_code', 'CENTRIC-ADMIN-2025')
on conflict (key) do update set value = excluded.value;

-- Sign-up trigger: gate Manager (owner) creation behind the secret code.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare existing int; chosen text; is_first boolean; v_shop uuid; v_meta jsonb; v_code text; v_expected text;
begin
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  select count(*) into existing from public.profiles;
  is_first := existing = 0;
  chosen := case
    when is_first then 'owner'                                        -- first account = Manager (bootstrap)
    when v_meta->>'role' in ('owner','manager','staff') then v_meta->>'role'
    else 'staff' end;

  -- Only an authorised person (with the secret code) may create a Manager.
  if chosen = 'owner' and not is_first then
    select value into v_expected from public.app_settings where key = 'manager_signup_code';
    v_code := coalesce(v_meta->>'manager_code', '');
    if v_expected is null or v_expected = '' or v_code <> v_expected then
      raise exception 'INVALID_MANAGER_CODE';                         -- rolls back the whole sign-up
    end if;
  end if;

  if chosen = 'owner' then
    insert into public.shops (name, owner_id, team_size)
    values (coalesce(nullif(v_meta->>'shop_name',''), 'My Shop'), new.id, coalesce((v_meta->>'team_size')::int, 0))
    returning id into v_shop;
  else
    v_shop := nullif(v_meta->>'shop_id','')::uuid;
  end if;

  insert into public.profiles (id, email, full_name, role, shop_id, approved)
  values (
    new.id, new.email,
    coalesce(v_meta->>'full_name', split_part(new.email,'@',1)),
    chosen, v_shop,
    case when chosen = 'owner' then true else false end
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
