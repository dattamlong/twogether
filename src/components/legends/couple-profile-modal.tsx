"use client";

import { AvatarFace } from "@/components/couple/avatar-face";
import { FlameIcon, HeartIcon, HouseIcon, TrophyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { useCoupleLegendProfile } from "@/features/legends/queries";
import { readAvatar } from "@/features/session/types";
import { Crown, TierBadge } from "./legend-art";

export function CoupleProfileModal({ coupleId, onClose }: { coupleId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useCoupleLegendProfile(coupleId);
  const [a, b] = data?.members ?? [];

  return (
    <Modal open={Boolean(coupleId)} onOpenChange={(open) => !open && onClose()} title={data ? `${a?.name} & ${b?.name}` : "Couple"} subtitle={data?.name}>
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} /> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-1 rounded-3xl bg-gradient-to-b from-lavender-100 to-sakura-50 p-5">
            <AvatarFace avatar={readAvatar(a?.avatar)} size={80} />
            <HeartIcon size={26} />
            <AvatarFace avatar={readAvatar(b?.avatar)} size={80} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-2xl bg-white/80 p-2">
              <TierBadge tier={data.tier} size={30} />
              <p className="text-[11px] font-bold text-cocoa-400">Tier</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="font-display text-xl font-bold">{data.weeklyScore.toLocaleString()}</p>
              <p className="text-[11px] font-bold text-cocoa-400">This week</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
                <FlameIcon size={18} />
                {data.coupleStreakBest}
              </p>
              <p className="text-[11px] font-bold text-cocoa-400">Best couple streak</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
                <HouseIcon size={18} />
                {data.homeLevel}
              </p>
              <p className="text-[11px] font-bold text-cocoa-400">Home level</p>
            </div>
          </div>
          {data.trophies.length ? (
            <div>
              <p className="mb-2 font-display font-semibold">Trophies</p>
              <ul className="flex flex-wrap gap-2">
                {data.trophies.map((t) => (
                  <li key={t.week} className="flex items-center gap-1.5 rounded-2xl bg-gold-200/60 px-3 py-1.5 text-xs font-bold">
                    <Crown variant={t.rank === 1 ? "gold" : t.rank === 2 ? "silver" : "bronze"} size={22} />#{t.rank} · week of {new Date(`${t.week}T12:00:00Z`).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-display font-semibold">
              <TrophyIcon size={20} /> Achievements
            </p>
            {data.achievements.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {data.achievements.map((ach) => (
                  <li key={ach.id} className="rounded-xl bg-white/80 px-2.5 py-1 text-xs font-semibold" title={ach.title_vi}>
                    {ach.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-cocoa-400">Their story is just beginning.</p>
            )}
          </div>
          <p className="text-[11px] text-cocoa-400">Only public leaderboard information is shown. Messages, answers, memories and mistakes are always private.</p>
        </div>
      ) : null}
    </Modal>
  );
}
