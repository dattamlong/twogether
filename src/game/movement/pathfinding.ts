import { ROOM_DEPTH, ROOM_WIDTH, tileKey, type Tile } from "../world/room";

export type WalkGrid = {
  width: number;
  depth: number;
  blocked: Set<string>;
  seats: Set<string>;
};

export function createWalkGrid(blockedTiles: Tile[], seatTiles: Tile[], width = ROOM_WIDTH, depth = ROOM_DEPTH): WalkGrid {
  return {
    width,
    depth,
    blocked: new Set(blockedTiles.map(tileKey)),
    seats: new Set(seatTiles.map(tileKey)),
  };
}

export function isWalkable(grid: WalkGrid, t: Tile) {
  return t.x >= 0 && t.y >= 0 && t.x < grid.width && t.y < grid.depth && !grid.blocked.has(tileKey(t));
}

const DIRECTIONS = [
  { x: 1, y: 0, cost: 1 },
  { x: -1, y: 0, cost: 1 },
  { x: 0, y: 1, cost: 1 },
  { x: 0, y: -1, cost: 1 },
  { x: 1, y: 1, cost: Math.SQRT2 },
  { x: 1, y: -1, cost: Math.SQRT2 },
  { x: -1, y: 1, cost: Math.SQRT2 },
  { x: -1, y: -1, cost: Math.SQRT2 },
];

const heuristic = (a: Tile, b: Tile) => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};

export function findPath(grid: WalkGrid, start: Tile, goal: Tile, occupied: Tile[] = []): Tile[] | null {
  const goalKey = tileKey(goal);
  const goalIsSeat = grid.seats.has(goalKey);
  if (!goalIsSeat && !isWalkable(grid, goal)) return null;
  if (tileKey(start) === goalKey) return [];

  const occupiedKeys = new Set(occupied.map(tileKey));
  if (occupiedKeys.has(goalKey)) return null;

  const passable = (t: Tile) => {
    const key = tileKey(t);
    if (key === goalKey) return true;
    return isWalkable(grid, t) && !occupiedKeys.has(key) && !grid.seats.has(key);
  };

  const open = new Map<string, { tile: Tile; f: number }>([[tileKey(start), { tile: start, f: heuristic(start, goal) }]]);
  const cameFrom = new Map<string, Tile>();
  const g = new Map<string, number>([[tileKey(start), 0]]);

  while (open.size > 0) {
    let currentKey = "";
    let current: Tile | null = null;
    let best = Infinity;
    for (const [key, node] of open) {
      if (node.f < best) {
        best = node.f;
        currentKey = key;
        current = node.tile;
      }
    }
    if (!current) break;
    if (currentKey === goalKey) {
      const path: Tile[] = [current];
      let cursor = cameFrom.get(currentKey);
      while (cursor && tileKey(cursor) !== tileKey(start)) {
        path.unshift(cursor);
        cursor = cameFrom.get(tileKey(cursor));
      }
      return path;
    }
    open.delete(currentKey);

    for (const dir of DIRECTIONS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (!passable(next)) continue;
      if (dir.x !== 0 && dir.y !== 0) {
        const sideA = { x: current.x + dir.x, y: current.y };
        const sideB = { x: current.x, y: current.y + dir.y };
        if (!isWalkable(grid, sideA) || !isWalkable(grid, sideB) || grid.seats.has(tileKey(sideA)) || grid.seats.has(tileKey(sideB))) continue;
      }
      const key = tileKey(next);
      const tentative = (g.get(currentKey) ?? Infinity) + dir.cost;
      if (tentative < (g.get(key) ?? Infinity)) {
        cameFrom.set(key, current);
        g.set(key, tentative);
        open.set(key, { tile: next, f: tentative + heuristic(next, goal) });
      }
    }
  }
  return null;
}

export function nearestReachable(grid: WalkGrid, start: Tile, candidates: Tile[], occupied: Tile[] = []) {
  let best: { tile: Tile; path: Tile[] } | null = null;
  for (const tile of candidates) {
    const path = findPath(grid, start, tile, occupied);
    if (path && (!best || path.length < best.path.length)) best = { tile, path };
  }
  return best;
}
