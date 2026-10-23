import { STREAK_MILESTONES } from "@/content/catalog";

export const MAX_STREAK_FREEZES = 2;

export type StreakState = {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  freezes: number;
};

const DAY_MS = 86_400_000;

export function daysBetween(fromIsoDate: string, toIsoDate: string) {
  return Math.round((Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate}T00:00:00Z`)) / DAY_MS);
}

export function advanceStreak(state: StreakState, today: string) {
  if (state.lastActiveDate === today) return { state, freezesUsed: 0, milestone: null as number | null };

  const gap = state.lastActiveDate ? daysBetween(state.lastActiveDate, today) : Infinity;
  const missedDays = gap - 1;
  let freezes = state.freezes;
  let current: number;
  let freezesUsed = 0;

  if (gap === 1) current = state.current + 1;
  else if (missedDays >= 1 && missedDays <= freezes) {
    freezesUsed = missedDays;
    freezes -= missedDays;
    current = state.current + 1;
  } else current = 1;

  const milestone = (STREAK_MILESTONES as readonly number[]).includes(current) ? current : null;
  if (milestone && milestone >= 7) freezes = Math.min(MAX_STREAK_FREEZES, freezes + 1);

  return {
    state: { current, longest: Math.max(state.longest, current), lastActiveDate: today, freezes },
    freezesUsed,
    milestone,
  };
}

export function effectiveStreak(state: StreakState, today: string) {
  if (!state.lastActiveDate) return { days: 0, status: "none" as const };
  const gap = daysBetween(state.lastActiveDate, today);
  if (gap <= 0) return { days: state.current, status: "done_today" as const };
  if (gap === 1) return { days: state.current, status: "pending_today" as const };
  if (gap - 1 <= state.freezes) return { days: state.current, status: "protected" as const };
  return { days: 0, status: "broken" as const };
}
