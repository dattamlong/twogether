import { botThink, createBotMind, profileFor, type BotMind, type Difficulty } from "./bot";
import { COURT, DT, inDoubles, inDoublesServiceCourt, inServiceCourt, inSingles, serviceCourt, sideOf, sideSign, type Side } from "./court";
import { solveShot, stepShuttle, type ShotKind, type Shuttle, type Vec3 } from "./physics";
import { ACCEL, DECEL, IDLE, LUNGE_REACH, LUNGE_SPEED, MAX_SPEED, PRESS_BUFFER, REACH, SCORE_CAP, TARGET_SCORE } from "./rules";
import { EMPTY_LOADOUT, FULL_LOADOUT, SKILL_BALANCE, SKILLS, type Loadout, type SkillCategory, type SkillId } from "./skills";

const WHIFF_COOLDOWN = 22;
const LUNGE_TICKS = 16;
const LUNGE_RECOVERY = 22;
const LUNGE_COOLDOWN = 48;
const POINT_PAUSE = 84;
const OVERHEAD_HEIGHT = 1.75;
const MAX_CONTACT_HEIGHT = 2.9;
const JUMP_CONTACT_HEIGHT = 3.15;
const MIN_CONTACT_HEIGHT = 0.12;
const HISTORY = 30;
export const MAX_REWIND = 24;
const PUPPET_STEP = LUNGE_SPEED * DT * 1.1;
const TEAMMATE_GAP = 0.55;

export type PressKind = "hit" | "smash" | "drop" | "special" | "ultimate";
export type Quality = "perfect" | "good" | "late";
export type Format = "singles" | "doubles";

export type Input = {
  mx: number;
  my: number;
  hit?: boolean;
  smash?: boolean;
  drop?: boolean;
  lunge?: boolean;
  dash?: boolean;
  special?: boolean;
  ultimate?: boolean;
  sync?: boolean;
  aim?: { x: number; depth: number };
};

export type PuppetFrame = { x: number; y: number; lunge?: boolean; dash?: boolean; sync?: boolean; press?: { kind: PressKind; rewind: number } };

export type Controller = { kind: "human" } | { kind: "puppet" } | { kind: "bot"; difficulty: Difficulty; persona?: string };

export type Swing = { kind: "forehand" | "backhand" | "overhead" | "smash" | "drop" | "lift" | "whiff" | "serve"; t: number; quality: Quality | null };

export type Player = {
  side: Side;
  slot: number;
  index: 0 | 1;
  control: Controller["kind"];
  speedScale: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  swing: Swing | null;
  pending: { kind: PressKind; ticks: number; aim: Input["aim"]; rewind: number } | null;
  cooldown: number;
  recover: number;
  lunge: number;
  lungeCooldown: number;
  lungeDir: { x: number; y: number };
  aim: Input["aim"];
  moveX: number;
  moveY: number;
  energy: number;
  rallyGain: number;
  cooldowns: Record<SkillCategory, number>;
  dash: number;
  dashDir: { x: number; y: number };
  dashedAt: number;
  loadout: Loadout;
};

export type Phase = "serve" | "rally" | "point" | "over";

export type PointReason = "in" | "out" | "net" | "serve_fault";

export type ComboKind = "love_combo" | "sakura_duo" | "teamwork";

export type SimEvent =
  | { type: "hit"; side: Side; slot: number; shot: ShotKind; quality: Quality; sakura: boolean; save: boolean; speed: number; skill: SkillId | null; sync: boolean }
  | { type: "skill"; side: Side; slot: number; skill: SkillId | "love_sync" }
  | { type: "skill_fail"; side: Side; slot: number; skill: SkillId | "love_sync" | null; reason: "energy" | "cooldown" | "locked" | "position" }
  | { type: "counter"; side: Side; slot: number }
  | { type: "sync_ready"; side: Side }
  | { type: "whiff"; side: Side; slot: number }
  | { type: "lunge"; side: Side; slot: number }
  | { type: "net"; side: Side }
  | { type: "land"; x: number; y: number; inside: boolean }
  | { type: "point"; winner: Side; reason: PointReason; score: [number, number] }
  | { type: "combo"; side: Side; kind: ComboKind }
  | { type: "serve_ready"; server: Side; serverSlot: number }
  | { type: "over"; winner: Side };

export type SideStats = { perfectHits: number; smashes: number; smashWinners: number; hits: number; combos: number };

export type PlayerStats = { perfectHits: number; smashes: number; smashWinners: number; hits: number; saves: number; drops: number };

export type MatchStats = { longestRally: number; rallies: number; sides: [SideStats, SideStats]; players: PlayerStats[] };

