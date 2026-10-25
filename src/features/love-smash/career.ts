import type { Avatar } from "@/features/session/types";
import type { Style } from "./bot";
import type { MatchConfig } from "./net";
import { createRng, next } from "./rng";
import type { Controller } from "./sim";
import type { Loadout } from "./skills";

export type CareerKind = "solo" | "solo_doubles" | "couple";

export type Character = { id: string; name: string; title?: string; style: Style; avatar: Avatar; rival?: boolean };

const A = (hair: Avatar["hair"], hairColor: string, outfitColor: string, accessory = "none", skin = "#ffe3d3", eyes = "#45365b"): Avatar => ({ hair, hairColor, skin, eyes, outfit: "tee", outfitColor, accessory });

export const CHARACTERS: Record<string, Character> = {
  mochi: { id: "mochi", name: "Mochi", title: "The Sleepy Rookie", style: "sleepy", avatar: A("bun", "#c7b8ea", "#bce5d5"), rival: true },
  sakura: { id: "sakura", name: "Sakura", title: "Mochi's Best Friend", style: "balanced", avatar: A("twintails", "#e7779f", "#fbe3b1", "bow"), rival: true },
  hikari: { id: "hikari", name: "Hikari", title: "The Rising Star", style: "balanced", avatar: A("long", "#f5cb78", "#b8ddf5", "flower_crown") },
  kenta: { id: "kenta", name: "Kenta", title: "Academy Captain", style: "defensive", avatar: A("short", "#2c2140", "#c7b8ea", "none", "#f6d0b8") },
  blaze: { id: "blaze", name: "Blaze", title: "The Fire Striker", style: "striker", avatar: A("spiky", "#e0607e", "#f6a88a", "none", "#f6d0b8") },
  riku: { id: "riku", name: "Riku", title: "Blaze's Spark", style: "aggressive", avatar: A("spiky", "#a8714f", "#ffd6c2") },
  thunder: { id: "thunder", name: "Thunder", title: "Twin Ace of Power", style: "aggressive", avatar: A("spiky", "#f5cb78", "#6fb5e3", "glasses", "#e8b896") },
  storm: { id: "storm", name: "Storm", title: "Twin Ace of Guard", style: "defensive", avatar: A("bob", "#6fb5e3", "#c7b8ea", "none", "#e8b896") },
  shadow: { id: "shadow", name: "Shadow Dragon", title: "The Deceiver", style: "trickster", avatar: A("long", "#2c2140", "#6a5583", "glasses", "#d9a37f", "#e7779f") },
  king: { id: "king", name: "Lightning King", title: "Master of Defence", style: "defensive", avatar: A("short", "#f5cb78", "#fbe3b1", "beanie", "#f6d0b8") },
  emperor: { id: "emperor", name: "Dragon Emperor", title: "The Unstoppable Attacker", style: "aggressive", avatar: A("spiky", "#d45a86", "#45365b", "none", "#e8b896", "#f5cb78") },
  legend: { id: "legend", name: "Lightning Legend", title: "The Endless Defender", style: "defensive", avatar: A("long", "#ffffff", "#a995dc", "flower_crown", "#ffe3d3", "#6fb5e3") },
  kiko: { id: "kiko", name: "Kiko", title: "Your Doubles Partner", style: "balanced", avatar: A("bob", "#8fd3c1", "#f8bbd0", "bow") },
  yuna: { id: "yuna", name: "Yuna", style: "balanced", avatar: A("long", "#a8714f", "#f8bbd0") },
  sora: { id: "sora", name: "Sora", style: "defensive", avatar: A("short", "#6a5583", "#b8ddf5") },
  hana: { id: "hana", name: "Hana", style: "trickster", avatar: A("bun", "#e7779f", "#bce5d5", "bow") },
  taro: { id: "taro", name: "Taro", style: "aggressive", avatar: A("spiky", "#5b4256", "#f5cb78") },
  mei: { id: "mei", name: "Mei", style: "striker", avatar: A("twintails", "#2c2140", "#f39bbb") },
  ren: { id: "ren", name: "Ren", style: "balanced", avatar: A("short", "#a8714f", "#c7b8ea", "glasses") },
  aoi: { id: "aoi", name: "Aoi", style: "defensive", avatar: A("bob", "#6fb5e3", "#fff7ed") },
  kai: { id: "kai", name: "Kai", style: "aggressive", avatar: A("spiky", "#2c2140", "#8fd3c1", "none", "#d9a37f") },
  nami: { id: "nami", name: "Nami", style: "trickster", avatar: A("long", "#8fd3c1", "#fbe3b1") },
  haru: { id: "haru", name: "Haru", style: "sleepy", avatar: A("short", "#f5cb78", "#ffd6c2") },
  rin: { id: "rin", name: "Rin", style: "striker", avatar: A("twintails", "#a995dc", "#b8ddf5", "bow") },
  jun: { id: "jun", name: "Jun", style: "balanced", avatar: A("short", "#5b4256", "#bce5d5", "beanie") },
  emi: { id: "emi", name: "Emi", style: "defensive", avatar: A("bun", "#a8714f", "#c7b8ea") },
  toma: { id: "toma", name: "Toma", style: "striker", avatar: A("spiky", "#6a5583", "#f6a88a") },
  yui: { id: "yui", name: "Yui", style: "trickster", avatar: A("bob", "#2c2140", "#f8bbd0", "glasses") },
  miki: { id: "miki", name: "Miki", style: "balanced", avatar: A("twintails", "#f5cb78", "#bce5d5") },
  shin: { id: "shin", name: "Shin", style: "aggressive", avatar: A("short", "#2c2140", "#f39bbb", "none", "#e8b896") },
  ayaka: { id: "ayaka", name: "Ayaka", style: "defensive", avatar: A("long", "#6a5583", "#fbe3b1") },
  daichi: { id: "daichi", name: "Daichi", style: "striker", avatar: A("spiky", "#a8714f", "#b8ddf5") },
  kana: { id: "kana", name: "Kana", style: "trickster", avatar: A("bun", "#f39bbb", "#c7b8ea") },
  yuto: { id: "yuto", name: "Yuto", style: "balanced", avatar: A("short", "#5b4256", "#ffd6c2", "glasses") },
  noa: { id: "noa", name: "Noa", style: "sleepy", avatar: A("bob", "#c7b8ea", "#f8bbd0") },
  sho: { id: "sho", name: "Sho", style: "aggressive", avatar: A("spiky", "#6fb5e3", "#f5cb78") },
  rina: { id: "rina", name: "Rina", style: "defensive", avatar: A("long", "#e7779f", "#b8ddf5") },
  kei: { id: "kei", name: "Kei", style: "striker", avatar: A("short", "#f5cb78", "#8fd3c1", "beanie") },
};

