"use client";

import gsap from "gsap";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { HeartIcon } from "@/components/ui/icons";
import type { LeaderboardRow } from "@/features/legends/queries";
import { PODIUM_STYLES } from "@/features/legends/tiers";
import { readAvatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { Crown, LegendFlame } from "./legend-art";

type Place = 1 | 2 | 3;

const THEME: Record<
  Place,
  { block: string; glow: string; aura: string; chip: string; medal: [string, string, string]; height: string; avatar: string; label: string }
> = {
  1: {
    block: "bg-gradient-to-b from-[#fff1c4] via-[#f5cb78] to-[#d9a440]",
    glow: "shadow-[0_0_0_3px_#fff7d6,0_-6px_40px_10px_rgba(245,203,120,0.65)]",
    aura: "bg-[radial-gradient(circle,rgba(255,236,170,0.95)_0%,rgba(248,187,208,0.5)_45%,transparent_70%)]",
    chip: "bg-gradient-to-r from-[#e9b44c] to-[#e7779f] text-white",
    medal: ["#fff1c4", "#f5cb78", "#b8832a"],
    height: "h-24 sm:h-32",
    avatar: "h-[68px] w-[68px] sm:h-[92px] sm:w-[92px]",
    label: "1ST",
  },
  2: {
    block: "bg-gradient-to-b from-[#ffffff] via-[#dfe2f0] to-[#b3a3e3]",
    glow: "shadow-[0_0_0_3px_#ffffff,0_-4px_28px_6px_rgba(169,149,220,0.5)]",
    aura: "bg-[radial-gradient(circle,rgba(199,184,234,0.9)_0%,rgba(184,221,245,0.45)_45%,transparent_70%)]",
    chip: "bg-gradient-to-r from-[#8fb7f0] to-[#a995dc] text-white",
    medal: ["#ffffff", "#d7dbe8", "#8a8fa8"],
    height: "h-16 sm:h-24",
    avatar: "h-[52px] w-[52px] sm:h-[72px] sm:w-[72px]",
    label: "2ND",
  },
  3: {
    block: "bg-gradient-to-b from-[#ffe7d6] via-[#f3b394] to-[#d08a6c]",
    glow: "shadow-[0_0_0_3px_#fff0e8,0_-4px_24px_5px_rgba(246,168,138,0.5)]",
    aura: "bg-[radial-gradient(circle,rgba(255,214,194,0.95)_0%,rgba(243,155,187,0.42)_45%,transparent_70%)]",
    chip: "bg-gradient-to-r from-[#f6a88a] to-[#e7779f] text-white",
    medal: ["#ffe2cf", "#e9a07a", "#9a5c3f"],
    height: "h-12 sm:h-20",
    avatar: "h-[52px] w-[52px] sm:h-[72px] sm:w-[72px]",
    label: "3RD",
  },
};

const SHORT_TITLE: Record<Place, string> = { 1: "Ultimate", 2: "Diamond", 3: "Burning" };

function Medal({ place }: { place: Place }) {
  const [light, mid, dark] = THEME[place].medal;
  const size = place === 1 ? 46 : 38;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="drop-shadow-[0_3px_0_rgba(69,54,91,0.18)]">
      <defs>
        <radialGradient id={`medal-${place}`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor={light} />
          <stop offset=".6" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#medal-${place})`} stroke="#fff" strokeWidth="3" />
      <circle cx="24" cy="24" r="15" fill="none" stroke={dark} strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="2 3" />
      <text x="24" y="31" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="21" fill={dark}>
        {place}
      </text>
    </svg>
  );
}

function Particles({ place, reduced }: { place: Place; reduced: boolean }) {
  const count = place === 1 ? 12 : 7;
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: 6 + ((i * 37) % 88),
        delay: (i * 0.53) % 3.2,
        duration: 2.6 + ((i * 0.71) % 1.8),
        drift: ((i % 5) - 2) * 9,
        kind: place === 2 ? "diamond" : place === 3 ? (i % 2 ? "heart" : "spark") : i % 3 === 0 ? "heart" : "spark",
      })),
    [count, place],
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className={cn("absolute bottom-6", i % 2 === 1 && "hidden sm:block")}
          style={{ left: `${p.left}%`, animation: `legend-rise ${p.duration}s ease-out ${p.delay}s infinite`, ["--drift" as string]: `${p.drift}px` }}
        >
          {p.kind === "heart" ? (
            <HeartIcon size={12} />
          ) : p.kind === "diamond" ? (
            <svg width="10" height="12" viewBox="0 0 10 12">
              <path d="M5 0l5 5-5 7-5-7z" fill="#b8ddf5" stroke="#8a73c8" strokeWidth=".8" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 0l1.3 3.7L10 5 6.3 6.3 5 10 3.7 6.3 0 5l3.7-1.3z" fill="#f5cb78" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

function Silhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="31" fill="#ffffff" fillOpacity=".35" stroke="#ffffff" strokeOpacity=".9" strokeWidth="2" strokeDasharray="4 4" />
      <ellipse cx="32" cy="30" rx="15" ry="14" fill="#a995dc" fillOpacity=".28" />
      <path d="M17 27c0-11 7-17 15-17s15 6 15 17c-4-6-9-8-15-8s-11 2-15 8z" fill="#a995dc" fillOpacity=".35" />
      <rect x="22" y="44" width="20" height="14" rx="7" fill="#a995dc" fillOpacity=".28" />
    </svg>
  );
}