export type MatchOptions = { seed: number; difficulty: Difficulty; tutorial?: boolean; format?: Format; controllers?: Controller[]; loadouts?: (Loadout | null)[]; teamSync?: [boolean, boolean] };

type ShuttleFrame = { pos: Vec3; vel: Vec3; netted: boolean; lastHitter: Side | null; inPlay: boolean };

export type Match = {
  tick: number;
  phase: Phase;
  phaseTicks: number;
  score: [number, number];
  server: Side;
  serverSlot: number;
  courtRight: [number, number];
  players: Player[];
  shuttle: Shuttle;
  inPlay: boolean;
  lastHitter: Side | null;
  isServe: boolean;
  lastShot: { side: Side; slot: number; shot: ShotKind; quality: Quality; sakura: boolean } | null;
  rally: number;
  rallyLog: { slot: number; side: Side; save: boolean; perfect: boolean; smash: boolean }[];
  winner: Side | null;
  stats: MatchStats;
  minds: (BotMind | null)[];
  bot: BotMind;
  format: Format;
  options: MatchOptions;
  teamEnergy: [number, number];
  teamCooldown: [number, number];
  sync: [number, number];
  teamSync: [boolean, boolean];
  lastTeamHitter: [number, number];
  history: ShuttleFrame[];
  events: SimEvent[];
  lastPoint: { winner: Side; reason: PointReason } | null;
};

export const teamOf = (slot: number): Side => (slot % 2) as Side;

function newPlayer(slot: number, control: Controller, loadout: Loadout | null | undefined): Player {
  const side = teamOf(slot);
  return {
    side,
    slot,
    index: (slot < 2 ? 0 : 1) as 0 | 1,
    control: control.kind,
    speedScale: control.kind === "bot" ? profileFor(control.difficulty, control.persona).speedScale : 1,
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
    energy: 0,
    rallyGain: 0,
    cooldowns: { movement: 0, special: 0, ultimate: 0 },
    dash: 0,
    dashDir: { x: 0, y: 0 },
    dashedAt: -9999,
    loadout: loadout ?? (control.kind === "bot" ? { ...FULL_LOADOUT, special: profileFor(control.difficulty, control.persona).special } : EMPTY_LOADOUT),
  };
}

const emptySide = (): SideStats => ({ perfectHits: 0, smashes: 0, smashWinners: 0, hits: 0, combos: 0 });
const emptyPlayer = (): PlayerStats => ({ perfectHits: 0, smashes: 0, smashWinners: 0, hits: 0, saves: 0, drops: 0 });

export function defaultControllers(format: Format, difficulty: Difficulty): Controller[] {
  const bot: Controller = { kind: "bot", difficulty };
  return format === "doubles" ? [{ kind: "human" }, bot, bot, bot] : [{ kind: "human" }, bot];
}

export function createMatch(options: MatchOptions): Match {
  const format = options.format ?? "singles";
  const controllers = options.controllers ?? defaultControllers(format, options.difficulty);
  const players = controllers.map((c, slot) => newPlayer(slot, c, options.loadouts?.[slot]));
  const minds = controllers.map((c, slot) => (c.kind === "bot" ? createBotMind(c.difficulty, slot === 1 ? options.seed : options.seed + slot * 7919, c.persona) : null));
  const match: Match = {
    tick: 0,
    phase: "serve",
    phaseTicks: 0,
    score: [0, 0],
    server: options.tutorial ? 1 : 0,
    serverSlot: options.tutorial ? 1 : 0,
    courtRight: [0, 1],
    players,
    shuttle: { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, netted: false },
    inPlay: false,
    lastHitter: null,
    isServe: false,
    lastShot: null,
    rally: 0,
    rallyLog: [],
    winner: null,
    stats: { longestRally: 0, rallies: 0, sides: [emptySide(), emptySide()], players: players.map(emptyPlayer) },
    minds,
    bot: (minds[1] ?? createBotMind(options.difficulty, options.seed)) as BotMind,
    format,
    options,
    teamEnergy: [0, 0],
    teamCooldown: [0, 0],
    sync: [0, 0],
    teamSync: options.teamSync ?? [true, true],
    lastTeamHitter: [-1, -1],
    history: [],
    events: [],
    lastPoint: null,
  };
  setupServe(match);
  return match;
}

export function teammates(m: Match, slot: number) {
  return m.players.filter((p) => p.side === m.players[slot].side && p.slot !== slot);
}

function slotInCourt(m: Match, side: Side, right: boolean) {
  const team = m.players.filter((p) => p.side === side);
  if (team.length === 1) return team[0].slot;
  const r = m.courtRight[side];
  return right ? r : team.find((p) => p.slot !== r)!.slot;
}