export type ArenaTheme = "sakura_garden" | "academy_gym" | "city_hall" | "national_arena" | "asia_stadium" | "world_stadium" | "legends_arena";

export type TierDef = {
  tier: number;
  name: string;
  short: string;
  emoji: string;
  subtitle: string;
  arena: ArenaTheme;
  level: number;
  size: 8 | 16;
  boss: { singles: string; doubles: [string, string] };
  rivals?: [string, string];
  trophy: string;
  title: string;
  color: string;
};

export const TIERS: TierDef[] = [
  { tier: 1, name: "Sakura Rookie Cup", short: "Rookie Cup", emoji: "🌸", subtitle: "A beginner festival under the cherry blossoms", arena: "sakura_garden", level: 1, size: 8, boss: { singles: "mochi", doubles: ["mochi", "sakura"] }, trophy: "career_trophy_1", title: "Rookie Champion", color: "#f39bbb" },
  { tier: 2, name: "Academy Championship", short: "Academy", emoji: "🎓", subtitle: "The elite badminton academy's yearly cup", arena: "academy_gym", level: 2, size: 8, boss: { singles: "hikari", doubles: ["hikari", "kenta"] }, rivals: ["mochi", "sakura"], trophy: "career_trophy_2", title: "Academy Champion", color: "#6fb5e3" },
  { tier: 3, name: "City Open", short: "City Open", emoji: "🏙️", subtitle: "Pro players under the arena scoreboard", arena: "city_hall", level: 3, size: 16, boss: { singles: "blaze", doubles: ["blaze", "riku"] }, trophy: "career_trophy_3", title: "City Champion", color: "#f6a88a" },
  { tier: 4, name: "National Championship", short: "Nationals", emoji: "🏅", subtitle: "The best players in the country", arena: "national_arena", level: 4, size: 16, boss: { singles: "thunder", doubles: ["thunder", "storm"] }, rivals: ["mochi", "sakura"], trophy: "career_trophy_4", title: "National Champion", color: "#f5cb78" },
  { tier: 5, name: "Asia Masters", short: "Asia Masters", emoji: "🌏", subtitle: "A prestigious international stage", arena: "asia_stadium", level: 5, size: 16, boss: { singles: "shadow", doubles: ["shadow", "storm"] }, trophy: "career_trophy_5", title: "Asia Master", color: "#8a73c8" },
  { tier: 6, name: "World Grand Prix", short: "Grand Prix", emoji: "🌍", subtitle: "World-class rallies under championship lights", arena: "world_stadium", level: 6, size: 16, boss: { singles: "king", doubles: ["king", "blaze"] }, rivals: ["mochi", "sakura"], trophy: "career_trophy_6", title: "World-Class Player", color: "#3a9474" },
  { tier: 7, name: "Legends Championship", short: "Legends", emoji: "👑", subtitle: "The ultimate anime badminton championship", arena: "legends_arena", level: 7, size: 16, boss: { singles: "emperor", doubles: ["emperor", "legend"] }, trophy: "career_trophy_7", title: "Legendary Champion", color: "#d45a86" },
];

