import type { Avatar } from "@/features/session/types";
import { project, type Camera } from "./camera";
import { drawChibi, type AnimState } from "./chibi";
import { predictPath, type Vec3 } from "./physics";
import { REACH } from "./rules";
import { drawSpectators, type Scene } from "./scene";
import { hittable, type Match } from "./sim";

export { makeCamera, project, type Camera, type Insets } from "./camera";

export const CHIBI_SCALE = 1.3;

export type Snapshot = { players: { x: number; y: number }[]; shuttle: Vec3 };

export type Particle = { alive: boolean; x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; max: number; size: number; color: string; kind: "petal" | "spark" | "confetti" | "streak" | "snow" | "ember" | "heart" | "bolt" };

export type Pop = { text: string; x: number; y: number; life: number; max: number; color: string; size: number };

export type Impact = { x: number; y: number; life: number; max: number; color: string; power: number };

export type Fx = {
  particles: Particle[];
  pops: Pop[];
  impacts: Impact[];
  banner: { text: string; sub: string; life: number; max: number; color: string } | null;
  trail: Vec3[];
  trailKind: "normal" | "smash" | "sakura" | "frost" | "phoenix" | "sync";
  shake: number;
  flash: number;
  cheer: number;
  landing: { key: number; point: Vec3 | null };
  ambientIn: number;
  time: number;
};

export function createFx(): Fx {
  return { particles: [], pops: [], impacts: [], banner: null, trail: [], trailKind: "normal", shake: 0, flash: 0, cheer: 0, landing: { key: -1, point: null }, ambientIn: 0, time: 0 };
}

export function snapshot(m: Match): Snapshot {
  return {
    players: m.players.map((p) => ({ x: p.x, y: p.y })),
    shuttle: { ...m.shuttle.pos },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const PETAL_COLORS = ["#f8bbd0", "#f39bbb", "#ffd6e5", "#ffffff"];
const CONFETTI = ["#f39bbb", "#a995dc", "#8fd3c1", "#fbd38d", "#7cc3ef"];

function spawn(fx: Fx, p: Omit<Particle, "alive">) {
  for (const q of fx.particles) {
    if (!q.alive) {
      Object.assign(q, p, { alive: true });
      return;
    }
  }
  if (fx.particles.length < 260) fx.particles.push({ ...p, alive: true });
}

export function burst(fx: Fx, x: number, y: number, kind: Particle["kind"], count: number, power = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (40 + Math.random() * 170) * power;
    spawn(fx, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (kind === "spark" ? 40 : 90),
      rot: kind === "streak" ? a : Math.random() * 6,
      vr: kind === "streak" ? 0 : (Math.random() - 0.5) * 8,
      life: 0,
      max: kind === "spark" || kind === "bolt" ? 0.3 + Math.random() * 0.2 : kind === "streak" ? 0.28 : kind === "ember" ? 0.6 + Math.random() * 0.4 : 0.9 + Math.random() * 0.9,
      size: kind === "spark" ? 2 + Math.random() * 2.5 : kind === "streak" || kind === "bolt" ? 14 + Math.random() * 12 : kind === "ember" ? 2.5 + Math.random() * 3 : 5 + Math.random() * 5,
      color: kind === "confetti" ? CONFETTI[i % CONFETTI.length] : kind === "spark" ? "#fff6b0" : kind === "streak" ? "#ffffff" : kind === "bolt" ? "#7cc3ef" : kind === "snow" ? "#e5f3fc" : kind === "ember" ? (i % 2 ? "#f6a88a" : "#f5cb78") : kind === "heart" ? (i % 2 ? "#e7779f" : "#a995dc") : PETAL_COLORS[i % PETAL_COLORS.length],
      kind,
    });
  }
}

export function impact(fx: Fx, x: number, y: number, color: string, power: number) {
  fx.impacts.push({ x, y, life: 0, max: 0.26, color, power });
  if (fx.impacts.length > 4) fx.impacts.shift();
}

export function pop(fx: Fx, text: string, x: number, y: number, color: string, size = 22) {
  fx.pops.push({ text, x, y, life: 0, max: 0.9, color, size });
  if (fx.pops.length > 8) fx.pops.shift();
}

export function banner(fx: Fx, text: string, sub: string, color: string, seconds = 1.3) {
  fx.banner = { text, sub, life: 0, max: seconds, color };
}