function setupServe(m: Match) {
  const court = serviceCourt(m.server, m.score[m.server]);
  const right = m.score[m.server] % 2 === 0;
  m.serverSlot = slotInCourt(m, m.server, right);
  const receiverSlot = slotInCourt(m, court.receiver, right);
  for (const p of m.players) {
    p.vx = 0;
    p.vy = 0;
    p.swing = null;
    p.pending = null;
    p.cooldown = 0;
    p.recover = 0;
    p.lunge = 0;
    p.lungeCooldown = 0;
    p.dash = 0;
    p.rallyGain = 0;
  }
  m.lastTeamHitter = [-1, -1];
  const server = m.players[m.serverSlot];
  const receiver = m.players[receiverSlot];
  server.x = court.serverX;
  server.y = sideSign(m.server) * 2.6;
  receiver.x = court.receiverX;
  receiver.y = sideSign(court.receiver) * 2.7;
  for (const p of m.players) {
    if (p === server || p === receiver) continue;
    const partner = p.side === m.server ? server : receiver;
    p.x = -partner.x * 0.9;
    p.y = sideSign(p.side) * (p.side === m.server ? 4.4 : 4.1);
  }
  m.shuttle.netted = false;
  m.shuttle.vel = { x: 0, y: 0, z: 0 };
  holdShuttle(m);
  m.inPlay = false;
  m.lastHitter = null;
  m.isServe = false;
  m.lastShot = null;
  m.rally = 0;
  m.rallyLog = [];
  m.history = [];
  m.phase = "serve";
  m.phaseTicks = 0;
  m.events.push({ type: "serve_ready", server: m.server, serverSlot: m.serverSlot });
}

