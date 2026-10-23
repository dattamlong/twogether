import { Container, Graphics } from "pixi.js";
import { tileToScreen } from "../engine/iso";
import { shade } from "../entities/furniture";
import { ROOM_DEPTH, ROOM_WIDTH } from "../world/room";

export const WALL_HEIGHT = 132;
const OUTLINE = 0x45365b;

export type TimeOfDay = "morning" | "day" | "sunset" | "night";

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 9) return "morning";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 20) return "sunset";
  return "night";
}

const SKIES: Record<TimeOfDay, [number, number]> = {
  morning: [0xb8ddf5, 0xffd6c2],
  day: [0x8fcaf0, 0xe5f3fc],
  sunset: [0xc7b8ea, 0xf6a88a],
  night: [0x2c2140, 0x6a5583],
};

const P = (u: number, v: number, z: number) => {
  const s = tileToScreen(u, v);
  return [s.x, s.y - z];
};

function leftWallRect(g: Graphics, v0: number, v1: number, z0: number, z1: number, color: number, alpha = 1) {
  g.poly([...P(0, v0, z0), ...P(0, v1, z0), ...P(0, v1, z1), ...P(0, v0, z1)]).fill({ color, alpha });
}

function rightWallRect(g: Graphics, u0: number, u1: number, z0: number, z1: number, color: number, alpha = 1) {
  g.poly([...P(u0, 0, z0), ...P(u1, 0, z0), ...P(u1, 0, z1), ...P(u0, 0, z1)]).fill({ color, alpha });
}

function windowOn(g: Graphics, wall: "left" | "right", a0: number, a1: number, z0: number, z1: number, time: TimeOfDay) {
  const rect = wall === "left" ? leftWallRect : rightWallRect;
  rect(g, a0 - 0.12, a1 + 0.12, z0 - 8, z1 + 8, 0xfff7ed);
  const [top, bottom] = SKIES[time];
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = ((top >> 16) & 0xff) * (1 - t) + ((bottom >> 16) & 0xff) * t;
    const gg = ((top >> 8) & 0xff) * (1 - t) + ((bottom >> 8) & 0xff) * t;
    const b = (top & 0xff) * (1 - t) + (bottom & 0xff) * t;
    const color = (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
    const zTop = z1 - ((z1 - z0) * i) / bands;
    rect(g, a0, a1, zTop - (z1 - z0) / bands, zTop, color);
  }
  const mid = (a0 + a1) / 2;
  if (time === "night") {
    const [mx, my] = wall === "left" ? P(0, a0 + (a1 - a0) * 0.7, z1 - 16) : P(a0 + (a1 - a0) * 0.7, 0, z1 - 16);
    g.circle(mx, my, 7).fill(0xfff7ed);
    g.circle(mx + 3, my - 2, 6).fill(SKIES.night[0]);
    for (let i = 0; i < 6; i++) {
      const [sx, sy] = wall === "left" ? P(0, a0 + ((i * 0.37) % 1) * (a1 - a0), z0 + 10 + ((i * 19) % 40)) : P(a0 + ((i * 0.37) % 1) * (a1 - a0), 0, z0 + 10 + ((i * 19) % 40));
      g.circle(sx, sy, 1.1).fill(0xffffff);
    }
  } else {
    const [cx, cy] = wall === "left" ? P(0, a0 + (a1 - a0) * 0.3, z1 - 18) : P(a0 + (a1 - a0) * 0.3, 0, z1 - 18);
    g.circle(cx, cy, 6).fill({ color: 0xffffff, alpha: 0.85 });
    g.circle(cx + 7, cy + 1, 5).fill({ color: 0xffffff, alpha: 0.85 });
  }
  if (wall === "left") {
    g.poly([...P(0, mid - 0.03, z0), ...P(0, mid + 0.03, z0), ...P(0, mid + 0.03, z1), ...P(0, mid - 0.03, z1)]).fill(0xfff7ed);
  } else {
    g.poly([...P(mid - 0.03, 0, z0), ...P(mid + 0.03, 0, z0), ...P(mid + 0.03, 0, z1), ...P(mid - 0.03, 0, z1)]).fill(0xfff7ed);
  }
  rect(g, a0, a1, (z0 + z1) / 2 - 1.5, (z0 + z1) / 2 + 1.5, 0xfff7ed);
  rect(g, a0 - 0.18, a1 + 0.18, z0 - 12, z0 - 7, 0xe8c6a8);
}

export type RoomShell = {
  container: Container;
  twinkles: Graphics[];
  windowLight: Graphics;
  dustOrigin: { x: number; y: number };
  nightShade: Graphics;
};

