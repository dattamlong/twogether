import { COURT } from "./court";
import type { Vec3 } from "./physics";

export type Camera = { pos: Vec3; up: Vec3; fwd: Vec3; focal: number; cx: number; cy: number; pitch: number };

export type Insets = { top: number; right: number; bottom: number; left: number };

export type Projected = { x: number; y: number; s: number };

const PITCHES = [30, 34, 38, 42, 46, 50, 55, 60, 66];
const DISTANCE = 17;
const PREFERRED_PITCH = 40;

export const FIT_POINTS: Vec3[] = (() => {
  const x = COURT.doublesHalfWidth + 0.25;
  const near = -(COURT.halfLength + 0.5);
  const far = COURT.halfLength + 0.25;
  return [
    { x: -x, y: near, z: 0 },
    { x, y: near, z: 0 },
    { x: -x, y: far, z: 0 },
    { x, y: far, z: 0 },
    { x: 0, y: far - 0.3, z: 1.7 },
  ];
})();

function orient(pitchDeg: number, targetY: number): Camera {
  const p = (pitchDeg * Math.PI) / 180;
  const pos = { x: 0, y: targetY - DISTANCE * Math.cos(p), z: DISTANCE * Math.sin(p) };
  const fwd = { x: 0, y: Math.cos(p), z: -Math.sin(p) };
  const up = { x: 0, y: -fwd.z, z: fwd.y };
  return { pos, up, fwd, focal: 1, cx: 0, cy: 0, pitch: pitchDeg };
}

export function project(cam: Camera, p: Vec3): Projected {
  const rx = p.x - cam.pos.x;
  const ry = p.y - cam.pos.y;
  const rz = p.z - cam.pos.z;
  const zc = Math.max(0.5, rx * cam.fwd.x + ry * cam.fwd.y + rz * cam.fwd.z);
  const yc = rx * cam.up.x + ry * cam.up.y + rz * cam.up.z;
  return { x: cam.cx + (cam.focal * rx) / zc, y: cam.cy - (cam.focal * yc) / zc, s: cam.focal / zc };
}

function bounds(cam: Camera) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of FIT_POINTS) {
    const q = project(cam, p);
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  return { minX, maxX, minY, maxY };
}

export function makeCamera(w: number, h: number, insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 }): Camera {
  const availW = Math.max(40, w - insets.left - insets.right);
  const availH = Math.max(40, h - insets.top - insets.bottom);
  let best: { cam: Camera; scale: number; score: number } | null = null;
  for (const pitch of PITCHES) {
    const cam = orient(pitch, 0.3);
    const b = bounds(cam);
    const scale = Math.min(availW / (b.maxX - b.minX), availH / (b.maxY - b.minY));
    const score = scale * (1 - Math.abs(pitch - PREFERRED_PITCH) / 120);
    if (!best || score > best.score) best = { cam, scale, score };
  }
  const { cam, scale } = best!;
  cam.focal = scale;
  const b = bounds(cam);
  cam.cx = insets.left + availW / 2 - (b.minX + b.maxX) / 2;
  cam.cy = insets.top + availH / 2 - (b.minY + b.maxY) / 2;
  return cam;
}

export function courtCoverage(cam: Camera, w: number, h: number, insets: Insets) {
  const L = COURT.halfLength;
  const D = COURT.doublesHalfWidth;
  const pts = [
    { x: -D, y: -L, z: 0 },
    { x: D, y: -L, z: 0 },
    { x: -D, y: L, z: 0 },
    { x: D, y: L, z: 0 },
  ].map((p) => project(cam, p));
  const width = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  const height = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
  return {
    width: width / (w - insets.left - insets.right),
    height: height / (h - insets.top - insets.bottom),
    inside: pts.every((p) => p.x >= insets.left - 1 && p.x <= w - insets.right + 1 && p.y >= insets.top - 1 && p.y <= h - insets.bottom + 1),
  };
}
