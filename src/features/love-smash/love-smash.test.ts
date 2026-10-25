import { describe, expect, it } from "vitest";
import { botThink, createBotMind, type Difficulty } from "./bot";
import { COURT, inServiceCourt, inSingles, serviceCourt } from "./court";
import { predictPath, simulateFlight, solveShot, speedOf, stepShuttle, type ShotKind, type Shuttle, type Vec3 } from "./physics";
import { InputRecorder, decodeInput, encodeInput, replayMatch } from "./replay";
import { MAX_SPEED } from "./rules";
import { createMatch, quality, step, type Input, type Match } from "./sim";
import { FixedStepper } from "./stepper";

function flightOf(from: Vec3, target: { x: number; y: number }, kind: ShotKind) {
  const vel = solveShot(from, target, kind);
  const s: Shuttle = { pos: { ...from }, vel: { ...vel }, netted: false };
  let apex = from.z;
  let ticks = 0;
  while (stepShuttle(s) !== "landed" && ticks < 600) {
    apex = Math.max(apex, s.pos.z);
    ticks++;
  }
  return { vel, land: s.pos, apex, seconds: ticks / 60, netted: s.netted };
}

function playOut(difficulty: Difficulty, pilot: Difficulty, seed: number) {
  const match = createMatch({ seed, difficulty });
  const mind = createBotMind(pilot, seed + 99);
  const recorder = new InputRecorder();
  while (match.winner === null && match.tick < 60 * 60 * 15) step(match, recorder.record(botThink(match, mind, 0)));
  return { match, log: recorder.toLog(), ticks: recorder.ticks };
}

function rallyState(m: Match, hitter: 0 | 1, pos: Vec3, vel: Vec3) {
  m.phase = "rally";
  m.inPlay = true;
  m.isServe = false;
  m.lastHitter = hitter;
  m.shuttle = { pos, vel, netted: false };
  for (const p of m.players) p.x = 3.3;
  return m;
}

describe("court geometry", () => {
  it("uses real singles bounds and diagonal service courts", () => {
    expect(inSingles(2.5, -6.6)).toBe(true);
    expect(inSingles(2.7, -3)).toBe(false);
    expect(inSingles(0, 6.8)).toBe(false);
    const court = serviceCourt(0, 0);
    expect(court.serverX).toBeGreaterThan(0);
    expect(court.receiverX).toBeLessThan(0);
    expect(inServiceCourt(0, 0, -1, 3)).toBe(true);
    expect(inServiceCourt(0, 0, 1, 3)).toBe(false);
    expect(inServiceCourt(0, 0, -1, 1.5)).toBe(false);
    expect(serviceCourt(0, 1).serverX).toBeLessThan(0);
  });
});

describe("shuttlecock physics", () => {
  it("gives every shot a distinct, consistent trajectory", () => {
    const clear = flightOf({ x: 0, y: -5.5, z: 2.3 }, { x: 0, y: 5.9 }, "clear");
    const drop = flightOf({ x: 0, y: -5.5, z: 2.3 }, { x: 0, y: 1.4 }, "drop");
    const smash = flightOf({ x: 0, y: -3.5, z: 2.6 }, { x: 1.5, y: 4 }, "smash");
    const drive = flightOf({ x: 0, y: -3.5, z: 1.2 }, { x: 1.5, y: 4.8 }, "drive");
    const lift = flightOf({ x: 0, y: -1.5, z: 0.5 }, { x: -1.5, y: 5.7 }, "lift");
    expect(clear.land.y).toBeCloseTo(5.9, 1);
    expect(clear.apex).toBeGreaterThan(4);
    expect(drop.land.y).toBeGreaterThan(0.8);
    expect(drop.land.y).toBeLessThan(2.2);
    expect(speedOf(smash.vel)).toBeGreaterThan(25);
    expect(smash.vel.z).toBeLessThan(0);
    expect(smash.seconds).toBeLessThan(clear.seconds / 2);
    expect(smash.land.y).toBeGreaterThan(0);
    expect(drive.apex).toBeLessThan(2.6);
    expect(drive.seconds).toBeLessThan(clear.seconds);
    expect(lift.apex).toBeGreaterThan(clear.apex - 1);
    for (const f of [clear, drop, smash, drive, lift]) expect(f.netted).toBe(false);
    expect(flightOf({ x: 0, y: -5.5, z: 2.3 }, { x: 0, y: 5.9 }, "clear").land).toEqual(clear.land);
  });

  it("decelerates like a shuttle instead of bouncing like a ball", () => {
    const s: Shuttle = { pos: { x: 0, y: -3, z: 2 }, vel: { x: 0, y: 30, z: 0 }, netted: false };
    for (let i = 0; i < 30; i++) stepShuttle(s);
    expect(speedOf(s.vel)).toBeLessThan(12);
    const path = predictPath({ pos: { x: 0, y: 2, z: 3 }, vel: { x: 0, y: 1, z: 0 }, netted: false }, 600);
    expect(path[path.length - 1].z).toBe(0);
    expect(path.every((p, i) => i === 0 || p.z <= path[i - 1].z + 1e-9)).toBe(true);
  });

  it("stops a low shuttle at the net", () => {
    const flight = simulateFlight({ x: 0, y: -2, z: 1 }, { x: 0, y: 8, z: 0 });
    expect(flight.netted).toBe(true);
    expect(flight.land.y).toBeLessThan(0);
  });
});

