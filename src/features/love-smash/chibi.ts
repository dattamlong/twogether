import type { Avatar } from "@/features/session/types";
import { sideOf, type Side } from "./court";
import type { Match, Player, Swing } from "./sim";

export const READY_ANGLE = 2.2;

export type Mood = "normal" | "happy" | "sad" | "focus";

export type AnimState = {
  arm: number;
  off: number;
  jump: number;
  lean: number;
  squash: number;
  legPhase: number;
  stride: number;
  breathe: number;
  blink: number;
  blinkIn: number;
  headTilt: number;
  mood: Mood;
  result: "win" | "lose" | null;
  time: number;
};

export function createAnim(seed = 0): AnimState {
  return { arm: READY_ANGLE, off: 0.35, jump: 0, lean: 0, squash: 0, legPhase: 0, stride: 0, breathe: seed, blink: 0, blinkIn: 2 + seed, headTilt: 0, mood: "normal", result: null, time: 0 };
}

function keyframes(frames: [number, number][], t: number) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const e = k * k * (3 - 2 * k);
      return v0 + (v1 - v0) * e;
    }
  }
  return frames[frames.length - 1][1];
}

const SWINGS: Record<Swing["kind"], [number, number][]> = {
  overhead: [[0, 2.7], [3, 1.7], [6, 0.6], [11, 0.25], [22, READY_ANGLE]],
  smash: [[0, 2.6], [2, 1.4], [5, 0.1], [11, -0.1], [22, READY_ANGLE]],
  forehand: [[0, 1.5], [3, 0.7], [6, -0.2], [12, -0.35], [22, READY_ANGLE]],
  backhand: [[0, -1.3], [3, -2.0], [7, -2.4], [13, -2.2], [22, READY_ANGLE]],
  drop: [[0, 2.6], [4, 2.15], [10, 1.95], [22, READY_ANGLE]],
  lift: [[0, 0.45], [3, 1.4], [7, 2.4], [12, 2.6], [22, READY_ANGLE]],
  serve: [[0, 0.45], [3, 1.4], [7, 2.3], [12, 2.5], [22, READY_ANGLE]],
  whiff: [[0, 1.3], [5, -0.2], [12, 0.3], [22, READY_ANGLE]],
};

export const SWING_TICKS = 22;

export function swingAngle(swing: Swing) {
  return keyframes(SWINGS[swing.kind], swing.t);
}

function windup(m: Match, p: Player) {
  const s = m.shuttle.pos;
  if (s.z >= 1.75) return 3.7;
  if (s.z < 0.9) return 0.15;
  const across = (s.x - p.x) * (p.side === 0 ? 1 : -1) * p.facing;
  return across >= 0 ? 2.65 : -0.4;
}

const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