const FIELD = ["yuna", "sora", "hana", "taro", "mei", "ren", "aoi", "kai", "nami", "haru", "rin", "jun", "emi", "toma", "yui", "miki", "shin", "ayaka", "daichi", "kana", "yuto", "noa", "sho", "rina", "kei", "kenta", "riku", "hikari", "storm", "thunder"];

export type Entrant = { key: string; members: string[]; player?: boolean; level: number; story?: "boss" | "rival" };
export type BracketMatch = { a: number; b: number; winner?: number; score?: [number, number] };
export type Bracket = { tier: number; seed: number; entrants: Entrant[]; rounds: BracketMatch[][]; round: number; status: "active" | "champion"; attempts: number };

export type RivalRecord = { met: number; wins: number; losses: number };

export type CareerState = {
  version: number;
  kind: CareerKind;
  unlocked: number;
  champions: number[];
  current: Bracket | null;
  rivals: Record<string, RivalRecord>;
  stats: { matches: number; wins: number; losses: number };
  last?: { won: boolean; score: [number, number]; round: number; tier: number; champion: boolean };
};

export const PLAYER = "player";
export const doublesKind = (kind: CareerKind) => kind !== "solo";

export function roundNames(size: 8 | 16) {
  return size === 16 ? ["Round of 16", "Quarterfinal", "Semifinal", "Grand Final"] : ["Quarterfinal", "Semifinal", "Grand Final"];
}

