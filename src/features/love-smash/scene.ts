import { project, type Camera } from "./camera";
import { shade } from "./chibi";
import { COURT } from "./court";
import type { Vec3 } from "./physics";
import { createRng, next, type Rng } from "./rng";

export type Spectator = { x: number; y: number; z: number; skin: string; hair: string; shirt: string; phase: number; side: "far" | "left" | "right" };

export type Scene = { ground: HTMLCanvasElement; net: HTMLCanvasElement; spectators: Spectator[]; w: number; h: number };

export type SceneTheme = {
  indoor: boolean;
  sky: [string, string, string];
  floor: [string, string];
  court: [string, string, string];
  standFront: string;
  standSide: string;
  banner: string;
  bannerColors: [string, string, string];
  trees: boolean;
  lights: string | null;
};

export const THEMES: Record<string, SceneTheme> = {
  default: { indoor: false, sky: ["#e6dcff", "#ffe6f0", "#fff1e4"], floor: ["#c6ebcf", "#a9dfb8"], court: ["#5fb497", "#8ad5b9", "#6cc3a2"], standFront: "#c7b8ea", standSide: "#f8bbd0", banner: "LOVE SMASH! 🏸💗 SMASH TOGETHER", bannerColors: ["#f39bbb", "#e7779f", "#a995dc"], trees: true, lights: null },
  sakura_garden: { indoor: false, sky: ["#ffe1ee", "#ffeef5", "#fff6ec"], floor: ["#c9eccf", "#ade0b9"], court: ["#5fb497", "#8ad5b9", "#6cc3a2"], standFront: "#f8bbd0", standSide: "#f8bbd0", banner: "🌸 SAKURA ROOKIE CUP 🌸", bannerColors: ["#f8bbd0", "#f39bbb", "#e7779f"], trees: true, lights: null },
  academy_gym: { indoor: true, sky: ["#d9c7a8", "#e8d9bd", "#f1e6d0"], floor: ["#e2b980", "#d4a56a"], court: ["#3f8f78", "#6fbfa2", "#58ad90"], standFront: "#6fb5e3", standSide: "#b8ddf5", banner: "🎓 ACADEMY CHAMPIONSHIP", bannerColors: ["#6fb5e3", "#4f8fc4", "#a995dc"], trees: false, lights: "rgba(255,247,220,.35)" },
  city_hall: { indoor: true, sky: ["#4a4468", "#6b6390", "#9a90b8"], floor: ["#8a86a6", "#77738f"], court: ["#3a7f6b", "#5db095", "#4a9a80"], standFront: "#f6a88a", standSide: "#f39bbb", banner: "🏙️ CITY OPEN", bannerColors: ["#f6a88a", "#e0607e", "#f5cb78"], trees: false, lights: "rgba(255,230,200,.4)" },
  national_arena: { indoor: true, sky: ["#2c2140", "#45365b", "#6a5583"], floor: ["#5a4c74", "#4a3e62"], court: ["#2f7a64", "#4fa98b", "#3f9277"], standFront: "#f5cb78", standSide: "#d9a440", banner: "🏅 NATIONAL CHAMPIONSHIP", bannerColors: ["#f5cb78", "#d9a440", "#f6a88a"], trees: false, lights: "rgba(255,240,200,.5)" },
  asia_stadium: { indoor: true, sky: ["#1f2a4a", "#33406b", "#5a6aa0"], floor: ["#4c5a86", "#3d4a72"], court: ["#30766a", "#4ea590", "#3f8e7c"], standFront: "#a995dc", standSide: "#8a73c8", banner: "🌏 ASIA MASTERS", bannerColors: ["#a995dc", "#8a73c8", "#e7779f"], trees: false, lights: "rgba(220,230,255,.5)" },
  world_stadium: { indoor: true, sky: ["#0f1d2e", "#1e3550", "#33557a"], floor: ["#2e4a66", "#233b54"], court: ["#2c7266", "#47a28c", "#3a8a78"], standFront: "#6cc3a2", standSide: "#3a9474", banner: "🌍 WORLD GRAND PRIX", bannerColors: ["#6cc3a2", "#3a9474", "#6fb5e3"], trees: false, lights: "rgba(210,255,240,.5)" },
  legends_arena: { indoor: true, sky: ["#1c0f26", "#3a1a40", "#6a2a5a"], floor: ["#4a2440", "#3a1c34"], court: ["#2c6a5e", "#47a08a", "#3a8a76"], standFront: "#d45a86", standSide: "#a995dc", banner: "👑 LEGENDS CHAMPIONSHIP", bannerColors: ["#f5cb78", "#d45a86", "#a995dc"], trees: false, lights: "rgba(255,210,230,.55)" },
};