function holdShuttle(m: Match) {
  const server = m.players[m.serverSlot];
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

function tickTimers(p: Player) {
  if (p.cooldown > 0) p.cooldown--;
  if (p.lungeCooldown > 0) p.lungeCooldown--;
  if (p.recover > 0) p.recover--;
  if (p.cooldowns.movement > 0) p.cooldowns.movement--;
  if (p.cooldowns.special > 0) p.cooldowns.special--;
  if (p.cooldowns.ultimate > 0) p.cooldowns.ultimate--;
}

export function skillState(p: Player, category: SkillCategory): { skill: SkillId | null; ready: boolean; reason: "energy" | "cooldown" | "locked" | null } {
  const skill = p.loadout[category];
  if (!skill) return { skill: null, ready: false, reason: "locked" };
  if (p.cooldowns[category] > 0) return { skill, ready: false, reason: "cooldown" };
  if (p.energy < SKILLS[skill].cost) return { skill, ready: false, reason: "energy" };
  return { skill, ready: true, reason: null };
}

function spend(p: Player, category: SkillCategory) {
  const skill = p.loadout[category]!;
  p.energy -= SKILLS[skill].cost;
  p.cooldowns[category] = SKILLS[skill].cooldown;
}

function tryDash(m: Match, p: Player, dirX: number, dirY: number) {
  if (m.phase === "serve" || p.dash > 0 || p.lunge > 0) return;
  const state = skillState(p, "movement");
  if (!state.ready) {
    m.events.push({ type: "skill_fail", side: p.side, slot: p.slot, skill: state.skill, reason: state.reason ?? "locked" });
    return;
  }
  let lx = dirX;
  let ly = dirY;
  if (lx === 0 && ly === 0) {
    lx = m.shuttle.pos.x - p.x;
    ly = m.shuttle.pos.y - p.y;
  }
  const len = Math.sqrt(lx * lx + ly * ly) || 1;
  spend(p, "movement");
  p.dashDir = { x: lx / len, y: ly / len };
  p.dash = SKILL_BALANCE.dash.ticks;
  p.dashedAt = m.tick;
  m.events.push({ type: "skill", side: p.side, slot: p.slot, skill: state.skill! });
}

function trySync(m: Match, p: Player) {
  const side = p.side;
  const cost = SKILL_BALANCE.sync.cost;
  if (m.format !== "doubles" || !m.teamSync[side] || m.sync[side] > 0) {
    m.events.push({ type: "skill_fail", side, slot: p.slot, skill: "love_sync", reason: "locked" });
    return;
  }
  if (m.teamCooldown[side] > 0 || m.teamEnergy[side] < cost) {
    m.events.push({ type: "skill_fail", side, slot: p.slot, skill: "love_sync", reason: m.teamCooldown[side] > 0 ? "cooldown" : "energy" });
    return;
  }
  m.teamEnergy[side] -= cost;
  m.teamCooldown[side] = SKILL_BALANCE.sync.cooldown;
  m.sync[side] = SKILL_BALANCE.sync.window;
  m.events.push({ type: "skill", side, slot: p.slot, skill: "love_sync" });
}

function gainEnergy(m: Match, p: Player, amount: number) {
  const room = Math.max(0, SKILL_BALANCE.rallyGainCap - p.rallyGain);
  const add = Math.min(amount, room, SKILL_BALANCE.maxEnergy - p.energy);
  if (add <= 0) return;
  p.energy += add;
  p.rallyGain += add;
}

function gainTeam(m: Match, side: Side, amount: number) {
  if (!m.teamSync[side] || m.format !== "doubles") return;
  const before = m.teamEnergy[side];
  m.teamEnergy[side] = Math.min(SKILL_BALANCE.sync.cost, before + amount);
  if (before < SKILL_BALANCE.sync.cost && m.teamEnergy[side] >= SKILL_BALANCE.sync.cost && m.teamCooldown[side] === 0) m.events.push({ type: "sync_ready", side });
}

function startLunge(m: Match, p: Player, dirX: number, dirY: number) {
  let lx = dirX;
  let ly = dirY;
  if (lx === 0 && ly === 0) {
    lx = m.shuttle.pos.x - p.x;
    ly = m.shuttle.pos.y - p.y;
  }
  const len = Math.sqrt(lx * lx + ly * ly) || 1;
  p.lungeDir = { x: lx / len, y: ly / len };
  p.lunge = LUNGE_TICKS;
  p.lungeCooldown = LUNGE_COOLDOWN;
  m.events.push({ type: "lunge", side: p.side, slot: p.slot });
}

function advanceSwing(p: Player) {
  if (Math.abs(p.vx) > 0.3) p.facing = p.vx > 0 ? 1 : -1;
  if (p.swing) {
    p.swing.t++;
    if (p.swing.t > 22) p.swing = null;
  }
}

export function movePlayer(m: Match, p: Player, input: Input) {
  const dir = normalizeMove(input);
  p.moveX = dir.x;
  p.moveY = dir.y;
  tickTimers(p);
  const serving = m.phase === "serve";
  if (input.dash) tryDash(m, p, dir.x, dir.y);
  if (input.lunge && p.lunge === 0 && p.dash === 0 && p.lungeCooldown === 0 && p.recover === 0 && !serving) startLunge(m, p, dir.x, dir.y);

  if (p.dash > 0) {
    const fade = p.dash / SKILL_BALANCE.dash.ticks;
    p.vx = p.dashDir.x * SKILL_BALANCE.dash.speed * (0.5 + 0.5 * fade);
    p.vy = p.dashDir.y * SKILL_BALANCE.dash.speed * (0.5 + 0.5 * fade);
    p.dash--;
  } else if (p.lunge > 0) {
    const fade = p.lunge / LUNGE_TICKS;
    p.vx = p.lungeDir.x * LUNGE_SPEED * (0.4 + 0.6 * fade);
    p.vy = p.lungeDir.y * LUNGE_SPEED * (0.4 + 0.6 * fade);
    p.lunge--;
    if (p.lunge === 0) p.recover = Math.max(p.recover, LUNGE_RECOVERY);
  } else if (serving && m.serverSlot === p.slot) {
    p.vx = 0;
    p.vy = 0;
  } else {
    const scale = (p.recover > 0 ? 0.45 : 1) * p.speedScale;
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
  advanceSwing(p);
}

function movePuppet(m: Match, p: Player, frame: PuppetFrame) {
  tickTimers(p);
  if (frame.dash) tryDash(m, p, frame.x - p.x, frame.y - p.y);
  const stepLimit = p.dash > 0 ? SKILL_BALANCE.dash.speed * DT * 1.1 : PUPPET_STEP;
  if (p.dash > 0) p.dash--;
  const serving = m.phase === "serve" && m.serverSlot === p.slot;
  const s = sideSign(p.side);
  const tx = Math.max(-3.4, Math.min(3.4, frame.x));
  const ty = Math.max(0.35, Math.min(7.6, frame.y * s)) * s;
  let dx = serving ? 0 : tx - p.x;
  let dy = serving ? 0 : ty - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > stepLimit) {
    dx = (dx / d) * stepLimit;
    dy = (dy / d) * stepLimit;
  }
  p.moveX = d > 0.001 ? dx / (d > stepLimit ? stepLimit : d || 1) : 0;
  p.moveY = d > 0.001 ? dy / (d > stepLimit ? stepLimit : d || 1) : 0;
  p.vx = dx / DT;
  p.vy = dy / DT;
  p.x += dx;
  p.y += dy;
  clampToSide(p);
  if (frame.lunge && p.lunge === 0 && p.lungeCooldown === 0 && !m.phase.startsWith("serve")) startLunge(m, p, p.moveX, p.moveY);
  else if (p.lunge > 0) {
    p.lunge--;
    if (p.lunge === 0) p.recover = Math.max(p.recover, LUNGE_RECOVERY);
  }
  advanceSwing(p);
}

function separate(m: Match) {
  for (let i = 0; i < m.players.length; i++) {
    for (let j = i + 1; j < m.players.length; j++) {
      const a = m.players[i];
      const b = m.players[j];
      if (a.side !== b.side) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= TEAMMATE_GAP) continue;
      const nx = d > 0.0001 ? dx / d : 1;
      const ny = d > 0.0001 ? dy / d : 0;
      const push = (TEAMMATE_GAP - d) / 2;
      const aMoves = a.control !== "puppet";
      const bMoves = b.control !== "puppet";
      const share = aMoves && bMoves ? push : push * 2;
      if (aMoves) {
        a.x -= nx * share;
        a.y -= ny * share;
        clampToSide(a);
      }
      if (bMoves) {
        b.x += nx * share;
        b.y += ny * share;
        clampToSide(b);
      }
    }
  }
}

