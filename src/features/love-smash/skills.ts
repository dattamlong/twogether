import { TICK_RATE } from "./court";

export type SkillId = "lightning_dash" | "frost_drop" | "phoenix_drive" | "sakura_meteor";
export type SkillCategory = "movement" | "special" | "ultimate";
export type UnlockId = SkillId | "love_sync";

export type SkillDef = {
  id: SkillId;
  name: string;
  icon: string;
  category: SkillCategory;
  description: string;
  cost: number;
  cooldown: number;
};

const seconds = (s: number) => Math.round(s * TICK_RATE);

export const SKILL_BALANCE = {
  maxEnergy: 100,
  gain: { hit: 3, good: 5, perfect: 8, save: 10, teamwork: 8, counter: 12 },
  rallyGainCap: 30,
  dash: { ticks: 12, speed: 11.5 },
  frostDrop: { depth: 1.05 },
  phoenixDrive: { depth: 5.3, lateDip: -0.06 },
  meteor: { minHeight: 2.0, speedBonus: 9 },
  sync: { cost: 100, cooldown: seconds(35), window: seconds(6), speedBonus: 4, perCombo: 34, perHandoff: 4 },
  counterWindow: seconds(0.6),
};

export const SKILLS: Record<SkillId, SkillDef> = {
  lightning_dash: { id: "lightning_dash", name: "Lightning Dash", icon: "⚡", category: "movement", description: "A short burst of speed in your movement direction to reach far shuttles.", cost: 20, cooldown: seconds(6) },
  frost_drop: { id: "frost_drop", name: "Frost Drop", icon: "❄️", category: "special", description: "A precise drop that dies right behind the net. Needs a clean contact.", cost: 25, cooldown: seconds(8) },
  phoenix_drive: { id: "phoenix_drive", name: "Phoenix Drive", icon: "🔥", category: "special", description: "A fast, flat attacking drive. Late contact can clip the net.", cost: 30, cooldown: seconds(10) },
  sakura_meteor: { id: "sakura_meteor", name: "Sakura Meteor", icon: "🌸", category: "ultimate", description: "A spectacular jump smash from high contact. Still returnable with good defence.", cost: 80, cooldown: seconds(25) },
};

export const TEAM_SYNC = { id: "love_sync" as const, name: "Love Sync", friendName: "Duo Sync", icon: "💗", description: "Earned through teamwork. Your team's next attacking shot is faster and perfectly placed." };

export type Loadout = { movement: SkillId | null; special: SkillId | null; ultimate: SkillId | null };

export const FULL_LOADOUT: Loadout = { movement: "lightning_dash", special: "frost_drop", ultimate: "sakura_meteor" };
export const EMPTY_LOADOUT: Loadout = { movement: null, special: null, ultimate: null };

export const UNLOCKS: Record<UnlockId, { label: string; check: (s: UnlockStats) => boolean }> = {
  lightning_dash: { label: "Play your first match or finish the tutorial", check: (s) => s.tutorialDone || s.matches >= 1 },
  frost_drop: { label: "Play 20 drop shots", check: (s) => s.dropShots >= 20 },
  phoenix_drive: { label: "Win 10 matches", check: (s) => s.wins >= 10 },
  sakura_meteor: { label: "Reach Love Smash level 10", check: (s) => smashLevel(s) >= 10 },
  love_sync: { label: "Finish 5 doubles matches", check: (s) => s.doublesMatches >= 5 },
};

export type UnlockStats = { matches: number; wins: number; dropShots: number; doublesMatches: number; tutorialDone: boolean };

export function smashLevel(s: Pick<UnlockStats, "matches" | "wins">) {
  return 1 + Math.floor((s.matches + s.wins * 2) / 3);
}

export function unlockedSkills(s: UnlockStats) {
  return (Object.keys(UNLOCKS) as UnlockId[]).filter((id) => UNLOCKS[id].check(s));
}

export function sanitizeLoadout(raw: unknown, unlocked: UnlockId[]): Loadout {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Loadout, unknown>>;
  const pick = (slot: keyof Loadout, category: SkillCategory): SkillId | null => {
    const id = value[slot];
    if (typeof id !== "string" || !(id in SKILLS)) return null;
    const def = SKILLS[id as SkillId];
    return def.category === category && unlocked.includes(def.id) ? def.id : null;
  };
  return { movement: pick("movement", "movement"), special: pick("special", "special"), ultimate: pick("ultimate", "ultimate") };
}
