import { describe, expect, it } from "vitest";
import { botThink, createBotMind, personaProfile } from "./bot";
import { applyResult, careerMatchConfig, currentOpponent, entrantName, generateBracket, newCareer, PLAYER, roundNames, rivalLine, startTournament, TIERS, type CareerState } from "./career";
import { createConfiguredMatch, FrameRecorder, replayWithLogs } from "./net";
import { step } from "./sim";

function winOut(state: CareerState, seed = 1) {
  let s = state;
  let outcome = null;
  while (s.current?.status === "active") {
    const r = applyResult(s, true, [7, 3], seed++);
    s = r.state;
    outcome = r.outcome;
  }
  return { state: s, outcome: outcome! };
}

describe("tournament brackets", () => {
  it("builds real brackets with the boss waiting in the final and no repeated players", () => {
    for (const tier of TIERS) {
      for (const kind of ["solo", "solo_doubles"] as const) {
        const b = generateBracket(kind, tier.tier, 99);
        expect(b.entrants).toHaveLength(tier.size);
        expect(b.rounds[0]).toHaveLength(tier.size / 2);
        expect(b.entrants[0].player).toBe(true);
        expect(b.entrants[tier.size - 1].members).toEqual(kind === "solo" ? [tier.boss.singles] : tier.boss.doubles);
        const members = b.entrants.flatMap((e) => e.members);
        expect(new Set(members).size).toBe(members.length);
        if (kind === "solo_doubles") expect(b.entrants.every((e) => e.members.length === 2 || e.player)).toBe(true);
      }
    }
    expect(generateBracket("solo", 3, 5)).toEqual(generateBracket("solo", 3, 5));
  });

  it("advances on a win, simulates the other matches, and crowns a champion after the final", () => {
    let s = newCareer("solo", 3);
    const first = currentOpponent(s.current!)!;
    const r1 = applyResult(s, true, [7, 4], 10);
    expect(r1.outcome).toMatchObject({ won: true, champion: false, roundName: "Quarterfinal" });
    expect(r1.state.current!.round).toBe(1);
    expect(r1.state.current!.rounds[0].every((m) => m.winner !== undefined)).toBe(true);
    expect(currentOpponent(r1.state.current!)!.key).not.toBe(first.key);
    s = r1.state;
    const done = winOut(s, 20);
    expect(done.outcome).toMatchObject({ champion: true, trophy: "career_trophy_1", title: "Rookie Champion", unlockedTier: 2, roundName: "Grand Final" });
    expect(done.state.champions).toEqual([1]);
    expect(done.state.unlocked).toBe(2);
    expect(done.state.stats.wins).toBe(3);
  });

  it("keeps the same match to retry after a defeat without losing progress", () => {
    const s = applyResult(newCareer("solo", 4), true, [7, 2], 1).state;
    const opponent = currentOpponent(s.current!)!;
    const lost = applyResult(s, false, [3, 7], 2);
    expect(lost.outcome).toMatchObject({ won: false, champion: false });
    expect(lost.state.current!.round).toBe(1);
    expect(currentOpponent(lost.state.current!)!.key).toBe(opponent.key);
    expect(lost.state.current!.attempts).toBe(1);
    expect(lost.state.stats).toEqual({ matches: 2, wins: 1, losses: 1 });
  });

  it("only gives a trophy the first time and refuses locked tiers", () => {
    const champ = winOut(newCareer("solo", 6)).state;
    expect(() => startTournament(champ, 3, 1)).toThrow("tier_locked");
    const again = winOut(startTournament(champ, 1, 7)).outcome;
    expect(again).toMatchObject({ champion: true, trophy: null, unlockedTier: null });
    const two = startTournament(champ, 2, 9);
    expect(two.current!.tier).toBe(2);
    expect(roundNames(TIERS[1].size)).toEqual(["Quarterfinal", "Semifinal", "Grand Final"]);
  });

  it("tracks Mochi and Sakura as returning rivals with dialogue", () => {
    let s = winOut(newCareer("solo_doubles", 8)).state;
    s = startTournament(s, 2, 3);
    let met = false;
    for (let i = 0; i < 3 && s.current!.status === "active"; i++) {
      const opp = currentOpponent(s.current!)!;
      if (opp.members.includes("mochi")) {
        met = true;
        expect(rivalLine(s, opp).some((l) => l.startsWith("Mochi"))).toBe(true);
      }
      s = applyResult(s, true, [7, 5], i).state;
    }
    expect(met || s.rivals.mochi !== undefined).toBe(true);
    expect(s.rivals.mochi?.met ?? 0).toBeGreaterThanOrEqual(1);
    expect(entrantName(s.current!.entrants[0], "Dat")).toBe("Dat");
  });
});

describe("career opponents", () => {
  it("make higher tiers smarter without ever exceeding human speed", () => {
    const rookie = personaProfile("sleepy:1");
    const legend = personaProfile("aggressive:8");
    expect(legend.reaction).toBeLessThan(rookie.reaction);
    expect(legend.perfectChance).toBeGreaterThan(rookie.perfectChance);
    expect(legend.speedScale).toBeLessThanOrEqual(1);
    expect(personaProfile("defensive:5").smashChance).toBeLessThan(personaProfile("aggressive:5").smashChance);
  });

  it("plays a career match from its config and replays it exactly on the server", () => {
    const state = newCareer("solo_doubles", 12);
    const config = careerMatchConfig(state, 777, null, false);
    expect(config.controllers.map((c) => c.kind)).toEqual(["human", "bot", "bot", "bot"]);
    const live = createConfiguredMatch(config);
    const recorder = new FrameRecorder(config.controllers, []);
    const pilot = createBotMind("hard", 3);
    while (live.winner === null && live.tick < 60 * 60 * 15) step(live, recorder.record({ inputs: { 0: botThink(live, pilot, 0) } }));
    const replay = replayWithLogs(JSON.parse(JSON.stringify(config)), recorder.toLogs());
    expect(replay.ok && replay.match.score).toEqual(live.score);
    const solo = careerMatchConfig(newCareer("solo", 1), 5, null, false);
    expect(solo.format).toBe("singles");
    expect(solo.controllers[1]).toMatchObject({ kind: "bot", persona: expect.stringMatching(/:1$/) });
    expect(PLAYER).toBe("player");
  });
});