function shuttleAt(m: Match, rewind: number): ShuttleFrame {
  if (rewind <= 0 || m.history.length === 0) return { pos: m.shuttle.pos, vel: m.shuttle.vel, netted: m.shuttle.netted, lastHitter: m.lastHitter, inPlay: m.inPlay };
  const index = Math.max(0, m.history.length - 1 - rewind);
  return m.history[index];
}

function contact(m: Match, p: Player, rewind = 0) {
  if (!m.inPlay || m.shuttle.netted || m.lastHitter === p.side) return null;
  const s = shuttleAt(m, rewind);
  if (!s.inPlay || s.netted || s.lastHitter === p.side || sideOf(s.pos.y) !== p.side) return null;
  const dx = s.pos.x - p.x;
  const dy = s.pos.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const reach = p.lunge > 0 ? LUNGE_REACH : REACH;
  if (d > reach || s.pos.z < MIN_CONTACT_HEIGHT || s.pos.z > JUMP_CONTACT_HEIGHT) return null;
  return { d, z: s.pos.z, frame: s };
}

export function hittable(m: Match, slot: number) {
  const p = m.players[slot];
  return m.phase === "rally" && p.cooldown === 0 && contact(m, p) !== null;
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
  const opponents = m.players.filter((o) => o.side !== p.side);
  const s = sideSign(opponents[0].side);
  let x: number;
  let depthShift = 0;
  if (aim) {
    x = aim.x;
    depthShift = aim.depth;
  } else if (opponents.length === 1) {
    const opp = opponents[0];
    const away = opp.x > 0.15 ? -1 : opp.x < -0.15 ? 1 : p.x >= 0 ? -1 : 1;
    x = away * 1.6;
  } else {
    let best = 0;
    let bestGap = -1;
    for (const cx of [-2.2, -1.1, 0, 1.1, 2.2]) {
      const gap = Math.min(...opponents.map((o) => Math.abs(o.x - cx)));
      if (gap > bestGap + 1e-9) {
        bestGap = gap;
        best = cx;
      }
    }
    x = best;
  }
  const pull = q === "perfect" ? 0 : q === "good" ? 0.25 : 0.55;
  x = x * (1 - pull);
  const limit = m.format === "doubles" ? 3.4 : 2.9;
  x = Math.max(-limit, Math.min(limit, x));
  const base: Record<ShotKind, number> = { clear: 5.9, lift: 5.7, drop: 1.4, drive: 4.8, smash: 4.2, serve_high: 5.8, serve_short: 2.35, frost_drop: 1.05, phoenix_drive: 5.3, meteor: 4.2 };
  let depth = base[shot] + depthShift;
  if (q === "late") depth += shot === "drop" ? 1.1 : shot === "clear" || shot === "lift" ? -1.7 : -0.6;
  if (q === "good" && (shot === "clear" || shot === "lift")) depth -= 0.4;
  depth = Math.max(0.6, Math.min(6.25, depth));
  return { x, y: s * depth };
}