export function updateFx(fx: Fx, dt: number, reduced: boolean, w = 0) {
  fx.time += dt;
  for (const p of fx.particles) {
    if (!p.alive) continue;
    p.life += dt;
    if (p.life >= p.max) {
      p.alive = false;
      continue;
    }
    if (p.kind === "streak" || p.kind === "bolt") continue;
    const drag = p.kind === "petal" || p.kind === "snow" || p.kind === "heart" ? 1.6 : 3;
    p.vx -= p.vx * drag * dt;
    p.vy += (p.kind === "petal" ? 55 : p.kind === "confetti" ? 160 : 90) * dt - p.vy * drag * dt * 0.5;
    if (p.kind === "petal") p.vx += Math.sin(fx.time * 3 + p.rot) * 30 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (const t of fx.pops) t.life += dt;
  fx.pops = fx.pops.filter((t) => t.life < t.max);
  for (const i of fx.impacts) i.life += dt;
  fx.impacts = fx.impacts.filter((i) => i.life < i.max);
  if (fx.banner) {
    fx.banner.life += dt;
    if (fx.banner.life >= fx.banner.max) fx.banner = null;
  }
  fx.shake = reduced ? 0 : Math.max(0, fx.shake - dt * 2.5);
  fx.flash = Math.max(0, fx.flash - dt * 3);
  fx.cheer = Math.max(0, fx.cheer - dt * 0.7);
  if (!reduced && w > 0) {
    fx.ambientIn -= dt;
    if (fx.ambientIn <= 0) {
      fx.ambientIn = 0.55 + Math.random() * 0.6;
      spawn(fx, { x: Math.random() * w, y: -10, vx: 10 + Math.random() * 20, vy: 25 + Math.random() * 20, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, life: 0, max: 7, size: 3 + Math.random() * 3, color: PETAL_COLORS[Math.floor(Math.random() * 3)], kind: "petal" });
    }
  }
}

function ringPath(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const q = project(cam, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: 0 });
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
}

