"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { FlameIcon } from "@/components/ui/icons";
import { ackLegendCelebration, useLegendStatus } from "@/features/legends/queries";
import { readAvatar } from "@/features/session/types";
import { useSession } from "@/features/session/use-session";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { Crown } from "./legend-art";

export function LegendCelebration() {
  const { data: session } = useSession();
  const { data: status, refetch } = useLegendStatus();
  const [milestone, setMilestone] = useState<"top3" | "first" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const due: "top3" | "first" | null =
    status?.isPublic && status.rank && status.score > 0
      ? status.rank === 1 && !status.celebrations.includes("first")
        ? "first"
        : status.rank <= 3 && !status.celebrations.includes("top3") && !status.celebrations.includes("first")
          ? "top3"
          : null
      : null;

  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!due || started.current === due) return;
    started.current = due;
    const acks = due === "first" ? [ackLegendCelebration("first"), ackLegendCelebration("top3")] : [ackLegendCelebration(due)];
    void Promise.all(acks).then(() => {
      setMilestone(due);
      sfx.levelUp();
      void refetch();
    });
  }, [due, refetch]);

  useEffect(() => {
    if (!milestone || !root.current) return;
    const ctx = gsap.context(() => {
      if (reduced) return;
      const tl = gsap.timeline();
      tl.fromTo("[data-dim]", { opacity: 0 }, { opacity: 1, duration: 0.25 });
      tl.fromTo("[data-badge]", { scale: 0.2, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.7, ease: "elastic.out(1, 0.55)" });
      tl.fromTo(
        "[data-burst] span",
        { x: 0, y: 0, opacity: 1 },
        { x: () => gsap.utils.random(-200, 200), y: () => gsap.utils.random(-200, 120), rotate: () => gsap.utils.random(-180, 180), opacity: 0, duration: 1.4, ease: "power2.out", stagger: 0.008 },
        "<0.1",
      );
      tl.fromTo("[data-couple]", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, "-=1.1");
      tl.fromTo("[data-text]", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.1 }, "-=0.8");
    }, root);
    return () => ctx.revert();
  }, [milestone, reduced]);

  if (!milestone || !session) return null;
  const first = milestone === "first";
  const colors = first ? ["#f5cb78", "#fff1c4", "#f39bbb", "#d9a440"] : ["#f39bbb", "#f6a88a", "#c7b8ea", "#f5cb78"];

  return (
    <div ref={root} className="fixed inset-0 z-[80] grid place-items-center p-6" role="dialog" aria-modal aria-label={first ? "You are the number one couple" : "You reached the top 3"}>
      <div data-dim className="absolute inset-0 bg-plum-900/45 backdrop-blur-[2px]" onClick={() => setMilestone(null)} />
      <div data-burst className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
        {!reduced ? Array.from({ length: 36 }, (_, i) => <span key={i} className="absolute block h-3 w-2 rounded-sm" style={{ background: colors[i % colors.length] }} />) : null}
      </div>
      <div className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-[2rem] bg-gradient-to-b from-[#fff7e0] via-white to-sakura-50 p-6 text-center shadow-[0_0_60px_10px_rgba(245,203,120,0.45)] ring-4 ring-gold-200">
        <div data-badge className="grid place-items-center">
          {first ? <Crown variant="gold" size={110} /> : <FlameIcon size={96} />}
        </div>
        <div data-couple className="flex items-center gap-1">
          <AvatarFace avatar={readAvatar(session.profile.avatar)} size={56} />
          <AvatarFace avatar={readAvatar(session.partner?.avatar)} size={56} />
        </div>
        <p data-text className="font-display text-2xl font-bold text-plum-700">
          {first ? "You are the #1 couple!" : "You reached Top 3!"}
        </p>
        <p data-text lang="vi" className="text-sm text-cocoa-400">
          {first ? "Hai bạn đang là cặp đôi số 1!" : "Hai bạn đã vào Top 3!"}
        </p>
        <p data-text className="text-sm text-plum-500">
          {first ? "The Ultimate Couple — keep learning together to hold the crown until Monday." : `Rank #${status?.rank} this week. Learn together to climb even higher!`}
        </p>
        <Button data-text onClick={() => setMilestone(null)} className="mt-1">
          Keep shining
        </Button>
      </div>
    </div>
  );
}