export function updateAnim(a: AnimState, m: Match, slot: number, dt: number) {
  const p = m.players[slot];
  const side: Side = p.side;
  a.time += dt;
  a.result = m.winner === null ? null : m.winner === side ? "win" : "lose";
  const speed = Math.hypot(p.vx, p.vy);
  a.legPhase += speed * dt * 4.2;
  a.stride = approach(a.stride, Math.min(speed / 5, 1), 14, dt);
  a.breathe += dt * 2.2;
  a.blinkIn -= dt;
  if (a.blinkIn <= 0) {
    a.blink = 0.14;
    a.blinkIn = 2.2 + ((a.time * 7.3) % 2.4);
  }
  a.blink = Math.max(0, a.blink - dt);

  let armTarget = READY_ANGLE;
  let offTarget = 0.35 + Math.sin(a.legPhase) * 0.5 * a.stride;
  let squash = 0;
  let jump = 0;
  let mood: Mood = "normal";
  let tilt = 0;
  const incoming = m.inPlay && m.lastHitter !== null && m.lastHitter !== side && !m.shuttle.netted;

  if (a.result === "win") {
    armTarget = 3.0 + Math.sin(a.time * 9) * 0.25;
    offTarget = 2.9 - Math.sin(a.time * 9) * 0.25;
    jump = Math.abs(Math.sin(a.time * 6)) * 0.3;
    mood = "happy";
  } else if (a.result === "lose") {
    armTarget = 0.15;
    offTarget = 0.1;
    mood = "sad";
    tilt = 0.18;
    squash = 0.05;
  } else if (p.swing) {
    a.arm = swingAngle(p.swing);
    if (p.swing.kind === "smash") jump = Math.max(0, Math.sin((Math.min(p.swing.t + 3, 15) / 15) * Math.PI)) * 0.45;
    offTarget = p.swing.kind === "overhead" || p.swing.kind === "smash" || p.swing.kind === "drop" ? 2.4 : -0.3;
    mood = p.swing.kind === "whiff" ? "sad" : "focus";
  } else if (incoming && sideOf(m.shuttle.pos.y) === side) {
    const dist = Math.hypot(m.shuttle.pos.x - p.x, m.shuttle.pos.y - p.y);
    const w = Math.max(0, Math.min(1, (2.6 - dist) / 1.6));
    const wind = windup(m, p);
    armTarget = READY_ANGLE + (wind - READY_ANGLE) * w;
    if (m.shuttle.pos.z >= 1.75) {
      offTarget = 0.35 + 2.2 * w;
      squash = 0.05 * w;
    }
    mood = w > 0.3 ? "focus" : "normal";
  } else if (m.phase === "serve" && m.serverSlot === slot) {
    armTarget = 0.5;
    offTarget = 1.3;
  }

  if (!p.swing || a.result) a.arm = approach(a.arm, armTarget, 16, dt);
  a.off = approach(a.off, offTarget, 12, dt);
  a.jump = approach(a.jump, jump, p.swing?.kind === "smash" ? 40 : 14, dt);
  a.squash = approach(a.squash, squash, 12, dt);
  const leanTarget = p.lunge > 0 ? 0.42 * (p.lungeDir.x >= 0 ? 1 : -1) : Math.max(-0.12, Math.min(0.12, p.vx * 0.025));
  a.lean = approach(a.lean, leanTarget, p.lunge > 0 ? 30 : 10, dt);
  a.headTilt = approach(a.headTilt, tilt, 6, dt);
  a.mood = mood;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = Number.parseInt(full.slice(0, 6), 16);
  return Number.isNaN(n) ? [200, 180, 200] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const OUTLINE = "rgba(69,54,91,.55)";

function limb(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, fill: string, u: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1, 0.016 * u);
  ctx.beginPath();
  ctx.roundRect(-width / 2, 0, width, length, width / 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRacket(ctx: CanvasRenderingContext2D, u: number) {
  ctx.strokeStyle = "#45365b";
  ctx.lineWidth = Math.max(1.4, 0.022 * u);
  ctx.beginPath();
  ctx.moveTo(0, 0.26 * u);
  ctx.lineTo(0, 0.5 * u);
  ctx.stroke();
  ctx.fillStyle = "#6a5583";
  ctx.beginPath();
  ctx.roundRect(-0.022 * u, 0.22 * u, 0.044 * u, 0.12 * u, 0.02 * u);
  ctx.fill();
  const cy = 0.66 * u;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, 0.12 * u, 0.16 * u, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(231,119,159,.5)";
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.034 * u, cy - 0.17 * u);
    ctx.lineTo(i * 0.034 * u, cy + 0.17 * u);
    ctx.moveTo(-0.13 * u, cy + i * 0.044 * u);
    ctx.lineTo(0.13 * u, cy + i * 0.044 * u);
    ctx.stroke();
  }
  ctx.restore();
  const frame = ctx.createLinearGradient(0, cy - 0.16 * u, 0, cy + 0.16 * u);
  frame.addColorStop(0, "#f39bbb");
  frame.addColorStop(1, "#a995dc");
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(2, 0.034 * u);
  ctx.beginPath();
  ctx.ellipse(0, cy, 0.12 * u, 0.16 * u, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function backHair(ctx: CanvasRenderingContext2D, a: Avatar, u: number, hy: number) {
  ctx.fillStyle = shade(a.hairColor, -0.12);
  if (a.hair === "long") {
    ctx.beginPath();
    ctx.roundRect(-0.4 * u, hy - 0.05 * u, 0.8 * u, 0.62 * u, [0.1 * u, 0.1 * u, 0.22 * u, 0.22 * u]);
    ctx.fill();
  }
  if (a.hair === "bob") {
    ctx.beginPath();
    ctx.roundRect(-0.42 * u, hy - 0.08 * u, 0.84 * u, 0.36 * u, 0.16 * u);
    ctx.fill();
  }
  if (a.hair === "twintails") {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 0.47 * u, hy + 0.12 * u, 0.12 * u, 0.28 * u, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f39bbb";
      ctx.beginPath();
      ctx.arc(s * 0.4 * u, hy - 0.12 * u, 0.05 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(a.hairColor, -0.12);
    }
  }
  if (a.hair === "bun") {
    ctx.beginPath();
    ctx.arc(0, hy - 0.42 * u, 0.15 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, color: string, open: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, Math.max(0.08, open));
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.085 * u, 0.105 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  const iris = ctx.createLinearGradient(0, -0.1 * u, 0, 0.1 * u);
  iris.addColorStop(0, shade(color, -0.25));
  iris.addColorStop(1, shade(color, 0.35));
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(0.005 * u, 0.008 * u, 0.07 * u, 0.094 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2c2140";
  ctx.beginPath();
  ctx.ellipse(0.005 * u, 0.012 * u, 0.034 * u, 0.05 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0.03 * u, -0.035 * u, 0.026 * u, 0, Math.PI * 2);
  ctx.arc(-0.025 * u, 0.045 * u, 0.012 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#2c2140";
  ctx.lineWidth = Math.max(1.2, 0.024 * u);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(x, y, 0.09 * u, 0.11 * u * Math.max(0.08, open), 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
}

function face(ctx: CanvasRenderingContext2D, a: Avatar, u: number, hy: number, anim: AnimState) {
  const open = anim.blink > 0 ? 0.1 : 1;
  const ey = hy + 0.06 * u;
  if (anim.mood === "happy") {
    ctx.strokeStyle = "#2c2140";
    ctx.lineWidth = Math.max(1.4, 0.03 * u);
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 0.15 * u, ey + 0.03 * u, 0.06 * u, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    const squint = anim.mood === "sad" ? 0.7 : anim.mood === "focus" ? 0.85 : 1;
    eye(ctx, -0.15 * u, ey, u, a.eyes, open * squint);
    eye(ctx, 0.15 * u, ey, u, a.eyes, open * squint);
  }
  ctx.strokeStyle = shade(a.hairColor, -0.2);
  ctx.lineWidth = Math.max(1, 0.018 * u);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    const tilt = anim.mood === "focus" ? 0.035 : anim.mood === "sad" ? -0.03 : 0;
    ctx.moveTo(s * 0.08 * u, ey - 0.14 * u + tilt * u);
    ctx.quadraticCurveTo(s * 0.15 * u, ey - 0.17 * u, s * 0.22 * u, ey - 0.14 * u - tilt * u);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(243,155,187,.55)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 0.25 * u, ey + 0.12 * u, 0.065 * u, 0.035 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#45365b";
  ctx.fillStyle = "#c2527c";
  ctx.lineWidth = Math.max(1.1, 0.02 * u);
  const my = ey + 0.17 * u;
  ctx.beginPath();
  if (anim.mood === "happy" || anim.result === "win") {
    ctx.moveTo(-0.05 * u, my - 0.01 * u);
    ctx.quadraticCurveTo(0, my + 0.07 * u, 0.05 * u, my - 0.01 * u);
    ctx.closePath();
    ctx.fill();
  } else if (anim.mood === "sad") {
    ctx.arc(0, my + 0.03 * u, 0.035 * u, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (anim.mood === "focus") {
    ctx.ellipse(0, my, 0.018 * u, 0.022 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(0, my - 0.02 * u, 0.04 * u, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  if (anim.result === "lose") {
    ctx.fillStyle = "rgba(111,181,227,.85)";
    ctx.beginPath();
    ctx.ellipse(0.2 * u, ey + 0.13 * u, 0.025 * u, 0.04 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (a.accessory === "glasses") {
    ctx.strokeStyle = "#45365b";
    ctx.lineWidth = Math.max(1, 0.02 * u);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 0.15 * u, ey, 0.11 * u, 0.1 * u, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-0.04 * u, ey);
    ctx.lineTo(0.04 * u, ey);
    ctx.stroke();
  }
}

function frontHair(ctx: CanvasRenderingContext2D, a: Avatar, u: number, hy: number) {
  const hair = ctx.createLinearGradient(0, hy - 0.4 * u, 0, hy);
  hair.addColorStop(0, shade(a.hairColor, 0.12));
  hair.addColorStop(1, a.hairColor);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(0, hy - 0.08 * u, 0.42 * u, 0.3 * u, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  const spiky = a.hair === "spiky";
  ctx.moveTo(-0.42 * u, hy - 0.06 * u);
  const strands = spiky ? [[-0.3, 0.02], [-0.22, -0.14], [-0.1, 0.06], [0.02, -0.16], [0.14, 0.05], [0.26, -0.15], [0.36, 0.04]] : [[-0.3, 0.1], [-0.2, -0.02], [-0.08, 0.08], [0.02, -0.04], [0.12, 0.08], [0.24, -0.02], [0.34, 0.1]];
  for (const [x, y] of strands) ctx.quadraticCurveTo((x - 0.06) * u, hy + (y - 0.06) * u, x * u, hy + y * u);
  ctx.lineTo(0.42 * u, hy - 0.06 * u);
  ctx.lineTo(0.42 * u, hy - 0.2 * u);
  ctx.lineTo(-0.42 * u, hy - 0.2 * u);
  ctx.closePath();
  ctx.fill();
  if (a.hair === "bob" || a.hair === "long" || a.hair === "twintails") {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.4 * u, hy - 0.12 * u);
      ctx.quadraticCurveTo(s * 0.46 * u, hy + 0.12 * u, s * 0.34 * u, hy + 0.3 * u);
      ctx.quadraticCurveTo(s * 0.33 * u, hy + 0.05 * u, s * 0.3 * u, hy - 0.02 * u);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,.45)";
  ctx.lineWidth = Math.max(1.4, 0.028 * u);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-0.05 * u, hy - 0.06 * u, 0.28 * u, Math.PI * 1.2, Math.PI * 1.45);
  ctx.stroke();
}

function accessory(ctx: CanvasRenderingContext2D, a: Avatar, u: number, hy: number) {
  if (a.accessory === "bow") {
    ctx.fillStyle = "#e7779f";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0.22 * u, hy - 0.3 * u);
      ctx.lineTo(0.22 * u + s * 0.13 * u, hy - 0.4 * u);
      ctx.lineTo(0.22 * u + s * 0.13 * u, hy - 0.2 * u);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#c2527c";
    ctx.beginPath();
    ctx.arc(0.22 * u, hy - 0.3 * u, 0.035 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  if (a.accessory === "flower_crown") {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#f8bbd0" : "#fbe3b1";
      ctx.beginPath();
      ctx.arc((-0.3 + i * 0.12) * u, hy + (-0.32 + Math.abs(i - 2.5) * 0.02) * u, 0.055 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (a.accessory === "beanie") {
    ctx.fillStyle = "#a995dc";
    ctx.beginPath();
    ctx.ellipse(0, hy - 0.2 * u, 0.42 * u, 0.2 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#8a73c8";
    ctx.fillRect(-0.42 * u, hy - 0.22 * u, 0.84 * u, 0.07 * u);
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.arc(0, hy - 0.42 * u, 0.07 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawChibi(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, a: Avatar, p: Player, front: boolean, anim: AnimState, mirror = false) {
  const facing = (p.facing >= 0 ? 1 : -1) * (mirror ? -1 : 1);
  const hand = front ? -facing : facing;
  ctx.save();
  ctx.fillStyle = `rgba(69,54,91,${0.22 * (1 - anim.jump)})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 0.38 * u * (1 - anim.jump * 0.5), 0.13 * u * (1 - anim.jump * 0.5), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y - anim.jump * u);
  ctx.rotate(mirror ? -anim.lean : anim.lean);
  const breath = Math.sin(anim.breathe) * 0.008 * u;
  const bounce = Math.abs(Math.sin(anim.legPhase)) * 0.05 * u * anim.stride;
  ctx.scale(1 + anim.squash * 0.6, 1 - anim.squash);

  const hip = -0.42 * u;
  const stride = anim.stride * 0.55 + (p.lunge > 0 ? 0.35 : 0);
  const sock = "#ffffff";
  for (const s of [-1, 1]) {
    const swing = Math.sin(anim.legPhase + (s > 0 ? 0 : Math.PI)) * stride;
    limb(ctx, s * 0.1 * u, hip - bounce, swing, 0.4 * u, 0.12 * u, a.skin, u);
    ctx.save();
    ctx.translate(s * 0.1 * u, hip - bounce);
    ctx.rotate(swing);
    ctx.fillStyle = sock;
    ctx.fillRect(-0.06 * u, 0.24 * u, 0.12 * u, 0.1 * u);
    ctx.fillStyle = "#e7779f";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, 0.016 * u);
    ctx.beginPath();
    ctx.ellipse(0.015 * u * s, 0.38 * u, 0.085 * u, 0.05 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.translate(0, -bounce + breath);
  ctx.fillStyle = shade(a.outfitColor, -0.3);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1, 0.016 * u);
  ctx.beginPath();
  ctx.roundRect(-0.21 * u, -0.52 * u, 0.42 * u, 0.16 * u, 0.06 * u);
  ctx.fill();
  ctx.stroke();

  const offShoulderX = -hand * 0.22 * u;
  ctx.save();
  ctx.translate(offShoulderX, -0.76 * u);
  ctx.scale(-hand, 1);
  ctx.rotate(-anim.off);
  limb(ctx, 0, 0, 0, 0.3 * u, 0.1 * u, a.skin, u);
  ctx.fillStyle = a.outfitColor;
  ctx.beginPath();
  ctx.roundRect(-0.065 * u, -0.02 * u, 0.13 * u, 0.12 * u, 0.05 * u);
  ctx.fill();
  ctx.restore();

  const shirt = ctx.createLinearGradient(-0.22 * u, -0.86 * u, 0.22 * u, -0.46 * u);
  shirt.addColorStop(0, shade(a.outfitColor, 0.18));
  shirt.addColorStop(1, shade(a.outfitColor, -0.1));
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(-0.2 * u, -0.86 * u);
  ctx.lineTo(0.2 * u, -0.86 * u);
  ctx.quadraticCurveTo(0.25 * u, -0.66 * u, 0.23 * u, -0.46 * u);
  ctx.lineTo(-0.23 * u, -0.46 * u);
  ctx.quadraticCurveTo(-0.25 * u, -0.66 * u, -0.2 * u, -0.86 * u);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = Math.max(1.2, 0.025 * u);
  ctx.beginPath();
  if (front) {
    ctx.moveTo(-0.09 * u, -0.86 * u);
    ctx.lineTo(0, -0.76 * u);
    ctx.lineTo(0.09 * u, -0.86 * u);
  } else {
    ctx.moveTo(-0.11 * u, -0.86 * u);
    ctx.quadraticCurveTo(0, -0.82 * u, 0.11 * u, -0.86 * u);
  }
  ctx.moveTo(-0.23 * u, -0.5 * u);
  ctx.lineTo(0.23 * u, -0.5 * u);
  ctx.stroke();
  if (!front) {
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.beginPath();
    const hx = 0;
    const hy2 = -0.68 * u;
    const r = 0.05 * u;
    ctx.moveTo(hx, hy2 + r * 1.2);
    ctx.bezierCurveTo(hx - r * 2, hy2 - r * 0.2, hx - r * 0.8, hy2 - r * 1.6, hx, hy2 - r * 0.5);
    ctx.bezierCurveTo(hx + r * 0.8, hy2 - r * 1.6, hx + r * 2, hy2 - r * 0.2, hx, hy2 + r * 1.2);
    ctx.fill();
  }

  const hy = -1.16 * u;
  ctx.save();
  ctx.translate(0, -0.86 * u);
  ctx.rotate(anim.headTilt * hand);
  ctx.translate(0, 0.86 * u);
  backHair(ctx, a, u, hy);
  const skin = ctx.createRadialGradient(-0.1 * u, hy - 0.08 * u, 0.05 * u, 0, hy, 0.44 * u);
  skin.addColorStop(0, shade(a.skin, 0.25));
  skin.addColorStop(1, shade(a.skin, -0.06));
  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1, 0.018 * u);
  ctx.beginPath();
  ctx.ellipse(0, hy, 0.4 * u, 0.36 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (front) {
    face(ctx, a, u, hy, anim);
    frontHair(ctx, a, u, hy);
  } else {
    const hair = ctx.createLinearGradient(0, hy - 0.4 * u, 0, hy + 0.35 * u);
    hair.addColorStop(0, shade(a.hairColor, 0.15));
    hair.addColorStop(1, shade(a.hairColor, -0.1));
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, hy - 0.03 * u, 0.415 * u, 0.37 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.36 * u, hy + 0.1 * u);
    for (let i = 0; i <= 6; i++) ctx.quadraticCurveTo((-0.36 + i * 0.12 - 0.06) * u, hy + 0.34 * u, (-0.36 + i * 0.12) * u, hy + (i % 2 ? 0.24 : 0.3) * u);
    ctx.lineTo(0.36 * u, hy + 0.1 * u);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = Math.max(1.4, 0.03 * u);
    ctx.beginPath();
    ctx.arc(0, hy - 0.02 * u, 0.3 * u, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.strokeStyle = shade(a.hairColor, -0.25);
    ctx.lineWidth = Math.max(1, 0.015 * u);
    for (const dx of [-0.15, 0, 0.15]) {
      ctx.beginPath();
      ctx.moveTo(dx * u * 0.6, hy - 0.3 * u);
      ctx.quadraticCurveTo(dx * u, hy, dx * u * 1.2, hy + 0.25 * u);
      ctx.stroke();
    }
  }
  accessory(ctx, a, u, hy);
  ctx.restore();

  ctx.save();
  ctx.translate(hand * 0.22 * u, -0.78 * u);
  ctx.scale(hand, 1);
  ctx.rotate(-anim.arm);
  ctx.fillStyle = a.skin;
  limb(ctx, 0, 0, 0, 0.3 * u, 0.1 * u, a.skin, u);
  ctx.fillStyle = a.outfitColor;
  ctx.beginPath();
  ctx.roundRect(-0.065 * u, -0.02 * u, 0.13 * u, 0.12 * u, 0.05 * u);
  ctx.fill();
  ctx.fillStyle = "#f39bbb";
  ctx.fillRect(-0.055 * u, 0.22 * u, 0.11 * u, 0.04 * u);
  drawRacket(ctx, u);
  ctx.restore();
  ctx.restore();
}