describe("hit timing", () => {
  it("rates contact by distance and height without randomness", () => {
    expect(quality(0.1, 2.2)).toBe("perfect");
    expect(quality(0.5, 1.4)).toBe("good");
    expect(quality(0.9, 0.5)).toBe("late");
    expect(quality(0.1, 2.2)).toBe(quality(0.1, 2.2));
  });

  it("returns a shuttle with a perfect overhead clear when timed well", () => {
    const m = createMatch({ seed: 1, difficulty: "easy" });
    rallyState(m, 1, { x: 0, y: -4, z: 2.3 }, { x: 0, y: 0, z: -1 });
    m.players[0].x = 0;
    m.players[0].y = -4;
    step(m, { mx: 0, my: 0, hit: true });
    const hit = m.events.find((e) => e.type === "hit");
    expect(hit).toMatchObject({ type: "hit", side: 0, shot: "clear", quality: "perfect" });
    expect(m.shuttle.vel.y).toBeGreaterThan(0);
  });

  it("whiffs when the press is too early", () => {
    const m = createMatch({ seed: 1, difficulty: "easy" });
    rallyState(m, 1, { x: 0, y: 3, z: 3 }, { x: 0, y: -0.1, z: 0 });
    m.players[0].x = 0;
    m.players[0].y = -4;
    step(m, { mx: 0, my: 0, hit: true });
    let whiffed = false;
    for (let i = 0; i < 12; i++) {
      step(m, { mx: 0, my: 0 });
      whiffed ||= m.events.some((e) => e.type === "whiff");
    }
    expect(whiffed).toBe(true);
  });

  it("turns a perfect high smash into a Sakura Smash", () => {
    const m = createMatch({ seed: 2, difficulty: "easy" });
    rallyState(m, 1, { x: 0, y: -3, z: 2.5 }, { x: 0, y: 0, z: -0.5 });
    m.players[0].x = 0;
    m.players[0].y = -3;
    step(m, { mx: 0, my: 0, smash: true });
    expect(m.events.find((e) => e.type === "hit")).toMatchObject({ shot: "smash", sakura: true });
  });
});

describe("movement", () => {
  it("accelerates to a capped speed and never crosses the net", () => {
    const m = createMatch({ seed: 3, difficulty: "easy" });
    m.phase = "rally";
    const startX = m.players[0].x;
    for (let i = 0; i < 60; i++) step(m, { mx: 1, my: 0 });
    expect(m.players[0].x).toBeGreaterThan(startX);
    expect(Math.hypot(m.players[0].vx, m.players[0].vy)).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    for (let i = 0; i < 240; i++) step(m, { mx: 0, my: 1 });
    expect(m.players[0].y).toBeLessThan(-0.3);
    for (let i = 0; i < 6; i++) step(m, { mx: 0, my: 0 });
    expect(Math.hypot(m.players[0].vx, m.players[0].vy)).toBeLessThan(MAX_SPEED);
  });
});

