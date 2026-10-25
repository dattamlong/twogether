import { COURT, DT } from "./court";

export const GRAVITY = 9.81;
export const TERMINAL_SPEED = 7.6;
export const DRAG = GRAVITY / (TERMINAL_SPEED * TERMINAL_SPEED);
const SUBSTEPS = 2;
const MAX_FLIGHT_TICKS = 600;

export type Vec3 = { x: number; y: number; z: number };

export type Shuttle = {
  pos: Vec3;
  vel: Vec3;
  netted: boolean;
};

export type StepOutcome = "flying" | "net" | "landed";

export type ShotKind = "clear" | "lift" | "drop" | "drive" | "smash" | "serve_high" | "serve_short";

type AimedShot = { mode: "aim"; ratio: number; depth: number };
type SteepShot = { mode: "steep"; speed: number };

export const SHOTS: Record<ShotKind, AimedShot | SteepShot> = {
  clear: { mode: "aim", ratio: 0.95, depth: 5.9 },
  lift: { mode: "aim", ratio: 1.9, depth: 5.7 },
  drop: { mode: "aim", ratio: 0.5, depth: 1.4 },
  drive: { mode: "aim", ratio: 0.08, depth: 4.8 },
  smash: { mode: "steep", speed: 27 },
  serve_high: { mode: "aim", ratio: 2.1, depth: 5.8 },
  serve_short: { mode: "aim", ratio: 0.55, depth: 2.35 },
};

export function speedOf(v: Vec3) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function stepShuttle(s: Shuttle): StepOutcome {
  const h = DT / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) {
    const speed = speedOf(s.vel);
    s.vel.x -= DRAG * speed * s.vel.x * h;
    s.vel.y -= DRAG * speed * s.vel.y * h;
    s.vel.z -= (DRAG * speed * s.vel.z + GRAVITY) * h;
    const px = s.pos.x;
    const py = s.pos.y;
    const pz = s.pos.z;
    s.pos.x += s.vel.x * h;
    s.pos.y += s.vel.y * h;
    s.pos.z += s.vel.z * h;
    if (!s.netted && (py < 0) !== (s.pos.y < 0) && py !== 0) {
      const t = py / (py - s.pos.y);
      const zc = pz + (s.pos.z - pz) * t;
      const xc = px + (s.pos.x - px) * t;
      if (zc < COURT.netHeight && Math.abs(xc) <= COURT.postHalfWidth) {
        s.netted = true;
        s.pos.x = xc;
        s.pos.y = py < 0 ? -0.06 : 0.06;
        s.pos.z = zc;
        s.vel.x = 0;
        s.vel.y = py < 0 ? -0.4 : 0.4;
        s.vel.z = s.vel.z < 0 ? s.vel.z * 0.2 : 0;
        return "net";
      }
    }
    if (s.pos.z <= 0) {
      s.pos.z = 0;
      return "landed";
    }
  }
  return "flying";
}

export type Flight = { land: Vec3; netted: boolean; netMargin: number; ticks: number };

export function simulateFlight(from: Vec3, vel: Vec3): Flight {
  const s: Shuttle = { pos: { ...from }, vel: { ...vel }, netted: false };
  let netMargin = Number.NEGATIVE_INFINITY;
  let ticks = 0;
  while (ticks < MAX_FLIGHT_TICKS) {
    const py = s.pos.y;
    const pz = s.pos.z;
    const outcome = stepShuttle(s);
    ticks++;
    if (!s.netted && (py < 0) !== (s.pos.y < 0)) {
      const t = py / (py - s.pos.y);
      netMargin = pz + (s.pos.z - pz) * t - COURT.netHeight;
    }
    if (outcome === "net") return { land: { ...s.pos, z: 0 }, netted: true, netMargin: -1, ticks };
    if (outcome === "landed") break;
  }
  return { land: { ...s.pos }, netted: false, netMargin, ticks };
}

export function predictPath(shuttle: Shuttle, maxTicks = 240) {
  const s: Shuttle = { pos: { ...shuttle.pos }, vel: { ...shuttle.vel }, netted: shuttle.netted };
  const path: Vec3[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const outcome = stepShuttle(s);
    path.push({ ...s.pos });
    if (outcome === "landed") break;
  }
  return path;
}

function direction(from: Vec3, target: { x: number; y: number }) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { ux: dx / len, uy: dy / len, dist: len };
}

const NET_CLEARANCE = 0.12;

function solveAimed(from: Vec3, target: { x: number; y: number }, shot: AimedShot, sameSideLanding: boolean) {
  const { ux, uy, dist } = direction(from, target);
  let best: Vec3 | null = null;
  for (let step = 0; step <= 12; step++) {
    const ratio = shot.ratio + step * 0.2;
    let lo = 0.5;
    let hi = 90;
    let vel: Vec3 = { x: 0, y: 0, z: 0 };
    let flight: Flight | null = null;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      vel = { x: ux * mid, y: uy * mid, z: ratio * mid };
      flight = simulateFlight(from, vel);
      const travelled = (flight.land.x - from.x) * ux + (flight.land.y - from.y) * uy;
      if (flight.netted || travelled < dist) lo = mid;
      else hi = mid;
    }
    vel = { x: ux * hi, y: uy * hi, z: ratio * hi };
    flight = simulateFlight(from, vel);
    best = vel;
    if (sameSideLanding || (!flight.netted && flight.netMargin >= NET_CLEARANCE)) return vel;
  }
  return best!;
}

function solveSteep(from: Vec3, target: { x: number; y: number }, speed: number) {
  const { ux, uy } = direction(from, target);
  const velFor = (r: number) => {
    const n = Math.sqrt(1 + r * r);
    return { x: (ux * speed) / n, y: (uy * speed) / n, z: (r * speed) / n };
  };
  let lo = -1.1;
  let hi = 0.9;
  const lowest = simulateFlight(from, velFor(lo));
  if (!lowest.netted && lowest.netMargin >= NET_CLEARANCE * 2) return velFor(lo);
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const f = simulateFlight(from, velFor(mid));
    if (f.netted || f.netMargin < NET_CLEARANCE * 2) lo = mid;
    else hi = mid;
  }
  return velFor(hi);
}

export function solveShot(from: Vec3, target: { x: number; y: number }, kind: ShotKind, speedBonus = 0): Vec3 {
  const shot = SHOTS[kind];
  if (shot.mode === "steep") return solveSteep(from, target, shot.speed + speedBonus);
  return solveAimed(from, target, shot, (from.y < 0) === (target.y < 0));
}