function shuffle<T>(items: T[], seed: number) {
  const rng = createRng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next(rng) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateBracket(kind: CareerKind, tierNumber: number, seed: number): Bracket {
  const tier = TIERS[tierNumber - 1];
  const doubles = doublesKind(kind);
  const boss: Entrant = { key: doubles ? tier.boss.doubles.join("+") : tier.boss.singles, members: doubles ? tier.boss.doubles : [tier.boss.singles], level: tier.level + 1, story: "boss" };
  const used = new Set<string>(boss.members);
  const rivals: Entrant | null = tier.rivals ? { key: doubles ? tier.rivals.join("+") : tier.rivals[0], members: doubles ? tier.rivals : [tier.rivals[0]], level: tier.level, story: "rival" } : null;
  if (rivals) rivals.members.forEach((m) => used.add(m));
  const pool = shuffle(FIELD.filter((id) => !used.has(id)), seed);
  const fieldCount = tier.size - 2 - (rivals ? 1 : 0);
  const field: Entrant[] = [];
  for (let i = 0; i < fieldCount; i++) {
    const members = doubles ? [pool[(i * 2) % pool.length], pool[(i * 2 + 1) % pool.length]] : [pool[i % pool.length]];
    field.push({ key: members.join("+"), members, level: Math.max(1, tier.level - (i % 3 === 2 ? 1 : 0)) });
  }
  const player: Entrant = { key: PLAYER, members: [PLAYER], player: true, level: tier.level };
  const entrants: Entrant[] = new Array(tier.size);
  entrants[0] = player;
  entrants[tier.size - 1] = boss;
  const free = [...Array(tier.size).keys()].filter((i) => i !== 0 && i !== tier.size - 1);
  if (rivals) {
    const rivalSlot = tier.size === 16 ? 6 : 2;
    entrants[rivalSlot] = rivals;
    free.splice(free.indexOf(rivalSlot), 1);
  }
  free.forEach((slot, i) => {
    entrants[slot] = field[i];
  });
  const first: BracketMatch[] = [];
  for (let i = 0; i < tier.size; i += 2) first.push({ a: i, b: i + 1 });
  return { tier: tierNumber, seed, entrants, rounds: [first], round: 0, status: "active", attempts: 0 };
}

export function playerMatch(b: Bracket) {
  if (b.status !== "active") return null;
  return b.rounds[b.round].find((m) => m.a === 0 || m.b === 0) ?? null;
}

export function currentOpponent(b: Bracket) {
  const m = playerMatch(b);
  if (!m) return null;
  return b.entrants[m.a === 0 ? m.b : m.a];
}

export function entrantName(e: Entrant, playerName = "You") {
  return e.members.map((id) => (id === PLAYER ? playerName : CHARACTERS[id]?.name ?? id)).join(" & ");
}

function strength(e: Entrant) {
  return e.level * 10 + (e.members.includes("emperor") || e.members.includes("legend") ? 6 : 0);
}

export function newCareer(kind: CareerKind, seed: number): CareerState {
  return { version: 1, kind, unlocked: 1, champions: [], current: generateBracket(kind, 1, seed), rivals: {}, stats: { matches: 0, wins: 0, losses: 0 } };
}

export function startTournament(state: CareerState, tier: number, seed: number): CareerState {
  if (tier < 1 || tier > state.unlocked) throw new Error("tier_locked");
  if (state.current && state.current.status === "active" && state.current.tier !== tier && state.current.round > 0) throw new Error("tournament_in_progress");
  return { ...state, version: state.version + 1, current: generateBracket(state.kind, tier, seed) };
}

export type Outcome = { won: boolean; champion: boolean; trophy: string | null; title: string | null; unlockedTier: number | null; roundName: string; nextOpponent: Entrant | null };

export function applyResult(state: CareerState, won: boolean, score: [number, number], seed: number): { state: CareerState; outcome: Outcome } {
  const bracket = state.current;
  if (!bracket || bracket.status !== "active") throw new Error("no_active_tournament");
  const tier = TIERS[bracket.tier - 1];
  const names = roundNames(tier.size);
  const roundName = names[bracket.round];
  const b: Bracket = JSON.parse(JSON.stringify(bracket));
  const mine = b.rounds[b.round].find((m) => m.a === 0 || m.b === 0)!;
  const opponent = b.entrants[mine.a === 0 ? mine.b : mine.a];
  const rivals = { ...state.rivals };
  for (const id of opponent.members) {
    if (!CHARACTERS[id]?.rival) continue;
    const r = rivals[id] ?? { met: 0, wins: 0, losses: 0 };
    rivals[id] = { met: r.met + 1, wins: r.wins + (won ? 1 : 0), losses: r.losses + (won ? 0 : 1) };
  }
  const stats = { matches: state.stats.matches + 1, wins: state.stats.wins + (won ? 1 : 0), losses: state.stats.losses + (won ? 0 : 1) };
  if (!won) {
    b.attempts++;
    return {
      state: { ...state, version: state.version + 1, current: b, rivals, stats, last: { won, score, round: b.round, tier: b.tier, champion: false } },
      outcome: { won, champion: false, trophy: null, title: null, unlockedTier: null, roundName, nextOpponent: opponent },
    };
  }
  mine.winner = 0;
  mine.score = mine.a === 0 ? score : [score[1], score[0]];
  const rng = createRng(seed ^ (b.round * 7919 + 17));
  for (const m of b.rounds[b.round]) {
    if (m.winner !== undefined) continue;
    const sa = strength(b.entrants[m.a]);
    const sb = strength(b.entrants[m.b]);
    const roll = next(rng) < sa / (sa + sb);
    const storyA = b.entrants[m.a].story;
    const storyB = b.entrants[m.b].story;
    const aWins = storyA && !storyB ? true : storyB && !storyA ? false : roll;
    const loser = Math.floor(next(rng) * 6);
    m.winner = aWins ? m.a : m.b;
    m.score = aWins ? [7, loser] : [loser, 7];
  }
  b.attempts = 0;
  let champion = false;
  if (b.round === b.rounds.length - 1 && b.rounds[b.round].length === 1) {
    b.status = "champion";
    champion = true;
  } else {
    const winners = b.rounds[b.round].map((m) => m.winner!);
    const nextRound: BracketMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) nextRound.push({ a: winners[i], b: winners[i + 1] });
    b.rounds.push(nextRound);
    b.round++;
  }
  const champions = champion && !state.champions.includes(b.tier) ? [...state.champions, b.tier] : state.champions;
  const unlocked = champion ? Math.max(state.unlocked, Math.min(TIERS.length, b.tier + 1)) : state.unlocked;
  const firstTitle = champion && !state.champions.includes(b.tier);
  return {
    state: { ...state, version: state.version + 1, current: b, rivals, stats, champions, unlocked, last: { won, score, round: b.round, tier: b.tier, champion } },
    outcome: {
      won,
      champion,
      trophy: firstTitle ? tier.trophy : null,
      title: champion ? tier.title : null,
      unlockedTier: champion && unlocked > state.unlocked ? unlocked : null,
      roundName,
      nextOpponent: champion ? null : currentOpponent(b),
    },
  };
}