describe("scoring", () => {
  it("awards in, out and net faults to the right side", () => {
    const inside = rallyState(createMatch({ seed: 4, difficulty: "easy" }), 1, { x: 1, y: -3, z: 0.02 }, { x: 0, y: 0, z: -3 });
    step(inside, { mx: 0, my: 0 });
    expect(inside.events.find((e) => e.type === "point")).toMatchObject({ winner: 1, reason: "in" });

    const out = rallyState(createMatch({ seed: 4, difficulty: "easy" }), 1, { x: 3, y: -3, z: 0.02 }, { x: 0, y: 0, z: -3 });
    step(out, { mx: 0, my: 0 });
    expect(out.events.find((e) => e.type === "point")).toMatchObject({ winner: 0, reason: "out" });

    const net = rallyState(createMatch({ seed: 4, difficulty: "easy" }), 1, { x: 0, y: 0.5, z: 0.9 }, { x: 0, y: -9, z: 0 });
    const points = [];
    for (let i = 0; i < 120 && points.length === 0; i++) {
      step(net, { mx: 0, my: 0 });
      points.push(...net.events.filter((e) => e.type === "point"));
    }
    expect(points[0]).toMatchObject({ winner: 0, reason: "net" });
  });

  it("plays to 7, needs a 2 point lead, and caps at 11", () => {
    const land = (m: Match, loser: 0 | 1) => {
      rallyState(m, loser === 0 ? 1 : 0, { x: 0, y: loser === 0 ? -3 : 3, z: 0.02 }, { x: 0, y: 0, z: -3 });
      step(m, { mx: 0, my: 0 });
    };
    const m = createMatch({ seed: 5, difficulty: "easy" });
    m.score = [6, 6];
    land(m, 1);
    expect(m.winner).toBeNull();
    expect(m.server).toBe(0);
    land(m, 1);
    expect(m.winner).toBe(0);
    const capped = createMatch({ seed: 5, difficulty: "easy" });
    capped.score = [10, 10];
    land(capped, 0);
    expect(capped.winner).toBe(1);
    expect(capped.score).toEqual([10, 11]);
  });

  it("moves to the next serve after a short celebration with the winner serving", () => {
    const m = createMatch({ seed: 6, difficulty: "easy" });
    rallyState(m, 0, { x: 0, y: 3, z: 0.02 }, { x: 0, y: 0, z: -3 });
    step(m, { mx: 0, my: 0 });
    expect(m.phase).toBe("point");
    for (let i = 0; i < 90; i++) step(m, { mx: 0, my: 0 });
    expect(m.phase).toBe("serve");
    expect(m.server).toBe(0);
    expect(m.players[0].x).toBeLessThan(0);
  });

  it("keeps an early serve press until the serve is allowed", () => {
    const m = createMatch({ seed: 7, difficulty: "easy" });
    step(m, { mx: 0, my: 0, hit: true });
    for (let i = 0; i < 14 && m.phase === "serve"; i++) step(m, { mx: 0, my: 0 });
    expect(m.phase).toBe("rally");
    expect(m.lastShot?.shot).toBe("serve_high");
  });

  it("never ends a tutorial match", () => {
    const m = createMatch({ seed: 6, difficulty: "feeder", tutorial: true });
    m.score = [20, 0];
    rallyState(m, 0, { x: 0, y: 3, z: 0.02 }, { x: 0, y: 0, z: -3 });
    step(m, { mx: 0, my: 0 });
    expect(m.winner).toBeNull();
  });
});

describe("bot opponent", () => {
  it("chases the shuttle using its own predicted interception point", () => {
    const m = createMatch({ seed: 8, difficulty: "hard" });
    rallyState(m, 0, { x: 0, y: -4, z: 2.3 }, solveShot({ x: 0, y: -4, z: 2.3 }, { x: 2, y: 5.5 }, "clear"));
    m.players[1].x = -1;
    m.players[1].y = 3;
    for (let i = 0; i < 70; i++) step(m, { mx: 0, my: 0 });
    expect(m.players[1].x).toBeGreaterThan(0.5);
    expect(m.players[1].y).toBeGreaterThan(4);
  });

  it("completes full matches where harder bots beat easier ones", () => {
    let hardWins = 0;
    for (const seed of [11, 12, 13, 14]) {
      const { match } = playOut("easy", "hard", seed);
      expect(match.winner).not.toBeNull();
      if (match.winner === 0) hardWins++;
      expect(Math.max(...match.score)).toBeGreaterThanOrEqual(7);
    }
    expect(hardWins).toBeGreaterThanOrEqual(3);
  });
});