function executeHit(m: Match, p: Player, press: PressKind, aim: Input["aim"], hitQuality: Quality, reachUsed: number, from: ShuttleFrame, rewind: number) {
  const s = m.shuttle;
  const save = p.lunge > 0 || p.dash > 0 || (reachUsed > REACH * 0.8 && from.pos.z < 1.1);
  const incoming = m.lastShot;
  let skill: SkillId | null = null;
  let shot: ShotKind;
  if (press === "special" && p.loadout.special && skillState(p, "special").ready) {
    skill = p.loadout.special;
    shot = skill === "frost_drop" ? "frost_drop" : "phoenix_drive";
  } else if (press === "ultimate" && p.loadout.ultimate && skillState(p, "ultimate").ready && from.pos.z >= SKILL_BALANCE.meteor.minHeight && hitQuality !== "late") {
    skill = p.loadout.ultimate;
    shot = "meteor";
  } else {
    if (press === "ultimate" || press === "special") m.events.push({ type: "skill_fail", side: p.side, slot: p.slot, skill: press === "ultimate" ? p.loadout.ultimate : p.loadout.special, reason: "position" });
    shot = chooseShot(press === "ultimate" ? "smash" : press === "special" ? "hit" : press, from.pos.z, Math.abs(p.y));
  }
  if (skill) spend(p, SKILLS[skill].category);
  const synced = m.sync[p.side] > 0 && (shot === "smash" || shot === "meteor" || shot === "drive" || shot === "phoenix_drive" || shot === "drop" || shot === "frost_drop");
  if (synced) m.sync[p.side] = 0;
  const placement: Quality = skill === "frost_drop" || synced ? "perfect" : hitQuality;
  const target = aimTarget(m, p, shot, placement, aim);
  if (shot === "frost_drop") target.y = sideSign(p.side === 0 ? 1 : 0) * SKILL_BALANCE.frostDrop.depth;
  if (shot === "phoenix_drive") target.y = sideSign(p.side === 0 ? 1 : 0) * SKILL_BALANCE.phoenixDrive.depth;
  const sakura = (shot === "smash" && hitQuality === "perfect" && from.pos.z >= 2.3) || shot === "meteor";
  let bonus = shot === "smash" ? (sakura ? 6 : hitQuality === "perfect" ? 3 : hitQuality === "late" ? -5 : 0) : shot === "meteor" ? SKILL_BALANCE.meteor.speedBonus + (hitQuality === "perfect" ? 2 : 0) : 0;
  if (synced) bonus += SKILL_BALANCE.sync.speedBonus;
  s.pos = { ...from.pos };
  s.netted = false;
  s.vel = solveShot({ ...from.pos }, target, shot, bonus, shot === "phoenix_drive" && hitQuality === "late" ? SKILL_BALANCE.phoenixDrive.lateDip : null);
  let gain = hitQuality === "perfect" ? SKILL_BALANCE.gain.perfect : hitQuality === "good" ? SKILL_BALANCE.gain.good : SKILL_BALANCE.gain.hit;
  if (save) gain = Math.max(gain, SKILL_BALANCE.gain.save);
  const countered = incoming !== null && incoming.side !== p.side && (incoming.shot === "smash" || incoming.shot === "meteor") && m.tick - p.dashedAt <= SKILL_BALANCE.counterWindow && hitQuality !== "late";
  if (countered) {
    gain += SKILL_BALANCE.gain.counter;
    m.events.push({ type: "counter", side: p.side, slot: p.slot });
  }
  if (skill) gain = 0;
  gainEnergy(m, p, gain);
  const lastMate = m.lastTeamHitter[p.side];
  if (lastMate >= 0 && lastMate !== p.slot) gainTeam(m, p.side, SKILL_BALANCE.sync.perHandoff);
  m.lastTeamHitter[p.side] = p.slot;
  m.lastHitter = p.side;
  m.isServe = false;
  m.rally++;
  const st = m.stats.sides[p.side];
  const ps = m.stats.players[p.slot];
  st.hits++;
  ps.hits++;
  if (hitQuality === "perfect") {
    st.perfectHits++;
    ps.perfectHits++;
  }
  if (shot === "smash" || shot === "meteor") {
    st.smashes++;
    ps.smashes++;
  }
  if (shot === "drop" || shot === "frost_drop") ps.drops++;
  if (save) ps.saves++;
  m.rallyLog.push({ slot: p.slot, side: p.side, save, perfect: hitQuality === "perfect", smash: shot === "smash" });
  m.lastShot = { side: p.side, slot: p.slot, shot, quality: hitQuality, sakura };
  const dx = s.pos.x - p.x;
  p.swing = {
    kind: shot === "smash" || shot === "meteor" ? "smash" : shot === "clear" ? "overhead" : shot === "drop" || shot === "frost_drop" ? "drop" : shot === "lift" ? "lift" : dx * (p.side === 0 ? 1 : -1) >= 0 ? "forehand" : "backhand",
    t: 0,
    quality: hitQuality,
  };
  if (shot === "smash" || shot === "meteor") p.recover = Math.max(p.recover, sakura ? 24 : 18);
  if (skill) m.events.push({ type: "skill", side: p.side, slot: p.slot, skill });
  m.events.push({ type: "hit", side: p.side, slot: p.slot, shot, quality: hitQuality, sakura, save, speed: Math.sqrt(s.vel.x * s.vel.x + s.vel.y * s.vel.y + s.vel.z * s.vel.z), skill, sync: synced });
  for (let i = 0; i < rewind && m.inPlay; i++) {
    const outcome = stepShuttle(s);
    if (outcome === "net") m.events.push({ type: "net", side: p.side });
    if (outcome === "landed") resolveLanding(m);
  }
}

