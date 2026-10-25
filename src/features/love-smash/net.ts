import type { Difficulty } from "./bot";
import type { Loadout } from "./skills";
import type { Side } from "./court";
import { decodeInput, encodeInput, INPUT_CODES, MAX_MATCH_TICKS } from "./replay";
import { createMatch, MAX_REWIND, step, type Controller, type Format, type Frame, type Input, type Match, type Phase, type PressKind, type PuppetFrame, type SimEvent, type Swing } from "./sim";

export type MatchConfig = { seed: number; format: Format; difficulty: Difficulty; controllers: Controller[]; loadouts?: (Loadout | null)[]; teamSync?: [boolean, boolean]; cast?: (string | null)[] };

export function createConfiguredMatch(config: MatchConfig) {
  return createMatch({ seed: config.seed, difficulty: config.difficulty, format: config.format, controllers: config.controllers, loadouts: config.loadouts, teamSync: config.teamSync });
}

const PRESS_CODES: (PressKind | null)[] = [null, "hit", "smash", "drop", "special", "ultimate"];

export function encodePuppet(frame: PuppetFrame) {
  const x = Math.max(0, Math.min(800, Math.round(frame.x * 100) + 400));
  const y = Math.max(0, Math.min(1600, Math.round(frame.y * 100) + 800));
  const press = frame.press ? PRESS_CODES.indexOf(frame.press.kind) : 0;
  const flags = (frame.lunge ? 1 : 0) + press * 2 + (frame.dash ? 16 : 0) + (frame.sync ? 32 : 0);
  const rewind = frame.press ? Math.max(0, Math.min(MAX_REWIND, Math.round(frame.press.rewind))) : 0;
  return x + 1024 * (y + 2048 * (flags + 64 * rewind));
}

export function decodePuppet(code: number): PuppetFrame {
  const x = code % 1024;
  const rest = Math.floor(code / 1024);
  const y = rest % 2048;
  const rest2 = Math.floor(rest / 2048);
  const flags = rest2 % 64;
  const rewind = Math.floor(rest2 / 64);
  const frame: PuppetFrame = { x: (x - 400) / 100, y: (y - 800) / 100 };
  if (flags & 1) frame.lunge = true;
  if (flags & 16) frame.dash = true;
  if (flags & 32) frame.sync = true;
  const press = PRESS_CODES[(flags >> 1) & 7];
  if (press) frame.press = { kind: press, rewind };
  return frame;
}

class RunLog {
  private runs: number[] = [];
  private last = -1;
  private count = 0;

  push(code: number) {
    if (code === this.last) {
      this.count++;
      return;
    }
    if (this.count > 0) this.runs.push(this.last, this.count);
    this.last = code;
    this.count = 1;
  }

  toArray() {
    return this.count > 0 ? [...this.runs, this.last, this.count] : [...this.runs];
  }
}

export type MatchLogs = { inputs: Record<string, number[]>; puppets: Record<string, number[]> };

export class FrameRecorder {
  private inputs = new Map<number, RunLog>();
  private puppets = new Map<number, RunLog>();
  ticks = 0;

  constructor(controllers: Controller[], puppetSlots: number[]) {
    controllers.forEach((c, slot) => {
      if (c.kind === "human") this.inputs.set(slot, new RunLog());
      if (c.kind === "puppet" || puppetSlots.includes(slot)) this.puppets.set(slot, new RunLog());
    });
  }

  record(frame: Frame): Frame {
    const out: Frame = { inputs: {}, puppets: {} };
    for (const [slot, log] of this.inputs) {
      const code = encodeInput(frame.inputs?.[slot] ?? { mx: 0, my: 0 });
      log.push(code);
      out.inputs![slot] = decodeInput(code);
    }
    for (const [slot, log] of this.puppets) {
      const raw = frame.puppets?.[slot];
      if (!raw) continue;
      const code = encodePuppet(raw);
      log.push(code);
      out.puppets![slot] = decodePuppet(code);
    }
    this.ticks++;
    return out;
  }

  toLogs(): MatchLogs {
    const logs: MatchLogs = { inputs: {}, puppets: {} };
    for (const [slot, log] of this.inputs) logs.inputs[slot] = log.toArray();
    for (const [slot, log] of this.puppets) logs.puppets[slot] = log.toArray();
    return logs;
  }
}

function expand(runs: unknown, max: number, decode: (code: number) => unknown): unknown[] | null {
  if (!Array.isArray(runs) || runs.length % 2 !== 0) return null;
  const out: unknown[] = [];
  for (let i = 0; i < runs.length; i += 2) {
    const code = runs[i];
    const count = runs[i + 1];
    if (!Number.isInteger(code) || code < 0 || code > max || !Number.isInteger(count) || count < 1) return null;
    if (out.length + count > MAX_MATCH_TICKS) return null;
    const value = decode(code);
    for (let n = 0; n < count; n++) out.push(value);
  }
  return out;
}

export type MultiReplay = { ok: true; match: Match; ticks: number } | { ok: false; reason: "invalid_log" | "too_long" | "unfinished" };

