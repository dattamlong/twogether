"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeartIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useSetLegendVisibility, type LegendStatus } from "@/features/legends/queries";
import { tierById } from "@/features/legends/tiers";
import type { SessionData } from "@/features/session/types";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { TierBadge } from "./legend-art";
import { Movement } from "./leaderboard-list";

export function MyRankCard({ status, session, compact = false }: { status: LegendStatus; session: SessionData; compact?: boolean }) {
  const setVisibility = useSetLegendVisibility();
  const tier = tierById(status.tier);
  const nextTier = tierById(status.tier + 1);
  const me = session.profile.display_name;
  const partner = session.partner?.display_name ?? "Partner";
  const myPoints = status.memberPoints?.[session.userId] ?? 0;
  const partnerPoints = session.partner ? (status.memberPoints?.[session.partner.id] ?? 0) : 0;
  const rankLabel = status.rank ? `#${status.rank}` : "—";

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-[1.5rem] bg-gradient-to-r from-sakura-100 via-white to-lavender-100 px-3 py-2 shadow-[var(--shadow-soft)] ring-2 ring-white">
        <span className="font-display text-xl font-bold text-plum-700">{rankLabel}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-plum-700">
            {me} & {partner}
          </span>
          <span className="block text-[11px] text-cocoa-400">
            {status.score.toLocaleString()} pts{status.pointsToNext ? ` · ${status.pointsToNext} to next` : ""}
          </span>
        </span>
        <TierBadge tier={status.tier} size={26} />
        {!status.isPublic ? (
          <Button size="sm" onClick={() => setVisibility.mutate(true)} loading={setVisibility.isPending}>
            Join
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <HeartIcon size={22} />
        <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-sakura-500">Your couple</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-4xl font-bold text-plum-700">{rankLabel}</p>
          <p className="font-display font-semibold">
            {me} & {partner}
          </p>
        </div>
        {status.movement !== null && status.rank ? (
          <span className="rounded-full bg-white/80 px-2 py-1">
            <Movement value={status.movement} />
          </span>
        ) : null}
      </div>
      <div className="rounded-2xl bg-white/70 p-3">
        <p className="text-xs font-bold text-cocoa-400">Weekly score</p>
        <AnimatedNumber value={status.score} className="font-display text-2xl font-bold text-plum-700 tabular-nums" />
        {status.pointsToNext ? (
          <p className="text-xs text-plum-500">
            {status.pointsToNext.toLocaleString()} points until rank #{(status.rank ?? 2) - 1}
          </p>
        ) : status.rank === 1 ? (
          <p className="text-xs font-bold text-gold-500">You are the #1 couple this week!</p>
        ) : status.score === 0 ? (
          <p className="text-xs text-plum-500">Finish a lesson together to enter this week&apos;s ranking.</p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold">
          <span className={cn("rounded-xl px-2 py-1", myPoints ? "bg-sakura-100" : "bg-cream-200")}>
            {me}: {myPoints}
          </span>
          <span className={cn("rounded-xl px-2 py-1", partnerPoints ? "bg-lavender-100" : "bg-cream-200")}>
            {partner}: {partnerPoints}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-cocoa-400">Each partner can add up to {status.dailyCap} learning points a day. Learning on the same day adds a co-op bonus.</p>
      </div>
      <div className="flex items-center gap-3">
        <TierBadge tier={status.tier} size={44} showLabel />
      </div>
      {status.nextTierAt ? (
        <div>
          <ProgressBar value={status.legendPoints - status.tierFloor} max={status.nextTierAt - status.tierFloor} tone="gold" label="Tier progress" />
          <p className="mt-1 text-xs text-cocoa-400">
            {(status.nextTierAt - status.legendPoints).toLocaleString()} legend points to {nextTier.name} · {nextTier.reward}
          </p>
        </div>
      ) : (
        <p className="text-xs font-bold text-plum-500">Highest tier reached: {tier.name}</p>
      )}
      <div className="border-t border-lavender-100 pt-3">
        {status.isPublic ? (
          <Button variant="ghost" size="sm" onClick={() => setVisibility.mutate(false)} loading={setVisibility.isPending}>
            <EyeOff size={14} /> Hide us from the leaderboard
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-plum-500">
              Your couple is private. Join to appear on the leaderboard — only your names, characters, tier, score and badges are shown. Messages, answers and memories stay private.
            </p>
            <Button onClick={() => setVisibility.mutate(true)} loading={setVisibility.isPending}>
              <Eye size={16} /> Join Love Legends
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