const SKINS = ["#ffe3d3", "#f6d0b8", "#e8b896", "#ffeadd", "#d9a37f"];
const HAIRS = ["#5b4256", "#2c2140", "#a8714f", "#f5cb78", "#c7b8ea", "#e7779f", "#6a5583", "#8fd3c1"];
const SHIRTS = ["#f8bbd0", "#c7b8ea", "#bce5d5", "#b8ddf5", "#fbe3b1", "#ffd6c2", "#ffffff"];

const pick = <T,>(rng: Rng, list: T[]) => list[Math.floor(next(rng) * list.length)];

function poly(ctx: CanvasRenderingContext2D, cam: Camera, pts: Vec3[]) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = project(cam, p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
}

function quad(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, y0: number, x1: number, y1: number, z = 0) {
  poly(ctx, cam, [
    { x: x0, y: y0, z },
    { x: x1, y: y0, z },
    { x: x1, y: y1, z },
    { x: x0, y: y1, z },
  ]);
}

function box(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top: string, front: string, side: string) {
  ctx.fillStyle = front;
  poly(ctx, cam, [
    { x: x0, y: y0, z: z0 },
    { x: x1, y: y0, z: z0 },
    { x: x1, y: y0, z: z1 },
    { x: x0, y: y0, z: z1 },
  ]);
  ctx.fill();
  ctx.fillStyle = side;
  for (const x of [x0, x1]) {
    poly(ctx, cam, [
      { x, y: y0, z: z0 },
      { x, y: y1, z: z0 },
      { x, y: y1, z: z1 },
      { x, y: y0, z: z1 },
    ]);
    ctx.fill();
  }
  ctx.fillStyle = top;
  poly(ctx, cam, [
    { x: x0, y: y0, z: z1 },
    { x: x1, y: y0, z: z1 },
    { x: x1, y: y1, z: z1 },
    { x: x0, y: y1, z: z1 },
  ]);
  ctx.fill();
}

function tree(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, size: number, rng: Rng) {
  const base = project(cam, { x, y, z: 0 });
  const top = project(cam, { x, y, z: 2.4 * size });
  ctx.fillStyle = "rgba(69,54,91,.14)";
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 1.5 * size * base.s, 0.5 * size * base.s, 0, 0, Math.PI * 2);
  ctx.fill();
  const trunk = ctx.createLinearGradient(base.x - 0.2 * base.s, 0, base.x + 0.2 * base.s, 0);
  trunk.addColorStop(0, "#8d6a5c");
  trunk.addColorStop(1, "#6e4f45");
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(base.x - 0.18 * size * base.s, base.y);
  ctx.lineTo(top.x - 0.1 * size * top.s, top.y);
  ctx.lineTo(top.x + 0.1 * size * top.s, top.y);
  ctx.lineTo(base.x + 0.18 * size * base.s, base.y);
  ctx.closePath();
  ctx.fill();
  const blossoms = ["#f8bbd0", "#f39bbb", "#ffd6e5", "#fde4ee"];
  for (let i = 0; i < 16; i++) {
    const ox = (next(rng) - 0.5) * 2.6 * size;
    const oz = 2.3 * size + next(rng) * 1.7 * size;
    const oy = (next(rng) - 0.5) * 1.2 * size;
    const c = project(cam, { x: x + ox, y: y + oy, z: oz });
    const r = (0.55 + next(rng) * 0.5) * size * c.s;
    ctx.fillStyle = blossoms[i % blossoms.length];
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const crown = project(cam, { x: x - 0.4 * size, y, z: 3.7 * size });
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.beginPath();
  ctx.arc(crown.x, crown.y, 0.35 * size * crown.s, 0, Math.PI * 2);
  ctx.fill();
}

