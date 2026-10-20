"use client";
import { useStore } from "@/store/Store";
import { ROLE_LABEL } from "@/lib/inventory";
import Brand from "./Brand";

export default function AwaitingApproval({ declined = false }: { declined?: boolean }) {
  const { user, logout } = useStore();
  if (!user) return null;

  if (declined) {
    return (
      <div className="grid min-h-screen place-items-center p-6" style={{ background: "var(--bg)" }}>
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mb-5 flex justify-center"><Brand size={44} /></div>
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full" style={{ background: "#fde6ea", color: "var(--red)" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
          </div>
          <h1 className="text-2xl font-black">Request declined</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Hi {user.name.split(" ")[0]}, the <b>Manager</b>{user.shopName ? <> of <b>{user.shopName}</b></> : ""} has <b>declined</b> your request to join as a <b>{ROLE_LABEL[user.role]}</b>.
          </p>
          <div className="my-5 rounded-xl border p-3 text-left text-sm" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--red)" }} /> <span className="font-semibold">Access not granted</span></div>
            <div className="mt-1 text-xs text-[var(--text-faint)]">If you think this is a mistake, contact your Manager and ask them to approve you. If they approve you later, this screen updates automatically.</div>
          </div>
          <button onClick={() => logout()} className="btn btn-outline w-full">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center p-6" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mb-5 flex justify-center"><Brand size={44} /></div>
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full" style={{ background: "var(--blue-50)", color: "var(--blue)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </div>
        <h1 className="text-2xl font-black">Waiting for approval</h1>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Hi {user.name.split(" ")[0]}, your <b>{ROLE_LABEL[user.role]}</b> account{user.shopName ? <> for <b>{user.shopName}</b></> : ""} has been created.
          The shop <b>Manager</b> needs to approve you before your dashboard is unlocked.
        </p>
        <div className="my-5 rounded-xl border p-3 text-left text-sm" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber)" }} /> <span className="font-semibold">Pending approval</span></div>
          <div className="mt-1 text-xs text-[var(--text-faint)]">You&apos;ll get full access as soon as the Manager approves your account - this screen updates automatically.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="btn btn-primary flex-1">Refresh</button>
          <button onClick={() => logout()} className="btn btn-outline flex-1">Sign out</button>
        </div>
      </div>
    </div>
  );
}
