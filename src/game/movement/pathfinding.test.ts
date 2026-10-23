import { describe, expect, it } from "vitest";
import { FIXTURES, activeFixtures, footprintTiles, tileKey, type Tile } from "../world/room";
import { createWalkGrid, findPath, isWalkable, nearestReachable } from "./pathfinding";

const roomGrid = () => {
  const fixtures = activeFixtures(5).filter((f) => f.blocking);
  const seats = FIXTURES.flatMap((f) => f.seats?.map((s) => s.tile) ?? []);
  return createWalkGrid(fixtures.flatMap(footprintTiles), seats);
};

const adjacent = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;

describe("pathfinding", () => {
  it("finds a path that never crosses furniture", () => {
    const grid = roomGrid();
    const path = findPath(grid, { x: 5, y: 4 }, { x: 8, y: 8 })!;
    expect(path.at(-1)).toEqual({ x: 8, y: 8 });
    let previous = { x: 5, y: 4 };
    for (const step of path) {
      expect(isWalkable(grid, step)).toBe(true);
      expect(adjacent(previous, step)).toBe(true);
      previous = step;
    }
  });

  it("routes around obstacles without cutting corners", () => {
    const grid = createWalkGrid([{ x: 1, y: 0 }, { x: 1, y: 1 }], [], 4, 4);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 })!;
    const keys = path.map(tileKey);
    expect(keys).not.toContain("1,0");
    expect(keys).not.toContain("1,1");
    expect(keys).toContain("1,2");
  });

  it("refuses blocked or occupied goals and unreachable targets", () => {
    const grid = roomGrid();
    expect(findPath(grid, { x: 5, y: 4 }, { x: 0, y: 0 })).toBeNull();
    expect(findPath(grid, { x: 5, y: 4 }, { x: 5, y: 6 }, [{ x: 5, y: 6 }])).toBeNull();
    const boxed = createWalkGrid([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], [], 3, 3);
    expect(findPath(boxed, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
  });

  it("lets characters sit on seats only as a destination", () => {
    const grid = roomGrid();
    const toChair = findPath(grid, { x: 6, y: 3 }, { x: 6, y: 1 })!;
    expect(toChair.at(-1)).toEqual({ x: 6, y: 1 });
    const pastChair = findPath(grid, { x: 5, y: 1 }, { x: 8, y: 1 })!;
    expect(pastChair.map(tileKey)).not.toContain("6,1");
    expect(pastChair.map(tileKey)).not.toContain("7,1");
  });

  it("chooses the closest reachable approach tile", () => {
    const grid = roomGrid();
    const best = nearestReachable(grid, { x: 8, y: 5 }, [{ x: 4, y: 5 }, { x: 4, y: 6 }]);
    expect(best?.tile).toBeDefined();
    expect(best!.path.length).toBeLessThanOrEqual(5);
  });
});
