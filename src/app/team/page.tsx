"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/Store";
import { can, ROLE_LABEL, type Role } from "@/lib/inventory";

const ROLE_PILL: Record<Role, string> = { owner: "pill-blue", manager: "pill-green", staff: "pill-gray" };

export default function Team() {
  const { profiles, user, needsSetup, refreshProfiles, updateMember } = useStore();
  const myRole = user!.role;
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { refreshProfiles(); }, [refreshProfiles]);

  // only this Manager's shop (fall back to everyone if shops aren't set up yet)
  const myShop = user!.shopId;
  const mine = useMemo(() => profiles.filter((p) => !myShop || !p.shop_id || p.shop_id === myShop), [profiles, myShop]);

  const counts = useMemo(() => ({
    owner: mine.filter((p) => p.role === "owner").length,
    manager: mine.filter((p) => p.role === "manager").length,
    staff: mine.filter((p) => p.role === "staff").length,
  }), [mine]);

  const rows = useMemo(() => mine.filter((p) =>
    !q.trim() || (p.full_name || "").toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase())
  ), [mine, q]);
  const pending = useMemo(() => mine.filter((p) => p.approved === false && p.active !== false), [mine]);

  if (!can.manageWorkers(myRole)) {
    return <div className="card p-10 text-center"><p className="text-lg font-bold">Team management is restricted</p><p className="mt-1 text-sm text-[var(--text-soft)]">Only the shop Manager can approve staff and assign roles.</p></div>;
  }

  const canAssignOwner = can.assignOwner(myRole);
  const roleOptions: Role[] = canAssignOwner ? ["staff", "manager", "owner"] : ["staff", "manager"];
  const canModify = (p: { id: string; role: Role }) => p.id !== user!.id && (canAssignOwner || p.role !== "owner");

  const change = async (id: string, patch: { role?: Role; active?: boolean; approved?: boolean }) => {
    setSavingId(id);
    await updateMember(id, patch);
    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      {needsSetup && (
        <div className="card p-4" style={{ background: "#fdf0d8", borderColor: "#f0d79a" }}>
          <p className="text-sm font-bold" style={{ color: "#9a6b00" }}>Finish Supabase setup to manage the team</p>
          <p className="mt-1 text-xs" style={{ color: "#9a6b00" }}>Run the one-time <b>profiles</b> table SQL in your Supabase SQL editor. Until then, roles fall back to defaults.</p>
        </div>
      )}

      {/* pending approvals */}
      {pending.length > 0 && (
        <div className="card overflow-hidden" style={{ borderColor: "#f0d79a" }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ background: "#fdf0d8", borderColor: "#f0d79a" }}>
            <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "var(--amber)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 8v4M12 16h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>
            </span>
            <span className="text-sm font-bold" style={{ color: "#9a6b00" }}>{pending.length} account{pending.length > 1 ? "s" : ""} awaiting your approval</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}>{(p.full_name || p.email).charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><div className="font-semibold">{p.full_name || "-"}</div><div className="text-xs text-[var(--text-faint)]">{p.email} · wants to join as {ROLE_LABEL[p.role]}</div></div>
                <button onClick={() => change(p.id, { approved: true, active: true })} disabled={savingId === p.id} className="btn btn-success btn-sm">{savingId === p.id ? "…" : "Approve"}</button>
                <button onClick={() => change(p.id, { approved: false, active: false })} disabled={savingId === p.id} className="btn btn-sm" style={{ background: "#fde6ea", color: "var(--red)" }}>Decline</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* role summary */}
      <div className="grid grid-cols-3 gap-4">
        {([["owner", "Managers"], ["manager", "Sales Leaders"], ["staff", "Sales Assistants"]] as [Role, string][]).map(([r, label]) => (
          <div key={r} className="card flex items-center gap-3 p-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: r === "owner" ? "var(--blue)" : r === "manager" ? "var(--green)" : "var(--navy)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 3.5a3 3 0 010 6M21 20a6 6 0 00-5-5.9"/></svg>
            </span>
            <div><div className="text-2xl font-black leading-none">{counts[r]}</div><div className="mt-0.5 text-xs text-[var(--text-faint)]">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="card p-4" style={{ background: "var(--blue-50)", borderColor: "#cbd9fb" }}>
        <p className="text-sm text-[var(--navy)]"><b>You manage this shop.</b> Sales Leaders &amp; Assistants create their own account and choose your shop; approve them above, then set each person&apos;s role and access below. Changes save instantly.</p>
      </div>

      {/* search */}
      <div className="relative max-w-sm">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team by name or email…" className="input" style={{ paddingLeft: 36 }} />
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-[var(--text-faint)]" style={{ borderColor: "var(--border)" }}>
                <th className="p-3">Member</th><th className="p-3">Current role</th><th className="p-3">Assign role</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Access</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const modifiable = canModify(p);
                const isMe = p.id === user!.id;
                return (
                  <tr key={p.id} className="table-row border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}>{(p.full_name || p.email).charAt(0).toUpperCase()}</span>
                        <div><div className="font-semibold">{p.full_name || "-"}{isMe && <span className="ml-1 text-xs font-normal text-[var(--text-faint)]">(you)</span>}</div><div className="text-xs text-[var(--text-faint)]">{p.email}</div></div>
                      </div>
                    </td>
                    <td className="p-3"><span className={`pill ${ROLE_PILL[p.role]}`}>{ROLE_LABEL[p.role]}</span></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <select className="input !w-40 !py-2" value={p.role} disabled={!modifiable || savingId === p.id}
                          onChange={(e) => change(p.id, { role: e.target.value as Role })}>
                          {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          {!roleOptions.includes(p.role) && <option value={p.role}>{ROLE_LABEL[p.role]}</option>}
                        </select>
                        {savingId === p.id && <span className="text-xs text-[var(--text-faint)]">Saving…</span>}
                        {!modifiable && !isMe && <span className="text-xs text-[var(--text-faint)]">Locked</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center"><span className={`pill ${p.approved === false && p.active === false ? "pill-red" : p.approved === false ? "pill-amber" : p.active ? "pill-green" : "pill-gray"}`}>{p.approved === false && p.active === false ? "Declined" : p.approved === false ? "Pending" : p.active ? "Active" : "Disabled"}</span></td>
                    <td className="p-3 text-right">
                      {p.approved === false ? (
                        <button onClick={() => change(p.id, { approved: true, active: true })} disabled={savingId === p.id} className="btn btn-success btn-sm">{p.active === false ? "Re-approve" : "Approve"}</button>
                      ) : modifiable ? (
                        <button onClick={() => change(p.id, { active: !p.active })} disabled={savingId === p.id} className="btn btn-sm" style={p.active ? { background: "#fde6ea", color: "var(--red)" } : { background: "#e5f6ec", color: "var(--green)" }}>
                          {p.active ? "Disable" : "Enable"}
                        </button>
                      ) : <span className="text-xs text-[var(--text-faint)]">{isMe ? "-" : "Manager"}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="p-12 text-center">
            <p className="font-semibold">{mine.length === 0 ? "No staff in your shop yet" : "No matches"}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">{mine.length === 0 ? "When staff sign up and choose your shop, they appear here for approval." : "Try a different search."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
