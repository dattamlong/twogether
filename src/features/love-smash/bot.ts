import { sideSign, type Side } from "./court";
import { predictPath } from "./physics";
import { between, chance, createRng, next, spread, type Rng } from "./rng";
import { IDLE, MAX_SPEED, PRESS_BUFFER } from "./rules";
import { SKILL_BALANCE, SKILLS } from "./skills";
import { skillState, type Input, type Match, type Player, type PressKind } from "./sim";

export type Difficulty = "easy" | "normal" | "hard" | "feeder";

type Profile = {
  reaction: number;
  speedScale: number;
  predictError: number;
  perfectChance: number;
  missChance: number;
  smashChance: number;
  dropChance: number;
  aim: [number, number];
  wildChance: number;
  lunges: boolean;
  smashDepth: number;
  skillIQ: number;
};

export const PROFILES: Record<Difficulty, Profile> = {
  easy: { reaction: 20, speedScale: 0.74, predictError: 0.5, perfectChance: 0.12, missChance: 0.1, smashChance: 0.12, dropChance: 0.15, aim: [0.4, 1.4], wildChance: 0.06, lunges: false, smashDepth: 4.8, skillIQ: 0.15 },
  normal: { reaction: 12, speedScale: 0.88, predictError: 0.26, perfectChance: 0.4, missChance: 0.045, smashChance: 0.45, dropChance: 0.3, aim: [1, 1.9], wildChance: 0.03, lunges: true, smashDepth: 5.6, skillIQ: 0.45 },
  hard: { reaction: 6, speedScale: 1, predictError: 0.1, perfectChance: 0.72, missChance: 0.015, smashChance: 0.72, dropChance: 0.4, aim: [1.5, 2.15], wildChance: 0.01, lunges: true, smashDepth: 6.1, skillIQ: 0.8 },
  feeder: { reaction: 4, speedScale: 1, predictError: 0, perfectChance: 1, missChance: 0, smashChance: 0, dropChance: 0, aim: [0, 0], wildChance: 0, lunges: true, smashDepth: 0, skillIQ: 0 },
};

type Plan = { rally: number; x: number; y: number; z: number; hitTick: number; pressTick: number; lunged: boolean };

export type BotMind = {
  difficulty: Difficulty;
  profile: Profile;
  speedScale: number;
  rng: Rng;
  plan: Plan | null;
  reactAt: number | null;
  serveAt: number | null;
};

export function createBotMind(difficulty: Difficulty, seed: number): BotMind {
  const profile = PROFILES[difficulty];
  return { difficulty, profile, speedScale: profile.speedScale, rng: createRng(seed ^ 0x5eed5a11), plan: null, reactAt: null, serveAt: null };
}

function moveToward(x: number, y: number, tx: number, ty: number, slowRadius = 0.4): Pick<Input, "mx" | "my"> {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.05) return { mx: 0, my: 0 };
  const k = d < slowRadius ? d / slowRadius : 1;
  return { mx: (dx / d) * k, my: (dy / d) * k };
}

function makePlan(m: Match, mind: BotMind, slot: number): Plan | null {
  const me = m.players[slot];
  const sign = sideSign(me.side);
  const path = predictPath(m.shuttle, 260);
  const reachSpeed = MAX_SPEED * mind.speedScale;
  let pick = -1;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p.y * sign <= 0.15 || p.z > 2.6 || p.z < 0.3) continue;
    const prev = path[i - 1];
    if (prev && prev.z < p.z && p.z > 1.2) continue;
    const dx = p.x - me.x;
    const dy = p.y - me.y;
    const travel = Math.sqrt(dx * dx + dy * dy) / reachSpeed + 0.12;
    if (travel <= (i + 1) / 60) {
      pick = i;
      break;
    }
    if (pick < 0 || path[pick].z > p.z) pick = i;
  }
  if (pick < 0) return null;
  const target = path[pick];
  const err = mind.profile.predictError;
  const hitTick = m.tick + pick + 1;
  let offset = -1;
  if (chance(mind.rng, mind.profile.missChance)) offset = chance(mind.rng, 0.5) ? -(PRESS_BUFFER + 6) : 40;
  else if (!chance(mind.rng, mind.profile.perfectChance)) offset = Math.round(between(mind.rng, 3, 14));
  return {
    rally: m.rally,
    x: target.x + spread(mind.rng, err),
    y: target.y + spread(mind.rng, err),
    z: target.z,
    hitTick,
    pressTick: hitTick + offset,
    lunged: false,
  };
}

