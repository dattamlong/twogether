import type { Avatar } from "@/features/session/types";
import { COURT } from "./court";
import type { Vec3 } from "./physics";
import type { Match, Player, Swing } from "./sim";

type V3 = Vec3;

export type Camera = { pos: V3; up: V3; fwd: V3; focal: number; cx: number; cy: number };

export type Snapshot = { players: [{ x: number; y: number }, { x: number; y: number }]; shuttle: V3 };

export type Particle = { alive: boolean; x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; max: number; size: number; color: string; kind: "petal" | "spark" | "confetti" };

export type Pop = { text: string; x: number; y: number; life: number; max: number; color: string; size: number };

export type Fx = {
  particles: Particle[];
  pops: Pop[];
  banner: { text: string; sub: string; life: number; max: number; color: string } | null;
  trail: { x: number; y: number }[];
  trailColor: string;
  trailSakura: boolean;
  shake: number;
  flash: number;
  runPhase: [number, number];
  landing: V3 | null;
  time: number;
};

export function createFx(): Fx {
  return { particles: [], pops: [], banner: null, trail: [], trailColor: "#ffffff", trailSakura: false, shake: 0, flash: 0, runPhase: [0, 0], landing: null, time: 0 };
}

export function snapshot(m: Match): Snapshot {
  return {
    players: [
      { x: m.players[0].x, y: m.players[0].y },
      { x: m.players[1].x, y: m.players[1].y },
    ],
    shuttle: { ...m.shuttle.pos },
  };
}

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function makeCamera(w: number, h: number): Camera {
  const portrait = w / h < 0.85;
  const pos = portrait ? { x: 0, y: -11.5, z: 15 } : { x: 0, y: -14.2, z: 8.4 };
  const target = { x: 0, y: portrait ? 0.4 : 0.9, z: 0 };
  const fwd = norm(sub(target, pos));
  const up = { x: 0, y: -fwd.z, z: fwd.y };
  const cam: Camera = { pos, up, fwd, focal: 1, cx: 0, cy: 0 };
  const pts: V3[] = [];
  for (const x of [-3.7, 3.7]) for (const y of [-7.6, 7.6]) pts.push({ x, y, z: 0 });
  pts.push({ x: 0, y: -7.4, z: 1.9 }, { x: 0, y: 7.6, z: 2.4 });
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const q = project(cam, p);
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  const topPad = portrait ? 0.16 : 0.13;
  const bottomPad = portrait ? 0.3 : 0.06;
  const scale = Math.min((w * 0.94) / (maxX - minX), (h * (1 - topPad - bottomPad)) / (maxY - minY));
  cam.focal = scale;
  cam.cx = w / 2 - ((minX + maxX) / 2) * scale;
  cam.cy = h * topPad - minY * scale;
  return cam;
}

export function project(cam: Camera, p: V3) {
  const rel = sub(p, cam.pos);
  const zc = dot(rel, cam.fwd);
  const yc = dot(rel, cam.up);
  return { x: cam.cx + (cam.focal * rel.x) / zc, y: cam.cy - (cam.focal * yc) / zc, s: cam.focal / zc };
}

const PETAL_COLORS = ["#f8bbd0", "#f39bbb", "#ffd6e5", "#ffffff"];
const CONFETTI = ["#f39bbb", "#a995dc", "#8fd3c1", "#fbd38d", "#7cc3ef"];

function spawn(fx: Fx, p: Omit<Particle, "alive">) {
  let slot = fx.particles.find((q) => !q.alive);
  if (!slot) {
    if (fx.particles.length >= 220) return;
    slot = { ...p, alive: true };
    fx.particles.push(slot);
    return;
  }
  Object.assign(slot, p, { alive: true });
}

export function burst(fx: Fx, x: number, y: number, kind: Particle["kind"], count: number, power = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (40 + Math.random() * 160) * power;
    spawn(fx, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (kind === "spark" ? 40 : 90),
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 8,
      life: 0,
      max: kind === "spark" ? 0.35 + Math.random() * 0.2 : 0.9 + Math.random() * 0.9,
      size: kind === "spark" ? 2 + Math.random() * 2.5 : 5 + Math.random() * 5,
      color: kind === "confetti" ? CONFETTI[i % CONFETTI.length] : kind === "spark" ? "#fff6b0" : PETAL_COLORS[i % PETAL_COLORS.length],
      kind,
    });
  }
}

