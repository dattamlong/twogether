import { describe, expect, it } from "vitest";
import { advanceStreak, effectiveStreak, type StreakState } from "./streak";

const state = (s: Partial<StreakState>): StreakState => ({ current: 0, longest: 0, lastActiveDate: null, freezes: 1, ...s });

describe("streaks", () => {
  it("starts at one and ignores repeat activity the same day", () => {
    const first = advanceStreak(state({}), "2026-10-20").state;
    expect(first.current).toBe(1);
    expect(advanceStreak(first, "2026-10-20").state).toEqual(first);
  });

  it("continues on consecutive days across month boundaries", () => {
    const next = advanceStreak(state({ current: 4, longest: 4, lastActiveDate: "2026-10-31" }), "2026-11-01");
    expect(next.state.current).toBe(5);
  });

  it("spends a freeze to cover one missed day", () => {
    const next = advanceStreak(state({ current: 5, longest: 5, lastActiveDate: "2026-10-18", freezes: 1 }), "2026-10-20");
    expect(next.state).toMatchObject({ current: 6, freezes: 0 });
    expect(next.freezesUsed).toBe(1);
  });

  it("resets when the gap exceeds available freezes", () => {
    const next = advanceStreak(state({ current: 9, longest: 9, lastActiveDate: "2026-10-15", freezes: 2 }), "2026-10-20");
    expect(next.state).toMatchObject({ current: 1, longest: 9, freezes: 2 });
  });

  it("awards a freeze at weekly milestones up to the cap", () => {
    const next = advanceStreak(state({ current: 6, longest: 6, lastActiveDate: "2026-10-19", freezes: 2 }), "2026-10-20");
    expect(next.milestone).toBe(7);
    expect(next.state.freezes).toBe(2);
    const withRoom = advanceStreak(state({ current: 13, lastActiveDate: "2026-10-19", freezes: 0 }), "2026-10-20");
    expect(withRoom.state.freezes).toBe(1);
  });

  it("describes the visible streak without guilt", () => {
    expect(effectiveStreak(state({ current: 3, lastActiveDate: "2026-10-20" }), "2026-10-20").status).toBe("done_today");
    expect(effectiveStreak(state({ current: 3, lastActiveDate: "2026-10-19" }), "2026-10-20").status).toBe("pending_today");
    expect(effectiveStreak(state({ current: 3, lastActiveDate: "2026-10-18", freezes: 1 }), "2026-10-20")).toEqual({ days: 3, status: "protected" });
    expect(effectiveStreak(state({ current: 3, lastActiveDate: "2026-10-15" }), "2026-10-20")).toEqual({ days: 0, status: "broken" });
  });
});
