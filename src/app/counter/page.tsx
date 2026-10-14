"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/store/Store";
import { fmt, CATEGORIES, PAYMENT_LABEL, type CategoryKey, type Sale, type PaymentMethod } from "@/lib/inventory";
import ItemImage from "@/components/ItemImage";
import BarcodeScanner from "@/components/BarcodeScanner";

export default function Counter() {
  const { items, recordSale, toast } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryKey | "all">("all");
  const [cart, setCart] = useState<{ id: string; qty: number }[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState<number>(0);
  const [scan, setScan] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [cartOpen, setCartOpen] = useState(false); // mobile / tablet slide-in cart

  const results = useMemo(() => items.filter((i) => {
    if (cat !== "all" && i.category !== cat) return false;
    if (q.trim()) { const t = q.toLowerCase(); return i.name.toLowerCase().includes(t) || i.sku.toLowerCase().includes(t) || i.barcode.includes(t); }
    return true;
  }), [items, q, cat]);

  const add = (id: string) => {
    const it = items.find((i) => i.id === id); if (!it) return;
    setCart((c) => {
      const line = c.find((x) => x.id === id);
      if (line) { if (line.qty >= it.stock) { toast("No more stock available", "error"); return c; } return c.map((x) => x.id === id ? { ...x, qty: x.qty + 1 } : x); }
      if (it.stock <= 0) { toast("Out of stock", "error"); return c; }
      return [...c, { id, qty: 1 }];
    });
  };
  const setQty = (id: string, qty: number) => setCart((c) => qty <= 0 ? c.filter((x) => x.id !== id) : c.map((x) => x.id === id ? { ...x, qty } : x));

  const subtotal = cart.reduce((s, l) => { const it = items.find((i) => i.id === l.id); return s + (it ? it.price * l.qty : 0); }, 0);
  const total = Math.max(0, subtotal - (discount || 0));
  const change = Math.max(0, tendered - total);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const cashShort = payment === "cash" && tendered > 0 && tendered < total;
  const cats = Object.keys(CATEGORIES) as CategoryKey[];
  const NOTES = [1, 2, 5, 10, 20, 50, 100, 200];

  const onScan = (code: string) => {
    setScan(false);
    const found = items.find((i) => i.barcode && i.barcode === code);
    if (found) add(found.id);
    else { setQ(code); toast("No product with that barcode - showing search", "info"); }
  };

  const complete = () => {
    const sale = recordSale(cart, { discount, payment, customer, tendered: payment === "cash" ? tendered : undefined });
    if (sale) { setReceipt(sale); setCart([]); setCustomer(""); setDiscount(0); setPayment("cash"); setTendered(0); setCartOpen(false); }
  };

  const cartListBody = cart.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-[var(--text-soft)]">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18M7 18v2m10-2v2"/></svg>
      Tap or scan products to add them
    </div>
  ) : cart.map((l) => {
    const it = items.find((i) => i.id === l.id)!;
    return (
      <div key={l.id} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <ItemImage item={it} className="h-10 w-10 shrink-0 rounded-md border" />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-[13px] font-semibold">{it.name}</div>
            <div className="text-xs text-[var(--text-faint)]">{fmt(it.price)} each</div>
          </div>
          <button onClick={() => setQty(l.id, 0)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--red)]" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setQty(l.id, l.qty - 1)} className="grid h-7 w-8 place-items-center text-lg">−</button>
            <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
            <button onClick={() => setQty(l.id, l.qty + 1)} disabled={l.qty >= it.stock} className="grid h-7 w-8 place-items-center text-lg disabled:opacity-30">+</button>
          </div>
          <span className="whitespace-nowrap text-sm font-black" style={{ color: "var(--navy)" }}>{fmt(it.price * l.qty)}</span>
        </div>
      </div>
    );
  });

  const cartSummary = (
    <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--border)" }}>
      <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" className="input" />
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((p) => (
          <button key={p} onClick={() => { setPayment(p); setTendered(0); }} className={`btn btn-sm ${payment === p ? "btn-primary" : "btn-ghost"}`}>{p === "mobile-money" ? "MoMo" : PAYMENT_LABEL[p]}</button>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm"><span className="text-[var(--text-soft)]">Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-soft)]">Discount</span>
        <input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} placeholder="0" className="input !w-24 !py-1 text-right" />
      </div>
      <div className="flex items-center justify-between border-t pt-2 text-lg" style={{ borderColor: "var(--border)" }}>
        <span className="font-bold">Total</span><span className="font-black text-[var(--navy)]">{fmt(total)}</span>
      </div>

      {payment === "cash" && cart.length > 0 && (
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Cash received</span>
            <input type="number" min={0} value={tendered || ""} onChange={(e) => setTendered(Math.max(0, Number(e.target.value)))} placeholder="0" className="input !w-28 !py-1 text-right text-base font-bold" />
          </div>
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            <button onClick={() => setTendered(total)} className="btn btn-ghost !py-1.5 !text-xs col-span-2">Exact {fmt(total)}</button>
            {NOTES.filter((n) => n >= 5).map((n) => (
              <button key={n} onClick={() => setTendered((t) => t + n)} className="btn btn-ghost !py-1.5 !text-xs">+{n}</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{cashShort ? "Still owing" : "Change due"}</span>
            <span className="text-lg font-black" style={{ color: cashShort ? "var(--red)" : "var(--green)" }}>{cashShort ? fmt(total - tendered) : fmt(change)}</span>
          </div>
        </div>
      )}

      <button onClick={complete} disabled={cart.length === 0 || cashShort} className="btn btn-success w-full !py-3 text-base">
        {cashShort ? "Enter enough cash" : `Complete sale · ${fmt(total)}`}
      </button>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 lg:items-start">
      {/* catalogue */}
      <div className="flex min-w-0 flex-col pb-24 lg:pb-0">
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or scan a product…" className="input" style={{ paddingLeft: 36 }} autoFocus />
          </div>
          <button onClick={() => setScan(true)} className="btn btn-dark shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M6 8v8M10 8v8M14 8v8M18 8v8"/></svg>
            Scan
          </button>
        </div>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setCat("all")} className={`btn btn-sm shrink-0 ${cat === "all" ? "btn-primary" : "btn-ghost"}`}>All</button>
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`btn btn-sm shrink-0 ${cat === c ? "btn-primary" : "btn-ghost"}`}>{CATEGORIES[c].label}</button>)}
        </div>
        <div className="grid gap-2.5 pr-1 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", alignContent: "start" }}>
          {results.map((i) => (
            <button key={i.id} disabled={i.stock === 0} onClick={() => add(i.id)}
              className="card flex h-fit flex-col p-2 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[var(--shadow-md)] enabled:active:scale-[0.97] disabled:opacity-50">
              <ItemImage item={i} className="aspect-square w-full rounded-lg" />
              <div className="mt-1.5 line-clamp-2 min-h-[32px] text-[12px] font-semibold leading-tight">{i.name}</div>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-[13px] font-black text-[var(--navy)]">{fmt(i.price)}</span>
                <span className={`pill ${i.stock === 0 ? "pill-red" : i.stock <= i.reorderLevel ? "pill-amber" : "pill-gray"} !px-1.5 !py-0.5`}>{i.stock}</span>
              </div>
            </button>
          ))}
          {results.length === 0 && <div className="py-10 text-center text-sm text-[var(--text-soft)]" style={{ gridColumn: "1 / -1" }}>No products found.</div>}
        </div>
      </div>

      {/* cart — desktop sticky side column */}
      <div className="card hidden flex-col lg:flex lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--surface)] p-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-bold">Current sale {count > 0 && <span className="text-sm font-normal text-[var(--text-faint)]">· {count} items</span>}</h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-semibold text-[var(--red)]">Clear</button>}
        </div>
        <div className="space-y-2 p-3">{cartListBody}</div>
        {cartSummary}
      </div>

      {/* mobile / tablet — floating cart bar that opens the slide-in drawer */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--bg-elev)] p-3 lg:hidden" style={{ borderColor: "var(--border)" }}>
        <button onClick={() => setCartOpen(true)} className="btn btn-success w-full !justify-between !py-3 text-base">
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18M7 18v2m10-2v2"/></svg>
            {count > 0 ? `${count} item${count > 1 ? "s" : ""} in cart` : "Current sale"}
          </span>
          <span>{fmt(total)} · View ▸</span>
        </button>
      </div>

      {/* mobile / tablet — slide-in cart drawer from the right */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" style={{ animation: "fadeIn .2s ease" }} onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[90%] max-w-sm flex-col bg-[var(--surface)] shadow-[var(--shadow-lg)]" style={{ animation: "slideInRight .25s ease" }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-bold">Current sale {count > 0 && <span className="text-sm font-normal text-[var(--text-faint)]">· {count} items</span>}</h2>
              <div className="flex items-center gap-3">
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-semibold text-[var(--red)]">Clear</button>}
                <button onClick={() => setCartOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-2)]" aria-label="Close cart">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">{cartListBody}</div>
            {cartSummary}
          </div>
        </div>
      )}

      {scan && <BarcodeScanner title="Scan product to sell" onClose={() => setScan(false)} onDetected={onScan} />}
      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function Receipt({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { user, toast } = useStore();
  const shopTitle = user?.shopName || "Centric System Limited";
  const pay = sale.payment === "mobile-money" ? "Mobile Money" : sale.payment === "card" ? "Card" : "Cash";

  const printReceipt = () => {
    const rows = sale.items.map((it) => `<tr><td class="l">${it.qty} &times; ${esc(it.name)}</td><td class="r">${fmt(it.price * it.qty)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(sale.id)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #000; width: 80mm; padding: 6mm 5mm; font-size: 12px; line-height: 1.55; -webkit-print-color-adjust: exact; }
  .c { text-align: center; }
  .title { font-size: 17px; font-weight: 800; letter-spacing: .02em; }
  .muted { color: #555; font-size: 10px; }
  hr { border: none; border-top: 1px dashed #888; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; font-size: 12px; }
  td.r { text-align: right; white-space: nowrap; padding-left: 10px; font-weight: 600; }
  .row { display: flex; justify-content: space-between; gap: 10px; padding: 1px 0; }
  .row span:last-child { white-space: nowrap; }
  .total { font-size: 15px; font-weight: 800; margin: 3px 0; }
  .b { font-weight: 700; }
</style></head><body>
  <div class="c title">${esc(shopTitle)}</div>
  <div class="c muted">Powered by Centric System Limited</div>
  <div class="c muted">Sales receipt</div>
  <hr>
  <div class="row"><span>Receipt</span><span class="b">${esc(sale.id)}</span></div>
  <div class="row"><span>Date</span><span>${esc(new Date(sale.date).toLocaleString("en-GB"))}</span></div>
  <div class="row"><span>Cashier</span><span>${esc(sale.cashierName)}</span></div>
  <div class="row"><span>Customer</span><span>${esc(sale.customer || "Walk-in")}</span></div>
  <hr>
  <table>${rows}</table>
  <hr>
  <div class="row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
  ${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(sale.discount)}</span></div>` : ""}
  <div class="row total"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
  <div class="row"><span>Paid (${esc(pay)})</span><span>${fmt(sale.tendered ?? sale.total)}</span></div>
  ${sale.change !== undefined && sale.change > 0 ? `<div class="row b"><span>CHANGE</span><span>${fmt(sale.change)}</span></div>` : ""}
  <hr>
  <div class="c muted">Thank you for your purchase!</div>
  <div class="c muted">Goods sold are subject to warranty terms.</div>
  <script>window.onload=function(){window.focus();window.print();};window.onafterprint=function(){window.close();};<\/script>
</body></html>`;
    const w = window.open("", "PRINT", "width=380,height=640");
    if (!w) { toast("Allow pop-ups to print the receipt", "error"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-center gap-2 text-white">
          <span className="pop grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--green)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
          </span>
          <span className="text-lg font-black">Sale complete</span>
        </div>

        {/* printable receipt */}
        <div id="receipt" className="card p-6" style={{ fontVariantNumeric: "tabular-nums" }}>
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: "var(--navy)" }}>{shopTitle}</div>
            <div className="text-[11px] text-[var(--text-faint)]">Powered by Centric System Limited</div>
            <div className="mt-1 text-[11px] text-[var(--text-faint)]">Sales receipt</div>
          </div>

          <div className="my-3 border-y border-dashed py-2 text-[11px] text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
            <div className="flex justify-between"><span>Receipt</span><span className="font-mono font-semibold text-[var(--text)]">{sale.id}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{new Date(sale.date).toLocaleString("en-GB")}</span></div>
            <div className="flex justify-between"><span>Cashier</span><span>{sale.cashierName}</span></div>
            <div className="flex justify-between"><span>Customer</span><span>{sale.customer || "Walk-in"}</span></div>
          </div>

          <div className="space-y-1 text-sm">
            {sale.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span className="line-clamp-1 pr-2">{it.qty} × {it.name}</span>
                <span className="whitespace-nowrap font-semibold">{fmt(it.price * it.qty)}</span>
              </div>
            ))}
          </div>

          <div className="my-3 space-y-1 border-t border-dashed pt-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <div className="flex justify-between text-[var(--text-soft)]"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
            {sale.discount > 0 && <div className="flex justify-between text-[var(--text-soft)]"><span>Discount</span><span>−{fmt(sale.discount)}</span></div>}
            <div className="flex justify-between text-lg font-black"><span>TOTAL</span><span style={{ color: "var(--navy)" }}>{fmt(sale.total)}</span></div>
            <div className="flex justify-between pt-1"><span className="text-[var(--text-soft)]">Paid ({pay})</span><span className="font-semibold">{fmt(sale.tendered ?? sale.total)}</span></div>
            {sale.change !== undefined && sale.change > 0 && (
              <div className="flex justify-between text-base font-black"><span>CHANGE</span><span style={{ color: "var(--green)" }}>{fmt(sale.change)}</span></div>
            )}
          </div>

          <div className="mt-3 text-center text-[11px] text-[var(--text-faint)]">Thank you for your purchase! 💙<br/>Goods sold are subject to warranty terms.</div>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={printReceipt} className="btn btn-outline flex-1 bg-white">Print</button>
          <button onClick={onClose} className="btn btn-primary flex-1">New sale</button>
        </div>
      </div>
    </div>
  );
}
