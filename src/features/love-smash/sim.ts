import { botThink, createBotMind, type BotMind, type Difficulty } from "./bot";
import { DT, inServiceCourt, inSingles, serviceCourt, sideOf, sideSign, type Side } from "./court";
import { solveShot, stepShuttle, type ShotKind, type Shuttle, type Vec3 } from "./physics";
import { ACCEL, DECEL, IDLE, LUNGE_REACH, MAX_SPEED, PRESS_BUFFER, REACH, SCORE_CAP, TARGET_SCORE } from "./rules";

const WHIFF_COOLDOWN = 16;
const LUNGE_TICKS = 16;
const LUNGE_SPEED = 8.2;
const LUNGE_RECOVERY = 22;
const LUNGE_COOLDOWN = 48;
const POINT_PAUSE = 84;
const OVERHEAD_HEIGHT = 1.75;
const MAX_CONTACT_HEIGHT = 2.9;
const JUMP_CONTACT_HEIGHT = 3.15;
const MIN_CONTACT_HEIGHT = 0.12;

export type PressKind = "hit" | "smash" | "drop";
export type Quality = "perfect" | "good" | "late";

export type Input = {
  mx: number;
  my: number;
  hit?: boolean;
  smash?: boolean;
  drop?: boolean;
  lunge?: boolean;
  aim?: { x: number; depth: number };
};

export type Swing = { kind: "forehand" | "backhand" | "overhead" | "smash" | "drop" | "lift" | "whiff" | "serve"; t: number; quality: Quality | null };

export type Player = {
  side: Side;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  swing: Swing | null;
  pending: { kind: PressKind; ticks: number; aim: Input["aim"] } | null;
  cooldown: number;
  recover: number;
  lunge: number;
  lungeCooldown: number;
  lungeDir: { x: number; y: number };
  aim: Input["aim"];
  moveX: number;
  moveY: number;
};

export type Phase = "serve" | "rally" | "point" | "over";

export type PointReason = "in" | "out" | "net" | "serve_fault";

export type SimEvent =
  | { type: "hit"; side: Side; shot: ShotKind; quality: Quality; sakura: boolean; speed: number }
  | { type: "whiff"; side: Side }
  | { type: "lunge"; side: Side }
  | { type: "net"; side: Side }
  | { type: "land"; x: number; y: number; inside: boolean }
  | { type: "point"; winner: Side; reason: PointReason; score: [number, number] }
  | { type: "serve_ready"; server: Side }
  | { type: "over"; winner: Side };

export type SideStats = { perfectHits: number; smashes: number; smashWinners: number; hits: number };

export type MatchStats = { longestRally: number; rallies: number; sides: [SideStats, SideStats] };

export type MatchOptions = { seed: number; difficulty: Difficulty; tutorial?: boolean };

export type Match = {
  tick: number;
  phase: Phase;
  phaseTicks: number;
  score: [number, number];
  server: Side;
  players: [Player, Player];
  shuttle: Shuttle;
  inPlay: boolean;
  lastHitter: Side | null;
  isServe: boolean;
  lastShot: { side: Side; shot: ShotKind; quality: Quality; sakura: boolean } | null;
  rally: number;
  winner: Side | null;
  stats: MatchStats;
  bot: BotMind;
  options: MatchOptions;
  events: SimEvent[];
  lastPoint: { winner: Side; reason: PointReason } | null;
};

function newPlayer(side: Side): Player {
  return {
    side,
    x: 0,
    y: sideSign(side) * 3.2,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    swing: null,
    pending: null,
    cooldown: 0,
    recover: 0,
    lunge: 0,
    lungeCooldown: 0,
    lungeDir: { x: 0, y: 0 },
    aim: undefined,
    moveX: 0,
    moveY: 0,
  };
}

const emptyStats = (): SideStats => ({ perfectHits: 0, smashes: 0, smashWinners: 0, hits: 0 });

export function createMatch(options: MatchOptions): Match {
  const match: Match = {
    tick: 0,
    phase: "serve",
    phaseTicks: 0,
    score: [0, 0],
    server: options.tutorial ? 1 : 0,
    players: [newPlayer(0), newPlayer(1)],
    shuttle: { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, netted: false },
    inPlay: false,
    lastHitter: null,
    isServe: false,
    lastShot: null,
    rally: 0,
    winner: null,
    stats: { longestRally: 0, rallies: 0, sides: [emptyStats(), emptyStats()] },
    bot: createBotMind(options.difficulty, options.seed),
    options,
    events: [],
    lastPoint: null,
  };
  setupServe(match);
  return match;
}

