import { describe, expect, it } from "vitest";
import { botThink, createBotMind } from "./bot";
import { decodePuppet, encodePuppet } from "./net";
import { speedOf, type Vec3 } from "./physics";
import { decodeInput, encodeInput } from "./replay";
import { createMatch, step, type Match, type SimEvent } from "./sim";
import { FULL_LOADOUT, sanitizeLoadout, SKILL_BALANCE, SKILLS, smashLevel, unlockedSkills } from "./skills";

const LOADOUT = { movement: "lightning_dash" as const, special: "frost_drop" as const, ultimate: "sakura_meteor" as const };

function singles(energy = 100, special: "frost_drop" | "phoenix_drive" = "frost_drop") {
  const m = createMatch({ seed: 3, difficulty: "easy", loadouts: [{ ...LOADOUT, special }, null] });
  m.players[0].energy = energy;
  return m;
}

function incoming(m: Match, pos: Vec3, hitter: 0 | 1 = 1) {
  m.phase = "rally";
  m.inPlay = true;
  m.lastHitter = hitter;
  m.shuttle = { pos, vel: { x: 0, y: 0, z: -0.5 }, netted: false };
  m.players[0].x = pos.x;
  m.players[0].y = pos.y;
  m.players[1].x = 3;
}

const events = (m: Match) => m.events as SimEvent[];

describe("skill energy", () => {
  it("earns energy from real hits, more for perfect timing, capped per rally and at 100", () => {
    const m = singles(0);
    incoming(m, { x: 0, y: -4, z: 2.3 });
    step(m, { mx: 0, my: 0, hit: true });
    expect(events(m).find((e) => e.type === "hit")).toMatchObject({ quality: "perfect" });
    expect(m.players[0].energy).toBe(SKILL_BALANCE.gain.perfect);
    m.players[0].rallyGain = SKILL_BALANCE.rallyGainCap - 2;
    m.lastHitter = 1;
    m.players[0].cooldown = 0;
    m.players[0].swing = null;
    incoming(m, { x: 0, y: -4, z: 2.3 });
    step(m, { mx: 0, my: 0, hit: true });
    expect(m.players[0].energy).toBe(SKILL_BALANCE.gain.perfect + 2);
    const full = singles(99);
    incoming(full, { x: 0, y: -4, z: 2.3 });
    step(full, { mx: 0, my: 0, hit: true });
    expect(full.players[0].energy).toBe(100);
  });

  it("starts every new match with empty energy", () => {
    expect(createMatch({ seed: 1, difficulty: "easy" }).players.every((p) => p.energy === 0)).toBe(true);
  });
});

describe("Lightning Dash", () => {
  it("moves the player much faster than running, costs energy and respects the net and cooldown", () => {
    const m = singles(40);
    m.phase = "rally";
    m.players[0].x = 0;
    m.players[0].y = -3;
    step(m, { mx: 1, my: 0, dash: true });
    expect(events(m).find((e) => e.type === "skill")).toMatchObject({ skill: "lightning_dash" });
    expect(m.players[0].energy).toBe(40 - SKILLS.lightning_dash.cost);
    for (let i = 0; i < 11; i++) step(m, { mx: 1, my: 0 });
    expect(m.players[0].x).toBeGreaterThan(1.3);
    step(m, { mx: 0, my: 1, dash: true });
    expect(events(m).find((e) => e.type === "skill_fail")).toMatchObject({ reason: "cooldown" });
    expect(m.players[0].energy).toBe(20);
    m.players[0].cooldowns.movement = 0;
    m.players[0].y = -1;
    step(m, { mx: 0, my: 1, dash: true });
    for (let i = 0; i < 20; i++) step(m, { mx: 0, my: 1 });
    expect(m.players[0].y).toBeLessThan(-0.3);
  });

  it("fails without spending anything when energy is short", () => {
    const m = singles(10);
    m.phase = "rally";
    step(m, { mx: 1, my: 0, dash: true });
    expect(events(m).find((e) => e.type === "skill_fail")).toMatchObject({ skill: "lightning_dash", reason: "energy" });
    expect(m.players[0].energy).toBe(10);
    expect(m.players[0].cooldowns.movement).toBe(0);
  });
});

