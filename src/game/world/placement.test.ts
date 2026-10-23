import { describe, expect, it } from "vitest";
import { placementProblem, type Placement } from "./placement";

const item = (overrides: Partial<Placement>): Placement => ({ inventoryId: "a", itemId: "floor_lamp", x: 8, y: 7, w: 1, h: 1, flipped: false, ...overrides });

describe("placement rules", () => {
  it("accepts a free tile inside the room", () => {
    expect(placementProblem(item({}), [])).toBeNull();
  });

  it("rejects tiles outside the room", () => {
    expect(placementProblem(item({ x: 9, w: 2 }), [])).toBe("out_of_bounds");
    expect(placementProblem(item({ y: -1 }), [])).toBe("out_of_bounds");
  });

  it("rejects fixtures, approach tiles and other items", () => {
    expect(placementProblem(item({ x: 0, y: 0 }), [])).toBe("tile_occupied");
    expect(placementProblem(item({ x: 6, y: 2 }), [])).toBe("tile_occupied");
    expect(placementProblem(item({}), [item({ inventoryId: "b" })])).toBe("tile_occupied");
  });

  it("ignores the item's own previous position when moving it", () => {
    expect(placementProblem(item({}), [item({})])).toBeNull();
  });
});