function aimFor(mind: BotMind, opponents: Player[]) {
  const prof = mind.profile;
  if (opponents.length === 1) {
    const opp = opponents[0];
    const sign = opp.x > 0.3 ? -1 : opp.x < -0.3 ? 1 : next(mind.rng) < 0.5 ? -1 : 1;
    let x = sign * between(mind.rng, prof.aim[0], prof.aim[1]);
    let depth = 0;
    if (chance(mind.rng, prof.wildChance)) {
      x = sign * 2.8;
      depth = 0.5;
    }
    return { x, depth };
  }
  let best = 0;
  let bestGap = -1;
  for (const cx of [-2.5, -1.3, 0, 1.3, 2.5]) {
    const gap = Math.min(...opponents.map((o) => Math.abs(o.x - cx))) + next(mind.rng) * 0.3;
    if (gap > bestGap) {
      bestGap = gap;
      best = cx;
    }
  }
  const accuracy = between(mind.rng, prof.aim[0], prof.aim[1]) / 2.15;
  let x = best * Math.max(0.5, accuracy);
  let depth = 0;
  if (chance(mind.rng, prof.wildChance)) {
    x = (best >= 0 ? 1 : -1) * 3.3;
    depth = 0.5;
  }
  return { x, depth };
}

function chooseShot(m: Match, mind: BotMind, slot: number, plan: Plan): { press: PressKind; aim: Input["aim"] } {
  const me = m.players[slot];
  const opponents = m.players.filter((o) => o.side !== me.side);
  const prof = mind.profile;
  if (mind.difficulty === "feeder") return { press: "hit", aim: { x: opponents[0].x * 0.4, depth: plan.z >= 1.75 ? -1.6 : plan.z >= 0.95 ? -1.3 : -1.4 } };
  let press: PressKind = "hit";
  const myDepth = Math.abs(me.y);
  const oppDepth = Math.min(...opponents.map((o) => Math.abs(o.y)));
  if (plan.z >= 1.75) {
    if (myDepth < prof.smashDepth && chance(mind.rng, prof.smashChance)) press = "smash";
    else if (oppDepth > 3.8 && chance(mind.rng, prof.dropChance)) press = "drop";
  } else if (plan.z >= 0.95) {
    if (oppDepth > 4.5 && chance(mind.rng, prof.dropChance * 0.7)) press = "drop";
  } else if (myDepth < 2.6 && chance(mind.rng, prof.dropChance)) {
    press = "drop";
  }
  const iq = prof.skillIQ;
  if (iq > 0 && plan.z >= SKILL_BALANCE.meteor.minHeight + 0.1 && myDepth < 5.2 && skillState(me, "ultimate").ready && chance(mind.rng, iq * 0.8)) press = "ultimate";
  else if (iq > 0 && skillState(me, "special").ready) {
    const special = me.loadout.special;
    if (special === "frost_drop" && oppDepth > 3.8 && chance(mind.rng, iq * 0.5)) press = "special";
    else if (special === "phoenix_drive" && plan.z >= 0.9 && plan.z <= 1.7 && chance(mind.rng, iq * 0.4)) press = "special";
  }
  return { press, aim: aimFor(mind, opponents) };
}

function responsibilityPoint(m: Match, side: Side) {
  const path = predictPath(m.shuttle, 260);
  const sign = sideSign(side);
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    if (p.y * sign > 0.15 && p.z <= 1.7 && p.z < path[i - 1].z) return p;
  }
  return path[path.length - 1] ?? m.shuttle.pos;
}

function travelTime(p: Player, x: number, y: number) {
  const dx = x - p.x;
  const dy = y - p.y;
  return Math.sqrt(dx * dx + dy * dy) / (MAX_SPEED * p.speedScale);
}

function formationHome(m: Match, me: Player, mate: Player) {
  const s = sideSign(me.side);
  const own = m.lastShot && m.lastShot.side === me.side ? m.lastShot.shot : null;
  const attacking = own === "smash" || own === "drop" || own === "drive";
  if (attacking) {
    const iAmFront = mate.control === "bot" ? Math.abs(me.y) < Math.abs(mate.y) || (Math.abs(me.y) === Math.abs(mate.y) && me.slot < mate.slot) : Math.abs(mate.y) >= 3.3;
    return iAmFront ? { x: -mate.x * 0.3, y: 2.1 * s } : { x: -mate.x * 0.3, y: 4.5 * s };
  }
  const iAmLeft = mate.control === "bot" ? me.x < mate.x || (me.x === mate.x && me.slot < mate.slot) : mate.x >= 0;
  return { x: iAmLeft ? -1.35 : 1.35, y: 3.5 * s };
}