describe("special shots", () => {
  it("Frost Drop places a precise drop right behind the net", () => {
    const m = singles(30);
    incoming(m, { x: 0, y: -5, z: 2.2 });
    step(m, { mx: 0, my: 0, special: true });
    expect(events(m).find((e) => e.type === "hit")).toMatchObject({ shot: "frost_drop", skill: "frost_drop" });
    expect(m.players[0].energy).toBe(5);
    expect(m.players[0].cooldowns.special).toBe(SKILLS.frost_drop.cooldown);
    let landed: Vec3 | null = null;
    for (let i = 0; i < 300 && !landed; i++) {
      step(m, { mx: 0, my: 0 });
      const land = events(m).find((e) => e.type === "land");
      if (land && land.type === "land") landed = { x: land.x, y: land.y, z: 0 };
    }
    expect(landed!.y).toBeGreaterThan(0.6);
    expect(landed!.y).toBeLessThan(1.7);
  });

  it("Phoenix Drive is fast and flat, and a late contact can clip the net", () => {
    const clean = singles(60, "phoenix_drive");
    incoming(clean, { x: 0, y: -3.5, z: 1.4 });
    step(clean, { mx: 0, my: 0, special: true });
    expect(events(clean).find((e) => e.type === "hit")).toMatchObject({ shot: "phoenix_drive" });
    expect(speedOf(clean.shuttle.vel)).toBeGreaterThan(15);
    expect(Math.abs(clean.shuttle.vel.z) / speedOf(clean.shuttle.vel)).toBeLessThan(0.3);
    const late = singles(60, "phoenix_drive");
    incoming(late, { x: 0.9, y: -5.5, z: 0.5 });
    late.players[0].x = 0.3;
    step(late, { mx: 0, my: 0, special: true });
    expect(events(late).find((e) => e.type === "hit")).toMatchObject({ shot: "phoenix_drive", quality: "late" });
    let netted = false;
    for (let i = 0; i < 200; i++) {
      step(late, { mx: 0, my: 0 });
      netted ||= events(late).some((e) => e.type === "net");
    }
    expect(netted).toBe(true);
  });
});

describe("Sakura Meteor", () => {
  it("needs a high contact and energy; otherwise it is a normal shot and costs nothing", () => {
    const low = singles(100);
    incoming(low, { x: 0, y: -3, z: 1.4 });
    step(low, { mx: 0, my: 0, ultimate: true });
    expect(events(low).find((e) => e.type === "skill_fail")).toMatchObject({ reason: "position" });
    expect(events(low).find((e) => e.type === "hit")).toMatchObject({ skill: null });
    expect(low.players[0].energy).toBeGreaterThan(80);

    const high = singles(100);
    incoming(high, { x: 0, y: -3, z: 2.5 });
    step(high, { mx: 0, my: 0, ultimate: true });
    expect(events(high).find((e) => e.type === "hit")).toMatchObject({ shot: "meteor", skill: "sakura_meteor", sakura: true });
    expect(high.players[0].energy).toBe(20);
    const smash = singles(0);
    incoming(smash, { x: 0, y: -3, z: 2.5 });
    step(smash, { mx: 0, my: 0, smash: true });
    expect(speedOf(high.shuttle.vel)).toBeGreaterThan(speedOf(smash.shuttle.vel));

    const broke = singles(50);
    incoming(broke, { x: 0, y: -3, z: 2.5 });
    step(broke, { mx: 0, my: 0, ultimate: true });
    expect(events(broke).find((e) => e.type === "skill_fail")).toMatchObject({ reason: "energy" });
    expect(broke.players[0].energy).toBe(50);
  });

  it("can still be returned: a defender who dashes in scores a Perfect Counter", () => {
    const m = singles(40);
    m.phase = "rally";
    m.inPlay = true;
    m.lastHitter = 1;
    m.lastShot = { side: 1, slot: 1, shot: "meteor", quality: "perfect", sakura: true };
    m.shuttle = { pos: { x: 1.5, y: -3, z: 1.5 }, vel: { x: 0, y: -1, z: -2 }, netted: false };
    m.players[0].x = 0.1;
    m.players[0].y = -3;
    step(m, { mx: 1, my: 0, dash: true });
    for (let i = 0; i < 5; i++) step(m, { mx: 1, my: 0 });
    step(m, { mx: 0, my: 0, hit: true });
    const all: SimEvent[] = [...events(m)];
    for (let i = 0; i < 8 && !all.some((e) => e.type === "hit"); i++) {
      step(m, { mx: 0, my: 0 });
      all.push(...events(m));
    }
    expect(all.some((e) => e.type === "counter")).toBe(true);
  });
});

