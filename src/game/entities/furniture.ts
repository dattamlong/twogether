import { Container, Graphics } from "pixi.js";
import { tileToScreen } from "../engine/iso";

const OUTLINE = 0x45365b;

export function shade(color: number, amount: number) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

const P = (u: number, v: number, z: number) => {
  const s = tileToScreen(u, v);
  return [s.x, s.y - z];
};

export type BoxStyle = { color: number; top?: number; left?: number; right?: number; outline?: number };

export function isoBox(g: Graphics, u: number, v: number, w: number, d: number, z0: number, h: number, style: BoxStyle) {
  const z1 = z0 + h;
  const top = style.top ?? shade(style.color, 14);
  const left = style.left ?? shade(style.color, -10);
  const right = style.right ?? shade(style.color, -30);
  const stroke = { color: style.outline ?? OUTLINE, width: 1.2, alpha: 0.35, join: "round" as const };

  g.poly([...P(u, v + d, z0), ...P(u + w, v + d, z0), ...P(u + w, v + d, z1), ...P(u, v + d, z1)]).fill(left).stroke(stroke);
  g.poly([...P(u + w, v, z0), ...P(u + w, v + d, z0), ...P(u + w, v + d, z1), ...P(u + w, v, z1)]).fill(right).stroke(stroke);
  g.poly([...P(u, v, z1), ...P(u + w, v, z1), ...P(u + w, v + d, z1), ...P(u, v + d, z1)]).fill(top).stroke(stroke);
}

export function isoQuad(g: Graphics, u: number, v: number, w: number, d: number, z: number, color: number, alpha = 1) {
  g.poly([...P(u, v, z), ...P(u + w, v, z), ...P(u + w, v + d, z), ...P(u, v + d, z)]).fill({ color, alpha });
}

function leftFacePoint(u: number, v: number, z: number) {
  const [x, y] = P(u, v, z);
  return { x, y };
}

function pot(g: Graphics, cu: number, cv: number, color = 0xffd6c2, scale = 1) {
  const c = tileToScreen(cu, cv);
  g.ellipse(c.x, c.y, 12 * scale, 6 * scale).fill({ color: OUTLINE, alpha: 0.15 });
  g.poly([c.x - 10 * scale, c.y - 16 * scale, c.x + 10 * scale, c.y - 16 * scale, c.x + 8 * scale, c.y, c.x - 8 * scale, c.y]).fill(color).stroke({ color: OUTLINE, width: 1.2, alpha: 0.35 });
  g.ellipse(c.x, c.y - 16 * scale, 10 * scale, 4 * scale).fill(shade(color, -25));
  return c;
}

function leaf(g: Graphics, x: number, y: number, rx: number, ry: number, rotation: number, color: number) {
  const steps = 14;
  const pts: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    pts.push(x + px * Math.cos(rotation) - py * Math.sin(rotation), y + px * Math.sin(rotation) + py * Math.cos(rotation));
  }
  g.poly(pts).fill(color).stroke({ color: shade(color, -40), width: 1, alpha: 0.5 });
}

export type FurnitureArt = { container: Container; sway?: Graphics; glow?: Graphics; screen?: Graphics };

