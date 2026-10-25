"use client";

import { useEffect, useRef, useState } from "react";
import { SKILL_BALANCE, SKILLS, type Loadout, type SkillCategory } from "@/features/love-smash/skills";
import type { Player } from "@/features/love-smash/sim";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export type SkillAction = "dash" | "special" | "ultimate" | "sync";

export type SkillView = {
  energy: number;
  loadout: Loadout;
  cooldowns: Record<SkillCategory, number>;
  doubles: boolean;
  teamEnergy: number;
  teamCooldown: number;
  syncActive: boolean;
  syncAllowed: boolean;
  couple: boolean;
};

export function viewOf(p: Player | undefined, extra: Omit<SkillView, "energy" | "loadout" | "cooldowns">): SkillView | null {
  if (!p) return null;
  return { energy: p.energy, loadout: p.loadout, cooldowns: { ...p.cooldowns }, ...extra };
}

const SLOTS: { category: SkillCategory; action: SkillAction; key: string }[] = [
  { category: "movement", action: "dash", key: "Q" },
  { category: "special", action: "special", key: "E" },
  { category: "ultimate", action: "ultimate", key: "R" },
];

export function SkillBar({ read, onPress, touch }: { read: () => SkillView | null; onPress: (action: SkillAction) => void; touch: boolean }) {
  const [view, setView] = useState<SkillView | null>(null);
  const wasReady = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const next = read();
      if (next) {
        const ult = next.loadout.ultimate;
        const ultReady = Boolean(ult && next.energy >= SKILLS[ult].cost && next.cooldowns.ultimate === 0);
        if (ultReady && wasReady.current.ultimate === false) sfx.skillReady();
        wasReady.current.ultimate = ultReady;
      }
      setView(next);
    }, 120);
    return () => clearInterval(timer);
  }, [read]);

  if (!view) return null;
  const hasAny = view.loadout.movement || view.loadout.special || view.loadout.ultimate || (view.doubles && view.syncAllowed);
  return (
    <div className={cn("pointer-events-auto absolute z-20 flex flex-col gap-1.5", touch ? "inset-x-0 bottom-[196px] items-center landscape:bottom-2" : "bottom-4 left-4 items-start")} data-testid="skill-bar">
      <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-[var(--shadow-soft)]" aria-label={`Energy ${Math.round(view.energy)} of 100`}>
        <span className="text-xs font-bold text-plum-700">⚡</span>
        <div className="h-2.5 w-28 overflow-hidden rounded-full bg-lavender-100 sm:w-36">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-lavender-300 to-sakura-400 transition-[width] duration-150" style={{ width: `${view.energy}%` }} data-testid="energy-fill" data-energy={Math.round(view.energy)} />
        </div>
        <span className="w-7 text-right font-display text-xs font-bold tabular-nums text-plum-700">{Math.round(view.energy)}</span>
      </div>
      {hasAny ? (
        <div className="flex gap-1.5">
          {SLOTS.map(({ category, action, key }) => {
            const id = view.loadout[category];
            if (!id) return null;
            const def = SKILLS[id];
            const cd = view.cooldowns[category];
            const ready = cd === 0 && view.energy >= def.cost;
            return (
              <SkillChip key={category} icon={def.icon} label={def.name} hotkey={touch ? null : key} cost={def.cost} cooldown={cd / def.cooldown} ready={ready} onPress={() => onPress(action)} testId={`skill-${action}`} />
            );
          })}
          {view.doubles && view.syncAllowed ? (
            <SkillChip
              icon={view.couple ? "💗" : "✨"}
              label={view.couple ? "Love Sync" : "Duo Sync"}
              hotkey={touch ? null : "F"}
              cost={SKILL_BALANCE.sync.cost}
              cooldown={view.teamCooldown / SKILL_BALANCE.sync.cooldown}
              ready={view.teamCooldown === 0 && view.teamEnergy >= SKILL_BALANCE.sync.cost && !view.syncActive}
              active={view.syncActive}
              progress={view.teamEnergy / SKILL_BALANCE.sync.cost}
              onPress={() => onPress("sync")}
              testId="skill-sync"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SkillChip({ icon, label, hotkey, cost, cooldown, ready, active, progress, onPress, testId }: { icon: string; label: string; hotkey: string | null; cost: number; cooldown: number; ready: boolean; active?: boolean; progress?: number; onPress: () => void; testId: string }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      aria-label={`${label}${hotkey ? ` (${hotkey})` : ""}, ${ready ? "ready" : cooldown > 0 ? "cooling down" : `needs ${cost} energy`}`}
      aria-disabled={!ready}
      data-testid={testId}
      data-ready={ready}
      className={cn("relative grid size-12 place-items-center overflow-hidden rounded-2xl text-xl shadow-[var(--shadow-soft)] ring-2 transition", ready ? "bg-white ring-gold-300" : "bg-white/70 ring-white grayscale-[60%]", active && "animate-pulse ring-sakura-400")}
    >
      <span aria-hidden>{icon}</span>
      {progress !== undefined && !ready ? <span className="absolute inset-x-0 bottom-0 bg-sakura-200/80" style={{ height: `${Math.min(1, progress) * 100}%` }} aria-hidden /> : null}
      {cooldown > 0 ? <span className="absolute inset-x-0 top-0 bg-plum-900/35" style={{ height: `${cooldown * 100}%` }} aria-hidden /> : null}
      {hotkey ? <span className="absolute bottom-0.5 right-1 font-display text-[0.6rem] font-bold text-plum-500">{hotkey}</span> : null}
      <span className="absolute left-1 top-0.5 font-display text-[0.55rem] font-bold text-cocoa-400">{cost}</span>
    </button>
  );
}
