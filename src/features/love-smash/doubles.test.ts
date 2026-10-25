import { describe, expect, it } from "vitest";
import { botThink, createBotMind } from "./bot";
import { inDoubles, inSingles } from "./court";
import { applySnapshot, createConfiguredMatch, decodePuppet, encodePuppet, encodeSnapshot, FrameRecorder, replayWithLogs, type MatchConfig } from "./net";
import { solveShot, type Vec3 } from "./physics";
import { MAX_SPEED } from "./rules";
import { createMatch, step, type Frame, type Match } from "./sim";

const DT = 1 / 60;

function doubles(seed = 1) {
  return createMatch({ seed, difficulty: "normal", format: "doubles" });
}

function land(m: Match, hitter: 0 | 1, pos: Vec3) {
  m.phase = "rally";
  m.inPlay = true;
  m.isServe = false;
  m.lastHitter = hitter;
  m.shuttle = { pos, vel: { x: 0, y: 0, z: -3 }, netted: false };
  for (const p of m.players) p.x = p.side === 0 ? -3.3 : 3.3;
  step(m, { inputs: {} });
}

describe("doubles rules", () => {
  it("puts four players on the court with two per team", () => {
    const m = doubles();
    expect(m.players.map((p) => p.side)).toEqual([0, 1, 0, 1]);
    expect(m.players.filter((p) => p.side === 0 && p.y < 0)).toHaveLength(2);
    expect(m.players.filter((p) => p.side === 1 && p.y > 0)).toHaveLength(2);
  });

  it("uses doubles sidelines during rallies", () => {
    expect(inDoubles(2.9, -4)).toBe(true);
    expect(inSingles(2.9, -4)).toBe(false);
    const m = doubles();
    land(m, 1, { x: 2.9, y: -4, z: 0.02 });
    expect(m.events.find((e) => e.type === "point")).toMatchObject({ winner: 1, reason: "in" });
  });

  it("rotates the server between courts and passes the serve to the other team", () => {
    const m = doubles(3);
    expect(m.serverSlot).toBe(0);
    land(m, 0, { x: 0, y: 3, z: 0.02 });
    for (let i = 0; i < 90; i++) step(m, { inputs: {} });
    expect(m.server).toBe(0);
    expect(m.serverSlot).toBe(0);
    expect(m.players[0].x).toBeLessThan(0);
    land(m, 0, { x: 0, y: -3, z: 0.02 });
    for (let i = 0; i < 90; i++) step(m, { inputs: {} });
    expect(m.server).toBe(1);
    expect(m.score).toEqual([1, 1]);
    expect(m.serverSlot % 2).toBe(1);
    const receiver = m.players.find((p) => p.side === 0 && Math.abs(p.y) < 3)!;
    expect(Math.sign(receiver.x)).toBe(-Math.sign(m.players[m.serverSlot].x));
  });

  it("lets only one teammate hit the shuttle, even when both press at once", () => {
    const m = doubles(4);
    m.phase = "rally";
    m.inPlay = true;
    m.lastHitter = 1;
    m.shuttle = { pos: { x: 0, y: -3, z: 2.2 }, vel: { x: 0, y: 0, z: -1 }, netted: false };
    m.players[0].x = -0.3;
    m.players[0].y = -3;
    m.players[2].x = 0.3;
    m.players[2].y = -3;
    m.players[2].control = "human";
    step(m, { inputs: { 0: { mx: 0, my: 0, hit: true }, 2: { mx: 0, my: 0, hit: true } } });
    const hits = m.events.filter((e) => e.type === "hit");
    expect(hits).toHaveLength(1);
    expect(m.lastHitter).toBe(0);
  });

  it("keeps teammates from overlapping", () => {
    const m = doubles(5);
    m.phase = "rally";
    m.players[2].control = "human";
    m.players[0].x = 0;
    m.players[0].y = -3;
    m.players[2].x = 0.1;
    m.players[2].y = -3;
    step(m, { inputs: { 0: { mx: 0, my: 0 }, 2: { mx: 0, my: 0 } } });
    expect(Math.hypot(m.players[0].x - m.players[2].x, m.players[0].y - m.players[2].y)).toBeGreaterThanOrEqual(0.549);
  });

  it("celebrates a save followed by the partner's winner as a Love Combo", () => {
    const m = doubles(6);
    m.rallyLog = [
      { slot: 0, side: 0, save: true, perfect: false, smash: false },
      { slot: 1, side: 1, save: false, perfect: false, smash: false },
      { slot: 2, side: 0, save: false, perfect: true, smash: false },
    ];
    land(m, 0, { x: 0, y: 3, z: 0.02 });
    expect(m.events.find((e) => e.type === "combo")).toMatchObject({ side: 0, kind: "love_combo" });
    expect(m.stats.sides[0].combos).toBe(1);
  });

  it("plays complete doubles matches where four bots coordinate", () => {
    const m = createMatch({ seed: 9, difficulty: "normal", format: "doubles", controllers: [{ kind: "bot", difficulty: "hard" }, { kind: "bot", difficulty: "normal" }, { kind: "bot", difficulty: "hard" }, { kind: "bot", difficulty: "normal" }] });
    while (m.winner === null && m.tick < 60 * 60 * 15) step(m, { inputs: {} });
    expect(m.winner).not.toBeNull();
    expect(m.stats.players.every((p) => p.hits > 0)).toBe(true);
  });

  it("lets an AI teammate leave a shuttle to the human who is going for it", () => {
    const m = createMatch({ seed: 11, difficulty: "hard", format: "doubles" });
    m.phase = "rally";
    m.inPlay = true;
    m.lastHitter = 1;
    m.shuttle = { pos: { x: 0, y: 3, z: 2.4 }, vel: solveShot({ x: 0, y: 3, z: 2.4 }, { x: -1.5, y: -4 }, "clear"), netted: false };
    m.players[0].x = -1.4;
    m.players[0].y = -3.6;
    m.players[2].x = 1.4;
    m.players[2].y = -3.6;
    const start = { x: m.players[2].x, y: m.players[2].y };
    for (let i = 0; i < 40; i++) step(m, { inputs: { 0: { mx: -0.1, my: -0.2 } } });
    expect(Math.hypot(m.players[2].x - -1.5, m.players[2].y - -4)).toBeGreaterThan(Math.hypot(start.x - -1.5, start.y - -4) - 1);
  });
});