export function drawRoomShell(homeLevel: number, time: TimeOfDay): RoomShell {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);

  const wallColor = homeLevel >= 3 ? 0xece4fb : 0xfff0e8;
  const wallRight = shade(wallColor, -10);
  const pattern = homeLevel >= 3 ? 0xd8cdf3 : 0xfde4ee;

  const thickness = 14;
  g.poly([...P(0, ROOM_DEPTH, 0), ...P(ROOM_WIDTH, ROOM_DEPTH, 0), ...P(ROOM_WIDTH, ROOM_DEPTH, -thickness), ...P(0, ROOM_DEPTH, -thickness)]).fill(0xc49a83);
  g.poly([...P(ROOM_WIDTH, 0, 0), ...P(ROOM_WIDTH, ROOM_DEPTH, 0), ...P(ROOM_WIDTH, ROOM_DEPTH, -thickness), ...P(ROOM_WIDTH, 0, -thickness)]).fill(0xa47c68);

  for (let x = 0; x < ROOM_WIDTH; x++) {
    for (let y = 0; y < ROOM_DEPTH; y++) {
      const base = (x + y) % 2 === 0 ? 0xf6e2cc : 0xf0d8bf;
      g.poly([...P(x, y, 0), ...P(x + 1, y, 0), ...P(x + 1, y + 1, 0), ...P(x, y + 1, 0)]).fill(base);
      const [ax, ay] = P(x, y + 0.5, 0);
      const [bx, by] = P(x + 1, y + 0.5, 0);
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ color: 0xe2c4a6, width: 0.8, alpha: 0.7 });
    }
  }

  leftWallRect(g, 0, ROOM_DEPTH, 0, WALL_HEIGHT, wallColor);
  rightWallRect(g, 0, ROOM_WIDTH, 0, WALL_HEIGHT, wallRight);

  for (let i = 0; i < ROOM_DEPTH * 2; i++) {
    for (let row = 0; row < 4; row++) {
      const v = 0.25 + i * 0.5;
      const z = 30 + row * 26 + (i % 2) * 13;
      if (z > WALL_HEIGHT - 12) continue;
      const [x, y] = P(0, v, z);
      if (homeLevel >= 3) g.moveTo(x, y + 2.5).bezierCurveTo(x - 4, y - 0.5, x - 1.5, y - 4, x, y - 1.5).bezierCurveTo(x + 1.5, y - 4, x + 4, y - 0.5, x, y + 2.5).fill({ color: pattern, alpha: 0.9 });
      else g.circle(x, y, 1.6).fill({ color: pattern, alpha: 0.9 });
    }
  }
  for (let i = 0; i < ROOM_WIDTH * 2; i++) {
    for (let row = 0; row < 4; row++) {
      const u = 0.25 + i * 0.5;
      const z = 30 + row * 26 + (i % 2) * 13;
      if (z > WALL_HEIGHT - 12) continue;
      const [x, y] = P(u, 0, z);
      if (homeLevel >= 3) g.moveTo(x, y + 2.5).bezierCurveTo(x - 4, y - 0.5, x - 1.5, y - 4, x, y - 1.5).bezierCurveTo(x + 1.5, y - 4, x + 4, y - 0.5, x, y + 2.5).fill({ color: shade(pattern, -8), alpha: 0.9 });
      else g.circle(x, y, 1.6).fill({ color: shade(pattern, -8), alpha: 0.9 });
    }
  }

  leftWallRect(g, 0, ROOM_DEPTH, 0, 10, 0xe8c6a8);
  rightWallRect(g, 0, ROOM_WIDTH, 0, 10, 0xd9b496);
  leftWallRect(g, 0, ROOM_DEPTH, WALL_HEIGHT - 6, WALL_HEIGHT, 0xfff7ed);
  rightWallRect(g, 0, ROOM_WIDTH, WALL_HEIGHT - 6, WALL_HEIGHT, 0xf6ead9);
  g.poly([...P(0, 0, 0), ...P(0, 0, WALL_HEIGHT)]).stroke({ color: OUTLINE, width: 1, alpha: 0.15 });

  windowOn(g, "right", 6.1, 8.0, 56, 112, time);
  windowOn(g, "left", 2.2, 4.0, 56, 112, time);

  leftWallRect(g, 7.55, 8.75, 0, 86, 0xc49a83);
  leftWallRect(g, 7.65, 8.65, 0, 80, 0xd8a985);
  const [kx, ky] = P(0, 8.5, 40);
  g.circle(kx, ky, 2.4).fill(0xf5cb78);
  const [hx, hy] = P(0, 8.15, 66);
  g.moveTo(hx, hy + 4).bezierCurveTo(hx - 7, hy - 1, hx - 3, hy - 7, hx, hy - 3).bezierCurveTo(hx + 3, hy - 7, hx + 7, hy - 1, hx, hy + 4).fill(0xf39bbb);

  leftWallRect(g, 5.2, 6.4, 64, 100, 0xfff7ed);
  leftWallRect(g, 5.3, 6.3, 68, 96, 0xfde4ee);
  const [fx, fy] = P(0, 5.8, 82);
  g.moveTo(fx, fy + 6).bezierCurveTo(fx - 10, fy - 2, fx - 4, fy - 10, fx, fy - 4).bezierCurveTo(fx + 4, fy - 10, fx + 10, fy - 2, fx, fy + 6).fill(0xe7779f);

  rightWallRect(g, 1.4, 2.6, 70, 98, 0xfff7ed);
  rightWallRect(g, 1.5, 2.5, 74, 94, 0xe3f5ee);
  const [tx, ty] = P(2, 0, 80);
  g.poly([tx - 8, ty + 6, tx, ty - 8, tx + 8, ty + 6]).fill(0x6cc3a2);

  if (homeLevel >= 5) {
    for (let i = 0; i < 9; i++) {
      const [x, y] = P(0.4 + i * 1.05, 0, WALL_HEIGHT - 16 - Math.sin((i / 8) * Math.PI) * 8);
      g.poly([x - 6, y, x + 6, y, x, y + 10]).fill([0xf8bbd0, 0xc7b8ea, 0xbce5d5, 0xfbe3b1][i % 4]);
    }
  }

  const twinkles: Graphics[] = [];
  if (homeLevel >= 4) {
    const string = new Graphics();
    const points: number[][] = [];
    for (let i = 0; i <= 20; i++) points.push(P(0, (i / 20) * ROOM_DEPTH, WALL_HEIGHT - 20 - Math.sin(((i % 5) / 5) * Math.PI) * 10));
    for (let i = 0; i <= 20; i++) points.push(P((i / 20) * ROOM_WIDTH, 0, WALL_HEIGHT - 20 - Math.sin(((i % 5) / 5) * Math.PI) * 10));
    string.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1, 21)) string.lineTo(x, y);
    string.moveTo(points[21][0], points[21][1]);
    for (const [x, y] of points.slice(22)) string.lineTo(x, y);
    string.stroke({ color: 0x6a5583, width: 1, alpha: 0.5 });
    container.addChild(string);
    points.forEach(([x, y], i) => {
      const bulb = new Graphics();
      bulb.circle(0, 0, 7).fill({ color: [0xf5cb78, 0xf8bbd0, 0xbce5d5][i % 3], alpha: 0.35 });
      bulb.circle(0, 0, 2.6).fill([0xf5cb78, 0xf39bbb, 0x6cc3a2][i % 3]);
      bulb.position.set(x, y + 3);
      container.addChild(bulb);
      twinkles.push(bulb);
    });
  }

  const windowLight = new Graphics();
  const lightColor = time === "night" ? 0xc7b8ea : time === "sunset" ? 0xf6a88a : 0xfff7ed;
  windowLight.poly([...P(6.1, 0, 0), ...P(8, 0, 0), ...P(8.6, 3.2, 0), ...P(6.7, 3.2, 0)]).fill({ color: lightColor, alpha: time === "night" ? 0.12 : 0.28 });
  windowLight.poly([...P(0, 2.2, 0), ...P(0, 4, 0), ...P(3.2, 4.6, 0), ...P(3.2, 2.8, 0)]).fill({ color: lightColor, alpha: time === "night" ? 0.12 : 0.28 });
  container.addChild(windowLight);

  const nightShade = new Graphics();
  if (time === "night") {
    nightShade.poly([...P(0, 0, WALL_HEIGHT), ...P(ROOM_WIDTH, 0, WALL_HEIGHT), ...P(ROOM_WIDTH, 0, 0), ...P(ROOM_WIDTH, ROOM_DEPTH, 0), ...P(0, ROOM_DEPTH, 0), ...P(0, 0, 0)]).fill({ color: 0x2c2140, alpha: homeLevel >= 4 ? 0.06 : 0.12 });
  }

  const dust = tileToScreen(7, 1.5);
  return { container, twinkles, windowLight, dustOrigin: { x: dust.x, y: dust.y - 40 }, nightShade };
}

export function roomScreenBounds() {
  const left = tileToScreen(0, ROOM_DEPTH).x;
  const right = tileToScreen(ROOM_WIDTH, 0).x;
  const top = tileToScreen(0, 0).y - WALL_HEIGHT;
  const bottom = tileToScreen(ROOM_WIDTH, ROOM_DEPTH).y + 16;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}
