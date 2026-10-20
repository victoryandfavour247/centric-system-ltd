"use client";
import { useEffect, useRef, useState } from "react";

export interface SelectOption { value: string; label: string }

/** A nicely styled dropdown that replaces the native <select> option list
 *  (which the OS renders and CSS can't theme). Matches the app design. */
export default function Select({
  value, onChange, options, className = "", ariaLabel, placeholder = "Select…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate" style={{ color: current ? "var(--text)" : "var(--text-faint)" }}>{current?.label ?? placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2"
          className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-auto rounded-xl border p-1 shadow-[var(--shadow-lg)]"
          style={{ borderColor: "var(--border)", background: "var(--surface)", animation: "fadeUp .12s ease" }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${active ? "" : "hover:bg-[var(--surface-2)]"}`}
                style={active ? { background: "var(--blue-50)", color: "var(--blue)" } : { color: "var(--text)" }}
              >
                <span className="truncate">{o.label}</span>
                {active && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