function flowers(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, x1: number, y0: number, y1: number, rng: Rng) {
  ctx.fillStyle = "#9fd39f";
  quad(ctx, cam, x0, y0, x1, y1);
  ctx.fill();
  const colors = ["#f39bbb", "#ffffff", "#fbe3b1", "#c7b8ea", "#f8bbd0"];
  const count = Math.round(Math.abs((x1 - x0) * (y1 - y0)) * 6);
  for (let i = 0; i < count; i++) {
    const p = project(cam, { x: x0 + (x1 - x0) * next(rng), y: y0 + (y1 - y0) * next(rng), z: 0.12 });
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.2, 0.07 * p.s), 0, Math.PI * 2);
    ctx.fill();
  }
}

function noisePattern(ctx: CanvasRenderingContext2D, rng: Rng) {
  const tile = document.createElement("canvas");
  tile.width = 64;
  tile.height = 64;
  const t = tile.getContext("2d")!;
  for (let i = 0; i < 420; i++) {
    t.fillStyle = next(rng) < 0.5 ? "rgba(255,255,255,.07)" : "rgba(30,90,70,.06)";
    t.fillRect(Math.floor(next(rng) * 64), Math.floor(next(rng) * 64), 1 + Math.floor(next(rng) * 2), 1);
  }
  return ctx.createPattern(tile, "repeat");
}

function courtLine(ctx: CanvasRenderingContext2D, cam: Camera, a: { x: number; y: number }, b: { x: number; y: number }, width: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  poly(ctx, cam, [
    { x: a.x + nx, y: a.y + ny, z: 0 },
    { x: b.x + nx, y: b.y + ny, z: 0 },
    { x: b.x - nx, y: b.y - ny, z: 0 },
    { x: a.x - nx, y: a.y - ny, z: 0 },
  ]);
  ctx.fill();
}