describe("determinism and replay", () => {
  it("encodes inputs losslessly at the recorded precision", () => {
    const input: Input = { mx: -0.5, my: 1, smash: true, lunge: true };
    expect(decodeInput(encodeInput(input))).toEqual(input);
  });

  it("replays a recorded match to the exact same result", () => {
    const { match, log, ticks } = playOut("normal", "hard", 21);
    const replay = replayMatch(21, "normal", log);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.ticks).toBe(ticks);
    expect(replay.match.score).toEqual(match.score);
    expect(replay.match.stats).toEqual(match.stats);
  });

  it("rejects forged or unfinished logs", () => {
    expect(replayMatch(1, "easy", "nope")).toEqual({ ok: false, reason: "invalid_log" });
    expect(replayMatch(1, "easy", [0, -3])).toEqual({ ok: false, reason: "invalid_log" });
    expect(replayMatch(1, "easy", [40, 600])).toEqual({ ok: false, reason: "unfinished" });
    expect(replayMatch(1, "easy", [40, 60 * 60 * 21])).toEqual({ ok: false, reason: "too_long" });
    const { log } = playOut("normal", "hard", 22);
    const own = replayMatch(22, "normal", log);
    const other = replayMatch(23, "normal", log);
    expect(own.ok).toBe(true);
    const summary = (r: typeof own) => (r.ok ? { score: r.match.score, ticks: r.ticks } : r.reason);
    expect(summary(other)).not.toEqual(summary(own));
  });

  it("produces the same simulation at any frame rate", () => {
    const run = (frames: number[]) => {
      const m = createMatch({ seed: 31, difficulty: "normal" });
      const stepper = new FixedStepper();
      const mind = createBotMind("normal", 5);
      for (const f of frames) {
        const n = stepper.advance(f);
        for (let i = 0; i < n; i++) step(m, botThink(m, mind, 0));
      }
      return { tick: m.tick, score: m.score, shuttle: m.shuttle.pos, p0: [m.players[0].x, m.players[0].y] };
    };
    const at = (fps: number, seconds: number) => Array.from({ length: Math.round(fps * seconds) }, () => 1 / fps);
    const jitter = Array.from({ length: 1200 }, (_, i) => (i % 3 === 0 ? 1 / 30 : i % 3 === 1 ? 1 / 144 : 1 / 75));
    const total = jitter.reduce((a, b) => a + b, 0);
    const base = run(at(60, total));
    expect(run(at(144, total)).tick).toBeGreaterThanOrEqual(base.tick - 1);
    const ticks = Math.min(run(jitter).tick, run(at(30, total)).tick, base.tick);
    const fixed = (frames: number[]) => {
      const m = createMatch({ seed: 31, difficulty: "normal" });
      const mind = createBotMind("normal", 5);
      const stepper = new FixedStepper();
      for (const f of frames) {
        const n = stepper.advance(f);
        for (let i = 0; i < n && m.tick < ticks; i++) step(m, botThink(m, mind, 0));
      }
      return { score: m.score, shuttle: m.shuttle.pos, p0: [m.players[0].x, m.players[0].y], tick: m.tick };
    };
    expect(fixed(jitter)).toEqual(fixed(at(60, total)));
    expect(fixed(at(30, total))).toEqual(fixed(at(144, total)));
  });

  it("restarts cleanly many times without leaking state between matches", () => {
    const first = playOut("easy", "normal", 41);
    for (let i = 0; i < 5; i++) playOut("easy", "normal", 41 + i);
    const again = playOut("easy", "normal", 41);
    expect(again.match.score).toEqual(first.match.score);
    expect(again.ticks).toBe(first.ticks);
  });
});

describe("court constants", () => {
  it("keeps the net at regulation height", () => {
    expect(COURT.netHeight).toBeCloseTo(1.55, 2);
  });
});
