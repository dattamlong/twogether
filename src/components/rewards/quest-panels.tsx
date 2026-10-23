"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CoinIcon, EnergyIcon, HeartIcon, SparkleIcon, StarIcon } from "@/components/ui/icons";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { useClaimQuest, useCoupleQuests, useDailyQuests } from "@/features/progression/queries";
import { useSession } from "@/features/session/use-session";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function DailyQuestPanel({ className }: { className?: string }) {
  const { data, isLoading, error, refetch } = useDailyQuests();
  const claim = useClaimQuest();
  const done = data?.filter((q) => q.claimed).length ?? 0;

  return (
    <Panel className={className}>
      <PanelTitle
        icon={<SparkleIcon size={32} />}
        title={t("quests.daily")}
        subtitle={`${t("quests.daily", "vi")} · ${done}/${data?.length ?? 4}`}
      />
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}
      <ul className="flex flex-col gap-2.5">
        {data?.map((q) => (
          <motion.li
            key={q.id}
            layout
            className={cn("flex items-center gap-3 rounded-2xl p-3 ring-2", q.claimed ? "bg-mint-100/70 ring-mint-200" : q.completed ? "bg-gold-200/50 ring-gold-300" : "bg-white/70 ring-white")}
          >
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold leading-tight">{q.title}</p>
              <p lang="vi" className="text-xs text-cocoa-400">{q.title_vi}</p>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={q.progress} max={q.target} tone={q.completed ? "mint" : "sakura"} label={`${q.title} progress`} className="h-2" />
                <span className="text-xs font-bold tabular-nums text-cocoa-400">
                  {q.progress}/{q.target}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1 text-xs font-bold text-plum-500">
                <StarIcon size={16} />
                {q.xp_reward}
                <CoinIcon size={16} />
                {q.coin_reward}
              </span>
              {q.claimed ? (
                <span className="flex items-center gap-1 rounded-xl bg-mint-200 px-2.5 py-1 text-xs font-bold text-mint-600">
                  <Check size={14} /> {t("quests.claimed")}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant={q.completed ? "gold" : "soft"}
                  disabled={!q.completed}
                  loading={claim.isPending && claim.variables === q.id}
                  onClick={() => claim.mutate(q.id)}
                >
                  {t("quests.claim")}
                </Button>
              )}
            </div>
          </motion.li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-cocoa-400">New quests every day at midnight in your timezone. Missing a day is okay — rest is part of learning.</p>
    </Panel>
  );
}

export function CoupleQuestPanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data, isLoading, error, refetch } = useCoupleQuests();
  const me = session?.userId ?? "";
  const partnerId = session?.partner?.id ?? "";

  const memberValue = (progress: unknown, id: string) => {
    const raw = (progress as Record<string, unknown>)?.[id];
    return typeof raw === "number" ? raw : 0;
  };
  const memberDay = (progress: unknown, id: string) => {
    const raw = (progress as Record<string, unknown>)?.[id];
    return typeof raw === "string" ? new Date(`${raw}T12:00:00`).toLocaleDateString("en", { weekday: "short" }) : null;
  };

  return (
    <Panel className={className}>
      <PanelTitle icon={<HeartIcon size={32} />} title={t("quests.couple")} subtitle={`${t("quests.couple", "vi")} · resets weekly`} />
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}
      <ul className="flex flex-col gap-2.5">
        {data?.map((q) => {
          const mine = memberValue(q.member_progress, me);
          const theirs = memberValue(q.member_progress, partnerId);
          const myDay = memberDay(q.member_progress, me);
          const theirDay = memberDay(q.member_progress, partnerId);
          const sameDay = q.mode === "same_day";
          const combined = q.mode === "combined";
          return (
            <li key={q.id} className={cn("rounded-2xl p-3 ring-2", q.completed ? "bg-mint-100/70 ring-mint-200" : "bg-white/70 ring-white")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display font-semibold leading-tight">{q.title}</p>
                  <p lang="vi" className="text-xs text-cocoa-400">{q.title_vi}</p>
                  <p className="mt-1 text-sm text-plum-500">{q.description}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-plum-500">
                  <EnergyIcon size={16} />+{q.love_energy}
                </span>
              </div>
              {q.completed ? (
                <p className="mt-2 flex items-center gap-1 text-sm font-bold text-mint-600">
                  <Check size={16} /> Completed together
                </p>
              ) : combined ? (
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={mine + theirs} max={q.target} tone="lavender" label={`${q.title} progress`} className="h-2" />
                  <span className="text-xs font-bold tabular-nums text-cocoa-400">
                    {mine + theirs}/{q.target}
                  </span>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
                  <span className={cn("rounded-xl px-2 py-1 text-center", (sameDay ? myDay : mine >= q.target) ? "bg-mint-200 text-mint-600" : "bg-cream-200 text-cocoa-400")}>
                    You {sameDay ? (myDay ? `studied ${myDay}` : "—") : `${Math.min(mine, q.target)}/${q.target}`}
                  </span>
                  <span className={cn("rounded-xl px-2 py-1 text-center", (sameDay ? theirDay : theirs >= q.target) ? "bg-mint-200 text-mint-600" : "bg-cream-200 text-cocoa-400")}>
                    {session?.partner?.display_name ?? "Partner"} {sameDay ? (theirDay ? `studied ${theirDay}` : "—") : `${Math.min(theirs, q.target)}/${q.target}`}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