export function replayWithLogs(config: MatchConfig, logs: unknown): MultiReplay {
  if (!logs || typeof logs !== "object") return { ok: false, reason: "invalid_log" };
  const { inputs, puppets } = logs as Partial<MatchLogs>;
  const streams = new Map<number, { kind: "input" | "puppet"; values: unknown[] }>();
  for (const [slot, c] of config.controllers.entries()) {
    if (c.kind === "bot") continue;
    const source = c.kind === "human" ? inputs?.[slot] : puppets?.[slot];
    const values = c.kind === "human" ? expand(source, INPUT_CODES - 1, decodeInput) : expand(source, 2 ** 32, decodePuppet);
    if (!values) return { ok: false, reason: "invalid_log" };
    streams.set(slot, { kind: c.kind === "human" ? "input" : "puppet", values });
  }
  const lengths = [...streams.values()].map((s) => s.values.length);
  const ticks = Math.max(0, ...lengths);
  if (lengths.some((l) => l !== ticks)) return { ok: false, reason: "invalid_log" };
  if (ticks > MAX_MATCH_TICKS) return { ok: false, reason: "too_long" };
  const match = createConfiguredMatch(config);
  let played = 0;
  for (let t = 0; t < ticks && match.winner === null; t++) {
    const frame: Frame = { inputs: {}, puppets: {} };
    for (const [slot, stream] of streams) {
      if (stream.kind === "input") frame.inputs![slot] = stream.values[t] as Input;
      else frame.puppets![slot] = stream.values[t] as PuppetFrame;
    }
    step(match, frame);
    played++;
  }
  if (match.winner === null) return { ok: false, reason: "unfinished" };
  return { ok: true, match, ticks: played };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type NetPlayer = [number, number, number, number, number, Swing["kind"] | null, number, Swing["quality"], number, number, number, number, number, number, number, number, number, number, number, number];

export type NetSnapshot = {
  t: number;
  ph: Phase;
  pt: number;
  sc: [number, number];
  sv: Side;
  ss: number;
  ip: boolean;
  lh: Side | null;
  is: boolean;
  ra: number;
  w: Side | null;
  sh: [number, number, number, number, number, number, boolean];
  pl: NetPlayer[];
  ls: Match["lastShot"];
  ev: SimEvent[];
  te: [number, number, number, number, number, number];
  st?: Match["stats"];
  wait?: string[];
};

export function encodeSnapshot(m: Match, events: SimEvent[], extras: { stats?: boolean; waiting?: string[] } = {}): NetSnapshot {
  const s = m.shuttle;
  return {
    t: m.tick,
    ph: m.phase,
    pt: m.phaseTicks,
    sc: [m.score[0], m.score[1]],
    sv: m.server,
    ss: m.serverSlot,
    ip: m.inPlay,
    lh: m.lastHitter,
    is: m.isServe,
    ra: m.rally,
    w: m.winner,
    sh: [r3(s.pos.x), r3(s.pos.y), r3(s.pos.z), r3(s.vel.x), r3(s.vel.y), r3(s.vel.z), s.netted],
    pl: m.players.map((p) => [r3(p.x), r3(p.y), r3(p.vx), r3(p.vy), p.facing, p.swing?.kind ?? null, p.swing?.t ?? 0, p.swing?.quality ?? null, p.lunge, r3(p.lungeDir.x), r3(p.lungeDir.y), p.recover, p.cooldown, r3(p.moveX), r3(p.moveY), p.energy, p.cooldowns.movement, p.cooldowns.special, p.cooldowns.ultimate, p.dash]),
    ls: m.lastShot,
    ev: events,
    te: [m.teamEnergy[0], m.teamEnergy[1], m.teamCooldown[0], m.teamCooldown[1], m.sync[0], m.sync[1]],
    ...(extras.stats ? { st: m.stats } : {}),
    ...(extras.waiting?.length ? { wait: extras.waiting } : {}),
  };
}

export function applySnapshot(m: Match, snap: NetSnapshot) {
  m.tick = snap.t;
  m.phase = snap.ph;
  m.phaseTicks = snap.pt;
  m.score = [snap.sc[0], snap.sc[1]];
  m.server = snap.sv;
  m.serverSlot = snap.ss;
  m.inPlay = snap.ip;
  m.lastHitter = snap.lh;
  m.isServe = snap.is;
  m.rally = snap.ra;
  m.winner = snap.w;
  m.shuttle.pos = { x: snap.sh[0], y: snap.sh[1], z: snap.sh[2] };
  m.shuttle.vel = { x: snap.sh[3], y: snap.sh[4], z: snap.sh[5] };
  m.shuttle.netted = snap.sh[6];
  snap.pl.forEach((row, i) => {
    const p = m.players[i];
    if (!p) return;
    [p.x, p.y, p.vx, p.vy, p.facing] = [row[0], row[1], row[2], row[3], row[4]];
    p.swing = row[5] ? { kind: row[5], t: row[6], quality: row[7] } : null;
    p.lunge = row[8];
    p.lungeDir = { x: row[9], y: row[10] };
    p.recover = row[11];
    p.cooldown = row[12];
    p.moveX = row[13];
    p.moveY = row[14];
    p.energy = row[15];
    p.cooldowns = { movement: row[16], special: row[17], ultimate: row[18] };
    p.dash = row[19];
  });
  m.lastShot = snap.ls;
  m.teamEnergy = [snap.te[0], snap.te[1]];
  m.teamCooldown = [snap.te[2], snap.te[3]];
  m.sync = [snap.te[4], snap.te[5]];
  if (snap.st) m.stats = snap.st;
  return m;
}