export function pop(fx: Fx, text: string, x: number, y: number, color: string, size = 22) {
  fx.pops.push({ text, x, y, life: 0, max: 0.9, color, size });
  if (fx.pops.length > 8) fx.pops.shift();
}

export function banner(fx: Fx, text: string, sub: string, color: string, seconds = 1.3) {
  fx.banner = { text, sub, life: 0, max: seconds, color };
}

export function updateFx(fx: Fx, dt: number, reduced: boolean) {
  fx.time += dt;
  for (const p of fx.particles) {
    if (!p.alive) continue;
    p.life += dt;
    if (p.life >= p.max) {
      p.alive = false;
      continue;
    }
    const drag = p.kind === "petal" ? 1.6 : 3;
    p.vx -= p.vx * drag * dt;
    p.vy += (p.kind === "petal" ? 60 : p.kind === "confetti" ? 160 : 90) * dt - p.vy * drag * dt * 0.5;
    if (p.kind === "petal") p.vx += Math.sin(fx.time * 3 + p.rot) * 30 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (const t of fx.pops) t.life += dt;
  fx.pops = fx.pops.filter((t) => t.life < t.max);
  if (fx.banner) {
    fx.banner.life += dt;
    if (fx.banner.life >= fx.banner.max) fx.banner = null;
  }
  fx.shake = reduced ? 0 : Math.max(0, fx.shake - dt * 2.5);
  fx.flash = Math.max(0, fx.flash - dt * 3);
}

function keyframes(frames: [number, number][], t: number) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (t <= t1) return lerp(v0, v1, (t - t0) / (t1 - t0));
  }
  return frames[frames.length - 1][1];
}

const READY_ANGLE = 2.3;
const CHIBI_SCALE = 1.3;

function armAngle(swing: Swing | null) {
  if (!swing) return READY_ANGLE;
  const t = swing.t;
  switch (swing.kind) {
    case "overhead":
    case "smash":
      return keyframes([[0, 3.4], [3, 3.6], [6, 1.0], [10, 0.4], [22, READY_ANGLE]], t);
    case "forehand":
      return keyframes([[0, 2.6], [3, 2.9], [6, 0.9], [12, 0.6], [22, READY_ANGLE]], t);
    case "backhand":
      return keyframes([[0, 2.0], [3, 1.4], [6, 3.4], [12, 3.0], [22, READY_ANGLE]], t);
    case "drop":
      return keyframes([[0, 3.2], [4, 3.3], [8, 1.8], [22, READY_ANGLE]], t);
    case "lift":
    case "serve":
      return keyframes([[0, 0.4], [3, 0.2], [7, 2.6], [12, 2.9], [22, READY_ANGLE]], t);
    case "whiff":
      return keyframes([[0, 2.8], [4, 0.6], [12, 0.9], [22, READY_ANGLE]], t);
  }
}

function jumpHeight(swing: Swing | null) {
  if (!swing || swing.kind !== "smash") return 0;
  return Math.max(0, Math.sin((Math.min(swing.t, 14) / 14) * Math.PI)) * 0.42;
}

