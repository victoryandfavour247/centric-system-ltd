import { supabase } from "./supabase";
import type { InventoryItem, Supplier, Movement, PurchaseOrder, Sale } from "./inventory";

/* ---------- row <-> app mappers ---------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
const toItem = (r: any): InventoryItem => ({
  id: r.id, sku: r.sku ?? "", name: r.name, brand: r.brand, category: r.category,
  cost: Number(r.cost) || 0, price: Number(r.price) || 0, stock: Number(r.stock) || 0,
  reorderLevel: Number(r.reorder_level) || 0, reorderQty: Number(r.reorder_qty) || 0,
  supplierId: r.supplier_id ?? "", location: r.location ?? "", barcode: r.barcode ?? "", image: r.image ?? undefined,
});
const fromItem = (i: InventoryItem) => ({
  id: i.id, sku: i.sku, name: i.name, brand: i.brand, category: i.category,
  cost: i.cost, price: i.price, stock: i.stock, reorder_level: i.reorderLevel, reorder_qty: i.reorderQty,
  supplier_id: i.supplierId, location: i.location, barcode: i.barcode, image: i.image ?? null, updated_at: new Date().toISOString(),
});

const toSupplier = (r: any): Supplier => ({ id: r.id, name: r.name, contact: r.contact ?? "", phone: r.phone ?? "", email: r.email ?? "", leadDays: Number(r.lead_days) || 0 });
const fromSupplier = (s: Supplier) => ({ id: s.id, name: s.name, contact: s.contact, phone: s.phone, email: s.email, lead_days: s.leadDays });

const toMovement = (r: any): Movement => ({ id: r.id, date: r.date, itemId: r.item_id, itemName: r.item_name, type: r.type, qty: Number(r.qty), note: r.note ?? "", byName: r.by_name ?? "" });
const fromMovement = (m: Movement) => ({ id: m.id, date: m.date, item_id: m.itemId, item_name: m.itemName, type: m.type, qty: m.qty, note: m.note, by_name: m.byName });

const toPO = (r: any): PurchaseOrder => ({ id: r.id, supplierId: r.supplier_id, date: r.date, expected: r.expected ?? "", status: r.status, lines: r.lines ?? [], note: r.note ?? "", createdBy: r.created_by ?? "", receivedDate: r.received_date ?? undefined });
const fromPO = (o: PurchaseOrder) => ({ id: o.id, supplier_id: o.supplierId, date: o.date, expected: o.expected, status: o.status, lines: o.lines, note: o.note, created_by: o.createdBy, received_date: o.receivedDate ?? null });

const toSale = (r: any): Sale => ({ id: r.id, date: r.date, cashierId: r.cashier_id ?? "", cashierName: r.cashier_name ?? "", items: r.items ?? [], subtotal: Number(r.subtotal) || 0, discount: Number(r.discount) || 0, total: Number(r.total) || 0, cost: Number(r.cost) || 0, profit: Number(r.profit) || 0, payment: r.payment, customer: r.customer ?? undefined, tendered: r.tendered ?? undefined, change: r.change ?? undefined });
const fromSale = (s: Sale) => ({ id: s.id, date: s.date, cashier_id: s.cashierId, cashier_name: s.cashierName, items: s.items, subtotal: s.subtotal, discount: s.discount, total: s.total, cost: s.cost, profit: s.profit, payment: s.payment, customer: s.customer ?? null, tendered: s.tendered ?? null, change: s.change ?? null });
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface DbSnapshot { items: InventoryItem[]; suppliers: Supplier[]; movements: Movement[]; orders: PurchaseOrder[]; sales: Sale[]; }

const MISSING = /relation|does not exist|schema cache|could not find the table/i;

const withShop = (obj: Record<string, unknown>, shopId?: string) => (shopId ? { ...obj, shop_id: shopId } : obj);

/** Load this shop's data. Returns null if the data tables don't exist yet (run supabase-data.sql). */
export async function dbLoadAll(shopId?: string): Promise<DbSnapshot | null> {
  const sid = shopId ?? "";
  const pq = supabase.from("products").select("*");
  const sq = supabase.from("suppliers").select("*");
  const mq = supabase.from("stock_movements").select("*").order("date", { ascending: false }).limit(500);
  const oq = supabase.from("purchase_orders").select("*").order("date", { ascending: false });
  const saq = supabase.from("sales").select("*").order("date", { ascending: false }).limit(1000);
  const [p, s, m, o, sa] = await Promise.all([
    shopId ? pq.eq("shop_id", sid) : pq,
    shopId ? sq.eq("shop_id", sid) : sq,
    shopId ? mq.eq("shop_id", sid) : mq,
    shopId ? oq.eq("shop_id", sid) : oq,
    shopId ? saq.eq("shop_id", sid) : saq,
  ]);
  const firstErr = [p, s, m, o, sa].find((r) => r.error)?.error;
  if (firstErr && MISSING.test(firstErr.message)) return null; // tables not set up
  return {
    items: (p.data ?? []).map(toItem),
    suppliers: (s.data ?? []).map(toSupplier),
    movements: (m.data ?? []).map(toMovement),
    orders: (o.data ?? []).map(toPO),
    sales: (sa.data ?? []).map(toSale),
  };
}

/** Seed THIS shop with starter products & suppliers if it has none. */
export async function dbSeedIfEmpty(items: InventoryItem[], suppliers: Supplier[], shopId?: string) {
  let q = supabase.from("products").select("id", { count: "exact", head: true });
  if (shopId) q = q.eq("shop_id", shopId);
  const { count } = await q;
  if ((count ?? 0) > 0) return;
  await supabase.from("suppliers").upsert(suppliers.map((s) => withShop(fromSupplier(s), shopId)));
  for (let i = 0; i < items.length; i += 200) {
    await supabase.from("products").upsert(items.slice(i, i + 200).map((it) => withShop(fromItem(it), shopId)));
  }
}

/* ---------- mutations (shop-scoped) ---------- */
export const dbUpsertItem = (i: InventoryItem, shopId?: string) => supabase.from("products").upsert(withShop(fromItem(i), shopId));
export const dbDeleteItem = (id: string) => supabase.from("products").delete().eq("id", id);
export const dbSetStock = (id: string, stock: number) => supabase.from("products").update({ stock, updated_at: new Date().toISOString() }).eq("id", id);
export const dbUpsertItems = (items: InventoryItem[], shopId?: string) => supabase.from("products").upsert(items.map((i) => withShop(fromItem(i), shopId)));

export const dbInsertMovements = (ms: Movement[], shopId?: string) => supabase.from("stock_movements").insert(ms.map((m) => withShop(fromMovement(m), shopId)));

export const dbUpsertSupplier = (s: Supplier, shopId?: string) => supabase.from("suppliers").upsert(withShop(fromSupplier(s), shopId));
export const dbDeleteSupplier = (id: string) => supabase.from("suppliers").delete().eq("id", id);

export const dbInsertPO = (o: PurchaseOrder, shopId?: string) => supabase.from("purchase_orders").insert(withShop(fromPO(o), shopId));
export const dbUpdatePO = (o: PurchaseOrder) => supabase.from("purchase_orders").update(fromPO(o)).eq("id", o.id);
export const dbDeletePO = (id: string) => supabase.from("purchase_orders").delete().eq("id", id);

export const dbInsertSale = (s: Sale, shopId?: string) => supabase.from("sales").insert(withShop(fromSale(s), shopId));
