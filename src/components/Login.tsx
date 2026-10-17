"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store/Store";
import type { Role } from "@/lib/inventory";
import type { Shop } from "@/store/Store";
import Brand from "./Brand";

export default function Login() {
  const { login, signUp, configured, fetchShops } = useStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [role, setRole] = useState<Role>("staff");
  const [shopName, setShopName] = useState("");
  const [teamSize, setTeamSize] = useState<number>(1);
  const [managerCode, setManagerCode] = useState("");
  const [joinShopName, setJoinShopName] = useState("");
  const [shopList, setShopList] = useState<Shop[]>([]);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErr(""); setNotice(""); };

  // load the list of shops to join when a Leader/Assistant signs up
  useEffect(() => {
    if (mode === "signup" && role !== "owner") fetchShops().then((s) => setShopList(s));
  }, [mode, role, fetchShops]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setNotice("");
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const r = await login(form.email, form.password);
        if (!r.ok) setErr(r.error ?? "Sign in failed");
      } else {
        if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
        if (form.password !== form.confirm) { setErr("Passwords do not match."); return; }
        const r = await signUp(form.name, form.email, form.password, role, { shopName, teamSize, joinShopName, managerCode });
        if (!r.ok) setErr(r.error ?? "Sign up failed");
        else if (r.needsConfirm) { setNotice("Account created! Please check your email to confirm it, then sign in."); setMode("signin"); }
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand side */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ background: "linear-gradient(140deg,#043d2f,#059669)" }}>
        <div className="absolute inset-0 opacity-20">
          <svg className="h-full w-full"><defs><pattern id="m" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="8" width="15" height="4" rx="2" fill="#8ef0c9"/></pattern></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>
        </div>
        <div className="relative"><Brand size={46} light /></div>
        <div className="relative">
          <h1 className="text-4xl font-black leading-tight">Run your store<br/>like clockwork.</h1>
          <p className="mt-4 max-w-sm text-white/80">Track stock in real time, raise purchase orders, manage suppliers and see exactly how much your inventory is worth - all in one place.</p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            {["Live stock levels & low-stock alerts", "Purchase orders & supplier management", "Inventory valuation & reports", "Manager, Sales Leader & Assistant roles"].map((f) => (
              <li key={f} className="flex items-center gap-2"><span style={{ color: "#c7f23a" }}>✓</span>{f}</li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-white/60">© {new Date().getFullYear()} Centric System Limited</div>
      </div>

      {/* form side */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><Brand size={44} /></div>

          <div className="mb-6 flex rounded-xl p-1" style={{ background: "var(--surface-2)" }}>
            {(["signin", "signup"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setNotice(""); }} className="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
                style={mode === m ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)", color: "var(--navy)" } : { color: "var(--text-faint)" }}>
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-black">{mode === "signin" ? "Staff sign in" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">{mode === "signin" ? "Enter your work email and password." : "Choose your role - the shop Manager approves new staff."}</p>

          {!configured && <div className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: "#fdf0d8", color: "#9a6b00" }}>Supabase isn’t configured. Add your project URL & key to <b>.env.local</b>.</div>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Kofi Mensah" autoComplete="name" /></div>
            )}
            <div><label className="label">Work email</label><input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@nemtek.gh" autoComplete="email" /></div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-12" type={show ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[var(--text-faint)] hover:bg-[var(--surface-2)]">{show ? "Hide" : "Show"}</button>
              </div>
            </div>
            {mode === "signup" && (
              <div><label className="label">Confirm password</label><input className="input" type={show ? "text" : "password"} value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="Re-enter password" autoComplete="new-password" /></div>
            )}
            {mode === "signup" && (
              <div>
                <label className="label">I want to create an account as</label>
                <div className="grid grid-cols-3 gap-2">
                  {([["owner", "Manager", "Owns the shop"], ["manager", "Sales Leader", "Leads the sales team"], ["staff", "Sales Assistant", "Sells at the counter"]] as [Role, string, string][]).map(([val, title, sub]) => (
                    <button key={val} type="button" onClick={() => setRole(val)} className="rounded-xl border p-2.5 text-left transition"
                      style={role === val ? { borderColor: "var(--blue)", background: "var(--blue-50)", boxShadow: "0 0 0 1px var(--blue)" } : { borderColor: "var(--border)" }}>
                      <div className="text-[13px] font-bold" style={{ color: role === val ? "var(--blue)" : "var(--text)" }}>{title}</div>
                      <div className="mt-0.5 text-[10px] leading-3 text-[var(--text-faint)]">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manager: name the shop + team size */}
            {mode === "signup" && role === "owner" && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div className="col-span-2 text-xs font-semibold text-[var(--text-soft)]">Set up your shop</div>
                <div><label className="label">Shop name</label><input className="input" value={shopName} onChange={(e) => { setShopName(e.target.value); setErr(""); }} placeholder="e.g. Centric Store Accra" /></div>
                <div><label className="label">People working under you</label><input type="number" min={0} className="input" value={teamSize || ""} onChange={(e) => setTeamSize(Math.max(0, Number(e.target.value)))} placeholder="0" /></div>
                <div className="col-span-2">
                  <label className="label">Manager access code</label>
                  <input className="input" type="password" value={managerCode} onChange={(e) => { setManagerCode(e.target.value); setErr(""); }} placeholder="Required to create a shop" autoComplete="off" />
                </div>
              </div>
            )}

            {/* Leader / Assistant: type the name of the shop they join */}
            {mode === "signup" && role !== "owner" && (
              <div>
                <label className="label">Name of the shop you work under</label>
                <input
                  className="input"
                  value={joinShopName}
                  onChange={(e) => { setJoinShopName(e.target.value); setErr(""); }}
                  placeholder="e.g. Centric Store Accra"
                  list="shop-suggestions"
                  autoComplete="off"
                />
                {shopList.length > 0 && (
                  <datalist id="shop-suggestions">
                    {shopList.map((s) => <option key={s.id} value={s.name} />)}
                  </datalist>
                )}
                <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
                  Type the exact shop name your Manager registered. When you create your account, the Manager is notified and must approve you before your dashboard opens.
                </p>
              </div>
            )}

            {err && <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#fde6ea", color: "var(--red)" }}>{err}</div>}
            {notice && <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#e5f6ec", color: "var(--green)" }}>{notice}</div>}

            <button disabled={busy} className="btn btn-primary w-full !py-3">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
