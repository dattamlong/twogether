import { describe, expect, it } from "vitest";
import { lessonRewards, levelForXp, levelProgress, totalXpForLevel } from "./xp";

describe("XP and levels", () => {
  it("uses a growing step per level", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(250);
    expect(totalXpForLevel(4)).toBe(450);
    expect(totalXpForLevel(5)).toBe(700);
  });

  it("derives level from XP at the boundaries", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(699)).toBe(4);
    expect(levelForXp(700)).toBe(5);
  });

  it("scales couple levels by the multiplier", () => {
    expect(levelForXp(199, 2)).toBe(1);
    expect(levelForXp(200, 2)).toBe(2);
  });

  it("reports progress inside the current level", () => {
    expect(levelProgress(175)).toEqual({ level: 2, xpIntoLevel: 75, xpForNextLevel: 150, ratio: 0.5 });
  });

  it("rewards first completions more than replays", () => {
    expect(lessonRewards(8, true)).toEqual({ xp: 100, coins: 26 });
    expect(lessonRewards(8, false)).toEqual({ xp: 50, coins: 5 });
  });
});