describe("Love Sync", () => {
  function team(energy: number) {
    const m = createMatch({ seed: 5, difficulty: "easy", format: "doubles" });
    m.teamEnergy[0] = energy;
    return m;
  }

  it("needs a full team meter, which only teamwork fills, and boosts the next attack once", () => {
    const empty = team(60);
    step(empty, { inputs: { 0: { mx: 0, my: 0, sync: true } } });
    expect(events(empty).find((e) => e.type === "skill_fail")).toMatchObject({ skill: "love_sync", reason: "energy" });
    const m = team(100);
    step(m, { inputs: { 0: { mx: 0, my: 0, sync: true } } });
    expect(events(m).find((e) => e.type === "skill")).toMatchObject({ skill: "love_sync" });
    expect(m.teamEnergy[0]).toBe(0);
    expect(m.sync[0]).toBeGreaterThan(0);
    m.phase = "rally";
    m.inPlay = true;
    m.lastHitter = 1;
    m.shuttle = { pos: { x: 0, y: -3, z: 2.4 }, vel: { x: 0, y: 0, z: -0.5 }, netted: false };
    m.players[0].x = 0;
    m.players[0].y = -3;
    m.players[2].x = -3;
    step(m, { inputs: { 0: { mx: 0, my: 0, smash: true } } });
    expect(events(m).find((e) => e.type === "hit")).toMatchObject({ sync: true });
    expect(m.sync[0]).toBe(0);
  });

  it("expires if unused and is not available in singles", () => {
    const m = team(100);
    step(m, { inputs: { 0: { mx: 0, my: 0, sync: true } } });
    for (let i = 0; i < SKILL_BALANCE.sync.window; i++) step(m, { inputs: {} });
    expect(m.sync[0]).toBe(0);
    const solo = singles(100);
    solo.teamEnergy[0] = 100;
    step(solo, { mx: 0, my: 0, sync: true });
    expect(events(solo).find((e) => e.type === "skill_fail")).toMatchObject({ skill: "love_sync", reason: "locked" });
  });

  it("fills the team meter from combos", () => {
    const m = team(0);
    m.rallyLog = [
      { slot: 0, side: 0, save: true, perfect: false, smash: false },
      { slot: 2, side: 0, save: false, perfect: true, smash: false },
    ];
    m.phase = "rally";
    m.inPlay = true;
    m.lastHitter = 0;
    m.shuttle = { pos: { x: 0, y: 3, z: 0.02 }, vel: { x: 0, y: 0, z: -3 }, netted: false };
    step(m, { inputs: {} });
    expect(m.teamEnergy[0]).toBe(SKILL_BALANCE.sync.perCombo);
  });
});

describe("AI skill use", () => {
  it("only uses skills it can afford and respects cooldowns", () => {
    const m = createMatch({ seed: 44, difficulty: "hard", format: "doubles", controllers: [{ kind: "bot", difficulty: "hard" }, { kind: "bot", difficulty: "hard" }, { kind: "bot", difficulty: "hard" }, { kind: "bot", difficulty: "hard" }] });
    const lastUse = new Map<string, number>();
    let used = 0;
    while (m.winner === null && m.tick < 60 * 60 * 15) {
      const energyBefore = m.players.map((p) => p.energy);
      step(m, { inputs: {} });
      for (const e of m.events) {
        if (e.type !== "skill" || e.skill === "love_sync") continue;
        used++;
        const def = SKILLS[e.skill];
        expect(energyBefore[e.slot]).toBeGreaterThanOrEqual(def.cost);
        const key = `${e.slot}:${def.category}`;
        if (lastUse.has(key)) expect(m.tick - lastUse.get(key)!).toBeGreaterThanOrEqual(def.cooldown);
        lastUse.set(key, m.tick);
      }
      expect(m.players.every((p) => p.energy >= 0 && p.energy <= 100)).toBe(true);
    }
    expect(used).toBeGreaterThan(0);
    expect(m.winner).not.toBeNull();
  });

  it("never lets skills decide the match on their own: easy skilled bots still lose to hard", () => {
    let hardWins = 0;
    for (const seed of [61, 62, 63]) {
      const m = createMatch({ seed, difficulty: "hard" });
      const mind = createBotMind("easy", seed);
      while (m.winner === null && m.tick < 60 * 60 * 15) step(m, botThink(m, mind, 0));
      if (m.winner === 1) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(2);
  });
});

describe("skill inputs and progression", () => {
  it("carries skill presses through the replay and network encodings", () => {
    const input = { mx: 1, my: 0, dash: true, special: true, ultimate: true, sync: true };
    expect(decodeInput(encodeInput(input))).toEqual(input);
    const frame = { x: 1.25, y: -3.5, dash: true, sync: true, press: { kind: "ultimate" as const, rewind: 12 } };
    expect(decodePuppet(encodePuppet(frame))).toEqual(frame);
  });

  it("unlocks skills from verified stats and strips locked ones from a loadout", () => {
    const fresh = { matches: 0, wins: 0, dropShots: 0, doublesMatches: 0, tutorialDone: false };
    expect(unlockedSkills(fresh)).toEqual([]);
    expect(unlockedSkills({ ...fresh, tutorialDone: true })).toEqual(["lightning_dash"]);
    const veteran = { matches: 20, wins: 10, dropShots: 25, doublesMatches: 5, tutorialDone: true };
    expect(smashLevel(veteran)).toBe(14);
    expect(unlockedSkills(veteran)).toEqual(["lightning_dash", "frost_drop", "phoenix_drive", "sakura_meteor", "love_sync"]);
    expect(sanitizeLoadout(FULL_LOADOUT, ["lightning_dash"])).toEqual({ movement: "lightning_dash", special: null, ultimate: null });
    expect(sanitizeLoadout({ movement: "sakura_meteor", special: "frost_drop" }, unlockedSkills(veteran))).toEqual({ movement: null, special: "frost_drop", ultimate: null });
  });
});
