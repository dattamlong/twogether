import type { Database } from "@/lib/supabase/database.types";

export type QuestionCard = Database["public"]["Views"]["question_cards"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

export type WordCard = {
  term: string;
  ipa?: string;
  pinyin?: string;
  part_of_speech: string;
  meaning_vi: string;
  example: string;
  example_pinyin?: string;
  example_vi: string;
};

export type StudyLanguage = "en" | "zh";

export const LANGUAGE_INFO: Record<StudyLanguage, { name: string; native: string; vi: string; learnVi: string; standard: string; levels: string[]; speech: string }> = {
  en: { name: "English", native: "English", vi: "Tiếng Anh", learnVi: "Học tiếng Anh từng chút mỗi ngày", standard: "CEFR", levels: ["A1", "A2", "B1", "B2", "C1"], speech: "en-US" },
  zh: {
    name: "Chinese",
    native: "中文",
    vi: "Tiếng Trung",
    learnVi: "Học tiếng Trung từng chút mỗi ngày",
    standard: "HSK 3.0",
    levels: ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6", "HSK7", "HSK8", "HSK9"],
    speech: "zh-CN",
  },
};

export function speechLang(language: string | null | undefined) {
  return language === "zh" ? "zh-CN" : "en-US";
}

export function displayAnswer(answer: string, language: string | null | undefined) {
  return language === "zh" ? answer.replace(/ /g, "") : answer;
}

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
  HSK1: { name: "Elementary 1", vi: "Sơ cấp 1" },
  HSK2: { name: "Elementary 2", vi: "Sơ cấp 2" },
  HSK3: { name: "Elementary 3", vi: "Sơ cấp 3" },
  HSK4: { name: "Intermediate 4", vi: "Trung cấp 4" },
  HSK5: { name: "Intermediate 5", vi: "Trung cấp 5" },
  HSK6: { name: "Intermediate 6", vi: "Trung cấp 6" },
  HSK7: { name: "Advanced 7", vi: "Cao cấp 7" },
  HSK8: { name: "Advanced 8", vi: "Cao cấp 8" },
  HSK9: { name: "Advanced 9", vi: "Cao cấp 9" },
};