function hairBack(ctx: CanvasRenderingContext2D, a: Avatar, u: number) {
  ctx.fillStyle = a.hairColor;
  if (a.hair === "long") {
    ctx.beginPath();
    ctx.roundRect(-0.36 * u, -1.12 * u, 0.72 * u, 0.62 * u, 0.2 * u);
    ctx.fill();
  }
  if (a.hair === "twintails") {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 0.42 * u, -0.92 * u, 0.11 * u, 0.24 * u, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (a.hair === "bun") {
    ctx.beginPath();
    ctx.arc(0, -1.48 * u, 0.14 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHead(ctx: CanvasRenderingContext2D, a: Avatar, u: number, front: boolean, mood: "normal" | "happy" | "sad" | "focus") {
  hairBack(ctx, a, u);
  ctx.fillStyle = a.skin;
  ctx.strokeStyle = "rgba(69,54,91,.35)";
  ctx.lineWidth = Math.max(1, 0.02 * u);
  ctx.beginPath();
  ctx.ellipse(0, -1.06 * u, 0.36 * u, 0.33 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = a.hairColor;
  if (!front) {
    ctx.beginPath();
    ctx.ellipse(0, -1.1 * u, 0.375 * u, 0.33 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -0.86 * u, 0.3 * u, 0.12 * u, 0, 0, Math.PI);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -1.24 * u, 0.38 * u, 0.22 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    const spiky = a.hair === "spiky";
    ctx.moveTo(-0.37 * u, -1.18 * u);
    for (let i = 0; i <= 6; i++) {
      const x = -0.37 + (0.74 * i) / 6;
      ctx.lineTo(x * u, (i % 2 ? (spiky ? -1.3 : -1.08) : -1.18) * u);
    }
    ctx.lineTo(0.37 * u, -1.32 * u);
    ctx.lineTo(-0.37 * u, -1.32 * u);
    ctx.closePath();
    ctx.fill();
    if (a.hair === "bob" || a.hair === "long") {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 0.33 * u, -0.98 * u, 0.08 * u, 0.2 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = a.eyes;
    const eyeY = -1.0 * u;
    if (mood === "happy") {
      ctx.strokeStyle = a.eyes;
      ctx.lineWidth = 0.035 * u;
      ctx.lineCap = "round";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 0.13 * u, eyeY + 0.02 * u, 0.055 * u, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    } else {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 0.13 * u, eyeY, 0.055 * u, mood === "sad" ? 0.04 * u : 0.075 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 0.13 * u + 0.02 * u, eyeY - 0.03 * u, 0.02 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(243,155,187,.6)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 0.22 * u, -0.92 * u, 0.06 * u, 0.035 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#45365b";
    ctx.lineWidth = 0.025 * u;
    ctx.beginPath();
    if (mood === "sad") ctx.arc(0, -0.83 * u, 0.04 * u, Math.PI * 1.15, Math.PI * 1.85);
    else if (mood === "focus") {
      ctx.moveTo(-0.03 * u, -0.88 * u);
      ctx.lineTo(0.03 * u, -0.88 * u);
    } else ctx.arc(0, -0.9 * u, 0.045 * u, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    if (a.accessory === "glasses") {
      ctx.strokeStyle = "#45365b";
      ctx.lineWidth = 0.02 * u;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 0.13 * u, eyeY, 0.085 * u, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  if (a.accessory === "bow") {
    ctx.fillStyle = "#e7779f";
    ctx.beginPath();
    ctx.moveTo(0.16 * u, -1.36 * u);
    ctx.lineTo(0.32 * u, -1.46 * u);
    ctx.lineTo(0.32 * u, -1.26 * u);
    ctx.closePath();
    ctx.moveTo(0.16 * u, -1.36 * u);
    ctx.lineTo(0.0, -1.46 * u);
    ctx.lineTo(0.0, -1.26 * u);
    ctx.closePath();
    ctx.fill();
  }
  if (a.accessory === "flower_crown") {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#f8bbd0" : "#fbe3b1";
      ctx.beginPath();
      ctx.arc((-0.28 + i * 0.14) * u, (-1.36 + Math.abs(i - 2) * 0.02) * u, 0.055 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (a.accessory === "beanie") {
    ctx.fillStyle = "#a995dc";
    ctx.beginPath();
    ctx.ellipse(0, -1.3 * u, 0.37 * u, 0.17 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.arc(0, -1.48 * u, 0.06 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

export type PoseInfo = { moving: boolean; runPhase: number; lunge: boolean; recovering: boolean; result: "win" | "lose" | null; t: number };

export function drawChibi(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, a: Avatar, p: Player, front: boolean, pose: PoseInfo) {
  const jump = jumpHeight(p.swing) + (pose.result === "win" ? Math.abs(Math.sin(pose.t * 6)) * 0.25 : 0);
  ctx.save();
  ctx.fillStyle = "rgba(69,54,91,.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, 0.36 * u * (1 - jump * 0.6), 0.12 * u * (1 - jump * 0.6), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y - jump * u);
  const lean = pose.lunge ? 0.35 * (p.lungeDir.x >= 0 ? 1 : -1) : pose.moving ? p.vx * 0.02 : 0;
  ctx.rotate(lean);
  const bob = pose.moving ? Math.abs(Math.sin(pose.runPhase)) * 0.04 * u : Math.sin(pose.t * 2.4) * 0.012 * u;
  const legSwing = pose.moving ? Math.sin(pose.runPhase) * 0.09 * u : 0;
  ctx.fillStyle = "#fff7ed";
  ctx.strokeStyle = "rgba(69,54,91,.35)";
  ctx.lineWidth = Math.max(1, 0.02 * u);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(s * 0.1 * u - 0.055 * u, -0.38 * u + (s > 0 ? legSwing : -legSwing) * 0.5, 0.11 * u, 0.36 * u, 0.05 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f39bbb";
    ctx.beginPath();
    ctx.ellipse(s * 0.1 * u, -0.03 * u + (s > 0 ? legSwing : -legSwing) * 0.5, 0.08 * u, 0.04 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
  }
  ctx.translate(0, -bob);
  ctx.fillStyle = a.outfitColor;
  ctx.beginPath();
  ctx.roundRect(-0.21 * u, -0.78 * u, 0.42 * u, 0.46 * u, 0.12 * u);
  ctx.fill();
  ctx.stroke();
  const side = p.facing >= 0 ? 1 : -1;
  const angle = pose.result === "win" ? 3.0 + Math.sin(pose.t * 8) * 0.2 : pose.result === "lose" ? 0.2 : armAngle(p.swing);
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.ellipse(-side * 0.25 * u, -0.56 * u, 0.06 * u, 0.13 * u, -side * (pose.result === "win" ? -2.6 : 0.3), 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(side * 0.2 * u, -0.68 * u);
  ctx.scale(side, 1);
  ctx.rotate(-angle);
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.roundRect(-0.05 * u, 0, 0.1 * u, 0.3 * u, 0.05 * u);
  ctx.fill();
  ctx.strokeStyle = "#45365b";
  ctx.lineWidth = Math.max(1.2, 0.025 * u);
  ctx.beginPath();
  ctx.moveTo(0, 0.28 * u);
  ctx.lineTo(0, 0.5 * u);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.strokeStyle = "#e7779f";
  ctx.lineWidth = Math.max(1.5, 0.03 * u);
  ctx.beginPath();
  ctx.ellipse(0, 0.64 * u, 0.12 * u, 0.15 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(231,119,159,.35)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.04 * u, 0.5 * u);
    ctx.lineTo(i * 0.04 * u, 0.78 * u);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  if (pose.result === "lose") {
    ctx.translate(0, 0.06 * u);
    ctx.rotate(0.12 * side);
  }
  drawHead(ctx, a, u, front, pose.result === "win" ? "happy" : pose.result === "lose" ? "sad" : p.swing && p.swing.kind !== "whiff" ? "focus" : "normal");
  ctx.restore();
  ctx.restore();
}

function drawShuttle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dirX: number, dirY: number) {
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;
  const k = Math.max(5, s * 0.16);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(uy, ux));
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(69,54,91,.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -k * 0.35);
  ctx.lineTo(-k * 1.6, -k * 0.85);
  ctx.lineTo(-k * 1.6, k * 0.85);
  ctx.lineTo(0, k * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f39bbb";
  ctx.beginPath();
  ctx.arc(k * 0.15, 0, k * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, cam: Camera, a: V3, b: V3) {
  const p = project(cam, a);
  const q = project(cam, b);
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
}

function poly(ctx: CanvasRenderingContext2D, cam: Camera, pts: V3[]) {
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const q = project(cam, pt);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
}

function drawCourt(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#efe4ff");
  sky.addColorStop(0.45, "#ffe9f1");
  sky.addColorStop(1, "#fff4e8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  poly(ctx, cam, [
    { x: -6, y: -9, z: 0 },
    { x: 6, y: -9, z: 0 },
    { x: 6, y: 9.5, z: 0 },
    { x: -6, y: 9.5, z: 0 },
  ]);
  ctx.fillStyle = "#f7dce8";
  ctx.fill();
  const L = COURT.halfLength;
  const D = COURT.doublesHalfWidth;
  const S = COURT.singlesHalfWidth;
  poly(ctx, cam, [
    { x: -D - 0.25, y: -L - 0.25, z: 0 },
    { x: D + 0.25, y: -L - 0.25, z: 0 },
    { x: D + 0.25, y: L + 0.25, z: 0 },
    { x: -D - 0.25, y: L + 0.25, z: 0 },
  ]);
  const floor = ctx.createLinearGradient(0, project(cam, { x: 0, y: L, z: 0 }).y, 0, project(cam, { x: 0, y: -L, z: 0 }).y);
  floor.addColorStop(0, "#9fd9c4");
  floor.addColorStop(1, "#7ccbb0");
  ctx.fillStyle = floor;
  ctx.fill();
  poly(ctx, cam, [
    { x: -S, y: -L, z: 0 },
    { x: S, y: -L, z: 0 },
    { x: S, y: L, z: 0 },
    { x: -S, y: L, z: 0 },
  ]);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = Math.max(1.5, cam.focal * 0.0028);
  ctx.beginPath();
  for (const x of [-D, -S, S, D]) line(ctx, cam, { x, y: -L, z: 0 }, { x, y: L, z: 0 });
  for (const y of [-L, L, -COURT.shortService, COURT.shortService, -COURT.doublesLongService, COURT.doublesLongService]) line(ctx, cam, { x: -D, y, z: 0 }, { x: D, y, z: 0 });
  line(ctx, cam, { x: 0, y: -L, z: 0 }, { x: 0, y: -COURT.shortService, z: 0 });
  line(ctx, cam, { x: 0, y: COURT.shortService, z: 0 }, { x: 0, y: L, z: 0 });
  ctx.stroke();
}

function drawNet(ctx: CanvasRenderingContext2D, cam: Camera) {
  const P = COURT.postHalfWidth;
  const H = COURT.netHeight;
  ctx.fillStyle = "rgba(69,54,91,.12)";
  poly(ctx, cam, [
    { x: -P, y: 0.02, z: 0 },
    { x: P, y: 0.02, z: 0 },
    { x: P, y: 0.35, z: 0 },
    { x: -P, y: 0.35, z: 0 },
  ]);
  ctx.fill();
  poly(ctx, cam, [
    { x: -P, y: 0, z: H - 0.76 },
    { x: P, y: 0, z: H - 0.76 },
    { x: P, y: 0, z: H },
    { x: -P, y: 0, z: H },
  ]);
  ctx.fillStyle = "rgba(69,54,91,.22)";
  ctx.fill();
  ctx.strokeStyle = "rgba(69,54,91,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -P; x <= P + 0.01; x += 0.25) line(ctx, cam, { x, y: 0, z: H - 0.76 }, { x, y: 0, z: H });
  for (let z = H - 0.76; z <= H; z += 0.19) line(ctx, cam, { x: -P, y: 0, z }, { x: P, y: 0, z });
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, cam.focal * 0.004);
  ctx.beginPath();
  line(ctx, cam, { x: -P, y: 0, z: H }, { x: P, y: 0, z: H });
  ctx.stroke();
  ctx.strokeStyle = "#a995dc";
  ctx.lineWidth = Math.max(3, cam.focal * 0.006);
  ctx.beginPath();
  for (const x of [-P, P]) line(ctx, cam, { x, y: 0, z: 0 }, { x, y: 0, z: H + 0.05 });
  ctx.stroke();
  for (const x of [-P, P]) {
    const top = project(cam, { x, y: 0, z: H + 0.08 });
    ctx.fillStyle = "#f39bbb";
    ctx.beginPath();
    ctx.arc(top.x, top.y, Math.max(3, top.s * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLanding(ctx: CanvasRenderingContext2D, cam: Camera, p: V3, t: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  const r = 0.28 + Math.sin(t * 8) * 0.03;
  const pts: V3[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, z: 0 });
  }
  poly(ctx, cam, pts);
  ctx.stroke();
  ctx.restore();
}

export type RenderInput = {
  match: Match;
  prev: Snapshot;
  alpha: number;
  avatars: [Avatar, Avatar];
  fx: Fx;
  showLanding: boolean;
  offscreenMarker?: boolean;
  dt: number;
};

export function render(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, input: RenderInput) {
  const { match: m, prev, alpha, avatars, fx } = input;
  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 14, (Math.random() - 0.5) * fx.shake * 14);
  drawCourt(ctx, cam, w, h);
  if (input.showLanding && fx.landing) drawLanding(ctx, cam, fx.landing, fx.time);

  const shuttle: V3 = {
    x: lerp(prev.shuttle.x, m.shuttle.pos.x, alpha),
    y: lerp(prev.shuttle.y, m.shuttle.pos.y, alpha),
    z: lerp(prev.shuttle.z, m.shuttle.pos.z, alpha),
  };
  const shuttleShadow = project(cam, { ...shuttle, z: 0 });
  ctx.fillStyle = "rgba(69,54,91,.2)";
  ctx.beginPath();
  ctx.ellipse(shuttleShadow.x, shuttleShadow.y, Math.max(3, shuttleShadow.s * 0.12), Math.max(1.5, shuttleShadow.s * 0.05), 0, 0, Math.PI * 2);
  ctx.fill();

  const sp = project(cam, shuttle);
  const speed = Math.hypot(m.shuttle.vel.x, m.shuttle.vel.y, m.shuttle.vel.z);
  if (m.inPlay && speed > 9 && m.shuttle.pos.z > 0) {
    fx.trail.push({ x: sp.x, y: sp.y });
    if (fx.trail.length > 12) fx.trail.shift();
  } else if (fx.trail.length) fx.trail.shift();

  const drawables: { depth: number; draw: () => void }[] = [];
  for (const side of [0, 1] as const) {
    const p = m.players[side];
    const px = lerp(prev.players[side].x, p.x, alpha);
    const py = lerp(prev.players[side].y, p.y, alpha);
    const moving = Math.hypot(p.vx, p.vy) > 0.4;
    fx.runPhase[side] += Math.hypot(p.vx, p.vy) * input.dt * 3.2;
    drawables.push({
      depth: py,
      draw: () => {
        const g = project(cam, { x: px, y: py, z: 0 });
        const result = m.winner === null ? null : m.winner === side ? "win" : "lose";
        drawChibi(ctx, g.x, g.y, g.s * CHIBI_SCALE, avatars[side], p, side === 1, { moving, runPhase: fx.runPhase[side], lunge: p.lunge > 0, recovering: p.recover > 0, result, t: fx.time });
      },
    });
  }
  drawables.push({ depth: 0, draw: () => drawNet(ctx, cam) });
  drawables.push({
    depth: shuttle.y,
    draw: () => {
      if (fx.trail.length > 1) {
        ctx.save();
        ctx.lineCap = "round";
        for (let i = 1; i < fx.trail.length; i++) {
          const a = fx.trail[i - 1];
          const b = fx.trail[i];
          ctx.strokeStyle = fx.trailSakura ? `rgba(243,155,187,${i / fx.trail.length})` : `rgba(255,255,255,${(i / fx.trail.length) * 0.7})`;
          ctx.lineWidth = (fx.trailSakura ? 10 : 5) * (i / fx.trail.length);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      const ahead = project(cam, { x: shuttle.x + m.shuttle.vel.x * 0.02, y: shuttle.y + m.shuttle.vel.y * 0.02, z: shuttle.z + m.shuttle.vel.z * 0.02 });
      drawShuttle(ctx, sp.x, sp.y, sp.s, ahead.x - sp.x || 0.001, ahead.y - sp.y);
      if (input.offscreenMarker && sp.y < 86) {
        const x = Math.max(24, Math.min(w - 24, sp.x));
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.strokeStyle = "#e7779f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, 104, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e7779f";
        ctx.beginPath();
        ctx.moveTo(x, 82);
        ctx.lineTo(x - 7, 90);
        ctx.lineTo(x + 7, 90);
        ctx.closePath();
        ctx.fill();
        drawShuttle(ctx, x, 104, 40, 0, 1);
        ctx.restore();
      }
    },
  });
  drawables.sort((a, b) => b.depth - a.depth);
  for (const d of drawables) d.draw();

  for (const p of fx.particles) {
    if (!p.alive) continue;
    const fade = 1 - p.life / p.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade * 1.4);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.kind === "petal") {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "confetti") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of fx.pops) {
    const k = t.life / t.max;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `700 ${t.size}px Fredoka, ui-rounded, system-ui, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.strokeText(t.text, t.x, t.y - k * 34);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y - k * 34);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,240,246,${fx.flash * 0.45})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (fx.banner) {
    const b = fx.banner;
    const k = b.life / b.max;
    const appear = Math.min(1, b.life / 0.15);
    const size = Math.min(w * 0.09, 64) * (0.8 + 0.2 * appear);
    ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(b.text, w / 2, h * 0.42);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, w / 2, h * 0.42);
    if (b.sub) {
      ctx.font = `600 ${size * 0.38}px Fredoka, ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeText(b.sub, w / 2, h * 0.42 + size * 0.75);
      ctx.fillStyle = "#6b5a86";
      ctx.fillText(b.sub, w / 2, h * 0.42 + size * 0.75);
    }
    ctx.globalAlpha = 1;
  }
}
