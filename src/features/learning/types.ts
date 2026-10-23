import type { Database } from "@/lib/supabase/database.types";

export type QuestionCard = Database["public"]["Views"]["question_cards"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

export type WordCard = {
  term: string;
  ipa: string;
  part_of_speech: string;
  meaning_vi: string;
  example: string;
  example_vi: string;
};

export type AnswerFeedback = {
  correct: boolean;
  attemptNo: number;
  correctAnswer: string;
  acceptedAnswers: string[] | null;
  explanation: string;
  explanationVi: string;
  word: WordCard | null;
  newlyLearned: boolean;
};

export const LEVEL_LABELS: Record<string, { name: string; vi: string }> = {
  A1: { name: "Beginner", vi: "Mới bắt đầu" },
  A2: { name: "Elementary", vi: "Sơ cấp" },
  B1: { name: "Intermediate", vi: "Trung cấp" },
  B2: { name: "Upper Intermediate", vi: "Trung cao cấp" },
  C1: { name: "Advanced", vi: "Nâng cao" },
};
