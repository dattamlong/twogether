"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { saveLoadout, useLoveSmashProgress } from "@/features/love-smash/queries";
import { qk } from "@/features/query-keys";
import { SKILLS, TEAM_SYNC, UNLOCKS, type Loadout, type SkillCategory, type SkillId } from "@/features/love-smash/skills";
import { cn } from "@/lib/utils";

const CATEGORY: Record<SkillCategory, { label: string; slot: keyof Loadout; key: string }> = {
  movement: { label: "Movement", slot: "movement", key: "Q" },
  special: { label: "Special shot", slot: "special", key: "E" },
  ultimate: { label: "Ultimate", slot: "ultimate", key: "R" },
};

export function SkillsPanel({ userId }: { userId: string | undefined }) {
  const progress = useLoveSmashProgress(userId);
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const data = progress.data;
  if (!data) return null;
  const equip = async (id: SkillId | null, category: SkillCategory) => {
    setBusy(id ?? category);
    try {
      await saveLoadout({ ...data.loadout, [CATEGORY[category].slot]: id });
      await client.invalidateQueries({ queryKey: qk.loveSmashStats });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Panel data-testid="skills-panel">
      <PanelTitle title={`Skills · Love Smash level ${data.level}`} subtitle={<Vi>Kỹ năng — chọn 1 di chuyển, 1 cú đánh đặc biệt, 1 tuyệt chiêu</Vi>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.values(SKILLS) as (typeof SKILLS)[SkillId][]).map((skill) => {
          const unlocked = data.unlocked.includes(skill.id);
          const equipped = data.loadout[CATEGORY[skill.category].slot] === skill.id;
          return (
            <article key={skill.id} className={cn("flex flex-col gap-1 rounded-3xl p-4 ring-2", equipped ? "bg-sakura-50 ring-sakura-300" : "bg-white/70 ring-white", !unlocked && "opacity-75")} data-testid={`skill-card-${skill.id}`} data-equipped={equipped} data-unlocked={unlocked}>
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden>
                  {skill.icon}
                </span>
                <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-[0.65rem] font-semibold text-plum-500">
                  {CATEGORY[skill.category].label} · {CATEGORY[skill.category].key}
                </span>
              </div>
              <p className="font-display font-semibold text-plum-700">{skill.name}</p>
              <p className="text-xs text-plum-500">{skill.description}</p>
              <p className="text-xs font-semibold text-cocoa-400">
                ⚡ {skill.cost} energy · ⏱ {Math.round(skill.cooldown / 60)}s cooldown
              </p>
              {unlocked ? (
                <Button size="sm" variant={equipped ? "soft" : "primary"} className="mt-auto" loading={busy === skill.id} onClick={() => void equip(equipped ? null : skill.id, skill.category)} data-testid={`equip-${skill.id}`}>
                  {equipped ? (
                    <>
                      <Check size={14} /> Equipped
                    </>
                  ) : (
                    "Equip"
                  )}
                </Button>
              ) : (
                <p className="mt-auto flex items-center gap-1 text-xs font-semibold text-cocoa-400">
                  <Lock size={12} /> {UNLOCKS[skill.id].label}
                </p>
              )}
            </article>
          );
        })}
        <article className={cn("flex flex-col gap-1 rounded-3xl bg-gradient-to-br from-sakura-50 to-lavender-100 p-4 ring-2 ring-white", !data.unlocked.includes("love_sync") && "opacity-75")} data-testid="skill-card-love_sync">
          <div className="flex items-center justify-between">
            <span className="text-2xl" aria-hidden>
              {TEAM_SYNC.icon}
            </span>
            <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-[0.65rem] font-semibold text-plum-500">Team · F</span>
          </div>
          <p className="font-display font-semibold text-plum-700">{TEAM_SYNC.name} / ✨ {TEAM_SYNC.friendName}</p>
          <p className="text-xs text-plum-500">{TEAM_SYNC.description} Same power for couples and friends.</p>
          <p className="text-xs font-semibold text-cocoa-400">Team meter fills only from teamwork · 35s cooldown</p>
          <p className="mt-auto flex items-center gap-1 text-xs font-semibold text-cocoa-400">{data.unlocked.includes("love_sync") ? "✅ Unlocked for doubles" : <><Lock size={12} /> {UNLOCKS.love_sync.label}</>}</p>
        </article>
      </div>
      <p className="mt-3 text-xs text-cocoa-400">Energy (0–100) comes from real hits: +3 normal, +5 good, +8 perfect, +10 for a diving save, +12 for a Perfect Counter, max 30 per rally. Skills never guarantee a point. Unlocks come only from verified matches — nothing is for sale.</p>
    </Panel>
  );
}
