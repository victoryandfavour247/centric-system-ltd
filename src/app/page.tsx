"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/Store";
import { fmt, CATEGORIES, MOVEMENT_META, ROLE_LABEL, type CategoryKey, type InventoryItem, type Movement } from "@/lib/inventory";
import Stat from "@/components/Stat";
import ItemImage from "@/components/ItemImage";
import type { Profile } from "@/store/Store";

/* ---------------------------------------------------------------- */
export default function Dashboard() {
  const { items, movements, orders, suppliers, profiles, user, updateMember, refreshProfiles } = useStore();
  const role = user!.role;

  useEffect(() => { if (role === "owner") refreshProfiles(); }, [role, refreshProfiles]);
  const pending = useMemo(() => profiles.filter((p) => p.approved === false && p.active !== false && !!user!.shopId && p.shop_id === user!.shopId), [profiles, user]);

  const s = useMemo(() => {
    const costVal = items.reduce((a, i) => a + i.cost * i.stock, 0);
    const retailVal = items.reduce((a, i) => a + i.price * i.stock, 0);
    const units = items.reduce((a, i) => a + i.stock, 0);
    const low = items.filter((i) => i.stock > 0 && i.stock <= i.reorderLevel);
    const out = items.filter((i) => i.stock === 0);
    const pendingPO = orders.filter((o) => o.status !== "received").length;
    return { costVal, retailVal, units, low, out, pendingPO, margin: retailVal - costVal };
  }, [items, orders]);

  const greeting = `Hi ${user!.name.split(" ")[0]}`;

  if (role === "owner")
    return (
      <RoleShell title="Manager dashboard" greeting={greeting} tint="linear-gradient(120deg,#064e3b,#059669)" roleLabel="Manager">
        <PendingApprovals pending={pending} onApprove={(id) => updateMember(id, { approved: true, active: true })} onDecline={(id) => updateMember(id, { approved: false, active: false })} />
        <AdminDashboard s={s} items={items} movements={movements} suppliers={suppliers} workers={profiles} orders={orders} />
      </RoleShell>
    );
  if (role === "manager")
    return (
      <RoleShell title="Sales Leader dashboard" greeting={greeting} tint="linear-gradient(120deg,#047857,#14b8a6)" roleLabel="Sales Leader">
        <ManagerDashboard s={s} items={items} movements={movements} suppliers={suppliers} />
      </RoleShell>
    );
  return (
    <RoleShell title="Sales Assistant dashboard" greeting={greeting} tint="linear-gradient(120deg,#0e7a46,#16b86a)" roleLabel="Sales Assistant">
      <SalesDashboard s={s} items={items} movements={movements} />
    </RoleShell>
  );
}

