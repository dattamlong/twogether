"use client";

import { Clock } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { HeartIcon, TrophyIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock, Skeleton } from "@/components/ui/states";
import { useLeaderboard, useLegendStatus } from "@/features/legends/queries";
import { BOARDS, formatCountdown, type BoardId } from "@/features/legends/tiers";
import { useRequiredSession } from "@/features/session/use-session";
import { cn } from "@/lib/utils";
import { CoupleProfileModal } from "./couple-profile-modal";
import { LeaderboardList } from "./leaderboard-list";
import { MyRankCard } from "./my-rank-card";
import { Podium } from "./podium";

function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return target ? formatCountdown(Date.parse(target) - now) : "…";
}

export function LegendsPage() {
  const session = useRequiredSession();
  const [board, setBoard] = useState<BoardId>("weekly");
  const status = useLegendStatus();
  const leaderboard = useLeaderboard(board);
  const [selected, setSelected] = useState<string | null>(null);
  const countdown = useCountdown(status.data?.weekEndsAt);
  const active = BOARDS.find((b) => b.id === board)!;
  const rows = leaderboard.data ?? [];
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const season = status.data?.season;

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-0">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-gold-500">
            <TrophyIcon size={20} /> Love Legends
          </p>
          <h1 className="bg-gradient-to-r from-[#d9a440] via-sakura-400 to-lavender-400 bg-clip-text text-4xl font-bold text-transparent">Love Legends</h1>
          <p className="font-display text-plum-500">The strongest couples grow together.</p>
          <Vi>Học cùng nhau. Cùng nhau tỏa sáng.</Vi>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-2xl bg-white/80 px-4 py-2 ring-2 ring-white sm:items-end">
          <p className="font-display text-sm font-semibold text-plum-700">
            {season ? `Season ${String(season.id).padStart(2, "0")} — ${season.name}` : "Off-season"}
          </p>
          <p className="flex items-center gap-1 text-xs font-semibold text-cocoa-400">
            <Clock size={13} /> Weekly ranking ends in {countdown}
          </p>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto rounded-[1.5rem] bg-white/70 p-1.5 ring-2 ring-white" role="tablist" aria-label="Leaderboards">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={board === b.id}
            onClick={() => setBoard(b.id)}
            className={cn("relative shrink-0 rounded-2xl px-3.5 py-2 text-left transition-colors sm:flex-1", board === b.id ? "text-white" : "text-plum-500 hover:bg-white")}
          >
            {board === b.id ? <motion.span layoutId="legend-tab" className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sakura-400 to-lavender-400 shadow-[var(--shadow-pop)]" transition={{ type: "spring", bounce: 0.25, duration: 0.45 }} /> : null}
            <span className="relative block font-display text-sm font-semibold">{b.label}</span>
            <span lang="vi" className={cn("relative block text-[11px]", board === b.id ? "text-white/85" : "text-cocoa-400")}>
              {b.vi}
            </span>
          </button>
        ))}
      </div>
      <p className="-mt-2 px-2 text-xs text-cocoa-400">{active.hint}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {leaderboard.isLoading ? <Skeleton className="h-80 rounded-[2rem]" /> : null}
          {leaderboard.error ? <ErrorBlock error={leaderboard.error} onRetry={() => leaderboard.refetch()} /> : null}
          {leaderboard.data ? <Podium rows={top} animationKey={board} onSelect={setSelected} /> : null}

          {leaderboard.data && rows.length < 3 ? (
            <Panel className="flex flex-col items-center gap-1 text-center">
              <HeartIcon size={40} className="animate-float" />
              <p className="font-display text-lg font-semibold">{rows.length === 0 ? "Your love story is just beginning." : "More couples will join the adventure soon."}</p>
              <Vi>{rows.length === 0 ? "Hãy là cặp đôi đầu tiên trở thành huyền thoại!" : "Sẽ có thêm nhiều cặp đôi tham gia."}</Vi>
              <p className="mt-1 max-w-md text-sm text-plum-500">
                Every real couple appears here as soon as they earn points — empty podiums are waiting. Finish a lesson together to claim your spot.
              </p>
            </Panel>
          ) : null}

          {rest.length ? (
            <Panel className="p-3 sm:p-4">
              <LeaderboardList rows={rest} unit={active.unit} onSelect={setSelected} showMovement={board === "weekly"} />
            </Panel>
          ) : null}

          <Panel className="grid gap-2 text-sm text-plum-500 sm:grid-cols-2">
            <div>
              <p className="font-display font-semibold text-plum-700">How the weekly score works</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>XP from lessons, mini-games and Daily Quests (server-verified)</li>
                <li>Couple Quests add their couple XP</li>
                <li>+30 co-op bonus each day you both learn</li>
                <li>Up to 400 learning points per partner per day — no grinding needed</li>
                <li>Shop purchases never count</li>
              </ul>
            </div>
            <div>
              <p className="font-display font-semibold text-plum-700">Weekly rewards (Mon 00:00 UTC)</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>#1 — 500 coins each, Legendary Crown & Golden Aura, Love Trophy</li>
                <li>#2 — 300 coins each, Diamond Aura & badge</li>
                <li>#3 — 200 coins each, Burning Hearts Aura & badge</li>
                <li>#4–#10 — 100 coins each, Top Couple badge</li>
              </ul>
            </div>
          </Panel>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{status.data ? <MyRankCard status={status.data} session={session} /> : status.isLoading ? <LoadingBlock /> : null}</div>
        </aside>
      </div>

      {status.data ? (
        <div className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+4.75rem)] z-30 md:bottom-4 md:left-32 lg:hidden">
          <MyRankCard status={status.data} session={session} compact />
        </div>
      ) : null}

      <CoupleProfileModal coupleId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