function drawShuttle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, grounded: boolean) {
  const k = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(grounded ? Math.PI / 2 - 0.3 : angle);
  ctx.lineJoin = "round";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#45365b";
  ctx.lineWidth = Math.max(1.4, k * 0.14);
  ctx.beginPath();
  ctx.moveTo(-k * 0.1, -k * 0.38);
  ctx.lineTo(-k * 1.7, -k * 0.95);
  ctx.quadraticCurveTo(-k * 1.85, 0, -k * 1.7, k * 0.95);
  ctx.lineTo(-k * 0.1, k * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(106,85,131,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const t of [-0.5, 0, 0.5]) {
    ctx.moveTo(-k * 0.2, t * k * 0.5);
    ctx.lineTo(-k * 1.65, t * k * 1.6);
  }
  ctx.stroke();
  ctx.fillStyle = "#e7779f";
  ctx.strokeStyle = "#45365b";
  ctx.lineWidth = Math.max(1.2, k * 0.12);
  ctx.beginPath();
  ctx.arc(k * 0.12, 0, k * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.beginPath();
  ctx.arc(0, -k * 0.16, k * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export type RenderInput = {
  match: Match;
  prev: Snapshot;
  alpha: number;
  avatars: Avatar[];
  anims: AnimState[];
  names?: string[];
  scene: Scene;
  fx: Fx;
  dt: number;
  human: number | null;
  flip?: boolean;
  offscreenMarker?: boolean;
  markerY?: number;
};

export const toView = (p: Vec3, flip: boolean): Vec3 => (flip ? { x: -p.x, y: -p.y, z: p.z } : p);

export function render(ctx: CanvasRenderingContext2D, rawCam: Camera, w: number, h: number, input: RenderInput) {
  const { match: m, prev, alpha, avatars, anims, scene, fx } = input;
  const flip = Boolean(input.flip);
  const cam = rawCam;
  const P = (p: Vec3) => project(cam, toView(p, flip));
  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 14, (Math.random() - 0.5) * fx.shake * 14);
  ctx.drawImage(scene.ground, 0, 0, w, h);
  drawSpectators(ctx, cam, scene.spectators, fx.time, fx.cheer);

  const shuttle: Vec3 = {
    x: lerp(prev.shuttle.x, m.shuttle.pos.x, alpha),
    y: lerp(prev.shuttle.y, m.shuttle.pos.y, alpha),
    z: lerp(prev.shuttle.z, m.shuttle.pos.z, alpha),
  };
  const flying = m.inPlay && m.phase === "rally" && shuttle.z > 0.001;

  if (flying && !m.shuttle.netted && m.shuttle.vel.z < 0 && shuttle.z > 0.25) {
    if (fx.landing.key !== m.rally || !fx.landing.point) {
      const path = predictPath(m.shuttle, 420);
      const end = path[path.length - 1];
      fx.landing = { key: m.rally, point: end && end.z <= 0.0001 ? end : null };
    }
  } else fx.landing = { key: m.rally, point: null };
  if (fx.landing.point) {
    const pt = fx.landing.point;
    const pulse = 0.22 + Math.sin(fx.time * 9) * 0.03;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ringPath(ctx, cam, flip ? -pt.x : pt.x, flip ? -pt.y : pt.y, pulse);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (input.human !== null && m.phase === "rally") {
    const p = m.players[input.human];
    const px = lerp(prev.players[input.human].x, p.x, alpha);
    const py = lerp(prev.players[input.human].y, p.y, alpha);
    const ready = hittable(m, input.human);
    const incoming = m.inPlay && m.lastHitter !== input.human && !m.shuttle.netted;
    if (incoming || ready) {
      ctx.save();
      ctx.lineWidth = ready ? 3 : 1.5;
      ctx.strokeStyle = ready ? "rgba(231,119,159,.9)" : "rgba(255,255,255,.45)";
      ctx.fillStyle = ready ? "rgba(243,155,187,.18)" : "rgba(255,255,255,.06)";
      ringPath(ctx, cam, flip ? -px : px, flip ? -py : py, REACH);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  const shadow = P({ x: shuttle.x, y: shuttle.y, z: 0 });
  const lift = Math.min(1, shuttle.z / 5);
  ctx.fillStyle = `rgba(45,33,64,${0.42 - lift * 0.25})`;
  ctx.beginPath();
  ctx.ellipse(shadow.x, shadow.y, Math.max(3.5, shadow.s * 0.13 * (1 - lift * 0.4)), Math.max(1.8, shadow.s * 0.055 * (1 - lift * 0.4)), 0, 0, Math.PI * 2);
  ctx.fill();

  const sp = P(shuttle);
  const speed = Math.hypot(m.shuttle.vel.x, m.shuttle.vel.y, m.shuttle.vel.z);
  if (flying && speed > 5) {
    fx.trail.push({ ...shuttle });
    const max = Math.max(4, Math.min(16, Math.round(speed / 2)));
    while (fx.trail.length > max) fx.trail.shift();
  } else if (fx.trail.length) fx.trail.shift();

  const vy = (y: number) => (flip ? -y : y);
  const order: { depth: number; kind: "player" | "net" | "shuttle"; slot: number }[] = m.players.map((p, slot) => ({ depth: vy(lerp(prev.players[slot]?.y ?? p.y, p.y, alpha)), kind: "player" as const, slot }));
  order.push({ depth: 0, kind: "net", slot: -1 }, { depth: vy(shuttle.y), kind: "shuttle", slot: -1 });
  order.sort((a, b) => b.depth - a.depth);
  const viewer = flip ? 1 : 0;
  for (const item of order) {
    if (item.kind === "net") ctx.drawImage(scene.net, 0, 0, w, h);
    else if (item.kind === "shuttle") {
      if (flying && shuttle.z > 0.35) {
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(shadow.x, shadow.y);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (fx.trail.length > 1) {
        ctx.save();
        ctx.lineCap = "round";
        const intensity = Math.min(1, speed / 20);
        let last = P(fx.trail[0]);
        for (let i = 1; i < fx.trail.length; i++) {
          const cur = P(fx.trail[i]);
          const k = i / fx.trail.length;
          const tint = { sakura: `rgba(243,155,187,${k})`, smash: `rgba(255,200,110,${k * 0.9})`, frost: `rgba(150,215,245,${k * 0.9})`, phoenix: `rgba(246,140,90,${k})`, sync: `rgba(201,150,230,${k})`, normal: `rgba(255,255,255,${k * (0.35 + intensity * 0.5)})` }[fx.trailKind];
          ctx.strokeStyle = tint;
          ctx.lineWidth = (fx.trailKind === "normal" ? 3 + intensity * 4 : fx.trailKind === "frost" ? 6 : 9) * k;
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
          last = cur;
        }
        ctx.restore();
      }
      const ahead = P({ x: shuttle.x + m.shuttle.vel.x * 0.02, y: shuttle.y + m.shuttle.vel.y * 0.02, z: shuttle.z + m.shuttle.vel.z * 0.02 });
      const size = Math.max(6, sp.s * 0.13);
      drawShuttle(ctx, sp.x, sp.y, size, Math.atan2(ahead.y - sp.y, ahead.x - sp.x || 0.0001), !m.inPlay && shuttle.z <= 0.01);
      const my = input.markerY ?? 92;
      if (input.offscreenMarker && sp.y < my - 22) {
        const x = Math.max(24, Math.min(w - 24, sp.x));
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.strokeStyle = "#e7779f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, my, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e7779f";
        ctx.beginPath();
        ctx.moveTo(x, my - 22);
        ctx.lineTo(x - 7, my - 14);
        ctx.lineTo(x + 7, my - 14);
        ctx.closePath();
        ctx.fill();
        drawShuttle(ctx, x + 3, my, 6, -Math.PI / 2, false);
      }
    } else {
      const slot = item.slot;
      const p = m.players[slot];
      const px = lerp(prev.players[slot]?.x ?? p.x, p.x, alpha);
      const py = lerp(prev.players[slot]?.y ?? p.y, p.y, alpha);
      const g = P({ x: px, y: py, z: 0 });
      const u = g.s * CHIBI_SCALE;
      drawChibi(ctx, g.x, g.y, u, avatars[slot] ?? avatars[p.side], p, p.side !== viewer, anims[slot], flip);
      const name = input.names?.[slot];
      if (name) {
        const ty = g.y - (1.72 + anims[slot].jump) * u;
        ctx.font = `700 ${Math.max(10, Math.min(14, u * 0.2))}px Fredoka, ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = ctx.measureText(name).width + 12;
        ctx.fillStyle = slot === input.human ? "rgba(231,119,159,.92)" : p.side === viewer ? "rgba(255,255,255,.88)" : "rgba(69,54,91,.75)";
        ctx.beginPath();
        ctx.roundRect(g.x - tw / 2, ty - 9, tw, 18, 9);
        ctx.fill();
        ctx.fillStyle = slot === input.human || p.side !== viewer ? "#ffffff" : "#45365b";
        ctx.fillText(name, g.x, ty + 1);
      }
    }
  }

  for (const i of fx.impacts) {
    const k = i.life / i.max;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = i.color;
    ctx.lineCap = "round";
    for (let n = 0; n < 14; n++) {
      const a = (n / 14) * Math.PI * 2 + n;
      const r0 = (18 + k * 50) * i.power;
      const r1 = r0 + (16 + (n % 3) * 10) * i.power * (1 - k * 0.5);
      ctx.lineWidth = (n % 2 ? 2 : 3.5) * i.power;
      ctx.beginPath();
      ctx.moveTo(i.x + Math.cos(a) * r0, i.y + Math.sin(a) * r0);
      ctx.lineTo(i.x + Math.cos(a) * r1, i.y + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const p of fx.particles) {
    if (!p.alive) continue;
    const fade = 1 - p.life / p.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade * 1.4) * (p.max > 5 ? 0.7 : 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    if (p.kind === "petal") {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "confetti") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    else if (p.kind === "snow") {
      ctx.lineWidth = 1.5;
      for (let a = 0; a < 3; a++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(p.size, 0);
        ctx.stroke();
      }
    } else if (p.kind === "heart") {
      const r = p.size * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, r * 1.2);
      ctx.bezierCurveTo(-r * 2, -r * 0.2, -r * 0.8, -r * 1.6, 0, -r * 0.5);
      ctx.bezierCurveTo(r * 0.8, -r * 1.6, r * 2, -r * 0.2, 0, r * 1.2);
      ctx.fill();
    } else if (p.kind === "bolt") {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-p.size * fade, -2);
      ctx.lineTo(0, 2);
      ctx.lineTo(p.size * fade, -2);
      ctx.stroke();
    } else if (p.kind === "streak") {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-p.size * fade, 0);
      ctx.lineTo(p.size * fade, 0);
      ctx.stroke();
    } else {
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
    const grow = Math.min(1, t.life / 0.08);
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `800 ${t.size * (0.7 + 0.3 * grow)}px Fredoka, ui-rounded, system-ui, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.strokeText(t.text, t.x, t.y - k * 34);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y - k * 34);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,240,246,${fx.flash * 0.4})`;
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
    ctx.strokeText(b.text, w / 2, h * 0.4);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, w / 2, h * 0.4);
    if (b.sub) {
      ctx.font = `600 ${size * 0.38}px Fredoka, ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeText(b.sub, w / 2, h * 0.4 + size * 0.75);
      ctx.fillStyle = "#6b5a86";
      ctx.fillText(b.sub, w / 2, h * 0.4 + size * 0.75);
    }
    ctx.globalAlpha = 1;
  }
}
