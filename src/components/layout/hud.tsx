"use client";

import Link from "next/link";
import { AvatarFace } from "@/components/couple/avatar-face";
import { CoinIcon, EnergyIcon, FlameIcon, StarIcon } from "@/components/ui/icons";
import { NotificationBell } from "@/components/notifications/notification-center";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useProgress } from "@/features/progression/queries";
import { effectiveStreak } from "@/features/progression/streak";
import { levelProgress } from "@/features/progression/xp";
import { useCoupleRealtime } from "@/features/realtime/couple-channel";
import { readAvatar, type SessionData } from "@/features/session/types";
import { cn } from "@/lib/utils";

export function todayIn(timezone: string) {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

export function Hud({ session }: { session: SessionData }) {
  const { data } = useProgress();
  const partnerPresence = useCoupleRealtime((s) => s.partnerPresence);
  const status = useCoupleRealtime((s) => s.status);
  const xp = levelProgress(data?.mine.xp ?? 0);
  const today = todayIn(session.profile.timezone);
  const streak = data?.myStreak
    ? effectiveStreak({ current: data.myStreak.current, longest: data.myStreak.longest, lastActiveDate: data.myStreak.last_active_date, freezes: data.myStreak.freezes }, today)
    : { days: 0, status: "none" as const };

  return (
    <header className="sticky top-0 z-30 px-3 pt-[calc(var(--safe-top)+0.5rem)] md:pl-32">
      <div className="mx-auto flex max-w-6xl items-center gap-2 rounded-[1.75rem] bg-white/85 p-2 pr-3 shadow-[var(--shadow-soft)] ring-2 ring-white backdrop-blur sm:gap-3">
        <Link href="/profile" className="flex min-w-0 items-center gap-2 rounded-2xl pr-1 hover:bg-sakura-50" aria-label="Profile and settings">
          <AvatarFace avatar={readAvatar(session.profile.avatar)} size={42} />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-display text-sm font-semibold leading-tight">{session.profile.display_name}</p>
            <p className="text-xs text-cocoa-400">{session.couple?.name ?? "Our Little Home"}</p>
          </div>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2" title={`${xp.xpIntoLevel} / ${xp.xpForNextLevel} XP`}>
          <div className="relative grid place-items-center">
            <StarIcon size={34} />
            <span className="absolute font-display text-[11px] font-bold text-plum-700">{xp.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <ProgressBar value={xp.xpIntoLevel} max={xp.xpForNextLevel} tone="lavender" label={`Level ${xp.level} progress`} />
            <p className="mt-0.5 hidden text-[11px] font-semibold text-cocoa-400 sm:block">
              {xp.xpIntoLevel} / {xp.xpForNextLevel} XP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-2xl bg-gold-200/60 px-2 py-1" aria-label={`${data?.mine.coins ?? 0} Love Coins`}>
          <CoinIcon size={24} />
          <span className="font-display text-sm font-bold tabular-nums">{data?.mine.coins ?? "–"}</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-2xl bg-peach-100 px-2 py-1" aria-label={`${streak.days} day streak`} title={streak.status === "protected" ? "Streak protected by a freeze" : undefined}>
          <FlameIcon size={24} lit={streak.status === "done_today"} className={cn(streak.status === "done_today" && "animate-flicker")} />
          <span className="font-display text-sm font-bold tabular-nums">{streak.days}</span>
        </div>
        <div className="hidden items-center gap-1 rounded-2xl bg-mint-100 px-2 py-1 sm:flex" aria-label={`${data?.couple?.love_energy ?? 0} Love Energy`}>
          <EnergyIcon size={24} />
          <span className="font-display text-sm font-bold tabular-nums">{data?.couple?.love_energy ?? 0}</span>
        </div>

        {session.partner ? (
          <div className="relative hidden lg:block" title={partnerPresence ? `${session.partner.display_name} is here` : `${session.partner.display_name} is resting`}>
            <AvatarFace avatar={readAvatar(session.partner.avatar)} size={38} sleeping={!partnerPresence} className={cn(!partnerPresence && "opacity-70")} />
            <span className={cn("absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-white", partnerPresence ? (partnerPresence.away ? "bg-gold-300" : "bg-mint-400") : "bg-lavender-200")} />
          </div>
        ) : null}
        <NotificationBell />
        {status === "reconnecting" || status === "offline" ? (
          <span role="status" className="rounded-xl bg-sky-100 px-2 py-1 text-[11px] font-bold text-plum-500">
            {status === "offline" ? "Offline" : "Reconnecting…"}
          </span>
        ) : null}
      </div>
    </header>
  );
}
