"use client";

import { HeartIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { LegendStatus } from "@/features/legends/queries";
import { tierById } from "@/features/legends/tiers";
import type { SessionData } from "@/features/session/types";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { TierBadge } from "./legend-art";
import { Movement } from "./leaderboard-list";

function tierProgress(status: LegendStatus) {
  if (!status.nextTierAt) return { value: 1, max: 1, label: "Highest tier reached" };
  const next = tierById(status.tier + 1);
  return {
    value: status.legendPoints - status.tierFloor,
    max: status.nextTierAt - status.tierFloor,
    label: `${(status.nextTierAt - status.legendPoints).toLocaleString()} pts to ${next.name}`,
  };
}

export function MyRankCard({ status, session, compact = false }: { status: LegendStatus; session: SessionData; compact?: boolean }) {
  const tier = tierById(status.tier);
  const me = session.profile.display_name;
  const partner = session.partner?.display_name ?? "Partner";
  const myPoints = status.memberPoints?.[session.userId] ?? 0;
  const partnerPoints = session.partner ? (status.memberPoints?.[session.partner.id] ?? 0) : 0;
  const rankLabel = status.rank ? `#${status.rank}` : "Unranked";
  const progress = tierProgress(status);

  if (compact) {
    return (
      <div className="rounded-[1.25rem] bg-white/95 px-3 py-2 shadow-[var(--shadow-soft)] ring-2 ring-white backdrop-blur">
        <div className="flex items-center gap-2.5">
          <TierBadge tier={status.tier} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-plum-700">
              {me} & {partner}
            </span>
            <span className="block truncate text-[11px] text-cocoa-400">
              {tier.name} · {progress.label}
            </span>
          </span>
          <span className="text-right">
            <span className={cn("block font-display font-bold leading-tight text-plum-700", status.rank ? "text-lg" : "text-xs")}>{rankLabel}</span>
            <span className="block text-[11px] font-semibold tabular-nums text-cocoa-400">{status.score.toLocaleString()} pts</span>
          </span>
        </div>
        <ProgressBar value={progress.value} max={progress.max} tone="gold" label="Tier progress" className="mt-1.5 h-1.5" />
      </div>
    );
  }

  return (
    <section aria-label="Your couple" className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <HeartIcon size={20} className="shrink-0" />
        <p className="min-w-0 truncate font-display text-lg font-semibold text-plum-700">
          {me} & {partner}
        </p>
      </div>

      <TierBadge tier={status.tier} size={38} showLabel />

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-lavender-100/70 px-3 py-2">
          <dt className="text-[11px] font-bold text-cocoa-400">Weekly rank</dt>
          <dd className="flex items-center gap-1.5">
            <span className={cn("font-display font-bold text-plum-700", status.rank ? "text-2xl" : "text-base leading-8")}>{rankLabel}</span>
            {status.rank && status.movement !== null ? <Movement value={status.movement} /> : null}
          </dd>
        </div>
        <div className="rounded-2xl bg-sakura-100/70 px-3 py-2">
          <dt className="text-[11px] font-bold text-cocoa-400">Weekly score</dt>
          <dd>
            <AnimatedNumber value={status.score} className="font-display text-2xl font-bold tabular-nums text-plum-700" />
          </dd>
        </div>
      </dl>

      <p className="-mt-1 text-xs text-plum-500">
        {status.rank === 1
          ? "You are the #1 couple this week!"
          : status.pointsToNext
            ? `${status.pointsToNext.toLocaleString()} pts to reach #${(status.rank ?? 2) - 1}`
            : "Finish a lesson together to enter this week's ranking."}
      </p>

      <div>
        <ProgressBar value={progress.value} max={progress.max} tone="gold" label="Tier progress" />
        <p className="mt-1 flex justify-between gap-2 text-[11px] text-cocoa-400">
          <span>{progress.label}</span>
          <span className="tabular-nums">{status.legendPoints.toLocaleString()} total</span>
        </p>
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-lavender-100 pt-2 text-[11px] text-cocoa-400">
        <span>
          This week: <b className="text-plum-500">{me}</b> {myPoints} · <b className="text-plum-500">{partner}</b> {partnerPoints}
        </span>
        <span>Max {status.dailyCap} learning pts/person/day</span>
      </p>
    </section>
  );
}
