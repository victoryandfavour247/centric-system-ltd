"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/store/Store";
import { ROLE_LABEL } from "@/lib/inventory";
import Brand from "./Brand";

const TITLES: Record<string, string> = {
  "/": "Dashboard", "/counter": "Sell / Counter", "/inventory": "Products", "/movements": "Stock Log",
  "/purchase-orders": "Purchase Orders", "/suppliers": "Suppliers", "/reports": "Reports & Valuation",
  "/accounting": "Accounting", "/team": "Team",
};

export default function Topbar() {
  const { user, logout, items, profiles } = useStore();
  const path = usePathname();
  const router = useRouter();
  if (!user) return null;
  const low = items.filter((i) => i.stock <= i.reorderLevel).length;
  const pending = user.role === "owner"
    ? profiles.filter((p) => p.approved === false && (!user.shopId || !p.shop_id || p.shop_id === user.shopId)).length
    : 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-[var(--bg-elev)] px-3 sm:gap-3 sm:px-4 lg:px-6" style={{ borderColor: "var(--border)" }}>
      <span className="shrink-0 lg:hidden"><Brand size={34} showText={false} /></span>
      <h1 className="min-w-0 flex-1 truncate text-base font-black sm:text-lg">{TITLES[path] ?? "Centric"}</h1>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link href="/counter" className="btn btn-success btn-sm hidden lg:inline-flex">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18M7 18v2m10-2v2"/></svg>
          New sale
        </Link>
        {user.role === "owner" && (
          <Link href="/team" className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-[var(--surface-2)]" title={`${pending} staff awaiting approval`}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>
            {pending > 0 && <span className="pop absolute -right-0.5 -top-0.5 grid place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--red)", height: 17, minWidth: 17 }}>{pending}</span>}
          </Link>
        )}
        <Link href="/inventory" className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-[var(--surface-2)]" title={`${low} low-stock items`}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/></svg>
          {low > 0 && <span className="absolute -right-0.5 -top-0.5 grid place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--amber)", height: 17, minWidth: 17 }}>{low}</span>}
        </Link>
        <div className="flex items-center gap-2 rounded-xl border px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
          <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}>{user.name.charAt(0)}</span>
          <div className="hidden leading-tight sm:block">
            <div className="text-[13px] font-bold">{user.name.split(" ")[0]}</div>
            <div className="text-[10px] text-[var(--text-faint)]">{ROLE_LABEL[user.role]}</div>
          </div>
          <button onClick={() => { logout(); router.push("/"); }} className="ml-1 grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]" title="Sign out">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