export function botThink(m: Match, mind: BotMind, slot: number): Input {
  const me = m.players[slot];
  const side = me.side;
  const other: Side = side === 0 ? 1 : 0;
  const mate = m.players.find((p) => p.side === side && p.slot !== slot) ?? null;
  if (m.phase === "serve") {
    mind.plan = null;
    mind.reactAt = null;
    if (m.serverSlot !== slot) return IDLE;
    if (mind.serveAt === null) mind.serveAt = m.tick + Math.round(between(mind.rng, 45, 85));
    if (m.tick < mind.serveAt) return IDLE;
    mind.serveAt = null;
    const short = mind.difficulty !== "feeder" && chance(mind.rng, 0.35);
    return short ? { mx: 0, my: 0, drop: true } : { mx: 0, my: 0, hit: true };
  }
  if (m.phase !== "rally") {
    mind.plan = null;
    mind.reactAt = null;
    return IDLE;
  }
  const incoming = m.inPlay && m.lastHitter === other && !m.shuttle.netted;
  if (!incoming) {
    mind.plan = null;
    mind.reactAt = null;
    if (mate) {
      const home = formationHome(m, me, mate);
      return { ...moveToward(me.x, me.y, home.x, home.y) };
    }
    const last = m.lastShot;
    const homeY = last?.side === side && last.shot === "drop" ? 2.7 : 3.4;
    return { ...moveToward(me.x, me.y, 0, homeY * sideSign(side)) };
  }
  if (mate && (!mind.plan || mind.plan.rally !== m.rally)) {
    const point = responsibilityPoint(m, side);
    const mine = travelTime(me, point.x, point.y);
    const theirs = travelTime(mate, point.x, point.y);
    const toX = point.x - mate.x;
    const toY = point.y - mate.y;
    const len = Math.sqrt(toX * toX + toY * toY) || 1;
    const heading = (mate.vx * toX + mate.vy * toY) / len / MAX_SPEED;
    const mateTakes = mate.control === "bot" ? theirs < mine || (theirs === mine && mate.slot < slot) : theirs <= mine || (theirs <= mine * 1.3 + 0.1 && heading > 0.45);
    if (mateTakes) {
      const s = sideSign(side);
      const depth = Math.abs(point.y) < 3.5 ? 4.3 : 2.4;
      return { ...moveToward(me.x, me.y, -Math.sign(point.x || 1) * 1.2, depth * s) };
    }
  }
  if (!mind.plan || mind.plan.rally !== m.rally) {
    if (mind.reactAt === null) mind.reactAt = m.tick + mind.profile.reaction;
    if (m.tick < mind.reactAt) return { mx: me.moveX, my: me.moveY };
    mind.plan = makePlan(m, mind, slot);
    mind.reactAt = null;
    if (!mind.plan) return IDLE;
  }
  const plan = mind.plan;
  const input: Input = { ...moveToward(me.x, me.y, plan.x, plan.y) };
  const dx = plan.x - me.x;
  const dy = plan.y - me.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ticksLeft = plan.hitTick - m.tick;
  const needed = (dist / (MAX_SPEED * mind.speedScale)) * 60;
  if (!plan.lunged && dist > 1.1 && ticksLeft > 6 && needed > ticksLeft && me.energy >= SKILLS.lightning_dash.cost && skillState(me, "movement").ready && chance(mind.rng, mind.profile.skillIQ)) {
    plan.lunged = true;
    input.dash = true;
  } else if (mind.profile.lunges && !plan.lunged && dist > 0.75 && ticksLeft <= 12 && ticksLeft > 2) {
    plan.lunged = true;
    input.lunge = true;
  }
  if (mate && m.teamEnergy[side] >= SKILL_BALANCE.sync.cost && m.teamCooldown[side] === 0 && m.sync[side] === 0 && plan.z >= 1.75 && ticksLeft < 20 && chance(mind.rng, mind.profile.skillIQ * 0.3)) input.sync = true;
  if (m.tick === plan.pressTick) {
    const choice = chooseShot(m, mind, slot, plan);
    input[choice.press] = true;
    input.aim = choice.aim;
  }
  return input;
}