function serve(m: Match, press: PressKind) {
  const p = m.players[m.serverSlot];
  const court = serviceCourt(m.server, m.score[m.server]);
  const short = press === "drop";
  const shot: ShotKind = short ? "serve_short" : "serve_high";
  const s = sideSign(court.receiver);
  const deep = m.format === "doubles" ? 5.45 : 5.8;
  const target = { x: court.targetX * (short ? 0.9 : 1.35), y: s * (short ? 2.35 : deep) };
  m.shuttle.vel = solveShot({ ...m.shuttle.pos }, target, shot);
  m.inPlay = true;
  m.lastHitter = m.server;
  m.isServe = true;
  m.rally = 1;
  m.stats.sides[m.server].hits++;
  m.stats.players[p.slot].hits++;
  m.lastShot = { side: m.server, slot: p.slot, shot, quality: "good", sakura: false };
  m.rallyLog.push({ slot: p.slot, side: m.server, save: false, perfect: false, smash: false });
  m.phase = "rally";
  m.phaseTicks = 0;
  p.swing = { kind: "serve", t: 0, quality: null };
  m.events.push({ type: "hit", side: m.server, slot: p.slot, shot, quality: "good", sakura: false, save: false, speed: 0, skill: null, sync: false });
}

function queuePress(m: Match, p: Player, kind: PressKind | null, aim: Input["aim"], rewind: number) {
  if ((kind === "special" || kind === "ultimate") && m.phase === "rally") {
    const state = skillState(p, kind);
    if (!state.ready) {
      m.events.push({ type: "skill_fail", side: p.side, slot: p.slot, skill: state.skill, reason: state.reason ?? "locked" });
      return;
    }
  }
  if (kind && p.cooldown === 0 && !p.pending && !(p.swing && p.swing.kind !== "whiff" && p.swing.t < 8)) {
    p.pending = { kind, ticks: PRESS_BUFFER, aim, rewind: Math.max(0, Math.min(MAX_REWIND, Math.round(rewind))) };
  }
}

function humanAim(p: Player): Input["aim"] {
  if (p.control === "bot" || (p.moveX === 0 && p.moveY === 0)) return undefined;
  const forward = p.moveY * sideSign(p.side) * -1;
  return { x: p.moveX * 2.1, depth: forward > 0.3 ? -0.9 : forward < -0.3 ? 0.25 : 0 };
}

function resolvePresses(m: Match) {
  if (m.phase === "serve") {
    for (const p of m.players) {
      if (!p.pending) continue;
      if (p.slot !== m.serverSlot) p.pending = null;
      else if (m.phaseTicks > 12) {
        serve(m, p.pending.kind);
        p.pending = null;
      }
    }
    return;
  }
  if (m.phase !== "rally") {
    for (const p of m.players) p.pending = null;
    return;
  }
  for (const side of [0, 1] as const) {
    let best: { p: Player; c: NonNullable<ReturnType<typeof contact>> } | null = null;
    for (const p of m.players) {
      if (p.side !== side || !p.pending) continue;
      const c = contact(m, p, p.pending.rewind);
      if (c && (c.z <= MAX_CONTACT_HEIGHT || p.pending.kind === "smash") && (!best || c.d < best.c.d)) best = { p, c };
    }
    if (best && m.phase === "rally") {
      const { p, c } = best;
      const pending = p.pending!;
      executeHit(m, p, pending.kind, pending.aim ?? humanAim(p), quality(c.d, c.z), c.d, c.frame, p.control === "puppet" ? pending.rewind : 0);
      for (const mate of m.players) if (mate.side === side && mate !== p && mate.pending) mate.pending = null;
      p.pending = null;
    }
  }
  for (const p of m.players) {
    if (!p.pending) continue;
    p.pending.ticks--;
    if (p.pending.ticks <= 0) {
      p.pending = null;
      p.cooldown = WHIFF_COOLDOWN;
      p.swing = { kind: "whiff", t: 0, quality: null };
      m.events.push({ type: "whiff", side: p.side, slot: p.slot });
    }
  }
}

