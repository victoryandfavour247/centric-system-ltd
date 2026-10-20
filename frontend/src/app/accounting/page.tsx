"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/store/Store";
import { fmt, can, PAYMENT_LABEL, type PaymentMethod } from "@/lib/inventory";
import Stat from "@/components/Stat";

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: [Period, string][] = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["all", "All time"]];

function since(p: Period): number {
  const now = new Date();
  if (p === "all") return 0;
  if (p === "today") { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
  const days = p === "7d" ? 7 : 30;
  return now.getTime() - days * 864e5;
}

export default function Accounting() {
  const { sales, orders, user } = useStore();
  const [period, setPeriod] = useState<Period>("30d");

  const data = useMemo(() => {
    const from = since(period);
    const inSales = sales.filter((s) => new Date(s.date).getTime() >= from);
    const revenue = inSales.reduce((a, s) => a + s.total, 0);
    const cogs = inSales.reduce((a, s) => a + s.cost, 0);
    const profit = inSales.reduce((a, s) => a + s.profit, 0);
    const discounts = inSales.reduce((a, s) => a + s.discount, 0);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const units = inSales.reduce((a, s) => a + s.items.reduce((b, l) => b + l.qty, 0), 0);
    const aov = inSales.length ? revenue / inSales.length : 0;

    // money out = received purchase orders in the period
    const purchases = orders.filter((o) => o.status === "received" && o.receivedDate && new Date(o.receivedDate).getTime() >= from)
      .reduce((a, o) => a + o.lines.reduce((b, l) => b + l.cost * l.qty, 0), 0);

    const payMap = new Map<PaymentMethod, number>();
    const prodMap = new Map<string, { name: string; rev: number; profit: number; qty: number }>();
    inSales.forEach((s) => {
      payMap.set(s.payment, (payMap.get(s.payment) ?? 0) + s.total);
      s.items.forEach((l) => {
        const p = prodMap.get(l.id) ?? { name: l.name, rev: 0, profit: 0, qty: 0 };
        p.rev += l.price * l.qty; p.profit += (l.price - l.cost) * l.qty; p.qty += l.qty; prodMap.set(l.id, p);
      });
    });
    const topProducts = [...prodMap.values()].sort((a, b) => b.rev - a.rev).slice(0, 6);
    const byPay = (Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((k) => [k, payMap.get(k) ?? 0] as [PaymentMethod, number]);

    // daily revenue (last 7 buckets within period, min 7)
    const days: { label: string; revenue: number; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const dd = sales.filter((s) => { const t = new Date(s.date); return t >= d && t < next; });
      days.push({ label: d.toLocaleDateString("en-GB", { weekday: "short" }), revenue: dd.reduce((a, s) => a + s.total, 0), profit: dd.reduce((a, s) => a + s.profit, 0) });
    }

    return { inSales, revenue, cogs, profit, discounts, margin, units, aov, purchases, net: revenue - purchases, topProducts, byPay, days };
  }, [sales, orders, period]);

  if (!can.viewAccounting(user!.role)) {
    return <div className="card p-10 text-center"><p className="text-lg font-bold">Accounting is restricted</p><p className="mt-1 text-sm text-[var(--text-soft)]">Only managers and administrators can view financials.</p></div>;
  }

  const dayMax = Math.max(1, ...data.days.map((d) => d.revenue));
  const payColor: Record<PaymentMethod, string> = { cash: "var(--green)", "mobile-money": "var(--amber)", card: "var(--blue)" };

  return (
    <div className="space-y-4">
      {/* period */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {PERIODS.map(([p, l]) => <button key={p} onClick={() => setPeriod(p)} className={`btn btn-sm ${period === p ? "btn-primary" : "btn-ghost"}`}>{l}</button>)}
        </div>
        <span className="text-sm text-[var(--text-soft)]">{data.inSales.length} transactions · {data.units} units sold</span>
      </div>

      {/* P&L KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue" value={fmt(data.revenue)} sub={`Avg sale ${fmt(Math.round(data.aov))}`} color="var(--green)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <Stat label="Cost of goods sold" value={fmt(data.cogs)} sub={`Discounts ${fmt(data.discounts)}`} color="var(--amber)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/></svg>} />
        <Stat label="Gross profit" value={fmt(data.profit)} sub={`Margin ${data.margin.toFixed(1)}%`} color="var(--purple)" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 14l4-4 3 3 5-6"/></svg>} />
        <Stat label="Net cash flow" value={fmt(data.net)} sub={`In ${fmt(data.revenue)} · Out ${fmt(data.purchases)}`} color={data.net >= 0 ? "var(--blue)" : "var(--red)"} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17l10-10M17 7v10H7"/></svg>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* revenue chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Revenue - last 7 days</h2>
            <span className="text-sm text-[var(--text-soft)]">Profit shown in dark</span>
          </div>
          <div className="flex h-48 items-end gap-3">
            {data.days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg" style={{ height: `${(d.revenue / dayMax) * 100}%`, minHeight: d.revenue > 0 ? 6 : 2, background: "linear-gradient(180deg,#8fb0ff,var(--blue))" }} title={`Revenue ${fmt(d.revenue)}`} />
                  <div className="absolute bottom-0 w-full rounded-t-lg" style={{ height: `${(Math.max(0, d.profit) / dayMax) * 100}%`, background: "var(--navy)", opacity: .85 }} title={`Profit ${fmt(d.profit)}`} />
                </div>
                <span className="text-[11px] text-[var(--text-faint)]">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* payment breakdown */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Payments received</h2>
          <div className="space-y-3">
            {data.byPay.map(([p, v]) => {
              const pct = data.revenue > 0 ? (v / data.revenue) * 100 : 0;
              return (
                <div key={p}>
                  <div className="mb-1 flex justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: payColor[p] }} />{PAYMENT_LABEL[p]}</span><span className="text-[var(--text-faint)]">{fmt(v)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: payColor[p] }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* top products */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Top products by revenue</h2>
          {data.topProducts.length === 0 ? <p className="py-6 text-center text-sm text-[var(--text-soft)]">No sales in this period.</p> : (
            <div className="space-y-2.5">
              {data.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: "var(--blue-50)", color: "var(--blue)" }}>{i + 1}</span>
                  <span className="line-clamp-1 flex-1 text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-[var(--text-faint)]">{p.qty} sold</span>
                  <span className="w-24 text-right text-sm font-bold">{fmt(p.rev)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ledger */}
        <div className="card overflow-hidden">
          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}><h2 className="font-bold">Transactions</h2></div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-[var(--text-faint)]" style={{ borderColor: "var(--border)" }}><th className="p-3">Receipt</th><th className="p-3">Cashier</th><th className="p-3">Pay</th><th className="p-3 text-right">Total</th></tr></thead>
              <tbody>
                {data.inSales.slice(0, 40).map((s) => (
                  <tr key={s.id} className="table-row border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="p-3"><div className="font-mono text-xs font-semibold">{s.id}</div><div className="text-[11px] text-[var(--text-faint)]">{new Date(s.date).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div></td>
                    <td className="p-3 text-[var(--text-soft)]">{s.cashierName.split(" ")[0]}</td>
                    <td className="p-3"><span className="pill pill-gray">{s.payment === "mobile-money" ? "MoMo" : PAYMENT_LABEL[s.payment]}</span></td>
                    <td className="p-3 text-right font-bold">{fmt(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.inSales.length === 0 && <div className="p-8 text-center text-sm text-[var(--text-soft)]">No transactions yet. Sales from the Counter appear here.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
