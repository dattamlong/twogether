import { describe, expect, it } from "vitest";
import { sortByDepth } from "./depth";

describe("isometric depth sorting", () => {
  it("draws a character standing in front of a bed after it", () => {
    const order = sortByDepth([
      { id: "char", x: 1.2, y: 3.2, w: 0.6, h: 0.6 },
      { id: "bed", x: 0, y: 0, w: 2, h: 3 },
    ]);
    expect(order).toEqual(["bed", "char"]);
  });

  it("draws a character behind a sofa before it", () => {
    const order = sortByDepth([
      { id: "sofa", x: 3, y: 5, w: 1, h: 2 },
      { id: "char", x: 2.2, y: 5.4, w: 0.6, h: 0.6 },
    ]);
    expect(order.indexOf("char")).toBeLessThan(order.indexOf("sofa"));
  });

  it("keeps floor decals underneath everything", () => {
    const order = sortByDepth([
      { id: "char", x: 1.5, y: 4.5, w: 0.6, h: 0.6 },
      { id: "rug", x: 1, y: 4, w: 2, h: 4, layer: -1 },
    ]);
    expect(order[0]).toBe("rug");
  });

  it("orders a chain of objects consistently", () => {
    const order = sortByDepth([
      { id: "c", x: 4, y: 4, w: 1, h: 1 },
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 2, y: 2, w: 1, h: 1 },
    ]);
    expect(order).toEqual(["a", "b", "c"]);
  });
});