function setupServe(m: Match) {
  const court = serviceCourt(m.server, m.score[m.server]);
  const server = m.players[m.server];
  const receiver = m.players[court.receiver];
  for (const p of m.players) {
    p.vx = 0;
    p.vy = 0;
    p.swing = null;
    p.pending = null;
    p.cooldown = 0;
    p.recover = 0;
    p.lunge = 0;
    p.lungeCooldown = 0;
  }
  server.x = court.serverX;
  server.y = sideSign(m.server) * 2.6;
  receiver.x = court.receiverX;
  receiver.y = sideSign(court.receiver) * 2.7;
  m.shuttle.netted = false;
  m.shuttle.vel = { x: 0, y: 0, z: 0 };
  holdShuttle(m);
  m.inPlay = false;
  m.lastHitter = null;
  m.isServe = false;
  m.lastShot = null;
  m.rally = 0;
  m.phase = "serve";
  m.phaseTicks = 0;
  m.events.push({ type: "serve_ready", server: m.server });
}

function holdShuttle(m: Match) {
  const server = m.players[m.server];
  m.shuttle.pos = { x: server.x + 0.32 * (m.server === 0 ? 1 : -1), y: server.y + sideSign(m.server) * -0.25, z: 1.0 };
}

function clampToSide(p: Player) {
  const s = sideSign(p.side);
  p.x = Math.max(-3.4, Math.min(3.4, p.x));
  const depth = Math.max(0.35, Math.min(7.6, p.y * s));
  if (depth !== p.y * s) {
    if (p.y * s < 0.35 && p.vy * s < 0) p.vy = 0;
    if (p.y * s > 7.6 && p.vy * s > 0) p.vy = 0;
  }
  p.y = depth * s;
}