export function drawFurniture(kind: string, w: number, h: number, flipped = false): FurnitureArt {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);
  const art: FurnitureArt = { container };

  switch (kind) {
    case "bed": {
      isoBox(g, 0.05, 0.05, 1.9, 2.9, 0, 12, { color: 0xc49a83 });
      isoBox(g, 0.1, 0.1, 1.8, 2.8, 12, 10, { color: 0xfff7ed });
      isoBox(g, 0.1, 1.05, 1.8, 1.85, 22, 4, { color: 0xf8bbd0 });
      isoBox(g, 0.1, 2.55, 1.8, 0.35, 22, 4.5, { color: 0xf39bbb });
      isoBox(g, 0.2, 0.2, 0.75, 0.55, 22, 7, { color: 0xffffff, top: 0xffffff });
      isoBox(g, 1.05, 0.2, 0.75, 0.55, 22, 7, { color: 0xefeafb, top: 0xffffff });
      isoBox(g, 0, 0, 2, 0.12, 0, 44, { color: 0xb3866f });
      const heart = leftFacePoint(1, 0.12, 34);
      g.moveTo(heart.x, heart.y + 4).bezierCurveTo(heart.x - 8, heart.y - 2, heart.x - 3, heart.y - 8, heart.x, heart.y - 3).bezierCurveTo(heart.x + 3, heart.y - 8, heart.x + 8, heart.y - 2, heart.x, heart.y + 4).fill(0xf8bbd0);
      break;
    }
    case "bookshelf": {
      isoBox(g, 0, 0, 2, 0.7, 0, 78, { color: 0xc49a83 });
      const colors = [0xe7779f, 0xc7b8ea, 0x6cc3a2, 0xf5cb78, 0x6fb5e3, 0xf6a88a, 0xa995dc];
      for (let shelf = 0; shelf < 3; shelf++) {
        const z = 8 + shelf * 24;
        isoQuad(g, 0.05, 0.69, 1.9, 0.02, z, shade(0xc49a83, -40));
        let u = 0.12;
        let i = shelf * 3;
        while (u < 1.82) {
          const bw = 0.11 + ((i * 37) % 5) * 0.015;
          const bh = 14 + ((i * 13) % 6);
          const [x0, y0] = P(u, 0.7, z);
          const [x1, y1] = P(u + bw, 0.7, z);
          g.poly([x0, y0, x1, y1, x1, y1 - bh, x0, y0 - bh]).fill(colors[i % colors.length]).stroke({ color: OUTLINE, width: 0.8, alpha: 0.3 });
          u += bw + 0.03;
          i++;
        }
      }
      break;
    }
    case "desk": {
      for (const [u, v] of [[0.08, 0.08], [1.82, 0.08], [0.08, 0.82], [1.82, 0.82]]) isoBox(g, u, v, 0.1, 0.1, 0, 28, { color: 0xb3866f });
      isoBox(g, 0, 0, 2, 1, 28, 5, { color: 0xe8c6a8 });
      isoBox(g, 1.3, 0.15, 0.5, 0.35, 33, 4, { color: 0xc7b8ea });
      isoBox(g, 1.3, 0.15, 0.06, 0.35, 37, 18, { color: 0x6a5583, right: 0x8a73c8 });
      const screen = new Graphics();
      const [sx, sy] = P(1.37, 0.32, 46);
      screen.ellipse(sx, sy, 10, 7).fill({ color: 0xb8ddf5, alpha: 0.85 });
      container.addChild(screen);
      art.screen = screen;
      isoBox(g, 0.2, 0.2, 0.3, 0.35, 33, 7, { color: 0xf8bbd0 });
      isoBox(g, 0.22, 0.22, 0.26, 0.31, 40, 4, { color: 0xbce5d5 });
      const [lx, ly] = P(0.85, 0.25, 33);
      g.moveTo(lx, ly).lineTo(lx + 2, ly - 24).stroke({ color: OUTLINE, width: 2, alpha: 0.6 });
      g.poly([lx - 8, ly - 22, lx + 12, ly - 22, lx + 7, ly - 34, lx - 3, ly - 34]).fill(0xf5cb78).stroke({ color: OUTLINE, width: 1, alpha: 0.4 });
      const glow = new Graphics();
      glow.circle(lx + 2, ly - 18, 34).fill({ color: 0xfbe3b1, alpha: 0.28 });
      container.addChildAt(glow, 0);
      art.glow = glow;
      break;
    }
    case "chair": {
      isoBox(g, 0.2, 0.2, 0.6, 0.6, 0, 16, { color: 0xe8c6a8 });
      isoBox(g, 0.2, 0.2, 0.6, 0.1, 16, 18, { color: 0xc49a83 });
      isoBox(g, 0.22, 0.32, 0.56, 0.46, 16, 3, { color: 0xf8bbd0 });
      break;
    }
    case "gift_cabinet": {
      isoBox(g, 0.1, 0, 0.8, 2, 0, 62, { color: 0xc7b8ea });
      for (const z of [12, 30, 48]) {
        const [x0, y0] = P(0.18, 2, z);
        const [x1, y1] = P(0.82, 2, z);
        g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: 0x8a73c8, width: 1.2 });
      }
      isoBox(g, 0.15, 0.4, 0.5, 0.5, 62, 12, { color: 0xf8bbd0 });
      isoBox(g, 0.36, 0.4, 0.08, 0.5, 62, 12.5, { color: 0xf5cb78 });
      isoBox(g, 0.2, 1.2, 0.45, 0.45, 62, 9, { color: 0xbce5d5 });
      const knob = leftFacePoint(0.5, 2, 40);
      g.circle(knob.x, knob.y, 2.2).fill(0xf5cb78);
      break;
    }
    case "plant_tall":
    case "monstera": {
      const c = pot(g, 0.5, 0.5, kind === "monstera" ? 0xfff7ed : 0xffd6c2);
      const sway = new Graphics();
      for (const [dx, dy, rot] of [[-10, -32, -0.6], [10, -36, 0.5], [0, -46, 0], [-6, -52, -0.3], [8, -26, 0.9]] as const) {
        leaf(sway, c.x + dx, c.y + dy, 8, 15, rot, kind === "monstera" ? 0x3a9474 : 0x6cc3a2);
      }
      sway.pivot.set(c.x, c.y - 16);
      sway.position.set(c.x, c.y - 16);
      container.addChild(sway);
      art.sway = sway;
      break;
    }
    case "plant_small":
    case "cactus": {
      const c = pot(g, 0.5, 0.5, kind === "cactus" ? 0xc7b8ea : 0xfde4ee, 0.8);
      const sway = new Graphics();
      if (kind === "cactus") {
        sway.roundRect(c.x - 6, c.y - 40, 12, 28, 6).fill(0x6cc3a2).stroke({ color: 0x3a9474, width: 1.2 });
        sway.roundRect(c.x + 4, c.y - 32, 8, 6, 3).fill(0x6cc3a2);
        sway.circle(c.x, c.y - 41, 3).fill(0xf39bbb);
      } else {
        for (const [dx, rot] of [[-6, -0.5], [6, 0.5], [0, 0]] as const) leaf(sway, c.x + dx, c.y - 22, 5, 10, rot, 0x6cc3a2);
        sway.circle(c.x, c.y - 30, 3.5).fill(0xf8bbd0);
      }
      sway.pivot.set(c.x, c.y - 12);
      sway.position.set(c.x, c.y - 12);
      container.addChild(sway);
      art.sway = sway;
      break;
    }
    case "console": {
      isoBox(g, 0.05, 0.05, 0.8, 1.9, 0, 18, { color: 0xe8c6a8 });
      isoBox(g, 0.2, 0.2, 0.08, 1.6, 18, 38, { color: 0x45365b, right: 0x2c2140 });
      const screen = new Graphics();
      const corners = [P(0.29, 0.28, 22), P(0.29, 1.72, 22), P(0.29, 1.72, 52), P(0.29, 0.28, 52)].flat();
      screen.poly(corners).fill({ color: 0x6fb5e3 });
      container.addChild(screen);
      art.screen = screen;
      isoBox(g, 0.45, 0.6, 0.3, 0.25, 18, 5, { color: 0xfff7ed });
      isoBox(g, 0.45, 1.15, 0.3, 0.25, 18, 5, { color: 0xf8bbd0 });
      break;
    }
    case "rug": {
      const ring = (inset: number, color: number, alpha = 1) =>
        isoQuad(g, inset, inset, w - inset * 2, h - inset * 2, 0.5, color, alpha);
      ring(0.05, 0xf8bbd0);
      ring(0.18, 0xfff7ed);
      ring(0.32, 0xefeafb);
      for (let i = 0; i < 3; i++) {
        const c = tileToScreen(w / 2, 1 + i * 1);
        g.moveTo(c.x, c.y + 3).bezierCurveTo(c.x - 7, c.y - 2, c.x - 3, c.y - 7, c.x, c.y - 3).bezierCurveTo(c.x + 3, c.y - 7, c.x + 7, c.y - 2, c.x, c.y + 3).fill({ color: 0xf39bbb, alpha: 0.8 });
      }
      break;
    }
    case "sofa": {
      isoBox(g, 0.1, 0.05, 0.85, 1.9, 0, 14, { color: 0xa995dc });
      isoBox(g, 0.15, 0.1, 0.65, 0.88, 14, 5, { color: 0xc7b8ea });
      isoBox(g, 0.15, 1.02, 0.65, 0.88, 14, 5, { color: 0xc7b8ea });
      isoBox(g, 0.72, 0.05, 0.25, 1.9, 14, 20, { color: 0x8a73c8 });
      isoBox(g, 0.1, 0.0, 0.85, 0.16, 14, 12, { color: 0x8a73c8 });
      isoBox(g, 0.1, 1.84, 0.85, 0.16, 14, 12, { color: 0x8a73c8 });
      isoBox(g, 0.5, 0.25, 0.22, 0.35, 19, 12, { color: 0xf8bbd0 });
      break;
    }
    case "mailbox": {
      isoBox(g, 0.44, 0.44, 0.12, 0.12, 0, 26, { color: 0xb3866f });
      isoBox(g, 0.2, 0.25, 0.6, 0.5, 26, 18, { color: 0xf39bbb });
      isoQuad(g, 0.2, 0.25, 0.6, 0.5, 44.5, 0xf8bbd0);
      const [fx, fy] = P(0.8, 0.35, 40);
      g.rect(fx, fy - 14, 2.5, 14).fill(0xb3866f);
      g.poly([fx + 2.5, fy - 14, fx + 12, fy - 10, fx + 2.5, fy - 6]).fill(0xf5cb78);
      const heart = leftFacePoint(0.5, 0.75, 34);
      g.moveTo(heart.x, heart.y + 3).bezierCurveTo(heart.x - 6, heart.y - 1, heart.x - 2, heart.y - 6, heart.x, heart.y - 2).bezierCurveTo(heart.x + 2, heart.y - 6, heart.x + 6, heart.y - 1, heart.x, heart.y + 3).fill(0xffffff);
      break;
    }
    case "floor_lamp":
    case "golden_lamp": {
      const c = tileToScreen(0.5, 0.5);
      g.ellipse(c.x, c.y, 9, 4.5).fill(0x8a73c8);
      g.moveTo(c.x, c.y).lineTo(c.x, c.y - 52).stroke({ color: OUTLINE, width: 2.2, alpha: 0.7 });
      const shadeColor = kind === "golden_lamp" ? 0xf5cb78 : 0xfff0e8;
      g.poly([c.x - 14, c.y - 50, c.x + 14, c.y - 50, c.x + 9, c.y - 68, c.x - 9, c.y - 68]).fill(shadeColor).stroke({ color: OUTLINE, width: 1, alpha: 0.4 });
      const glow = new Graphics();
      glow.circle(c.x, c.y - 56, 40).fill({ color: kind === "golden_lamp" ? 0xf5cb78 : 0xfbe3b1, alpha: 0.3 });
      container.addChildAt(glow, 0);
      art.glow = glow;
      break;
    }
    case "armchair": {
      isoBox(g, 0.1, 0.1, 0.8, 0.8, 0, 14, { color: 0xbce5d5 });
      isoBox(g, 0.1, 0.1, 0.8, 0.18, 14, 20, { color: 0x6cc3a2 });
      isoBox(g, 0.1, 0.1, 0.16, 0.8, 14, 10, { color: 0x6cc3a2 });
      isoBox(g, 0.74, 0.1, 0.16, 0.8, 14, 10, { color: 0x6cc3a2 });
      isoBox(g, 0.3, 0.3, 0.42, 0.5, 14, 4, { color: 0xfff7ed });
      break;
    }
    case "side_table": {
      isoBox(g, 0.42, 0.42, 0.16, 0.16, 0, 20, { color: 0xc49a83 });
      isoBox(g, 0.15, 0.15, 0.7, 0.7, 20, 4, { color: 0xe8c6a8 });
      isoBox(g, 0.3, 0.35, 0.15, 0.15, 24, 7, { color: 0xffffff });
      isoBox(g, 0.55, 0.45, 0.15, 0.15, 24, 7, { color: 0xf8bbd0 });
      break;
    }
    case "beanbag": {
      const c = tileToScreen(0.5, 0.5);
      g.ellipse(c.x, c.y, 22, 11).fill({ color: OUTLINE, alpha: 0.15 });
      g.ellipse(c.x, c.y - 10, 22, 15).fill(0xffd6c2).stroke({ color: OUTLINE, width: 1.2, alpha: 0.35 });
      g.ellipse(c.x - 3, c.y - 15, 13, 7).fill(0xfff0e8);
      break;
    }
    case "aquarium": {
      isoBox(g, 0.1, 0.2, 1.8, 0.6, 0, 16, { color: 0xc49a83 });
      isoBox(g, 0.15, 0.25, 1.7, 0.5, 16, 30, { color: 0xb8ddf5, top: 0xe5f3fc, left: 0x9fd0ef, right: 0x7fbde3 });
      const fish = new Graphics();
      for (const [u, z, color] of [[0.6, 26, 0xf6a88a], [1.2, 34, 0xf8bbd0]] as const) {
        const [x, y] = P(u, 0.75, z);
        fish.ellipse(x, y, 5, 3).fill(color);
        fish.poly([x - 5, y, x - 9, y - 3, x - 9, y + 3]).fill(color);
      }
      container.addChild(fish);
      art.sway = fish;
      break;
    }
    case "sunflower_pot":
    case "bonsai": {
      const c = pot(g, 0.5, 0.5, kind === "bonsai" ? 0xc7b8ea : 0xfde4ee, 0.85);
      const sway = new Graphics();
      if (kind === "bonsai") {
        sway.moveTo(c.x, c.y - 14).bezierCurveTo(c.x - 6, c.y - 22, c.x + 6, c.y - 26, c.x, c.y - 32).stroke({ color: 0x745d64, width: 3.5 });
        sway.circle(c.x - 8, c.y - 34, 9).fill(0x6cc3a2);
        sway.circle(c.x + 7, c.y - 36, 10).fill(0x3a9474);
        sway.circle(c.x, c.y - 42, 8).fill(0x6cc3a2);
      } else {
        sway.moveTo(c.x, c.y - 14).lineTo(c.x, c.y - 42).stroke({ color: 0x3a9474, width: 2.5 });
        leaf(sway, c.x - 6, c.y - 26, 6, 3, 0.4, 0x6cc3a2);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          sway.ellipse(c.x + Math.cos(a) * 7, c.y - 46 + Math.sin(a) * 7, 4, 2.5).fill(0xf5cb78);
        }
        sway.circle(c.x, c.y - 46, 5).fill(0x9a6b4f);
      }
      sway.pivot.set(c.x, c.y - 14);
      sway.position.set(c.x, c.y - 14);
      container.addChild(sway);
      art.sway = sway;
      break;
    }
    case "teddy_bear": {
      const c = tileToScreen(0.5, 0.5);
      g.ellipse(c.x, c.y, 13, 6).fill({ color: OUTLINE, alpha: 0.15 });
      g.ellipse(c.x, c.y - 10, 11, 11).fill(0xd8a985);
      g.circle(c.x, c.y - 26, 10).fill(0xd8a985);
      g.circle(c.x - 8, c.y - 34, 4).fill(0xd8a985);
      g.circle(c.x + 8, c.y - 34, 4).fill(0xd8a985);
      g.ellipse(c.x, c.y - 23, 4, 3).fill(0xfff0e8);
      g.circle(c.x - 4, c.y - 28, 1.4).fill(OUTLINE);
      g.circle(c.x + 4, c.y - 28, 1.4).fill(OUTLINE);
      g.poly([c.x - 4, c.y - 17, c.x + 4, c.y - 17, c.x, c.y - 13]).fill(0xe7779f);
      break;
    }
    case "star_lamp":
    case "heart_lantern": {
      const c = tileToScreen(0.5, 0.5);
      isoBox(g, 0.3, 0.3, 0.4, 0.4, 0, 8, { color: 0xc7b8ea });
      const glow = new Graphics();
      glow.circle(c.x, c.y - 26, 30).fill({ color: kind === "heart_lantern" ? 0xf8bbd0 : 0xfbe3b1, alpha: 0.35 });
      container.addChildAt(glow, 0);
      art.glow = glow;
      if (kind === "star_lamp") {
        const pts: number[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 6 : 14;
          const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
          pts.push(c.x + Math.cos(a) * r, c.y - 26 + Math.sin(a) * r);
        }
        g.poly(pts).fill(0xf5cb78).stroke({ color: 0xd9a440, width: 1.2 });
      } else {
        g.moveTo(c.x, c.y - 12).bezierCurveTo(c.x - 18, c.y - 24, c.x - 8, c.y - 42, c.x, c.y - 32).bezierCurveTo(c.x + 8, c.y - 42, c.x + 18, c.y - 24, c.x, c.y - 12).fill(0xf39bbb).stroke({ color: 0xe7779f, width: 1.4 });
      }
      break;
    }
    case "photo_stand": {
      isoBox(g, 0.3, 0.4, 0.4, 0.2, 0, 3, { color: 0xc49a83 });
      const [x0, y0] = P(0.25, 0.5, 3);
      const [x1, y1] = P(0.75, 0.5, 3);
      g.poly([x0, y0, x1, y1, x1, y1 - 26, x0, y0 - 26]).fill(0xfff7ed).stroke({ color: 0xc49a83, width: 3 });
      g.poly([x0 + 4, y0 - 4, x1 - 4, y1 - 4, x1 - 4, y1 - 22, x0 + 4, y0 - 22]).fill(0xfde4ee);
      g.circle((x0 + x1) / 2 - 4, (y0 + y1) / 2 - 14, 3).fill(0xe7779f);
      g.circle((x0 + x1) / 2 + 4, (y0 + y1) / 2 - 14, 3).fill(0x8a73c8);
      break;
    }
    case "cat_bed": {
      const c = tileToScreen(0.5, 0.5);
      g.ellipse(c.x, c.y - 4, 20, 10).fill(0xc7b8ea).stroke({ color: OUTLINE, width: 1.2, alpha: 0.35 });
      g.ellipse(c.x, c.y - 6, 15, 7).fill(0xefeafb);
      const sway = new Graphics();
      sway.ellipse(c.x, c.y - 10, 11, 7).fill(0xf6a88a);
      sway.circle(c.x + 8, c.y - 14, 6).fill(0xf6a88a);
      sway.poly([c.x + 4, c.y - 18, c.x + 6, c.y - 24, c.x + 9, c.y - 19]).fill(0xf6a88a);
      sway.poly([c.x + 9, c.y - 19, c.x + 12, c.y - 24, c.x + 13, c.y - 17]).fill(0xf6a88a);
      sway.moveTo(c.x + 6, c.y - 14).quadraticCurveTo(c.x + 7.5, c.y - 13, c.x + 9, c.y - 14).stroke({ color: OUTLINE, width: 1 });
      sway.moveTo(c.x - 10, c.y - 8).quadraticCurveTo(c.x - 16, c.y - 14, c.x - 10, c.y - 16).stroke({ color: 0xf6a88a, width: 3.5, cap: "round" });
      container.addChild(sway);
      art.sway = sway;
      break;
    }
    case "cushion_pile": {
      isoBox(g, 0.15, 0.15, 0.7, 0.7, 0, 8, { color: 0xf8bbd0 });
      isoBox(g, 0.25, 0.25, 0.5, 0.5, 8, 7, { color: 0xbce5d5 });
      isoBox(g, 0.32, 0.32, 0.36, 0.36, 15, 6, { color: 0xfbe3b1 });
      break;
    }
    case "legend_trophy":
    case "tier_trophy_gold":
    case "tier_trophy_diamond":
    case "tier_trophy_sakura":
    case "tier_trophy_eternal": {
      const cup = { legend_trophy: 0xf5cb78, tier_trophy_gold: 0xf5cb78, tier_trophy_diamond: 0xb8ddf5, tier_trophy_sakura: 0xf39bbb, tier_trophy_eternal: 0xc7b8ea }[kind]!;
      const c = tileToScreen(0.5, 0.5);
      isoBox(g, 0.25, 0.25, 0.5, 0.5, 0, 10, { color: 0x8a73c8 });
      g.rect(c.x - 2.5, c.y - 30, 5, 14).fill(shade(cup, -40));
      g.moveTo(c.x - 13, c.y - 52).lineTo(c.x + 13, c.y - 52).quadraticCurveTo(c.x + 12, c.y - 30, c.x, c.y - 29).quadraticCurveTo(c.x - 12, c.y - 30, c.x - 13, c.y - 52).fill(cup).stroke({ color: shade(cup, -50), width: 1.2 });
      g.circle(c.x - 15, c.y - 45, 4).stroke({ color: shade(cup, -30), width: 2 });
      g.circle(c.x + 15, c.y - 45, 4).stroke({ color: shade(cup, -30), width: 2 });
      g.moveTo(c.x, c.y - 47).bezierCurveTo(c.x - 5, c.y - 50, c.x - 3, c.y - 44, c.x, c.y - 41).bezierCurveTo(c.x + 3, c.y - 44, c.x + 5, c.y - 50, c.x, c.y - 47).fill(0xffffff);
      const glow = new Graphics();
      glow.circle(c.x, c.y - 40, 26).fill({ color: cup, alpha: 0.3 });
      container.addChildAt(glow, 0);
      art.glow = glow;
      break;
    }
    default:
      isoBox(g, 0.15, 0.15, Math.max(0.7, w - 0.3), Math.max(0.7, h - 0.3), 0, 18, { color: 0xc7b8ea });
  }

  if (flipped) {
    const center = tileToScreen(w / 2, h / 2);
    for (const child of container.children) {
      child.scale.x *= -1;
      child.x = 2 * center.x - child.x;
    }
  }
  return art;
}