function drawCourt(ctx: CanvasRenderingContext2D, cam: Camera, rng: Rng, theme: SceneTheme) {
  const L = COURT.halfLength;
  const D = COURT.doublesHalfWidth;
  const S = COURT.singlesHalfWidth;
  ctx.fillStyle = "rgba(69,54,91,.16)";
  quad(ctx, cam, -D - 0.75, -L - 0.85, D + 0.95, L + 0.65);
  ctx.fill();
  ctx.fillStyle = theme.court[0];
  quad(ctx, cam, -D - 0.7, -L - 0.8, D + 0.7, L + 0.7);
  ctx.fill();
  const near = project(cam, { x: 0, y: -L, z: 0 });
  const far = project(cam, { x: 0, y: L, z: 0 });
  const surface = ctx.createLinearGradient(0, far.y, 0, near.y);
  surface.addColorStop(0, theme.court[1]);
  surface.addColorStop(1, theme.court[2]);
  ctx.fillStyle = surface;
  quad(ctx, cam, -D - 0.55, -L - 0.65, D + 0.55, L + 0.55);
  ctx.fill();
  const pattern = noisePattern(ctx, rng);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.07)";
  quad(ctx, cam, -S, -COURT.shortService, S, COURT.shortService);
  ctx.fill();
  ctx.fillStyle = "rgba(20,70,55,.08)";
  for (const s of [-1, 1]) {
    quad(ctx, cam, -D - 0.55, s * L, D + 0.55, s * (L + 0.6));
    ctx.fill();
    quad(ctx, cam, s * D, -L - 0.6, s * (D + 0.55), L + 0.55);
    ctx.fill();
  }
  const lines: [{ x: number; y: number }, { x: number; y: number }][] = [];
  for (const x of [-D, -S, S, D]) lines.push([{ x, y: -L }, { x, y: L }]);
  for (const y of [-L, L, -COURT.shortService, COURT.shortService, -COURT.doublesLongService, COURT.doublesLongService]) lines.push([{ x: -D, y }, { x: D, y }]);
  lines.push([{ x: 0, y: -L }, { x: 0, y: -COURT.shortService }], [{ x: 0, y: COURT.shortService }, { x: 0, y: L }]);
  ctx.fillStyle = "rgba(30,90,70,.25)";
  ctx.save();
  ctx.translate(1, 1.5);
  for (const [a, b] of lines) courtLine(ctx, cam, a, b, 0.07);
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  for (const [a, b] of lines) courtLine(ctx, cam, a, b, 0.06);
  ctx.fillStyle = "rgba(69,54,91,.18)";
  poly(ctx, cam, [
    { x: -COURT.postHalfWidth, y: 0, z: 0 },
    { x: COURT.postHalfWidth, y: 0, z: 0 },
    { x: COURT.postHalfWidth + 0.15, y: -0.55, z: 0 },
    { x: -COURT.postHalfWidth + 0.15, y: -0.55, z: 0 },
  ]);
  ctx.fill();
}

function drawIndoor(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, theme: SceneTheme) {
  const wallBase = project(cam, { x: 0, y: 14, z: 0 }).y;
  const wall = ctx.createLinearGradient(0, 0, 0, Math.max(wallBase, 40));
  wall.addColorStop(0, theme.sky[0]);
  wall.addColorStop(0.6, theme.sky[1]);
  wall.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) {
    const x = (w * (i + 0.5)) / 6;
    const glow = ctx.createRadialGradient(x, wallBase * 0.08, 0, x, wallBase * 0.08, w * 0.12);
    glow.addColorStop(0, "rgba(255,255,255,.9)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - w * 0.12, 0, w * 0.24, wallBase * 0.4);
  }
  const floor = ctx.createLinearGradient(0, wallBase, 0, h);
  floor.addColorStop(0, theme.floor[0]);
  floor.addColorStop(1, theme.floor[1]);
  ctx.fillStyle = floor;
  ctx.fillRect(0, wallBase, w, h - wallBase);
  for (let i = -12; i < 30; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)";
    quad(ctx, cam, -40, i * 1.2, 40, i * 1.2 + 1.2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.12)";
  quad(ctx, cam, -5.4, -9.6, 5.4, 9.3);
  ctx.fill();
}

function drawEnvironment(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, rng: Rng, theme: SceneTheme) {
  if (theme.indoor) {
    drawIndoor(ctx, cam, w, h, theme);
    return;
  }
  const horizon = project(cam, { x: 0, y: 60, z: 0 }).y;
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 40));
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(0.6, theme.sky[1]);
  sky.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.82, horizon * 0.25, 0, w * 0.82, horizon * 0.25, Math.max(w, h) * 0.45);
  sun.addColorStop(0, "rgba(255,244,214,.85)");
  sun.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  for (let i = 0; i < 5; i++) {
    const cx = next(rng) * w;
    const cy = horizon * (0.15 + next(rng) * 0.55);
    const r = 18 + next(rng) * 26;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.6, cy - r * 0.3, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [color, lift, amp] of [["#cfe9d9", 0.07, 0.05], ["#b5e0c6", 0.035, 0.03]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, horizon - h * lift - Math.sin(x / w * 7 + lift * 40) * h * amp);
    ctx.lineTo(w, horizon + 2);
    ctx.closePath();
    ctx.fill();
  }
  const grass = ctx.createLinearGradient(0, horizon, 0, h);
  grass.addColorStop(0, theme.floor[0]);
  grass.addColorStop(1, theme.floor[1]);
  ctx.fillStyle = grass;
  ctx.fillRect(0, horizon, w, h - horizon);
  for (let i = -10; i < 30; i++) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(255,255,255,.08)";
    quad(ctx, cam, -40, i * 2.2, 40, i * 2.2 + 2.2);
    ctx.fill();
  }
  ctx.fillStyle = "#f8ead9";
  quad(ctx, cam, -5.4, -9.6, 5.4, 9.3);
  ctx.fill();
  ctx.strokeStyle = "rgba(201,160,130,.45)";
  ctx.lineWidth = 2;
  quad(ctx, cam, -5.4, -9.6, 5.4, 9.3);
  ctx.stroke();
  for (const s of [-1, 1]) {
    flowers(ctx, cam, s * 5.7, s * 6.6, -7, -2, rng);
    flowers(ctx, cam, s * 5.7, s * 6.6, 1.5, 6.5, rng);
  }
}

