"use client";

import gsap from "gsap";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { HeartIcon, SparkleIcon } from "@/components/ui/icons";
import type { LeaderboardRow } from "@/features/legends/queries";
import { PODIUM_STYLES } from "@/features/legends/tiers";
import { readAvatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { Crown, LegendFlame } from "./legend-art";

type Place = 1 | 2 | 3;

const PLACE_THEME: Record<Place, { block: string; glow: string; aura: string; chip: string; particle: string; height: string; numeral: string }> = {
  1: {
    block: "bg-gradient-to-b from-[#fff1c4] via-[#f5cb78] to-[#d9a440]",
    glow: "shadow-[0_0_0_3px_#fff7d6,0_0_40px_8px_rgba(245,203,120,0.7)]",
    aura: "bg-[radial-gradient(circle,rgba(255,236,170,0.95)_0%,rgba(248,187,208,0.55)_45%,transparent_72%)]",
    chip: "bg-gradient-to-r from-[#f5cb78] to-[#e7779f] text-white",
    particle: "#f5cb78",
    height: "h-36 sm:h-48",
    numeral: "text-[#9a6a12]",
  },
  2: {
    block: "bg-gradient-to-b from-[#ffffff] via-[#d7dbe8] to-[#a995dc]",
    glow: "shadow-[0_0_0_3px_#ffffff,0_0_30px_6px_rgba(169,149,220,0.55)]",
    aura: "bg-[radial-gradient(circle,rgba(199,184,234,0.9)_0%,rgba(184,221,245,0.5)_45%,transparent_72%)]",
    chip: "bg-gradient-to-r from-[#b8ddf5] to-[#a995dc] text-white",
    particle: "#b8ddf5",
    height: "h-28 sm:h-36",
    numeral: "text-[#6a5583]",
  },
  3: {
    block: "bg-gradient-to-b from-[#ffe2cf] via-[#f0a77f] to-[#c98e6b]",
    glow: "shadow-[0_0_0_3px_#fff0e8,0_0_26px_5px_rgba(246,168,138,0.55)]",
    aura: "bg-[radial-gradient(circle,rgba(255,214,194,0.95)_0%,rgba(243,155,187,0.45)_45%,transparent_72%)]",
    chip: "bg-gradient-to-r from-[#f6a88a] to-[#e7779f] text-white",
    particle: "#f39bbb",
    height: "h-20 sm:h-28",
    numeral: "text-[#8a5236]",
  },
};

function Particles({ place, reduced }: { place: Place; reduced: boolean }) {
  const count = place === 1 ? 12 : 7;
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: 8 + ((i * 37) % 84),
        delay: (i * 0.53) % 3.2,
        duration: 2.6 + ((i * 0.71) % 1.8),
        drift: ((i % 5) - 2) * 9,
        heart: place !== 2 && i % 3 === 0,
      })),
    [count, place],
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className={cn("absolute bottom-8", i % 2 === 1 && "hidden sm:block")}
          style={{ left: `${p.left}%`, animation: `legend-rise ${p.duration}s ease-out ${p.delay}s infinite`, ["--drift" as string]: `${p.drift}px` }}
        >
          {p.heart ? (
            <HeartIcon size={12} />
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 0l1.3 3.7L10 5 6.3 6.3 5 10 3.7 6.3 0 5l3.7-1.3z" fill={PLACE_THEME[place].particle} />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

function Spot({ place, row, reduced, onSelect }: { place: Place; row?: LeaderboardRow; reduced: boolean; onSelect: (id: string) => void }) {
  const theme = PLACE_THEME[place];
  const style = PODIUM_STYLES[place];
  const [a, b] = row?.members ?? [];

  return (
    <div className={cn("relative flex flex-col items-center", place === 1 ? "z-10" : "z-0")} data-spot={place}>
      <div data-reveal={place} className="relative flex w-full flex-col items-center">
        {row ? <div className={cn("absolute -top-6 h-40 w-40 rounded-full blur-md sm:h-56 sm:w-56", theme.aura)} style={reduced ? undefined : { animation: "legend-pulse 3s ease-in-out infinite" }} aria-hidden /> : null}
        {row ? <Particles place={place} reduced={reduced} /> : null}

        <div data-crown={place} className={cn("relative", place === 1 ? "-mb-1" : "-mb-2")} style={reduced || !row ? undefined : { animation: "legend-float 3.2s ease-in-out infinite" }}>
          {row ? <Crown variant={place === 1 ? "gold" : place === 2 ? "silver" : "bronze"} size={place === 1 ? 64 : 42} className="drop-shadow-[0_4px_10px_rgba(217,164,64,0.45)]" /> : <div className={place === 1 ? "h-11" : "h-7"} />}
        </div>

        <button
          type="button"
          disabled={!row}
          onClick={() => row && onSelect(row.couple_id)}
          className={cn("relative flex items-end justify-center rounded-3xl px-1 transition-transform enabled:hover:-translate-y-1", !row && "cursor-default")}
          aria-label={row ? `Rank ${place}: ${a?.name} and ${b?.name}, ${row.score} points` : `Rank ${place} is open`}
        >
          {row ? (
            <>
              <span style={reduced ? undefined : { animation: `${place === 3 ? "legend-wave" : "legend-hop"} ${place === 1 ? 1.6 : 2.2}s ease-in-out infinite` }} className="inline-block">
                <AvatarFace avatar={readAvatar(a?.avatar)} size={place === 1 ? 64 : 48} className="drop-shadow-[0_6px_10px_rgba(69,54,91,0.25)]" />
              </span>
              <HeartIcon size={place === 1 ? 22 : 16} className="mb-4 -mx-1.5 relative z-10" />
              <span style={reduced ? undefined : { animation: `${place === 3 ? "legend-wave" : "legend-hop"} ${place === 1 ? 1.6 : 2.2}s ease-in-out ${place === 1 ? 0.25 : 0.4}s infinite` }} className="inline-block">
                <AvatarFace avatar={readAvatar(b?.avatar)} size={place === 1 ? 64 : 48} className="drop-shadow-[0_6px_10px_rgba(69,54,91,0.25)]" />
              </span>
            </>
          ) : (
            <span className="flex gap-1 opacity-60">
              {[0, 1].map((i) => (
                <span key={i} className={cn("grid place-items-center rounded-full border-2 border-dashed border-white/80 bg-white/30", place === 1 ? "size-14" : "size-11")}>
                  <HeartIcon size={14} className="opacity-60" />
                </span>
              ))}
            </span>
          )}
        </button>

        <div className="relative mt-1 flex min-h-[3.75rem] w-full flex-col items-center px-1 text-center">
          {row ? (
            <>
              <p className={cn("w-full truncate font-display font-semibold text-plum-900", place === 1 ? "text-sm sm:text-base" : "text-xs sm:text-sm")}>
                {a?.name} & {b?.name}
              </p>
              <span className={cn("mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px]", theme.chip)}>{style.title}</span>
              <AnimatedNumber value={row.score} className={cn("mt-0.5 font-display font-bold tabular-nums text-plum-700", place === 1 ? "text-lg sm:text-xl" : "text-sm sm:text-base")} />
            </>
          ) : (
            <p className="text-[11px] font-semibold leading-tight text-plum-500 sm:text-xs">
              {place === 1 ? "Be the first couple to become a legend!" : "Waiting for a legend"}
            </p>
          )}
        </div>
      </div>

      <div data-block={place} className={cn("relative mt-2 w-full overflow-visible rounded-t-[1.25rem]", theme.height, theme.block, row && theme.glow)}>
        {row && place === 1 ? (
          <>
            <LegendFlame colors={["#f39bbb", "#f5cb78"]} className="absolute -left-2 -top-7 h-10 w-7 sm:h-12 sm:w-8" />
            <LegendFlame colors={["#f5cb78", "#fff1c4"]} className="absolute -right-2 -top-7 h-10 w-7 sm:h-12 sm:w-8" delay={0.4} />
          </>
        ) : null}
        {row && place === 3 ? (
          <>
            <LegendFlame colors={["#f6a88a", "#f39bbb"]} className="absolute -left-1.5 -top-6 h-8 w-6" delay={0.2} />
            <LegendFlame colors={["#f39bbb", "#ffd6c2"]} className="absolute -right-1.5 -top-6 h-8 w-6" delay={0.7} />
          </>
        ) : null}
        {row && place === 2 ? <SparkleIcon size={20} className="absolute right-2 top-2 opacity-90" /> : null}
        <div className="absolute inset-x-2 top-2 h-2 rounded-full bg-white/50" />
        <span className={cn("absolute inset-0 grid place-items-center font-display font-bold drop-shadow-[0_2px_0_rgba(255,255,255,0.6)]", place === 1 ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl", theme.numeral)}>{place}</span>
      </div>
    </div>
  );
}

export function Podium({ rows, animationKey, onSelect }: { rows: LeaderboardRow[]; animationKey: string; onSelect: (coupleId: string) => void }) {
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
      tl.fromTo("[data-bg]", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.out" });
      tl.fromTo('[data-block="3"], [data-block="2"], [data-block="1"]', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.08 }, "<0.1");
      tl.fromTo('[data-reveal="3"]', { y: 24, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, "-=0.15");
      tl.fromTo('[data-reveal="2"]', { y: 24, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, "-=0.1");
      tl.fromTo('[data-reveal="1"]', { y: 30, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)" }, "-=0.05");
      if (first) {
        tl.fromTo("[data-flash]", { opacity: 0 }, { opacity: 0.85, duration: 0.12, ease: "power2.out" }, "<0.1").to("[data-flash]", { opacity: 0, duration: 0.5 });
        tl.fromTo('[data-crown="1"] svg', { y: -60, opacity: 0, rotate: -25 }, { y: 0, opacity: 1, rotate: 0, duration: 0.6, ease: "bounce.out" }, "<");
        tl.fromTo(
          "[data-confetti] span",
          { x: 0, y: 0, opacity: 1, scale: 0.4 },
          {
            x: () => gsap.utils.random(-220, 220),
            y: () => gsap.utils.random(-180, 40),
            rotate: () => gsap.utils.random(-200, 200),
            scale: () => gsap.utils.random(0.7, 1.3),
            opacity: 0,
            duration: 1.3,
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
      <div data-bg className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#fff4f8_0%,#efeafb_45%,#c7b8ea_100%)]" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_70%,rgba(245,203,120,0.35)_0%,transparent_70%)]" />
        {!reduced
          ? Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                className={cn("absolute size-2 rounded-full bg-white", i % 2 && "hidden sm:block")}
                style={{ left: `${(i * 23) % 96}%`, top: `${(i * 31) % 55}%`, animation: `legend-twinkle ${2 + (i % 4) * 0.6}s ease-in-out ${(i % 5) * 0.4}s infinite` }}
              />
            ))
          : null}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/70 to-transparent" />
      </div>
      <div data-flash className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#fff7d6_0%,rgba(245,203,120,0.6)_35%,transparent_70%)] opacity-0" aria-hidden />
      <div data-confetti className="pointer-events-none absolute left-1/2 top-1/3" aria-hidden>
        {!reduced && first
          ? Array.from({ length: 26 }, (_, i) => (
              <span key={i} className="absolute block h-2.5 w-1.5 rounded-sm" style={{ background: confettiColors[i % confettiColors.length] }} />
            ))
          : null}
      </div>

      <div className="relative grid grid-cols-3 items-end gap-1.5 px-2 pt-10 sm:gap-4 sm:px-8 sm:pt-14">
        <Spot place={2} row={second} reduced={reduced} onSelect={onSelect} />
        <Spot place={1} row={first} reduced={reduced} onSelect={onSelect} />
        <Spot place={3} row={third} reduced={reduced} onSelect={onSelect} />
      </div>
    </section>
  );
}
