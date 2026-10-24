import { ItemArt } from "@/components/rewards/item-art";
import { cn } from "@/lib/utils";

const WALLS: Record<number, { wall: string; side: string; floor: string }> = {
  1: { wall: "#fde4ee", side: "#f8cfe0", floor: "#f3dcc8" },
  2: { wall: "#e3f5ee", side: "#cbeadd", floor: "#efd9c4" },
  3: { wall: "#efeafb", side: "#ddd3f3", floor: "#ead2bd" },
  4: { wall: "#e5f3fc", side: "#cfe6f6", floor: "#e8cdb6" },
  5: { wall: "#fff3d6", side: "#fbe3b1", floor: "#e6c7ad" },
};

const SLOTS = [
  { left: "50%", top: "62%" },
  { left: "33%", top: "52%" },
  { left: "67%", top: "52%" },
  { left: "42%", top: "74%" },
  { left: "60%", top: "75%" },
  { left: "50%", top: "44%" },
];

export function HomePreview({ homeLevel, items, className }: { homeLevel: number; items: string[]; className?: string }) {
  const c = WALLS[homeLevel] ?? WALLS[1];
  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100 to-cream-100", className)} aria-label={`Home level ${homeLevel} with ${items.length} visible decorations`}>
      <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <path d="M100 18 L20 58 L20 88 L100 48 Z" fill={c.wall} />
        <path d="M100 18 L180 58 L180 88 L100 48 Z" fill={c.side} />
        <path d="M100 48 L180 88 L100 118 L20 88 Z" fill={c.floor} />
        <path d="M100 48 L100 18" stroke="#ffffff" strokeWidth="1.5" opacity=".8" />
        {homeLevel >= 2 ? <circle cx="40" cy="70" r="6" fill="#6cc3a2" /> : null}
        {homeLevel >= 3 ? <path d="M60 46 q10 -8 20 0" stroke="#f5cb78" strokeWidth="2" fill="none" /> : null}
        {homeLevel >= 4 ? <circle cx="160" cy="68" r="4" fill="#f39bbb" /> : null}
      </svg>
      {items.slice(0, SLOTS.length).map((id, i) => (
        <span key={`${id}-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={SLOTS[i]}>
          <ItemArt itemId={id} size={34} />
        </span>
      ))}
      {items.length === 0 ? <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold text-cocoa-400">Cozy and simple</span> : null}
    </div>
  );
}
