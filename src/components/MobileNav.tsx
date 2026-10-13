"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/store/Store";
import { can } from "@/lib/inventory";

export default function MobileNav() {
  const path = usePathname();
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]); // close after navigating
  if (!user) return null;
  const role = user.role;

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/counter", label: "Sell / Counter" },
    { href: "/inventory", label: "Products" },
    { href: "/movements", label: "Stock Log" },
    ...(can.managePurchasing(role) ? [{ href: "/purchase-orders", label: "Purchase Orders" }, { href: "/suppliers", label: "Suppliers" }] : []),
    ...(can.viewReports(role) ? [{ href: "/reports", label: "Reports & Valuation" }] : []),
    ...(can.viewAccounting(role) ? [{ href: "/accounting", label: "Accounting" }] : []),
    ...(can.manageWorkers(role) ? [{ href: "/team", label: "Team" }] : []),
  ];
  const current = links.find((l) => l.href === path) ?? links[0];

  return (
    <div className="sticky top-16 z-20 border-b bg-[var(--bg-elev)] px-4 py-2 lg:hidden" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-bold"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-md text-white" style={{ background: "var(--blue)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </span>
          {current.label}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.2"
          className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-4 right-4 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-[var(--surface)] shadow-[var(--shadow-lg)]" style={{ borderColor: "var(--border)" }}>
            {links.map((l) => {
              const active = l.href === path;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b px-4 py-3 text-sm font-semibold last:border-b-0"
                  style={active ? { background: "var(--blue-50)", color: "var(--blue)", borderColor: "var(--border)" } : { color: "var(--text)", borderColor: "var(--border)" }}
                >
                  {l.label}
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
