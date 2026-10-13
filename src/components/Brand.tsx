export default function Brand({
  size = 40,
  light = false,
  showText = true,
}: { size?: number; light?: boolean; showText?: boolean }) {
  const stroke = "#ffffff";
  const dot = light ? "#ffffff" : "var(--cyan)";
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl"
        style={{
          width: size, height: size,
          background: light ? "rgba(255,255,255,.18)" : "linear-gradient(135deg, var(--blue), var(--navy))",
          boxShadow: light ? "0 0 0 1px rgba(255,255,255,.35)" : "var(--shadow-md)",
        }}
      >
        {/* Concentric "C" arcs = Centric */}
        <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path d="M24.92 7.97 A12 12 0 1 0 24.92 24.03" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" />
          <path d="M21.95 10.65 A8 8 0 1 0 21.95 21.35" stroke={stroke} strokeOpacity=".6" strokeWidth="2.9" strokeLinecap="round" />
          <circle cx="16" cy="16" r="2.5" fill={dot} />
        </svg>
      </span>
      {showText && (
        <span className="leading-none">
          <span className="block text-[15px] font-black tracking-tight" style={{ color: light ? "#fff" : "var(--text)" }}>CENTRIC</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: light ? "rgba(255,255,255,.7)" : "var(--text-faint)" }}>System Limited</span>
        </span>
      )}
    </span>
  );
}
