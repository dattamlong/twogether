export const XP_BASE_STEP = 100;
export const XP_STEP_GROWTH = 50;
export const COUPLE_XP_MULTIPLIER = 2;

export function totalXpForLevel(level: number, multiplier = 1): number {
  const n = Math.max(0, Math.floor(level) - 1);
  return multiplier * (XP_BASE_STEP * n + (XP_STEP_GROWTH / 2) * n * (n - 1));
}

export function levelForXp(xp: number, multiplier = 1): number {
  let level = 1;
  while (totalXpForLevel(level + 1, multiplier) <= xp) level++;
  return level;
}

export function levelProgress(xp: number, multiplier = 1) {
  const level = levelForXp(xp, multiplier);
  const floor = totalXpForLevel(level, multiplier);
  const ceiling = totalXpForLevel(level + 1, multiplier);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: ceiling - floor,
    ratio: (xp - floor) / (ceiling - floor),
  };
}

export const LESSON_XP_PER_CORRECT = 10;
export const LESSON_COMPLETION_BONUS = 20;

export function lessonRewards(firstTryCorrect: number, isFirstCompletion: boolean) {
  const xp = LESSON_XP_PER_CORRECT * firstTryCorrect + LESSON_COMPLETION_BONUS;
  return isFirstCompletion
    ? { xp, coins: 10 + 2 * firstTryCorrect }
    : { xp: Math.floor(xp / 2), coins: 5 };
}
