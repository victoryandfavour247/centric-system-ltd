"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { Session, User as SbUser } from "@supabase/supabase-js";
import { supabase, supabaseConfigured, OWNER_EMAILS } from "@/lib/supabase";
import {
  seedInventory, seedSuppliers,
  type InventoryItem, type Supplier, type Movement, type MovementType,
  type PurchaseOrder, type Role, type Sale, type SaleLine, type PaymentMethod,
} from "@/lib/inventory";
import {
  dbLoadAll, dbSeedIfEmpty, dbUpsertItem, dbDeleteItem, dbSetStock, dbUpsertItems,
  dbInsertMovements, dbUpsertSupplier, dbDeleteSupplier, dbInsertPO, dbUpdatePO, dbDeletePO, dbInsertSale,
} from "@/lib/db";

interface Toast { id: number; msg: string; type: "success" | "error" | "info"; }
export interface AuthUser { id: string; email: string; name: string; role: Role; active: boolean; approved: boolean; shopId?: string; shopName?: string; }
export interface Profile { id: string; email: string; full_name: string; role: Role; active: boolean; approved?: boolean; shop_id?: string; created_at?: string; }
export interface Shop { id: string; name: string; }

interface Ctx {
  ready: boolean;
  configured: boolean;
  needsSetup: boolean;        // profiles table missing
  needsDataSetup: boolean;    // data tables missing (running on local fallback)
  shared: boolean;            // true when data is Supabase-backed (live/shared)
  user: AuthUser | null;
  profiles: Profile[];
  shops: Shop[];
  fetchShops: () => Promise<Shop[]>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string, role?: Role, opts?: { shopName?: string; teamSize?: number; shopId?: string; joinShopName?: string; managerCode?: string }) => Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }>;
  logout: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  updateMember: (id: string, patch: { role?: Role; active?: boolean; approved?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  items: InventoryItem[]; suppliers: Supplier[]; orders: PurchaseOrder[]; movements: Movement[]; sales: Sale[];
  recordSale: (cart: { id: string; qty: number }[], opts: { discount: number; payment: PaymentMethod; customer?: string; tendered?: number }) => Sale | null;
  upsertItem: (item: InventoryItem) => void;
  deleteItem: (id: string) => void;
  moveStock: (id: string, type: MovementType, qty: number, note: string) => void;
  setStock: (id: string, newStock: number, note: string) => void;
  upsertSupplier: (s: Supplier) => void;
  deleteSupplier: (id: string) => void;
  createPO: (po: Omit<PurchaseOrder, "id" | "date" | "createdBy">) => PurchaseOrder;
  updatePO: (po: PurchaseOrder) => void;
  receivePO: (id: string) => void;
  deletePO: (id: string) => void;
  toasts: Toast[];
  toast: (msg: string, type?: Toast["type"]) => void;
  dismissToast: (id: number) => void;
}

const C = createContext<Ctx | null>(null);
const K = { items: "nti.v3.items", suppliers: "nti.v3.suppliers", orders: "nti.v3.orders", moves: "nti.v3.moves", sales: "nti.v3.sales" };

function read<T>(k: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
}
function write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const uid = (p: string) => p + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

export function Store({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsDataSetup, setNeedsDataSetup] = useState(false);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const backend = useRef<"local" | "supabase">("local");
  const dataLoaded = useRef(false);
  const greeted = useRef<string | null>(null);
  const shopIdRef = useRef<string | undefined>(undefined);
  const meRef = useRef<AuthUser | null>(null);
  useEffect(() => { shopIdRef.current = user?.shopId; meRef.current = user; }, [user]);

  /* ---- toasts ---- */
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => dismissToast(id), 2800);
  }, [dismissToast]);

  /* write-through helper */
  const sb = () => backend.current === "supabase";
  const persist = useCallback((run?: PromiseLike<{ error: unknown }>) => {
    if (!run) return;
    Promise.resolve(run).then((res) => { if (res && (res as { error?: unknown }).error) toast("Saved locally - cloud sync failed", "error"); }).catch(() => {});
  }, [toast]);

  /* ---- local fallback persistence ---- */
  const loadLocal = useCallback(() => {
    setItems(read(K.items, seedInventory()));
    setSuppliers(read(K.suppliers, seedSuppliers()));
    setOrders(read(K.orders, []));
    setMovements(read(K.moves, []));
    setSales(read(K.sales, []));
  }, []);
  useEffect(() => { if (backend.current === "local" && dataLoaded.current) write(K.items, items); }, [items]);
  useEffect(() => { if (backend.current === "local" && dataLoaded.current) write(K.suppliers, suppliers); }, [suppliers]);
  useEffect(() => { if (backend.current === "local" && dataLoaded.current) write(K.orders, orders); }, [orders]);
  useEffect(() => { if (backend.current === "local" && dataLoaded.current) write(K.moves, movements); }, [movements]);
  useEffect(() => { if (backend.current === "local" && dataLoaded.current) write(K.sales, sales); }, [sales]);

  /* ---- load shared data (after sign-in) ---- */
  const applySnapshot = useCallback((s: Awaited<ReturnType<typeof dbLoadAll>>) => {
    if (!s) return;
    setItems(s.items); setSuppliers(s.suppliers); setOrders(s.orders); setMovements(s.movements); setSales(s.sales);
  }, []);

  const loadData = useCallback(async (shopId?: string, shopName?: string, email?: string) => {
    if (dataLoaded.current) return;
    const sid = shopId ?? shopIdRef.current;
    // Only Dennis Ayensu Mensah's demo shop "Centric Store" is pre-loaded with the
    // sample catalogue. Every other shop (even one also named "Centric Store")
    // starts empty so its Manager adds their own products.
    const isDemoShop =
      (shopName ?? "").trim().toLowerCase() === "centric store" &&
      (email ?? "").trim().toLowerCase() === "profayensu77@gmail.com";
    try {
      const snap = await dbLoadAll(sid);
      if (!snap) { backend.current = "local"; setNeedsDataSetup(true); loadLocal(); }
      else {
        backend.current = "supabase"; setNeedsDataSetup(false);
        if (snap.items.length === 0) {
          if (sid && isDemoShop) {
            // Demo shop: seed the full sample catalogue.
            await dbSeedIfEmpty(seedInventory(), seedSuppliers(), sid);
            applySnapshot(await dbLoadAll(sid));
          } else if (sid) {
            // A real/new shop: start empty.
            applySnapshot(snap);
          } else {
            // Signed in but no shop yet (run the roles SQL): show the catalogue locally.
            backend.current = "local"; setNeedsDataSetup(true); loadLocal();
          }
        } else applySnapshot(snap);
      }
    } catch { backend.current = "local"; setNeedsDataSetup(true); loadLocal(); }
    dataLoaded.current = true;
  }, [applySnapshot, loadLocal]);

  const reloadShared = useCallback(async () => {
    if (backend.current !== "supabase") return;
    try { const snap = await dbLoadAll(shopIdRef.current); if (snap) applySnapshot(snap); } catch {}
  }, [applySnapshot]);


  /* ---- auth ---- */
  const shopName = useCallback(async (shopId?: string): Promise<string | undefined> => {
    if (!shopId) return undefined;
    try { const { data } = await supabase.from("shops").select("name").eq("id", shopId).maybeSingle(); return data?.name ?? undefined; } catch { return undefined; }
  }, []);

  const resolveUser = useCallback(async (sbUser: SbUser): Promise<AuthUser> => {
    const email = (sbUser.email ?? "").toLowerCase();
    const meta = (sbUser.user_metadata ?? {}) as { full_name?: string; role?: Role };
    const fallbackName = meta.full_name || email.split("@")[0] || "User";
    const isOwnerEmail = OWNER_EMAILS.includes(email);
    const base = (role: Role): AuthUser => ({ id: sbUser.id, email, name: fallbackName, role, active: true, approved: true });
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", sbUser.id).maybeSingle();
      if (error) { if (/relation|does not exist|schema cache/i.test(error.message)) setNeedsSetup(true); return base(isOwnerEmail ? "owner" : (meta.role ?? "staff")); }
      setNeedsSetup(false);
      if (data) {
        let role = data.role as Role;
        if (isOwnerEmail && role !== "owner") { await supabase.from("profiles").update({ role: "owner" }).eq("id", sbUser.id); role = "owner"; }
        const approved = role === "owner" ? true : (data.approved ?? true);
        let shopId: string | undefined = data.shop_id ?? undefined;
        // Backfill: a Manager who has no shop yet gets one created now (so staff can find & join it)
        if (role === "owner" && !shopId) {
          try {
            const { data: shop } = await supabase.from("shops").insert({ name: `${(data.full_name || fallbackName).split(" ")[0]}'s Shop`, owner_id: sbUser.id, team_size: 0 }).select("id").maybeSingle();
            if (shop?.id) { shopId = shop.id as string; await supabase.from("profiles").update({ shop_id: shopId }).eq("id", sbUser.id); }
          } catch {}
        }
        return { id: data.id, email: data.email || email, name: data.full_name || fallbackName, role, active: data.active ?? true, approved, shopId, shopName: await shopName(shopId) };
      }
      const role: Role = isOwnerEmail ? "owner" : (meta.role ?? "staff");
      await supabase.from("profiles").insert({ id: sbUser.id, email, full_name: fallbackName, role });
      return base(role);
    } catch { return base(isOwnerEmail ? "owner" : (meta.role ?? "staff")); }
  }, [shopName]);

  const fetchShops = useCallback(async () => {
    try { const { data, error } = await supabase.from("shops").select("id,name").order("name"); if (!error && data) { setShops(data as Shop[]); return data as Shop[]; } } catch {}
    return [] as Shop[];
  }, []);

  const refreshProfiles = useCallback(async () => {
    try { const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true }); if (!error && data) setProfiles(data as Profile[]); } catch {}
  }, []);

  /* Re-resolve MY own account (approval/decline reaches staff immediately) */
  const refreshMe = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const u = await resolveUser(session.user);
      const prev = meRef.current;
      if (prev && prev.role !== "owner" && prev.id === u.id) {
        if (prev.active && !u.active) toast("Your request was declined by the Manager.", "error");
        else if ((!prev.approved || !prev.active) && u.approved && u.active) toast("You've been approved - welcome aboard!");
      }
      setUser(u);
    } catch {}
  }, [resolveUser, toast]);

  /* realtime sync across devices (data + team/approval changes) */
  const canSeeTeam = user?.role === "owner" || user?.role === "manager";
  useEffect(() => {
    if (!ready || backend.current !== "supabase") return;
    let t: ReturnType<typeof setTimeout>;
    const ch = supabase.channel("nti-data").on("postgres_changes", { event: "*", schema: "public" }, () => {
      clearTimeout(t); t = setTimeout(() => { reloadShared(); refreshMe(); if (canSeeTeam) refreshProfiles(); }, 400);
    }).subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [ready, reloadShared, refreshProfiles, refreshMe, canSeeTeam]);

  useEffect(() => {
    if (!supabaseConfigured) { backend.current = "local"; loadLocal(); dataLoaded.current = true; setReady(true); return; }
    let active = true;
    const apply = async (session: Session | null) => {
      if (!active) return;
      if (session?.user) {
        const u = await resolveUser(session.user);
        if (!active) return;
        setUser(u);
        if (greeted.current !== u.id) { greeted.current = u.id; toast(`Welcome, ${u.name.split(" ")[0]}!`); }
        if (u.role === "owner" || u.role === "manager") refreshProfiles();
        await loadData(u.shopId, u.shopName, u.email);
      } else { setUser(null); setProfiles([]); greeted.current = null; }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { apply(session); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [resolveUser, refreshProfiles, toast, loadData, loadLocal]);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) return { ok: false, error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, role: Role = "staff", opts?: { shopName?: string; teamSize?: number; shopId?: string; joinShopName?: string; managerCode?: string }) => {
    if (!supabaseConfigured) return { ok: false, error: "Supabase is not configured yet." };
    if (!name.trim()) return { ok: false, error: "Enter your full name." };
    const cleanEmail = email.trim().toLowerCase();
    // Proper email format check (the browser's type=email is easy to bypass).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) return { ok: false, error: "Enter a valid email address." };
    const chosen: Role = (["owner", "manager", "staff"] as Role[]).includes(role) ? role : "staff";
    if (chosen === "owner" && !opts?.shopName?.trim()) return { ok: false, error: "Enter your shop name." };
    if (chosen === "owner" && !opts?.managerCode?.trim()) return { ok: false, error: "A Manager access code is required to create a shop." };
    const meta: Record<string, unknown> = { full_name: name.trim(), role: chosen };
    if (chosen === "owner") { meta.shop_name = opts?.shopName?.trim(); meta.team_size = opts?.teamSize ?? 0; meta.manager_code = opts?.managerCode?.trim(); }
    else {
      // Leader / Assistant: find the registered shop by the name they typed
      let shopId = opts?.shopId;
      const typed = opts?.joinShopName?.trim();
      if (!shopId && !typed) return { ok: false, error: "Enter the name of the shop you work under." };
      if (!shopId && typed) {
        try {
          const { data: rows } = await supabase.from("shops").select("id,name").ilike("name", typed);
          const match = (rows ?? []).find((r) => r.name.toLowerCase() === typed.toLowerCase()) ?? (rows ?? [])[0];
          if (!match) return { ok: false, error: `No shop named "${typed}" is registered yet. Check the exact name with your Manager.` };
          shopId = match.id as string;
        } catch { return { ok: false, error: "Could not look up that shop. Try again." }; }
      }
      meta.shop_id = shopId;
    }
    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: meta } });
    if (error) {
      // A rejected Manager code surfaces as a generic DB error from the trigger.
      if (chosen === "owner" && /database error|invalid_manager_code|saving new user/i.test(error.message)) {
        return { ok: false, error: "Manager access code is incorrect. Check it with your administrator." };
      }
      return { ok: false, error: error.message };
    }
    if (!data.session) return { ok: true, needsConfirm: true };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => { await supabase.auth.signOut(); setUser(null); setProfiles([]); }, []);

  const updateMember = useCallback(async (id: string, patch: { role?: Role; active?: boolean; approved?: boolean }) => {
    try { const { error } = await supabase.from("profiles").update(patch).eq("id", id); if (error) return { ok: false, error: error.message }; await refreshProfiles(); toast("Team member updated"); return { ok: true }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  }, [refreshProfiles, toast]);

  /* ================= inventory (Supabase-backed with local fallback) ================= */
  const moveStock = useCallback((id: string, type: MovementType, qty: number, note: string) => {
    if (qty <= 0) { toast("Enter a quantity greater than zero", "error"); return; }
    const it = items.find((i) => i.id === id); if (!it) return;
    if (type === "issue" && qty > it.stock) { toast("Not enough stock to issue", "error"); return; }
    const delta = type === "issue" ? -qty : qty;
    const newStock = Math.max(0, it.stock + delta);
    const mv: Movement = { id: uid("MV"), date: new Date().toISOString(), itemId: id, itemName: it.name, type, qty: delta, note, byName: user?.name ?? "Staff" };
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, stock: newStock } : i));
    setMovements((prev) => [mv, ...prev]);
    if (sb()) { persist(dbSetStock(id, newStock)); persist(dbInsertMovements([mv], shopIdRef.current)); }
    toast(type === "receive" ? `+${qty} received` : type === "issue" ? `${qty} issued out` : "Stock updated");
  }, [items, user, toast, persist]);

  const setStock = useCallback((id: string, newStock: number, note: string) => {
    const it = items.find((i) => i.id === id); if (!it) return;
    const diff = Math.max(0, newStock) - it.stock; const final = Math.max(0, newStock);
    const mv: Movement = { id: uid("MV"), date: new Date().toISOString(), itemId: id, itemName: it.name, type: "adjust", qty: diff, note: note || "Stock count correction", byName: user?.name ?? "Staff" };
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, stock: final } : i));
    setMovements((prev) => [mv, ...prev]);
    if (sb()) { persist(dbSetStock(id, final)); persist(dbInsertMovements([mv], shopIdRef.current)); }
    toast("Stock adjusted");
  }, [items, user, toast, persist]);

  const upsertItem = useCallback((item: InventoryItem) => {
    setItems((prev) => prev.some((i) => i.id === item.id) ? prev.map((i) => i.id === item.id ? item : i) : [{ ...item }, ...prev]);
    if (sb()) persist(dbUpsertItem(item, shopIdRef.current));
    toast("Product saved");
  }, [toast, persist]);
  const deleteItem = useCallback((id: string) => { setItems((prev) => prev.filter((i) => i.id !== id)); if (sb()) persist(dbDeleteItem(id)); toast("Product removed", "info"); }, [toast, persist]);

  const upsertSupplier = useCallback((s: Supplier) => {
    setSuppliers((prev) => prev.some((x) => x.id === s.id) ? prev.map((x) => x.id === s.id ? s : x) : [...prev, s]);
    if (sb()) persist(dbUpsertSupplier(s, shopIdRef.current));
    toast("Supplier saved");
  }, [toast, persist]);
  const deleteSupplier = useCallback((id: string) => { setSuppliers((prev) => prev.filter((x) => x.id !== id)); if (sb()) persist(dbDeleteSupplier(id)); toast("Supplier removed", "info"); }, [toast, persist]);

  const createPO = useCallback((po: Omit<PurchaseOrder, "id" | "date" | "createdBy">) => {
    const order: PurchaseOrder = { ...po, id: uid("PO"), date: new Date().toISOString(), createdBy: user?.name ?? "System" };
    setOrders((prev) => [order, ...prev]);
    if (sb()) persist(dbInsertPO(order, shopIdRef.current));
    toast(`Purchase order ${order.id} created`);
    return order;
  }, [user, toast, persist]);
  const updatePO = useCallback((po: PurchaseOrder) => { setOrders((prev) => prev.map((o) => o.id === po.id ? po : o)); if (sb()) persist(dbUpdatePO(po)); }, [persist]);
  const deletePO = useCallback((id: string) => { setOrders((prev) => prev.filter((o) => o.id !== id)); if (sb()) persist(dbDeletePO(id)); toast("Purchase order deleted", "info"); }, [toast, persist]);

  const receivePO = useCallback((id: string) => {
    const po = orders.find((o) => o.id === id); if (!po || po.status === "received") return;
    const now = new Date().toISOString();
    const changed: InventoryItem[] = [];
    for (const line of po.lines) { const it = items.find((i) => i.id === line.itemId); if (it) changed.push({ ...it, stock: it.stock + line.qty, cost: line.cost || it.cost }); }
    setItems((prev) => prev.map((i) => changed.find((ci) => ci.id === i.id) ?? i));
    const mvs: Movement[] = po.lines.map((l) => { const it = items.find((i) => i.id === l.itemId); return { id: uid("MV"), date: now, itemId: l.itemId, itemName: it?.name ?? l.itemId, type: "receive" as const, qty: l.qty, note: `PO ${po.id}`, byName: user?.name ?? "System" }; });
    setMovements((prev) => [...mvs, ...prev]);
    const updated = { ...po, status: "received" as const, receivedDate: now };
    setOrders((prev) => prev.map((o) => o.id === id ? updated : o));
    if (sb()) { if (changed.length) persist(dbUpsertItems(changed, shopIdRef.current)); persist(dbInsertMovements(mvs, shopIdRef.current)); persist(dbUpdatePO(updated)); }
    toast(`Received ${po.lines.reduce((s, l) => s + l.qty, 0)} units from PO ${po.id}`);
  }, [orders, items, user, toast, persist]);

  const recordSale = useCallback((cart: { id: string; qty: number }[], opts: { discount: number; payment: PaymentMethod; customer?: string; tendered?: number }) => {
    if (cart.length === 0) { toast("Add items to the sale first", "error"); return null; }
    for (const c of cart) { const it = items.find((i) => i.id === c.id); if (!it || it.stock < c.qty) { toast(`Not enough stock${it ? ` for ${it.name}` : ""}`, "error"); return null; } }
    const lines: SaleLine[] = cart.map((c) => { const it = items.find((i) => i.id === c.id)!; return { id: it.id, name: it.name, price: it.price, cost: it.cost, qty: c.qty }; });
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const discount = Math.min(Math.max(0, opts.discount || 0), subtotal);
    const total = subtotal - discount;
    const cost = lines.reduce((s, l) => s + l.cost * l.qty, 0);
    const profit = total - cost;
    if (opts.payment === "cash" && typeof opts.tendered === "number" && opts.tendered < total) { toast("Amount received is less than the total", "error"); return null; }
    const tendered = opts.payment === "cash" && typeof opts.tendered === "number" ? opts.tendered : undefined;
    const change = tendered !== undefined ? Math.max(0, tendered - total) : undefined;
    const now = new Date().toISOString();
    const sale: Sale = { id: uid("SALE"), date: now, cashierId: user?.id ?? "", cashierName: user?.name ?? "Staff", items: lines, subtotal, discount, total, cost, profit, payment: opts.payment, customer: opts.customer?.trim() || undefined, tendered, change };
    // Compute the stock-deducted items up front (don't rely on the async setState
    // updater running before we persist — otherwise the stock write is skipped).
    const changed: InventoryItem[] = cart.map((c) => { const it = items.find((i) => i.id === c.id)!; return { ...it, stock: Math.max(0, it.stock - c.qty) }; });
    setSales((prev) => [sale, ...prev]);
    setItems((prev) => prev.map((i) => changed.find((ci) => ci.id === i.id) ?? i));
    const mvs: Movement[] = lines.map((l) => ({ id: uid("MV"), date: now, itemId: l.id, itemName: l.name, type: "sale" as const, qty: -l.qty, note: `Sale ${sale.id}`, byName: user?.name ?? "Staff" }));
    setMovements((prev) => [...mvs, ...prev]);
    if (sb()) { persist(dbInsertSale(sale, shopIdRef.current)); if (changed.length) persist(dbUpsertItems(changed, shopIdRef.current)); persist(dbInsertMovements(mvs, shopIdRef.current)); }
    toast(`Sale completed · ${sale.id}`);
    return sale;
  }, [items, user, toast, persist]);

  const value: Ctx = useMemo(() => ({
    ready, configured: supabaseConfigured, needsSetup, needsDataSetup, shared: backend.current === "supabase",
    user, profiles, shops, fetchShops, login, signUp, logout, refreshProfiles, updateMember,
    items, suppliers, orders, movements, sales, recordSale,
    upsertItem, deleteItem, moveStock, setStock, upsertSupplier, deleteSupplier, createPO, updatePO, receivePO, deletePO,
    toasts, toast, dismissToast,
  }), [ready, needsSetup, needsDataSetup, user, profiles, shops, fetchShops, login, signUp, logout, refreshProfiles, updateMember, items, suppliers, orders, movements, sales, recordSale, upsertItem, deleteItem, moveStock, setStock, upsertSupplier, deleteSupplier, createPO, updatePO, receivePO, deletePO, toasts, toast, dismissToast]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useStore must be used within Store");
  return ctx;
}
