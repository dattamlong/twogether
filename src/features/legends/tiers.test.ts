import { describe, expect, it } from "vitest";
import { TIERS, formatCountdown, tierForPoints } from "./tiers";

describe("Love Legends tiers", () => {
  it("matches the server thresholds", () => {
    expect(TIERS.map((t) => t.threshold)).toEqual([0, 500, 1500, 3500, 7000, 12000]);
    expect(tierForPoints(0).key).toBe("bronze");
    expect(tierForPoints(499).key).toBe("bronze");
    expect(tierForPoints(500).key).toBe("silver");
    expect(tierForPoints(11999).key).toBe("sakura");
    expect(tierForPoints(50000).key).toBe("eternal");
  });

  it("formats the weekly countdown compactly", () => {
    expect(formatCountdown((2 * 24 + 14) * 3600_000 + 59_000)).toBe("2d 14h");
    expect(formatCountdown(3 * 3600_000 + 5 * 60_000)).toBe("3h 5m");
    expect(formatCountdown(-5)).toBe("0m");
  });
});
