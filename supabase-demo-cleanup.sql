-- ============================================================
-- Centric System Limited - Demo products belong to ONE shop only
-- Run in Supabase SQL Editor.
--
-- The sample catalogue is reserved for the demonstration shop "Centric Store"
-- owned by Dennis Ayensu Mensah (profayensu77@gmail.com). Every other shop
-- (even another one also named "Centric Store") must be empty so its Manager
-- adds their own items.
--
-- This clears products / suppliers / stock movements from every shop EXCEPT
-- that specific demo shop, plus any leftover rows with no shop.
-- Sales history is left untouched. Run once; safe to re-run.
-- ============================================================

-- The one demo shop = named "Centric Store" AND owned by profayensu77@gmail.com
-- (preview it):  select s.id, s.name, p.email
--                from public.shops s join public.profiles p on p.id = s.owner_id
--                where lower(trim(s.name)) = 'centric store'
--                  and lower(trim(p.email)) = 'profayensu77@gmail.com';

delete from public.stock_movements
  where shop_id is null
     or shop_id not in (
        select s.id from public.shops s join public.profiles p on p.id = s.owner_id
        where lower(coalesce(trim(s.name),'')) = 'centric store'
          and lower(coalesce(trim(p.email),'')) = 'profayensu77@gmail.com');

delete from public.products
  where shop_id is null
     or shop_id not in (
        select s.id from public.shops s join public.profiles p on p.id = s.owner_id
        where lower(coalesce(trim(s.name),'')) = 'centric store'
          and lower(coalesce(trim(p.email),'')) = 'profayensu77@gmail.com');

delete from public.suppliers
  where shop_id is null
     or shop_id not in (
        select s.id from public.shops s join public.profiles p on p.id = s.owner_id
        where lower(coalesce(trim(s.name),'')) = 'centric store'
          and lower(coalesce(trim(p.email),'')) = 'profayensu77@gmail.com');