/* ---------------------------- shell ---------------------------- */
function RoleShell({ title, greeting, tint, roleLabel, children }: { title: string; greeting: string; tint: string; roleLabel: string; children: React.ReactNode }) {
  return (
    <div className="reveal space-y-5">
      <div className="relative overflow-hidden rounded-[var(--radius)] p-5 text-white" style={{ background: tint }}>
        <div className="absolute inset-0 opacity-20"><svg className="h-full w-full"><defs><pattern id="hm" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="7" width="12" height="3.5" rx="2" fill="#fff"/></pattern></defs><rect width="100%" height="100%" fill="url(#hm)"/></svg></div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{title}</div>
            <div className="mt-1 text-2xl font-black">{greeting} 👋</div>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">{roleLabel} access</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ---------------------- shared building blocks ---------------------- */
function CategoryCard({ items, showCost }: { items: InventoryItem[]; showCost: boolean }) {
  const data = useMemo(() => {
    const m = new Map<CategoryKey, number>();
    items.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + (showCost ? i.cost : i.price) * i.stock));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [items, showCost]);
  const max = Math.max(1, ...data.map((c) => c[1]));
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">{showCost ? "Stock value by category" : "Stock by category"}</h2>
        {showCost && <Link href="/reports" className="text-sm font-semibold text-[var(--blue)]">Reports →</Link>}
      </div>
      <div className="space-y-3">
        {data.map(([c, v]) => (
          <div key={c}>
            <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 text-xs">
              <span className="line-clamp-1 font-semibold text-[var(--text-soft)]">{CATEGORIES[c].label}</span>
              <span className="whitespace-nowrap text-right font-semibold tabular-nums text-[var(--text-faint)]">{showCost ? fmt(v) : `${v.toLocaleString()}`}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: "linear-gradient(90deg,var(--blue),var(--navy))" }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ movements }: { movements: Movement[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Recent activity</h2>
        <Link href="/movements" className="text-sm font-semibold text-[var(--blue)]">All →</Link>
      </div>
      {movements.length === 0 ? <p className="py-8 text-center text-sm text-[var(--text-soft)]">No stock movements yet.</p> : (
        <div className="space-y-2.5">
          {movements.slice(0, 7).map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <span className={`pill ${MOVEMENT_META[m.type].pill} !px-2`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
              <span className="line-clamp-1 flex-1">{m.itemName}</span>
              <span className="text-[11px] text-[var(--text-faint)]">{new Date(m.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReorderCard({ items }: { items: InventoryItem[] }) {
  const reorder = useMemo(() => items.filter((i) => i.stock <= i.reorderLevel).sort((a, b) => a.stock - b.stock).slice(0, 6), [items]);
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">⚠ Reorder suggestions</h2>
        <Link href="/inventory?filter=low" className="text-sm font-semibold text-[var(--blue)]">Manage stock →</Link>
      </div>
      {reorder.length === 0 ? <p className="py-6 text-center text-sm text-[var(--text-soft)]">Everything is above its reorder level 🎉</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reorder.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
              <ItemImage item={i} className="h-12 w-12 shrink-0 rounded-lg border" />
              <div className="min-w-0 flex-1"><div className="line-clamp-1 text-sm font-semibold">{i.name}</div><div className="text-xs text-[var(--text-faint)]">Reorder {i.reorderQty} · level {i.reorderLevel}</div></div>
              <span className={`pill ${i.stock === 0 ? "pill-red" : "pill-amber"}`}>{i.stock} left</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Shortcut({ href, label, value, description, color, icon }: { href: string; label: string; value: string; description: string; color: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group flex min-h-28 items-start gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5 hover:border-[var(--blue)] hover:shadow-[var(--shadow-md)]" style={{ borderColor: "var(--border)" }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: color + "1a", color }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--text-faint)]">{label}</span>
        <span className="mt-1 block font-black tracking-tight text-[var(--text)]">{value}</span>
        <span className="mt-1 block text-xs leading-4 text-[var(--text-soft)]">{description}</span>
      </span>
      <span className="mt-1 text-sm font-bold text-[var(--blue)] transition group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

function PendingApprovals({ pending, onApprove, onDecline }: { pending: Profile[]; onApprove: (id: string) => void; onDecline: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (pending.length === 0) return null;
  const act = async (id: string, fn: (id: string) => void) => { setBusy(id); await fn(id); setBusy(null); };
  return (
    <div className="card overflow-hidden" style={{ borderColor: "#f0d79a" }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ background: "#fdf0d8", borderColor: "#f0d79a" }}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: "var(--amber)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>
          </span>
          <span className="text-sm font-bold" style={{ color: "#9a6b00" }}>{pending.length} staff request{pending.length > 1 ? "s" : ""} waiting for your approval</span>
        </div>
        <Link href="/team" className="text-sm font-semibold" style={{ color: "#9a6b00" }}>Open Team →</Link>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {pending.slice(0, 5).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}>{(p.full_name || p.email).charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><div className="font-semibold">{p.full_name || "-"}</div><div className="text-xs text-[var(--text-faint)]">{p.email} · wants to join as {ROLE_LABEL[p.role]}</div></div>
            <button onClick={() => act(p.id, onApprove)} disabled={busy === p.id} className="btn btn-success btn-sm">{busy === p.id ? "…" : "Approve"}</button>
            <button onClick={() => act(p.id, onDecline)} disabled={busy === p.id} className="btn btn-sm" style={{ background: "#fde6ea", color: "var(--red)" }}>Decline</button>
          </div>
        ))}
      </div>
    </div>
  );
}

type Stats = { costVal: number; retailVal: number; units: number; low: InventoryItem[]; out: InventoryItem[]; pendingPO: number; margin: number };

/* =========================== ADMIN =========================== */
function AdminDashboard({ s, items, movements, suppliers, workers, orders }: { s: Stats; items: InventoryItem[]; movements: Movement[]; suppliers: unknown[]; workers: unknown[]; orders: unknown[] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Inventory value (cost)" value={fmt(s.costVal)} sub={`${s.units.toLocaleString()} units · ${items.length} SKUs`} color="var(--blue)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/></svg>} />
        <Stat label="Retail value" value={fmt(s.retailVal)} sub={`Potential margin ${fmt(s.margin)}`} color="var(--green)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <Stat label="Low stock" value={String(s.low.length)} sub="At or below reorder level" color="var(--amber)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>} />
        <Stat label="Out of stock" value={String(s.out.length)} sub={`${s.pendingPO} open purchase orders`} color="var(--red)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.9 4.9l14.2 14.2M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>} />
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-bold">Business overview</h2>
        <p className="mb-4 text-xs text-[var(--text-soft)]">Full control of your shop - people, suppliers and stock.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Team members", workers.length], ["Suppliers", suppliers.length], ["Open POs", orders.filter((o) => (o as { status: string }).status !== "received").length], ["Products (SKUs)", items.length]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--border)" }}><div className="text-2xl font-black">{v as number}</div><div className="mt-0.5 text-xs text-[var(--text-faint)]">{l as string}</div></div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Shortcut href="/team" label="Administration" value="Manage team" description="Add staff, assign roles & access." color="var(--navy)" icon={<><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 3.5a3 3 0 010 6M21 20a6 6 0 00-5-5.9"/></>} />
        <Shortcut href="/reports" label="Insights" value="Reports & valuation" description="Cost, margin & movement trends." color="var(--green)" icon={<path d="M3 3v18h18M7 17v-6M12 17V7M17 17v-4" />} />
        <Shortcut href="/purchase-orders" label="Purchasing" value={`${s.pendingPO} open`} description="Create, place & receive orders." color="var(--blue)" icon={<path d="M9 2h6a2 2 0 012 2v2H7V4a2 2 0 012-2zM4 6h16v16H4zM9 12h6M9 16h6" />} />
        <Shortcut href="/suppliers" label="Supply chain" value={`${suppliers.length} suppliers`} description="Contacts & lead times." color="var(--purple)" icon={<path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 14h6" />} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2"><CategoryCard items={items} showCost /><ActivityCard movements={movements} /></div>
      <ReorderCard items={items} />
    </>
  );
}

/* =========================== MANAGER =========================== */
function ManagerDashboard({ s, items, movements, suppliers }: { s: Stats; items: InventoryItem[]; movements: Movement[]; suppliers: unknown[] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Inventory value (cost)" value={fmt(s.costVal)} sub={`${s.units.toLocaleString()} units · ${items.length} SKUs`} color="var(--blue)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/></svg>} />
        <Stat label="Retail value" value={fmt(s.retailVal)} sub={`Potential margin ${fmt(s.margin)}`} color="var(--green)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <Stat label="Low stock" value={String(s.low.length)} sub="Needs reordering" color="var(--amber)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>} />
        <Stat label="Open purchase orders" value={String(s.pendingPO)} sub="Awaiting delivery" color="var(--purple)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2h6a2 2 0 012 2v2H7V4a2 2 0 012-2zM4 6h16v16H4z"/></svg>} />
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Shortcut href="/purchase-orders" label="Purchasing" value={`${s.pendingPO} open`} description="Restock from suppliers." color="var(--blue)" icon={<path d="M9 2h6a2 2 0 012 2v2H7V4a2 2 0 012-2zM4 6h16v16H4zM9 12h6M9 16h6" />} />
        <Shortcut href="/suppliers" label="Suppliers" value={`${suppliers.length} active`} description="Manage supplier accounts." color="var(--purple)" icon={<path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 14h6" />} />
        <Shortcut href="/reports" label="Insights" value="Reports & valuation" description="Margins & movement." color="var(--green)" icon={<path d="M3 3v18h18M7 17v-6M12 17V7M17 17v-4" />} />
        <Shortcut href="/team" label="Team" value="Assign users" description="Add sales staff & set roles." color="var(--navy)" icon={<><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 3.5a3 3 0 010 6M21 20a6 6 0 00-5-5.9"/></>} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2"><CategoryCard items={items} showCost /><ActivityCard movements={movements} /></div>
      <ReorderCard items={items} />
    </>
  );
}

/* =========================== SALES =========================== */
function SalesDashboard({ s, items, movements }: { s: Stats; items: InventoryItem[]; movements: Movement[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Products" value={items.length.toString()} sub="in the catalogue" color="var(--blue)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/></svg>} />
        <Stat label="Units on hand" value={s.units.toLocaleString()} sub="across all shelves" color="var(--green)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7L9 18l-5-5"/></svg>} />
        <Stat label="Low stock" value={String(s.low.length)} sub="tell a manager" color="var(--amber)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>} />
        <Stat label="Out of stock" value={String(s.out.length)} sub="items at zero" color="var(--red)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.9 4.9l14.2 14.2M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>} />
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-bold">Quick actions</h2>
        <p className="mb-4 text-xs text-[var(--text-soft)]">Find products, record what you sell or receive, and keep stock accurate.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Shortcut href="/counter" label="Store counter" value="Sell to a customer" description="Scan items & take payment." color="var(--green)" icon={<><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18M7 18v2m10-2v2"/></>} />
          <Shortcut href="/inventory" label="Find / scan" value="Look up a product" description="Search or scan a barcode." color="var(--blue)" icon={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>} />
          <Shortcut href="/inventory" label="Receive" value="Add stock in" description="Log a delivery received." color="var(--purple)" icon={<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />} />
          <Shortcut href="/inventory?action=add" label="New item" value="Add a product" description="Create a product manually." color="var(--navy)" icon={<path d="M12 5v14M5 12h14" />} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2"><CategoryCard items={items} showCost={false} /><ActivityCard movements={movements} /></div>
      <ReorderCard items={items} />
    </>
  );
}
