"use client";

import { ChevronDown, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { TrophyIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/panel";
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

const EMPTY = {
  title: "Your legend starts here.",
  body: "Learn together and become the first legendary couple!",
  vi: "Cùng học để trở thành cặp đôi huyền thoại đầu tiên!",
};

export function LegendsPage() {
  const session = useRequiredSession();
  const [board, setBoard] = useState<BoardId>("weekly");
  const status = useLegendStatus();
  const leaderboard = useLeaderboard(board);
  const [selected, setSelected] = useState<string | null>(null);
  const countdown = useCountdown(status.data?.weekEndsAt);
  const active = BOARDS.find((b) => b.id === board)!;
  const rows = leaderboard.data ?? [];
  const season = status.data?.season;

  return (
    <div className="flex flex-col gap-3 pb-24 lg:pb-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <TrophyIcon size={44} className="shrink-0" />
          <div>
            <h1 className="bg-gradient-to-r from-[#d9a440] via-sakura-400 to-lavender-400 bg-clip-text text-3xl font-bold leading-tight text-transparent">Love Legends</h1>
            <p className="text-sm text-plum-500">
              Learn together. Rise together. <span lang="vi" className="text-cocoa-400">· Học cùng nhau, cùng nhau tỏa sáng</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex rounded-full bg-white/80 p-1 ring-2 ring-white" role="tablist" aria-label="Leaderboards">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                role="tab"
                aria-selected={board === b.id}
                onClick={() => setBoard(b.id)}
                className={cn("relative rounded-full px-4 py-1.5 font-display text-sm font-semibold transition-colors", board === b.id ? "text-white" : "text-plum-500 hover:text-plum-700")}
              >
                {board === b.id ? (
                  <motion.span layoutId="legend-tab" className="absolute inset-0 rounded-full bg-gradient-to-r from-sakura-400 to-lavender-400 shadow-[var(--shadow-pop)]" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} />
                ) : null}
                <span className="relative">
                  {b.id === "weekly" ? "Weekly Legends" : "All-Time Legends"}
                  <span lang="vi" className={cn("ml-1 hidden text-[11px] font-normal sm:inline", board === b.id ? "text-white/80" : "text-cocoa-400")}>
                    {b.vi}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-plum-500 ring-2 ring-white">
            <Clock size={13} />
            {board === "weekly" ? `Ends in ${countdown}` : season ? `Season ${String(season.id).padStart(2, "0")} · ${season.name}` : "All seasons"}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="px-1 text-xs text-cocoa-400">{active.hint}</p>
          {leaderboard.isLoading ? <Skeleton className="h-72 rounded-[2rem]" /> : null}
          {leaderboard.error ? <ErrorBlock error={leaderboard.error} onRetry={() => leaderboard.refetch()} /> : null}
          {leaderboard.data ? <Podium rows={rows.slice(0, 3)} animationKey={board} onSelect={setSelected} emptyMessage={rows.length === 0 ? EMPTY : null} /> : null}

          {rows.length > 3 ? (
            <Panel className="p-2.5 sm:p-3">
              <LeaderboardList rows={rows.slice(3)} unit={active.unit} onSelect={setSelected} showMovement={board === "weekly"} />
            </Panel>
          ) : null}

          <details className="group rounded-3xl bg-white/70 px-4 py-3 text-sm text-plum-500 ring-2 ring-white">
            <summary className="flex cursor-pointer list-none items-center justify-between font-display font-semibold text-plum-700">
              How scores, tiers & rewards work
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="font-semibold text-plum-700">Leaderboard position vs. rank tier</p>
                <p>Your <b>position</b> compares you with other couples and the weekly board resets every Monday. Your <b>tier</b> (Bronze → Eternal Legends) is permanent progress from every point you earn and never resets.</p>
                <p className="mt-2 font-semibold text-plum-700">Points</p>
                <ul className="list-disc pl-4">
                  <li>XP from lessons, mini-games and Daily Quests (server-verified)</li>
                  <li>Couple Quests, plus +30 each day you both learn</li>
                  <li>Max 400 learning points per partner per day · purchases never count</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-plum-700">Weekly rewards (Mon 00:00 UTC)</p>
                <ul className="list-disc pl-4">
                  <li>#1 — 500 coins each, Legendary Crown & Golden Aura, Love Trophy</li>
                  <li>#2 — 300 coins each, Diamond Aura & badge</li>
                  <li>#3 — 200 coins each, Burning Hearts Aura & badge</li>
                  <li>#4–#10 — 100 coins each, Top Couple badge</li>
                  <li>Perfect Partners badge when both of you earn ≥40% of the week&apos;s points</li>
                </ul>
              </div>
            </div>
          </details>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{status.data ? <MyRankCard status={status.data} session={session} /> : status.isLoading ? <LoadingBlock /> : null}</div>
        </aside>
      </div>

      {status.data ? (
        <div className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+4.6rem)] z-30 md:bottom-4 md:left-32 md:right-4 lg:hidden">
          <MyRankCard status={status.data} session={session} compact />
        </div>
      ) : null}

      <CoupleProfileModal coupleId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
