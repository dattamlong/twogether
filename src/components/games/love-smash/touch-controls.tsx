"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

export type PressKind = "hit" | "smash" | "drop" | "lunge";

const BUTTONS: { kind: PressKind; label: string; icon: string; className: string }[] = [
  { kind: "hit", label: "HIT", icon: "🏸", className: "size-[4.6rem] bg-sakura-400 text-white shadow-[0_4px_0_0_#c2527c]" },
  { kind: "smash", label: "SMASH", icon: "🔥", className: "size-16 bg-peach-400 text-white shadow-[0_4px_0_0_#d9825f]" },
  { kind: "drop", label: "DROP", icon: "🌸", className: "size-16 bg-lavender-300 text-white shadow-[0_4px_0_0_#8a73c8]" },
  { kind: "lunge", label: "DIVE", icon: "💨", className: "size-14 bg-mint-400 text-white shadow-[0_4px_0_0_#3a9474]" },
];

export function TouchControls({ onMove, onPress }: { onMove: (x: number, y: number) => void; onPress: (kind: PressKind) => void }) {
  const pointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [stick, setStick] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);
  const [pressed, setPressed] = useState<PressKind | null>(null);
  const RADIUS = 46;

  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== null) return;
    pointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    origin.current = { x: e.clientX, y: e.clientY };
    setStick({ ox: e.clientX - rect.left, oy: e.clientY - rect.top, dx: 0, dy: 0 });
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setStick((s) => (s ? { ...s, dx, dy } : s));
    const nx = dx / RADIUS;
    const ny = -dy / RADIUS;
    const dead = Math.hypot(nx, ny) < 0.18;
    onMove(dead ? 0 : nx, dead ? 0 : ny);
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setStick(null);
    onMove(0, 0);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-3 pb-[max(env(safe-area-inset-bottom),12px)]" data-testid="touch-controls">
      <div
        className="pointer-events-auto relative h-44 w-[46%] max-w-64 touch-none select-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Movement joystick"
        role="application"
      >
        {stick ? (
          <div className="absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35 ring-2 ring-white/70" style={{ left: stick.ox, top: stick.oy }}>
            <div className="absolute left-1/2 top-1/2 size-12 rounded-full bg-white/90 shadow-[var(--shadow-pop)]" style={{ transform: `translate(calc(-50% + ${stick.dx}px), calc(-50% + ${stick.dy}px))` }} />
          </div>
        ) : (
          <div className="absolute bottom-6 left-8 grid size-28 place-items-center rounded-full bg-white/25 text-xs font-semibold text-plum-700/70 ring-2 ring-white/50">MOVE</div>
        )}
      </div>
      <div className="pointer-events-auto grid grid-cols-2 items-end gap-2 touch-none select-none">
        {BUTTONS.map((b) => (
          <button
            key={b.kind}
            type="button"
            aria-label={b.label}
            onPointerDown={(e) => {
              e.preventDefault();
              setPressed(b.kind);
              onPress(b.kind);
            }}
            onPointerUp={() => setPressed(null)}
            onPointerCancel={() => setPressed(null)}
            onContextMenu={(e) => e.preventDefault()}
            className={cn("flex flex-col items-center justify-center rounded-full font-display text-[0.62rem] font-bold leading-tight transition-transform", b.className, pressed === b.kind && "translate-y-[3px] shadow-none")}
          >
            <span className="text-xl" aria-hidden>
              {b.icon}
            </span>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