function drawStands(ctx: CanvasRenderingContext2D, cam: Camera, theme: SceneTheme) {
  for (let row = 2; row >= 0; row--) {
    const y0 = 10.1 + row * 0.8;
    box(ctx, cam, -6.2, 6.2, y0, y0 + 0.8, 0, 0.45 + row * 0.5, "#fff7ed", shade(theme.standFront, row * 0.12), shade(theme.standFront, -0.08));
  }
  for (const s of [-1, 1]) {
    for (let row = 1; row >= 0; row--) {
      const x0 = s * (7.4 + row * 0.8);
      box(ctx, cam, Math.min(x0, x0 + s * 0.8), Math.max(x0, x0 + s * 0.8), -5, 6.5, 0, 0.45 + row * 0.5, "#fff7ed", shade(theme.standSide, row * 0.1), shade(theme.standSide, -0.05));
    }
  }
  const a = project(cam, { x: -4.8, y: 10.08, z: 0.43 });
  const b = project(cam, { x: 4.8, y: 10.08, z: 0.04 });
  const bw = b.x - a.x;
  const bh = b.y - a.y;
  if (bw > 40) {
    const g = ctx.createLinearGradient(a.x, 0, b.x, 0);
    g.addColorStop(0, theme.bannerColors[0]);
    g.addColorStop(0.5, theme.bannerColors[1]);
    g.addColorStop(1, theme.bannerColors[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(a.x, a.y, bw, bh, Math.min(10, bh / 2));
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.max(9, bh * 0.62)}px Fredoka, ui-rounded, system-ui, sans-serif`;
    ctx.fillText(theme.banner, a.x + bw / 2, a.y + bh / 2 + 1, bw * 0.94);
  }
  const left = project(cam, { x: -6.6, y: 12.9, z: 3.6 });
  const right = project(cam, { x: 6.6, y: 12.9, z: 3.6 });
  ctx.strokeStyle = "rgba(106,85,131,.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.quadraticCurveTo((left.x + right.x) / 2, left.y + (right.x - left.x) * 0.06, right.x, right.y);
  ctx.stroke();
  const flags = ["#f39bbb", "#fbe3b1", "#a995dc", "#8fd3c1", "#b8ddf5"];
  for (let i = 1; i < 18; i++) {
    const t = i / 18;
    const x = left.x + (right.x - left.x) * t;
    const y = left.y + (right.x - left.x) * 0.06 * 2 * t * (1 - t) * 2 * 0.5;
    const size = Math.max(4, (right.x - left.x) / 40);
    ctx.fillStyle = flags[i % flags.length];
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x, y + size * 1.3);
    ctx.closePath();
    ctx.fill();
  }
  for (const x of [-6.6, 6.6]) {
    const p0 = project(cam, { x, y: 12.9, z: 0 });
    const p1 = project(cam, { x, y: 12.9, z: 3.7 });
    ctx.strokeStyle = "#a995dc";
    ctx.lineWidth = Math.max(2, 0.08 * p0.s);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
}

function drawNet(ctx: CanvasRenderingContext2D, cam: Camera) {
  const P = COURT.postHalfWidth;
  const H = COURT.netHeight;
  const bottom = H - 0.76;
  const mesh = ctx.createLinearGradient(0, project(cam, { x: 0, y: 0, z: H }).y, 0, project(cam, { x: 0, y: 0, z: bottom }).y);
  mesh.addColorStop(0, "rgba(69,54,91,.3)");
  mesh.addColorStop(1, "rgba(69,54,91,.14)");
  ctx.fillStyle = mesh;
  poly(ctx, cam, [
    { x: -P, y: 0, z: bottom },
    { x: P, y: 0, z: bottom },
    { x: P, y: 0, z: H },
    { x: -P, y: 0, z: H },
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = -P; x <= P + 0.001; x += 0.16) {
    const a = project(cam, { x, y: 0, z: bottom });
    const b = project(cam, { x, y: 0, z: H });
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let z = bottom; z <= H; z += 0.12) {
    const a = project(cam, { x: -P, y: 0, z });
    const b = project(cam, { x: P, y: 0, z });
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  poly(ctx, cam, [
    { x: -P, y: 0, z: H - 0.05 },
    { x: P, y: 0, z: H - 0.05 },
    { x: P, y: 0, z: H },
    { x: -P, y: 0, z: H },
  ]);
  ctx.fill();
  ctx.fillStyle = "#e7779f";
  poly(ctx, cam, [
    { x: -P, y: 0, z: bottom },
    { x: P, y: 0, z: bottom },
    { x: P, y: 0, z: bottom + 0.03 },
    { x: -P, y: 0, z: bottom + 0.03 },
  ]);
  ctx.fill();
  for (const x of [-P, P]) {
    const base = project(cam, { x, y: 0, z: 0 });
    const top = project(cam, { x, y: 0, z: H + 0.06 });
    const r = Math.max(2.5, 0.05 * base.s);
    ctx.fillStyle = "rgba(69,54,91,.22)";
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, r * 2.4, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(base.x - r, 0, base.x + r, 0);
    g.addColorStop(0, "#c7b8ea");
    g.addColorStop(0.5, "#a995dc");
    g.addColorStop(1, "#8a73c8");
    ctx.fillStyle = g;
    ctx.fillRect(top.x - r, top.y, r * 2, base.y - top.y);
    ctx.fillStyle = "#f39bbb";
    ctx.beginPath();
    ctx.arc(top.x, top.y, r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.beginPath();
    ctx.arc(top.x - r * 0.4, top.y - r * 0.4, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function makeSpectators(rng: Rng): Spectator[] {
  const list: Spectator[] = [];
  for (let row = 0; row < 3; row++) {
    for (let x = -5.6; x <= 5.6; x += 0.92) {
      if (next(rng) < 0.22) continue;
      list.push({ x: x + (next(rng) - 0.5) * 0.3, y: 10.4 + row * 0.8, z: 0.45 + row * 0.5, skin: pick(rng, SKINS), hair: pick(rng, HAIRS), shirt: pick(rng, SHIRTS), phase: next(rng) * 6.28, side: "far" });
    }
  }
  for (const s of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      for (let y = -4.4; y <= 6; y += 1.05) {
        if (next(rng) < 0.3) continue;
        list.push({ x: s * (7.8 + row * 0.8), y: y + (next(rng) - 0.5) * 0.3, z: 0.45 + row * 0.5, skin: pick(rng, SKINS), hair: pick(rng, HAIRS), shirt: pick(rng, SHIRTS), phase: next(rng) * 6.28, side: s < 0 ? "left" : "right" });
      }
    }
  }
  return list.sort((a, b) => b.y - a.y);
}

export function buildScene(cam: Camera, w: number, h: number, dpr: number, themeKey = "default"): Scene {
  const theme = THEMES[themeKey] ?? THEMES.default;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, ctx };
  };
  const rng = createRng(20261025);
  const ground = make();
  drawEnvironment(ground.ctx, cam, w, h, rng, theme);
  drawStands(ground.ctx, cam, theme);
  if (theme.trees) {
    const trees: [number, number, number][] = [[-9.5, 9.5, 1.15], [9.8, 10.2, 1.2], [-11.5, 3, 1.05], [11.2, 1.5, 1.1], [-10.5, -5, 1], [10.6, -6, 1], [-14, 13, 1.3], [14, 14, 1.25], [0, 15.5, 1.4]];
    for (const [x, y, size] of trees.sort((a, b) => b[1] - a[1])) tree(ground.ctx, cam, x, y, size, rng);
  }
  drawCourt(ground.ctx, cam, rng, theme);
  if (theme.lights) {
    for (const x of [-0.25, 0.25]) {
      const top = { x: w / 2 + x * w, y: 0 };
      const beam = ground.ctx.createLinearGradient(top.x, 0, w / 2, h * 0.7);
      beam.addColorStop(0, theme.lights);
      beam.addColorStop(1, "rgba(255,255,255,0)");
      ground.ctx.fillStyle = beam;
      ground.ctx.beginPath();
      ground.ctx.moveTo(top.x - w * 0.03, 0);
      ground.ctx.lineTo(top.x + w * 0.03, 0);
      ground.ctx.lineTo(w / 2 + x * w * 0.2 + w * 0.22, h * 0.85);
      ground.ctx.lineTo(w / 2 + x * w * 0.2 - w * 0.22, h * 0.85);
      ground.ctx.closePath();
      ground.ctx.fill();
    }
  }
  const vignette = ground.ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, theme.indoor ? "rgba(20,10,40,.3)" : "rgba(120,90,140,.16)");
  ground.ctx.fillStyle = vignette;
  ground.ctx.fillRect(0, 0, w, h);
  const net = make();
  drawNet(net.ctx, cam);
  return { ground: ground.c, net: net.c, spectators: makeSpectators(createRng(7)), w, h };
}

export function drawSpectators(ctx: CanvasRenderingContext2D, cam: Camera, list: Spectator[], time: number, cheer: number) {
  for (const s of list) {
    const bob = Math.sin(time * 2 + s.phase) * 0.03 + (cheer > 0 ? Math.abs(Math.sin(time * 10 + s.phase)) * 0.18 * cheer : 0);
    const p = project(cam, { x: s.x, y: s.y, z: s.z + bob });
    const u = p.s;
    if (u < 4) continue;
    ctx.fillStyle = s.shirt;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 0.18 * u, 0.2 * u, 0.2 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    if (cheer > 0.2) {
      ctx.strokeStyle = s.skin;
      ctx.lineWidth = Math.max(1, 0.06 * u);
      ctx.beginPath();
      ctx.moveTo(p.x - 0.15 * u, p.y - 0.28 * u);
      ctx.lineTo(p.x - 0.26 * u, p.y - 0.55 * u);
      ctx.moveTo(p.x + 0.15 * u, p.y - 0.28 * u);
      ctx.lineTo(p.x + 0.26 * u, p.y - 0.55 * u);
      ctx.stroke();
    }
    ctx.fillStyle = s.skin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 0.5 * u, 0.19 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.hair;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 0.55 * u, 0.2 * u, Math.PI, 0);
    ctx.fill();
    if (s.side === "far" && u > 9) {
      ctx.fillStyle = "#2c2140";
      ctx.beginPath();
      ctx.arc(p.x - 0.07 * u, p.y - 0.47 * u, 0.025 * u, 0, Math.PI * 2);
      ctx.arc(p.x + 0.07 * u, p.y - 0.47 * u, 0.025 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