describe("online netcode", () => {
  it("packs remote player frames into a single integer without losing detail", () => {
    const frame = { x: -2.37, y: -5.12, lunge: true, press: { kind: "smash" as const, rewind: 7 } };
    expect(decodePuppet(encodePuppet(frame))).toEqual(frame);
    expect(decodePuppet(encodePuppet({ x: 1, y: 3 }))).toEqual({ x: 1, y: 3 });
  });

  it("hits a shuttle the remote player saw at their racket a few ticks ago", () => {
    const m = createMatch({ seed: 12, difficulty: "normal", format: "doubles", controllers: [{ kind: "human" }, { kind: "bot", difficulty: "easy" }, { kind: "puppet" }, { kind: "bot", difficulty: "easy" }] });
    m.phase = "rally";
    m.inPlay = true;
    m.lastHitter = 1;
    m.players[2].x = 1;
    m.players[2].y = -3;
    m.players[0].x = -3;
    m.shuttle = { pos: { x: 1, y: -3, z: 2.0 }, vel: { x: 0, y: -4, z: -1 }, netted: false };
    for (let i = 0; i < 8; i++) step(m, { inputs: {}, puppets: { 2: { x: 1, y: -3 } } });
    expect(m.events.some((e) => e.type === "hit")).toBe(false);
    step(m, { inputs: {}, puppets: { 2: { x: 1, y: -3, press: { kind: "hit", rewind: 7 } } } });
    expect(m.events.find((e) => e.type === "hit")).toMatchObject({ slot: 2 });
  });

  it("replays a mixed human, remote and bot match exactly on the server", () => {
    const config: MatchConfig = { seed: 77, format: "doubles", difficulty: "normal", controllers: [{ kind: "human" }, { kind: "bot", difficulty: "normal" }, { kind: "puppet" }, { kind: "bot", difficulty: "normal" }] };
    const live = createConfiguredMatch(config);
    const recorder = new FrameRecorder(config.controllers, []);
    const pilot = createBotMind("hard", 1);
    const remote = createBotMind("hard", 2);
    const ghost = { x: live.players[2].x, y: live.players[2].y };
    while (live.winner === null && live.tick < 60 * 60 * 15) {
      const wish = botThink(live, remote, 2);
      if (live.phase === "serve") Object.assign(ghost, { x: live.players[2].x, y: live.players[2].y });
      ghost.x += wish.mx * MAX_SPEED * DT;
      ghost.y += wish.my * MAX_SPEED * DT;
      const kind = wish.smash ? "smash" : wish.drop ? "drop" : wish.hit ? "hit" : null;
      const frame: Frame = { inputs: { 0: botThink(live, pilot, 0) }, puppets: { 2: { x: ghost.x, y: ghost.y, lunge: wish.lunge, press: kind ? { kind, rewind: 3 } : undefined } } };
      step(live, recorder.record(frame));
    }
    expect(live.winner).not.toBeNull();
    expect(live.stats.players[2].hits).toBeGreaterThan(0);
    const replay = replayWithLogs(config, recorder.toLogs());
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.match.score).toEqual(live.score);
    expect(replay.match.stats).toEqual(live.stats);
    expect(replayWithLogs(config, { inputs: recorder.toLogs().inputs, puppets: {} })).toEqual({ ok: false, reason: "invalid_log" });
  });

  it("mirrors the host's match on other devices through snapshots", () => {
    const host = createMatch({ seed: 21, difficulty: "normal", format: "doubles" });
    for (let i = 0; i < 400; i++) step(host, { inputs: {} });
    const mirror = createMatch({ seed: 21, difficulty: "normal", format: "doubles" });
    applySnapshot(mirror, JSON.parse(JSON.stringify(encodeSnapshot(host, []))));
    expect(mirror.tick).toBe(host.tick);
    expect(mirror.score).toEqual(host.score);
    host.players.forEach((p, i) => {
      expect(mirror.players[i].x).toBeCloseTo(p.x, 2);
      expect(mirror.players[i].y).toBeCloseTo(p.y, 2);
    });
    expect(mirror.shuttle.pos.z).toBeCloseTo(host.shuttle.pos.z, 2);
  });
});