function normalizeMove(input: Input) {
  let x = input.mx;
  let y = input.my;
  const len = Math.sqrt(x * x + y * y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

function movePlayer(m: Match, p: Player, input: Input) {
  const dir = normalizeMove(input);
  p.moveX = dir.x;
  p.moveY = dir.y;
  if (p.cooldown > 0) p.cooldown--;
  if (p.lungeCooldown > 0) p.lungeCooldown--;
  if (p.recover > 0) p.recover--;

  const serving = m.phase === "serve";
  if (input.lunge && p.lunge === 0 && p.lungeCooldown === 0 && p.recover === 0 && !serving) {
    let lx = dir.x;
    let ly = dir.y;
    if (lx === 0 && ly === 0) {
      lx = m.shuttle.pos.x - p.x;
      ly = m.shuttle.pos.y - p.y;
    }
    const len = Math.sqrt(lx * lx + ly * ly) || 1;
    p.lungeDir = { x: lx / len, y: ly / len };
    p.lunge = LUNGE_TICKS;
    p.lungeCooldown = LUNGE_COOLDOWN;
    m.events.push({ type: "lunge", side: p.side });
  }

  if (p.lunge > 0) {
    const fade = p.lunge / LUNGE_TICKS;
    p.vx = p.lungeDir.x * LUNGE_SPEED * (0.4 + 0.6 * fade);
    p.vy = p.lungeDir.y * LUNGE_SPEED * (0.4 + 0.6 * fade);
    p.lunge--;
    if (p.lunge === 0) p.recover = Math.max(p.recover, LUNGE_RECOVERY);
  } else if (serving && m.server === p.side) {
    p.vx = 0;
    p.vy = 0;
  } else {
    const scale = (p.recover > 0 ? 0.45 : 1) * (p.side === 1 ? m.bot.speedScale : 1);
    const tx = dir.x * MAX_SPEED * scale;
    const ty = dir.y * MAX_SPEED * scale;
    let dx = tx - p.vx;
    let dy = ty - p.vy;
    const dlen = Math.sqrt(dx * dx + dy * dy);
    const limit = (tx === 0 && ty === 0 ? DECEL : ACCEL) * DT;
    if (dlen > limit) {
      dx = (dx / dlen) * limit;
      dy = (dy / dlen) * limit;
    }
    p.vx += dx;
    p.vy += dy;
  }
  p.x += p.vx * DT;
  p.y += p.vy * DT;
  clampToSide(p);
  if (Math.abs(p.vx) > 0.3) p.facing = p.vx > 0 ? 1 : -1;
  if (p.swing) {
    p.swing.t++;
    if (p.swing.t > 22) p.swing = null;
  }
}

function contact(m: Match, p: Player) {
  const s = m.shuttle;
  if (!m.inPlay || s.netted || m.lastHitter === p.side || sideOf(s.pos.y) !== p.side) return null;
  const dx = s.pos.x - p.x;
  const dy = s.pos.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const reach = p.lunge > 0 ? LUNGE_REACH : REACH;
  if (d > reach || s.pos.z < MIN_CONTACT_HEIGHT || s.pos.z > JUMP_CONTACT_HEIGHT) return null;
  return { d, z: s.pos.z };
}

export function quality(d: number, z: number): Quality {
  const height = z >= 1.9 ? 0 : z >= 1.1 ? 0.2 : z >= 0.75 ? 0.4 : 0.6;
  const score = height + (d / REACH) * 0.6;
  if (score <= 0.36) return "perfect";
  if (score <= 0.75) return "good";
  return "late";
}

function chooseShot(press: PressKind, z: number, depth: number): ShotKind {
  if (press === "smash") return z >= OVERHEAD_HEIGHT ? "smash" : "drive";
  if (press === "drop") return "drop";
  if (z >= OVERHEAD_HEIGHT) return "clear";
  if (z >= 0.95 && depth > 1.6) return "drive";
  return "lift";
}

function aimTarget(m: Match, p: Player, shot: ShotKind, q: Quality, aim: Input["aim"]) {
  const opp = m.players[p.side === 0 ? 1 : 0];
  const s = sideSign(opp.side);
  let x: number;
  let depthShift = 0;
  if (aim) {
    x = aim.x;
    depthShift = aim.depth;
  } else {
    const away = opp.x > 0.15 ? -1 : opp.x < -0.15 ? 1 : p.x >= 0 ? -1 : 1;
    x = away * 1.6;
  }
  const pull = q === "perfect" ? 0 : q === "good" ? 0.25 : 0.55;
  x = x * (1 - pull);
  x = Math.max(-2.9, Math.min(2.9, x));
  const base: Record<ShotKind, number> = { clear: 5.9, lift: 5.7, drop: 1.4, drive: 4.8, smash: 4.2, serve_high: 5.8, serve_short: 2.35 };
  let depth = base[shot] + depthShift;
  if (q === "late") depth += shot === "drop" ? 1.1 : shot === "clear" || shot === "lift" ? -1.7 : -0.6;
  if (q === "good" && (shot === "clear" || shot === "lift")) depth -= 0.4;
  depth = Math.max(0.6, Math.min(6.25, depth));
  return { x, y: s * depth };
}

function executeHit(m: Match, p: Player, press: PressKind, aim: Input["aim"], hitQuality: Quality) {
  const s = m.shuttle;
  const shot = chooseShot(press, s.pos.z, Math.abs(p.y));
  const target = aimTarget(m, p, shot, hitQuality, aim);
  const sakura = shot === "smash" && hitQuality === "perfect" && s.pos.z >= 2.3;
  const bonus = shot === "smash" ? (sakura ? 6 : hitQuality === "perfect" ? 3 : hitQuality === "late" ? -5 : 0) : 0;
  const from: Vec3 = { ...s.pos };
  s.vel = solveShot(from, target, shot, bonus);
  m.lastHitter = p.side;
  m.isServe = false;
  m.rally++;
  const st = m.stats.sides[p.side];
  st.hits++;
  if (hitQuality === "perfect") st.perfectHits++;
  if (shot === "smash") st.smashes++;
  m.lastShot = { side: p.side, shot, quality: hitQuality, sakura };
  const dx = s.pos.x - p.x;
  p.swing = {
    kind: shot === "smash" ? "smash" : shot === "clear" ? "overhead" : shot === "drop" ? "drop" : shot === "lift" ? "lift" : dx * (p.side === 0 ? 1 : -1) >= 0 ? "forehand" : "backhand",
    t: 0,
    quality: hitQuality,
  };
  if (shot === "smash") p.recover = Math.max(p.recover, sakura ? 24 : 18);
  m.events.push({ type: "hit", side: p.side, shot, quality: hitQuality, sakura, speed: Math.sqrt(s.vel.x * s.vel.x + s.vel.y * s.vel.y + s.vel.z * s.vel.z) });
}

function serve(m: Match, press: PressKind) {
  const p = m.players[m.server];
  const court = serviceCourt(m.server, m.score[m.server]);
  const short = press === "drop";
  const shot: ShotKind = short ? "serve_short" : "serve_high";
  const s = sideSign(court.receiver);
  const target = { x: court.targetX * (short ? 0.9 : 1.35), y: s * (short ? 2.35 : 5.8) };
  m.shuttle.vel = solveShot({ ...m.shuttle.pos }, target, shot);
  m.inPlay = true;
  m.lastHitter = m.server;
  m.isServe = true;
  m.rally = 1;
  m.stats.sides[m.server].hits++;
  m.lastShot = { side: m.server, shot, quality: "good", sakura: false };
  m.phase = "rally";
  m.phaseTicks = 0;
  p.swing = { kind: "serve", t: 0, quality: null };
  m.events.push({ type: "hit", side: m.server, shot, quality: "good", sakura: false, speed: 0 });
}

function handlePresses(m: Match, p: Player, input: Input) {
  const press: PressKind | null = input.smash ? "smash" : input.drop ? "drop" : input.hit ? "hit" : null;
  if (press && p.cooldown === 0 && !p.pending && !(p.swing && p.swing.kind !== "whiff" && p.swing.t < 8)) {
    p.pending = { kind: press, ticks: PRESS_BUFFER, aim: input.aim };
  }
  if (!p.pending) return;
  if (m.phase === "serve") {
    if (m.server === p.side && m.phaseTicks > 12) serve(m, p.pending.kind);
    p.pending = null;
    return;
  }
  if (m.phase !== "rally") {
    p.pending = null;
    return;
  }
  const c = contact(m, p);
  const smashJump = p.pending.kind === "smash";
  if (c && (c.z <= MAX_CONTACT_HEIGHT || smashJump)) {
    const aim = p.pending.aim ?? (p.side === 0 && (p.moveX !== 0 || p.moveY !== 0) ? { x: p.moveX * 2.1, depth: p.moveY > 0.3 ? -0.9 : p.moveY < -0.3 ? 0.25 : 0 } : undefined);
    executeHit(m, p, p.pending.kind, aim, quality(c.d, c.z));
    p.pending = null;
    return;
  }
  p.pending.ticks--;
  if (p.pending.ticks <= 0) {
    p.pending = null;
    p.cooldown = WHIFF_COOLDOWN;
    p.swing = { kind: "whiff", t: 0, quality: null };
    m.events.push({ type: "whiff", side: p.side });
  }
}

function awardPoint(m: Match, winner: Side, reason: PointReason) {
  m.score[winner]++;
  m.stats.rallies++;
  m.stats.longestRally = Math.max(m.stats.longestRally, m.rally);
  if (m.lastShot?.shot === "smash" && m.lastShot.side === winner && reason === "in") m.stats.sides[winner].smashWinners++;
  m.inPlay = false;
  m.lastPoint = { winner, reason };
  m.events.push({ type: "point", winner, reason, score: [m.score[0], m.score[1]] });
  const [a, b] = m.score;
  const top = Math.max(a, b);
  const done = !m.options.tutorial && ((top >= TARGET_SCORE && Math.abs(a - b) >= 2) || top >= SCORE_CAP);
  if (done) {
    m.winner = a > b ? 0 : 1;
    m.phase = "over";
    m.events.push({ type: "over", winner: m.winner });
  } else {
    m.phase = "point";
  }
  m.phaseTicks = 0;
  m.server = winner;
  for (const p of m.players) p.pending = null;
}

function resolveLanding(m: Match) {
  const { x, y } = m.shuttle.pos;
  const landSide = sideOf(y);
  const hitter = m.lastHitter ?? m.server;
  const inside = m.isServe ? inServiceCourt(m.server, m.score[m.server], x, y) : inSingles(x, y);
  m.events.push({ type: "land", x, y, inside });
  if (m.shuttle.netted) {
    awardPoint(m, hitter === 0 ? 1 : 0, "net");
    return;
  }
  if (landSide === hitter) {
    awardPoint(m, hitter === 0 ? 1 : 0, m.isServe ? "serve_fault" : "out");
    return;
  }
  if (inside) awardPoint(m, hitter, "in");
  else awardPoint(m, landSide, m.isServe ? "serve_fault" : "out");
}

export function step(m: Match, human: Input) {
  m.events = [];
  m.tick++;
  m.phaseTicks++;
  if (m.phase === "over") return m;
  const botInput = botThink(m, m.bot, 1);
  const inputs: [Input, Input] = [human, botInput];
  for (const p of m.players) movePlayer(m, p, m.phase === "point" ? IDLE : inputs[p.side]);
  if (m.phase === "serve") holdShuttle(m);
  for (const p of m.players) handlePresses(m, p, m.phase === "point" ? IDLE : inputs[p.side]);
  if (m.phase === "rally" && m.inPlay && m.phaseTicks > 0) {
    const outcome = stepShuttle(m.shuttle);
    if (outcome === "net") m.events.push({ type: "net", side: m.lastHitter ?? m.server });
    if (outcome === "landed") resolveLanding(m);
  } else if (m.phase === "point" && m.shuttle.pos.z > 0) {
    if (stepShuttle(m.shuttle) === "landed") m.shuttle.pos.z = 0;
  }
  if (m.phase === "point" && m.phaseTicks >= POINT_PAUSE) setupServe(m);
  return m;
}

