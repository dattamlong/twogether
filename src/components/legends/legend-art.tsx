import { tierById } from "@/features/legends/tiers";
import { cn } from "@/lib/utils";

export function TierBadge({ tier, size = 40, className, showLabel = false }: { tier: number; size?: number; className?: string; showLabel?: boolean }) {
  const t = tierById(tier);
  const id = `tier-${t.key}-${size}`;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`${t.name} · ${t.vi}`}>
      <svg viewBox="0 0 48 52" width={size} height={size * 1.08} aria-label={t.name} role="img">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={t.colors.from} />
            <stop offset="1" stopColor={t.colors.to} />
          </linearGradient>
        </defs>
        <path d="M24 2l19 7v15c0 13-8 21-19 26C13 45 5 37 5 24V9z" fill={`url(#${id})`} stroke={t.colors.ring} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M24 36c-7-4.6-10-8-10-11.6 0-2.9 2.3-5 4.8-5 2 0 3.9 1.1 5.2 3 1.3-1.9 3.2-3 5.2-3 2.5 0 4.8 2.1 4.8 5C34 28 31 31.4 24 36z" fill={t.colors.gem} stroke="#fff" strokeWidth="1.5" />
        {t.id >= 4 ? <path d="M24 6l2.5 4.5L31 12l-4.5 2.5L24 19l-2.5-4.5L17 12l4.5-1.5z" fill="#fff" opacity=".9" /> : null}
        {t.id === 6 ? <path d="M14 6l5 4 5-6 5 6 5-4-2 7H16z" fill="#f5cb78" stroke="#c08a2a" strokeWidth="1" /> : null}
        <path d="M12 12c3-2 6-3 9-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      </svg>
      {showLabel ? (
        <span className="leading-tight">
          <span className="block font-display text-sm font-semibold text-plum-700">{t.name}</span>
          <span lang="vi" className="block text-[11px] text-cocoa-400">{t.vi}</span>
        </span>
      ) : null}
    </span>
  );
}

export function Crown({ variant = "gold", size = 56, className }: { variant?: "gold" | "silver" | "bronze"; size?: number; className?: string }) {
  const palette = {
    gold: ["#fff1c4", "#f5cb78", "#d9a440", "#e7779f"],
    silver: ["#ffffff", "#d7dbe8", "#9aa1b8", "#a995dc"],
    bronze: ["#ffe2cf", "#f0a77f", "#b77a58", "#f39bbb"],
  }[variant];
  const id = `crown-${variant}`;
  return (
    <svg viewBox="0 0 64 44" width={size} height={size * 0.69} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette[0]} />
          <stop offset=".55" stopColor={palette[1]} />
          <stop offset="1" stopColor={palette[2]} />
        </linearGradient>
      </defs>
      <path d="M6 14l13 10 13-20 13 20 13-10-5 26H11z" fill={`url(#${id})`} stroke={palette[2]} strokeWidth="2" strokeLinejoin="round" />
      <rect x="11" y="34" width="42" height="6" rx="2" fill={palette[2]} />
      <circle cx="32" cy="22" r="4.5" fill={palette[3]} stroke="#fff" strokeWidth="1.5" />
      <circle cx="18" cy="28" r="2.5" fill="#fff" opacity=".9" />
      <circle cx="46" cy="28" r="2.5" fill="#fff" opacity=".9" />
      <circle cx="6" cy="13" r="3" fill={palette[1]} />
      <circle cx="32" cy="4" r="3" fill={palette[1]} />
      <circle cx="58" cy="13" r="3" fill={palette[1]} />
    </svg>
  );
}

export function LegendFlame({ colors, className, delay = 0 }: { colors: [string, string]; className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 30 46" className={cn("origin-bottom", className)} style={{ animation: `legend-flame 1.6s ease-in-out ${delay}s infinite` }} aria-hidden>
      <path d="M15 45C6 45 1 39 1 31c0-8 6-12 8-20 1 4 3 6 5 7 0-6 3-11 8-17 1 9 7 14 7 26 0 11-6 18-14 18z" fill={colors[0]} opacity=".85" />
      <path d="M15 44c-5 0-8-3-8-8 0-5 4-7 5-12 2 4 6 6 6 11 1-2 2-3 2-6 2 3 3 5 3 8 0 4-3 7-8 7z" fill={colors[1]} />
    </svg>
  );
}
