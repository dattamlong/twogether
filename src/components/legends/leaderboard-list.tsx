"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { motion } from "motion/react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { HeartIcon } from "@/components/ui/icons";
import type { LeaderboardRow } from "@/features/legends/queries";
import { readAvatar } from "@/features/session/types";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { TierBadge } from "./legend-art";

export function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs font-bold text-cocoa-400" aria-label="New this week">NEW</span>;
  if (value === 0) return <Minus size={16} className="text-cocoa-400" aria-label="No change" />;
  return value > 0 ? (
    <span className="flex items-center text-xs font-bold text-mint-600" aria-label={`Up ${value}`}>
      <ArrowUp size={14} />
      {value}
    </span>
  ) : (
    <span className="flex items-center text-xs font-bold text-rose-err" aria-label={`Down ${-value}`}>
      <ArrowDown size={14} />
      {-value}
    </span>
  );
}

export function CoupleAvatars({ row, size = 36 }: { row: Pick<LeaderboardRow, "members">; size?: number }) {
  const [a, b] = row.members;
  return (
    <span className="flex shrink-0 items-center">
      <AvatarFace avatar={readAvatar(a?.avatar)} size={size} />
      <AvatarFace avatar={readAvatar(b?.avatar)} size={size} className="-ml-3 ring-2 ring-white rounded-full" />
    </span>
  );
}

export function LeaderboardList({ rows, unit, onSelect, showMovement }: { rows: LeaderboardRow[]; unit: string; onSelect: (id: string) => void; showMovement: boolean }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Ranks 4 and below">
      {rows.map((row, i) => (
        <motion.li key={row.couple_id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
          <button
            onClick={() => onSelect(row.couple_id)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-3xl px-3 py-2.5 text-left ring-2 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]",
              row.is_me ? "bg-gradient-to-r from-sakura-100 to-lavender-100 ring-sakura-300" : i % 2 ? "bg-white/70 ring-white" : "bg-cream-50/90 ring-white",
            )}
          >
            <span className="w-9 shrink-0 text-center font-display text-lg font-bold text-plum-500 tabular-nums">#{row.rank}</span>
            <CoupleAvatars row={row} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate font-display font-semibold text-plum-700">
                <span className="truncate">{row.members[0]?.name}</span>
                <HeartIcon size={14} className="shrink-0" />
                <span className="truncate">{row.members[1]?.name}</span>
                {row.is_me ? <span className="ml-1 shrink-0 rounded-full bg-sakura-400 px-1.5 py-0.5 text-[10px] font-bold text-white">YOU</span> : null}
              </span>
              <span className="block truncate text-xs text-cocoa-400">{row.couple_name}</span>
            </span>
            <TierBadge tier={row.tier} size={26} className="hidden sm:inline-flex" />
            <span className="w-16 shrink-0 text-right sm:w-24">
              <AnimatedNumber value={row.score} className="block font-display font-bold text-plum-700 tabular-nums" />
              <span className="block text-[10px] font-semibold uppercase text-cocoa-400">{unit}</span>
            </span>
            {showMovement ? (
              <span className="flex w-8 shrink-0 justify-center">
                <Movement value={row.movement} />
              </span>
            ) : null}
          </button>
        </motion.li>
      ))}
    </ol>
  );
}
