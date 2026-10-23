import type { QuestionCard } from "../learning/types";

export type SubjectSummary = {
  id: string;
  name: string;
  nameVi: string;
  description: string;
  descriptionVi: string;
  status: "available" | "coming_soon";
  language: "en" | "zh" | null;
  currentLevel: string;
  levels: { level: string; title: string; titleVi: string; lessonTarget: number; availableUnits: number }[];
  lessonsTotal: number;
  lessonsDone: number;
  stars: number;
  unitsCleared: number;
  placement: { recommendedLevel: string; correct: number; total: number; at: string } | null;
};

export type MapNode = {
  kind: "lesson" | "review" | "boss";
  lessonId?: string;
  title: string;
  titleVi: string;
  category?: string;
  questionCount?: number;
  completed: boolean;
  unlocked: boolean;
};

export type MapUnit = {
  id: string;
  number: number;
  title: string;
  titleVi: string;
  description: string;
  location: string;
  status: "available" | "planned";
  bossName: string | null;
  rewardItemId: string | null;
  unlocked: boolean;
  stars: number;
  bossBestPct: number;
  bossCleared: boolean;
  reviewDone: boolean;
  lessonsTotal: number;
  lessonsDone: number;
  nodes: MapNode[];
};

export type AdventureMapData = {
  subject: { id: string; name: string; name_vi: string; language: string | null };
  level: { level: string; title: string; title_vi: string; lesson_target: number } | null;
  units: MapUnit[];
  current: { unitId: string; nodeIndex: number } | null;
};

export type ChallengeStart = {
  sessionId: string;
  unit: { id: string; title: string; titleVi: string; bossName: string | null; location: string; subjectId: string; level: string };
  questions: QuestionCard[];
};

export type ChallengeResult = {
  mode: "boss" | "unit_review";
  correct: number;
  total: number;
  pct: number;
  stars: number;
  bestStars: number;
  firstClear: boolean;
  rewardItemId: string | null;
  xp: number;
  coins: number;
  leveledUp: boolean;
  level: number;
};

export type PlacementResult = {
  recommendedLevel: string;
  correct: number;
  total: number;
  byLevel: Record<string, { correct: number; total: number }>;
};

export type CoupleAdventure = {
  id: string;
  title: string;
  titleVi: string;
  story: string;
  storyVi: string;
  coupleXp: number;
  loveEnergy: number;
  rewardItemId: string | null;
  parts: { slot: 0 | 1; category: string; title: string; title_vi: string }[];
  mySlot: 0 | 1;
  progress: Record<string, { correct: number; at: string }>;
  completed: boolean;
  letter: string | null;
  letterVi: string | null;
};

export const STAR_RULES = [
  { min: 100, stars: 3, label: "Perfect" },
  { min: 90, stars: 2, label: "Great" },
  { min: 80, stars: 1, label: "Cleared" },
] as const;