function detectCombo(m: Match, winner: Side): ComboKind | null {
  if (m.format !== "doubles") return null;
  const log = m.rallyLog.filter((r) => r.side === winner);
  const slots = new Set(log.map((r) => r.slot));
  if (slots.size < 2) return null;
  const smashers = new Set(log.filter((r) => r.smash).map((r) => r.slot));
  if (smashers.size >= 2) return "sakura_duo";
  for (let i = 0; i < log.length; i++) {
    if (log[i].save && log.slice(i + 1).some((r) => r.slot !== log[i].slot)) return "love_combo";
  }
  const perfect = new Set(log.filter((r) => r.perfect).map((r) => r.slot));
  if (perfect.size >= 2) return "teamwork";
  return null;
}

function awardPoint(m: Match, winner: Side, reason: PointReason) {
  const servingTeam = m.server;
  m.score[winner]++;
  m.stats.rallies++;
  m.stats.longestRally = Math.max(m.stats.longestRally, m.rally);
  if (m.lastShot?.shot === "smash" && m.lastShot.side === winner && reason === "in") {
    m.stats.sides[winner].smashWinners++;
    m.stats.players[m.lastShot.slot].smashWinners++;
  }
  m.inPlay = false;
  m.lastPoint = { winner, reason };
  m.events.push({ type: "point", winner, reason, score: [m.score[0], m.score[1]] });
  const combo = detectCombo(m, winner);
  if (combo) {
    m.stats.sides[winner].combos++;
    m.events.push({ type: "combo", side: winner, kind: combo });
    for (const p of m.players) if (p.side === winner) gainEnergy(m, p, SKILL_BALANCE.gain.teamwork);
    gainTeam(m, winner, SKILL_BALANCE.sync.perCombo);
  }
  if (m.format === "doubles" && winner === servingTeam) {
    const team = m.players.filter((p) => p.side === winner);
    m.courtRight[winner] = team.find((p) => p.slot !== m.courtRight[winner])!.slot;
  }
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
  const doubles = m.format === "doubles";
  const inside = m.isServe ? (doubles ? inDoublesServiceCourt : inServiceCourt)(m.server, m.score[m.server], x, y) : doubles ? inDoubles(x, y) : inSingles(x, y);
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

export type Frame = { inputs?: Record<number, Input>; puppets?: Record<number, PuppetFrame> };

export function step(m: Match, input: Input | Frame) {
  const frame: Frame = "mx" in input ? { inputs: { 0: input } } : input;
  m.events = [];
  m.tick++;
  m.phaseTicks++;
  if (m.phase === "over") return m;
  for (const side of [0, 1] as const) {
    if (m.teamCooldown[side] > 0) m.teamCooldown[side]--;
    if (m.sync[side] > 0) m.sync[side]--;
  }
  const resting = m.phase === "point";
  const controls: (Input | null)[] = m.players.map((p) => {
    if (resting) return IDLE;
    if (p.control === "bot") return botThink(m, m.minds[p.slot]!, p.slot);
    if (p.control === "human") return frame.inputs?.[p.slot] ?? IDLE;
    return null;
  });
  for (const p of m.players) {
    const c = controls[p.slot];
    if (c) movePlayer(m, p, c);
    else movePuppet(m, p, frame.puppets?.[p.slot] ?? { x: p.x, y: p.y });
  }
  if (m.players.length > 2) separate(m);
  if (m.phase === "serve") holdShuttle(m);
  if (!resting) {
    for (const p of m.players) {
      const c = controls[p.slot];
      if (c) {
        if (c.sync) trySync(m, p);
        queuePress(m, p, c.ultimate ? "ultimate" : c.special ? "special" : c.smash ? "smash" : c.drop ? "drop" : c.hit ? "hit" : null, c.aim, 0);
      } else {
        const puppet = frame.puppets?.[p.slot];
        if (puppet?.sync) trySync(m, p);
        if (puppet?.press) queuePress(m, p, puppet.press.kind, undefined, puppet.press.rewind);
      }
    }
  }
  resolvePresses(m);
  if (m.phase === "rally" && m.inPlay && m.phaseTicks > 0) {
    const outcome = stepShuttle(m.shuttle);
    if (outcome === "net") m.events.push({ type: "net", side: m.lastHitter ?? m.server });
    if (outcome === "landed") resolveLanding(m);
  } else if (m.phase === "point" && m.shuttle.pos.z > 0) {
    if (stepShuttle(m.shuttle) === "landed") m.shuttle.pos.z = 0;
  }
  if (m.phase === "rally") {
    m.history.push({ pos: { ...m.shuttle.pos }, vel: { ...m.shuttle.vel }, netted: m.shuttle.netted, lastHitter: m.lastHitter, inPlay: m.inPlay });
    if (m.history.length > HISTORY) m.history.shift();
  }
  if (m.phase === "point" && m.phaseTicks >= POINT_PAUSE) setupServe(m);
  return m;
}

export const COURT_WIDTH = COURT.doublesHalfWidth;