export function personaFor(id: string, level: number) {
  return `${CHARACTERS[id]?.style ?? "balanced"}:${level}`;
}

export function careerMatchConfig(state: CareerState, seed: number, loadout: Loadout | null, partnerHuman: boolean): MatchConfig {
  const b = state.current;
  const opponent = b ? currentOpponent(b) : null;
  if (!b || !opponent) throw new Error("no_active_tournament");
  const bot = (id: string, level: number): Controller => ({ kind: "bot", difficulty: "normal", persona: personaFor(id, level) });
  if (!doublesKind(state.kind)) {
    return { seed, format: "singles", difficulty: "normal", controllers: [{ kind: "human" }, bot(opponent.members[0], opponent.level)], loadouts: [loadout, null], cast: [null, opponent.members[0]] };
  }
  const tierLevel = TIERS[b.tier - 1].level;
  return {
    seed,
    format: "doubles",
    difficulty: "normal",
    controllers: [{ kind: "human" }, bot(opponent.members[0], opponent.level), partnerHuman ? { kind: "puppet" } : bot("kiko", tierLevel), bot(opponent.members[1], opponent.level)],
    loadouts: [loadout, null, null, null],
    cast: [null, opponent.members[0], partnerHuman ? null : "kiko", opponent.members[1]],
  };
}

export function rivalLine(state: CareerState, opponent: Entrant | null): string[] {
  if (!opponent) return [];
  const lines: string[] = [];
  for (const id of opponent.members) {
    const record = state.rivals[id];
    if (!CHARACTERS[id]?.rival) continue;
    if (id === "mochi") lines.push(!record ? "Mochi: “Mmh… a match? Okay, I'm awake. Probably.”" : record.losses > record.wins ? "Mochi: “Hehe, I beat you last time. Ready for round two?”" : "Mochi: “We meet again. This time, we're ready!”");
    if (id === "sakura") lines.push(!record ? "Sakura: “Let's have a fun match!”" : "Sakura: “Let's see how much you've improved!”");
  }
  return lines;
}

export const CAREER_TROPHIES = TIERS.map((t) => ({ id: t.trophy, name: `${t.name} Trophy`, color: t.color, tier: t.tier }));
