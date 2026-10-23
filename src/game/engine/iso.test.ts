import { describe, expect, it } from "vitest";
import { facingBetween, screenToTile, screenToTileFloor, tileToScreen } from "./iso";

describe("isometric projection", () => {
  it("round-trips tile and screen coordinates", () => {
    for (const [x, y] of [[0, 0], [3, 7], [9, 2], [4.5, 6.25]]) {
      const s = tileToScreen(x, y);
      const back = screenToTile(s.x, s.y);
      expect(back.x).toBeCloseTo(x);
      expect(back.y).toBeCloseTo(y);
    }
  });

  it("picks the tile under a screen point", () => {
    const center = tileToScreen(3.5, 2.5);
    expect(screenToTileFloor(center.x, center.y)).toEqual({ x: 3, y: 2 });
  });

  it("derives a facing from movement direction", () => {
    expect(facingBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe("se");
    expect(facingBetween({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe("sw");
    expect(facingBetween({ x: 1, y: 1 }, { x: 0, y: 1 })).toBe("nw");
    expect(facingBetween({ x: 1, y: 1 }, { x: 1, y: 0 })).toBe("ne");
  });
});
