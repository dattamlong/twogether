import type { Tile } from "../world/room";

export const TILE_W = 64;
export const TILE_H = 32;

export type Point = { x: number; y: number };

export function tileToScreen(tx: number, ty: number): Point {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

export function tileCenter(tx: number, ty: number): Point {
  return tileToScreen(tx + 0.5, ty + 0.5);
}

export function screenToTile(sx: number, sy: number): Point {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function screenToTileFloor(sx: number, sy: number): Tile {
  const p = screenToTile(sx, sy);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

export function facingBetween(from: Point, to: Point): "ne" | "nw" | "se" | "sw" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "se" : "nw";
  return dy >= 0 ? "sw" : "ne";
}
