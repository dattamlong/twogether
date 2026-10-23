"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { CoinIcon, SparkleIcon, StarIcon } from "@/components/ui/icons";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { useCelebrations } from "@/stores/celebration-store";

export function CelebrationOverlay() {
  const current = useCelebrations((s) => s.queue[0]);
  const done = useCelebrations((s) => s.done);
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const hasXp = (current?.xp ?? 0) > 0;
  const hasCoins = (current?.coins ?? 0) !== 0;
  const empty = Boolean(current) && !hasXp && !hasCoins && !current?.leveledUp;

  useEffect(() => {
    if (current && empty) done(current.id);
  }, [current, empty, done]);

  useEffect(() => {
    if (!current || empty || !root.current) return;
    if (current.leveledUp) sfx.levelUp();
    else if ((current.coins ?? 0) > 0) sfx.coin();
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => done(current.id) });
      if (reduced) {
        tl.fromTo("[data-chip], [data-level]", { opacity: 0 }, { opacity: 1, duration: 0.2 }).to("[data-chip], [data-level]", {
          opacity: 0,
          duration: 0.3,
          delay: current.leveledUp ? 2.2 : 1.2,
        });
        return;
      }
      tl.fromTo("[data-chip]", { y: 30, opacity: 0, scale: 0.6 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, stagger: 0.1, ease: "back.out(2.2)" });
      tl.fromTo(
        "[data-spark]",
        { x: 0, y: 0, opacity: 1, scale: 0.4 },
        {
          x: () => gsap.utils.random(-160, 160),
          y: () => gsap.utils.random(-140, 40),
          opacity: 0,
          scale: () => gsap.utils.random(0.6, 1.4),
          rotation: () => gsap.utils.random(-180, 180),
          duration: 1.1,
          ease: "power2.out",
          stagger: 0.015,
        },
        "<",
      );
      if (current.leveledUp) tl.fromTo("[data-level]", { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, "<0.1");
      tl.to("[data-chip], [data-level]", { y: -40, opacity: 0, duration: 0.5, ease: "power2.in", delay: current.leveledUp ? 1.8 : 0.9 });
    }, root);
    return () => ctx.revert();
  }, [current, empty, done, reduced]);

  if (!current || empty) return null;

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[70] grid place-items-center" role="status" aria-live="polite">
      <div className="relative flex flex-col items-center gap-3">
        {Array.from({ length: reduced ? 0 : 18 }, (_, i) => (
          <span key={i} data-spark className="absolute left-1/2 top-1/2">
            <SparkleIcon size={18} />
          </span>
        ))}
        {current.leveledUp ? (
          <div data-level className="panel flex flex-col items-center px-8 py-5 text-center">
            <StarIcon size={64} />
            <p className="font-display text-3xl font-bold text-plum-700">Level {current.level}!</p>
            <p lang="vi" className="text-sm text-cocoa-400">
              Lên cấp rồi!
            </p>
          </div>
        ) : null}
        {current.label ? (
          <p data-chip className="rounded-full bg-white/90 px-4 py-1.5 font-display text-lg font-semibold text-plum-700 shadow-[var(--shadow-soft)]">
            {current.label}
          </p>
        ) : null}
        <div className="flex gap-3">
          {hasXp ? (
            <span data-chip className="flex items-center gap-1.5 rounded-full bg-lavender-100 px-4 py-2 font-display text-xl font-bold text-plum-700 shadow-[var(--shadow-soft)] ring-2 ring-white">
              <StarIcon size={26} />+{current.xp} XP
            </span>
          ) : null}
          {hasCoins ? (
            <span data-chip className="flex items-center gap-1.5 rounded-full bg-gold-200 px-4 py-2 font-display text-xl font-bold text-plum-700 shadow-[var(--shadow-soft)] ring-2 ring-white">
              <CoinIcon size={26} />
              {(current.coins ?? 0) > 0 ? "+" : ""}
              {current.coins}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