function Spot({ place, row, reduced, onSelect }: { place: Place; row?: LeaderboardRow; reduced: boolean; onSelect: (id: string) => void }) {
  const theme = THEME[place];
  const [a, b] = row?.members ?? [];
  const hop = place === 3 ? "legend-wave" : "legend-hop";

  return (
    <div className={cn("relative flex flex-col items-center", place === 1 && "z-10")} data-spot={place}>
      <div data-reveal={place} className="relative flex w-full flex-col items-center">
        {row ? (
          <div
            className={cn("absolute rounded-full blur-md", theme.aura, place === 1 ? "-top-4 h-40 w-40 sm:h-56 sm:w-56" : "top-0 h-28 w-28 sm:h-40 sm:w-40")}
            style={reduced ? undefined : { animation: "legend-pulse 3s ease-in-out infinite" }}
            aria-hidden
          />
        ) : null}
        {row ? <Particles place={place} reduced={reduced} /> : null}

        {row ? (
          <div data-crown={place} className="relative -mb-2 h-8 sm:h-10" style={reduced ? undefined : { animation: "legend-float 3.2s ease-in-out infinite" }}>
            <Crown variant={place === 1 ? "gold" : place === 2 ? "silver" : "bronze"} size={place === 1 ? 58 : 38} className="drop-shadow-[0_4px_10px_rgba(217,164,64,0.45)]" />
          </div>
        ) : null}

        <button
          type="button"
          disabled={!row}
          onClick={() => row && onSelect(row.couple_id)}
          className="relative flex items-end justify-center rounded-3xl transition-transform enabled:hover:-translate-y-1 disabled:cursor-default"
          aria-label={row ? `Rank ${place}: ${a?.name} and ${b?.name}, ${row.score} points` : `Rank ${place} is open`}
        >
          {row ? (
            <>
              <span className="inline-block" style={reduced ? undefined : { animation: `${hop} ${place === 1 ? 1.6 : 2.2}s ease-in-out infinite` }}>
                <AvatarFace avatar={readAvatar(a?.avatar)} size={92} className={cn(theme.avatar, "drop-shadow-[0_6px_10px_rgba(69,54,91,0.25)]")} />
              </span>
              <HeartIcon size={place === 1 ? 24 : 18} className="relative z-10 -mx-2.5 mb-5" />
              <span className="inline-block" style={reduced ? undefined : { animation: `${hop} ${place === 1 ? 1.6 : 2.2}s ease-in-out ${place === 1 ? 0.25 : 0.4}s infinite` }}>
                <AvatarFace avatar={readAvatar(b?.avatar)} size={92} className={cn(theme.avatar, "drop-shadow-[0_6px_10px_rgba(69,54,91,0.25)]")} />
              </span>
            </>
          ) : (
            <span className="flex items-end">
              <Silhouette className={theme.avatar} />
              <Silhouette className={cn(theme.avatar, "-ml-3")} />
            </span>
          )}
        </button>

        <div className="relative flex w-full flex-col items-center px-0.5 pb-3 text-center sm:pb-4">
          {row ? (
            <>
              <p className={cn("mt-1 w-full truncate font-display font-semibold text-plum-900", place === 1 ? "text-sm sm:text-lg" : "text-xs sm:text-sm")}>
                {a?.name} & {b?.name}
              </p>
              <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px]", theme.chip)}>
                <span className="sm:hidden">{SHORT_TITLE[place]}</span>
                <span className="hidden sm:inline">{PODIUM_STYLES[place].title}</span>
              </span>
            </>
          ) : (
            <p className="mt-1 text-[11px] font-semibold text-plum-500 sm:text-xs">{place === 1 ? "Your legend starts here" : "Open spot"}</p>
          )}
        </div>
      </div>

      <div data-block={place} className={cn("relative w-full rounded-t-[1.25rem]", theme.height, theme.block, row ? theme.glow : "opacity-70 saturate-50")}>
        {row && place === 1 ? (
          <>
            <LegendFlame colors={["#f39bbb", "#f5cb78"]} className="absolute -left-2 -top-3 h-7 w-5 sm:h-9 sm:w-6" />
            <LegendFlame colors={["#f5cb78", "#fff1c4"]} className="absolute -right-2 -top-3 h-7 w-5 sm:h-9 sm:w-6" delay={0.4} />
          </>
        ) : null}
        {row && place === 3 ? (
          <>
            <LegendFlame colors={["#f6a88a", "#f39bbb"]} className="absolute -left-1.5 -top-2.5 h-6 w-4" delay={0.2} />
            <LegendFlame colors={["#f39bbb", "#ffd6c2"]} className="absolute -right-1.5 -top-2.5 h-6 w-4" delay={0.7} />
          </>
        ) : null}
        <div className="absolute inset-x-2 top-1.5 h-1.5 rounded-full bg-white/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pt-1">
          <Medal place={place} />
          {row ? (
            <AnimatedNumber value={row.score} className={cn("font-display font-bold tabular-nums text-plum-900/80", place === 1 ? "text-sm sm:text-lg" : "text-xs sm:text-sm")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Podium({
  rows,
  animationKey,
  onSelect,
  emptyMessage,
}: {
  rows: LeaderboardRow[];
  animationKey: string;
  onSelect: (coupleId: string) => void;
  emptyMessage?: { title: string; body: string; vi: string } | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [first, second, third] = rows;

  useLayoutEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set("[data-reveal], [data-block], [data-bg]", { opacity: 1, y: 0, scale: 1 });
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo("[data-bg]", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
      tl.fromTo('[data-block="3"], [data-block="2"], [data-block="1"]', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.6)", stagger: 0.07 }, "<0.05");
      tl.fromTo('[data-reveal="3"]', { y: 20, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "-=0.15");
      tl.fromTo('[data-reveal="2"]', { y: 20, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "-=0.1");
      tl.fromTo('[data-reveal="1"]', { y: 26, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.2)" }, "-=0.05");
      if (first) {
        tl.fromTo("[data-flash]", { opacity: 0 }, { opacity: 0.8, duration: 0.12, ease: "power2.out" }, "<0.1").to("[data-flash]", { opacity: 0, duration: 0.45 });
        tl.fromTo('[data-crown="1"] svg', { y: -50, opacity: 0, rotate: -25 }, { y: 0, opacity: 1, rotate: 0, duration: 0.55, ease: "bounce.out" }, "<");
        tl.fromTo(
          "[data-confetti] span",
          { x: 0, y: 0, opacity: 1, scale: 0.4 },
          {
            x: () => gsap.utils.random(-200, 200),
            y: () => gsap.utils.random(-160, 40),
            rotate: () => gsap.utils.random(-200, 200),
            scale: () => gsap.utils.random(0.7, 1.3),
            opacity: 0,
            duration: 1.2,
            ease: "power2.out",
            stagger: 0.01,
          },
          "<",
        );
      }
    }, root);
    return () => ctx.revert();
  }, [animationKey, reduced, first]);

  const confettiColors = ["#f5cb78", "#f39bbb", "#c7b8ea", "#bce5d5", "#fff1c4"];

  return (
    <section ref={root} aria-label="Top 3 couples" className="relative overflow-hidden rounded-[2rem] ring-2 ring-white">
      <div data-bg className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_0%,#fff4f8_0%,#efeafb_48%,#c7b8ea_100%)]" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_62%,rgba(245,203,120,0.38)_0%,transparent_70%)]" />
        {!reduced
          ? Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className={cn("absolute size-1.5 rounded-full bg-white", i % 2 && "hidden sm:block")}
                style={{ left: `${(i * 23) % 96}%`, top: `${(i * 31) % 45}%`, animation: `legend-twinkle ${2 + (i % 4) * 0.6}s ease-in-out ${(i % 5) * 0.4}s infinite` }}
              />
            ))
          : null}
      </div>
      <div data-flash className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#fff7d6_0%,rgba(245,203,120,0.6)_35%,transparent_70%)] opacity-0" aria-hidden />
      <div data-confetti className="pointer-events-none absolute left-1/2 top-1/3" aria-hidden>
        {!reduced && first
          ? Array.from({ length: 24 }, (_, i) => <span key={i} className="absolute block h-2.5 w-1.5 rounded-sm" style={{ background: confettiColors[i % confettiColors.length] }} />)
          : null}
      </div>

      {emptyMessage ? (
        <div className="relative mx-auto mt-4 flex w-fit max-w-[90%] items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-center shadow-[var(--shadow-pop)]">
          <HeartIcon size={18} className="shrink-0" />
          <p className="text-xs text-plum-700 sm:text-sm">
            <b className="font-display">{emptyMessage.title}</b> <span className="hidden sm:inline">{emptyMessage.body}</span>
            <span lang="vi" className="block text-[10px] text-cocoa-400 sm:text-[11px]">{emptyMessage.vi}</span>
          </p>
        </div>
      ) : null}

      <div className={cn("relative grid grid-cols-3 items-end gap-1.5 px-2 sm:gap-4 sm:px-8", emptyMessage ? "pt-2" : "pt-5 sm:pt-6")}>
        <Spot place={2} row={second} reduced={reduced} onSelect={onSelect} />
        <Spot place={1} row={first} reduced={reduced} onSelect={onSelect} />
        <Spot place={3} row={third} reduced={reduced} onSelect={onSelect} />
      </div>
    </section>
  );
}
