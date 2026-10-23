import { z } from "zod";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export const cefrLevel = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof cefrLevel>;

export const HSK_LEVELS = [
  "HSK1",
  "HSK2",
  "HSK3",
  "HSK4",
  "HSK5",
  "HSK6",
  "HSK7",
  "HSK8",
  "HSK9",
] as const;
export const LESSON_LEVELS = [...CEFR_LEVELS, ...HSK_LEVELS] as const;
export const lessonLevel = z.enum(LESSON_LEVELS);
export type LessonLevel = z.infer<typeof lessonLevel>;

export const LANGUAGES = ["en", "zh"] as const;
export const language = z.enum(LANGUAGES);
export type Language = z.infer<typeof language>;

export const CATEGORIES = [
  "vocabulary",
  "grammar",
  "listening",
  "writing",
  "speaking",
] as const;
export const category = z.enum(CATEGORIES);
export type Category = z.infer<typeof category>;

const text = z.string().trim().min(1);

const questionBase = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  objective: text,
  explanation: text,
  explanation_vi: text,
});

export const vocabWord = z
  .object({
    term: text,
    ipa: z
      .string()
      .regex(/^\/.+\/$/)
      .optional(),
    pinyin: text.optional(),
    part_of_speech: z.enum([
      "noun",
      "verb",
      "adjective",
      "adverb",
      "phrase",
      "preposition",
      "pronoun",
      "measure_word",
      "particle",
      "number",
      "conjunction",
    ]),
    meaning_vi: text,
    example: text,
    example_pinyin: text.optional(),
    example_vi: text,
  })
  .refine((w) => Boolean(w.ipa) !== Boolean(w.pinyin), {
    message:
      "a word card needs exactly one of ipa (English) or pinyin (Chinese)",
  });

export const multipleChoice = questionBase.extend({
  kind: z.literal("multiple_choice"),
  prompt: text,
  prompt_vi: z.string().optional(),
  options: z.array(text).min(3).max(4),
  answer: text,
  word: vocabWord.optional(),
});

export const sentenceOrder = questionBase.extend({
  kind: z.literal("sentence_order"),
  prompt: text,
  prompt_vi: z.string().optional(),
  tokens: z.array(text).min(3).max(12),
  answers: z.array(text).min(1),
  hint: text,
  hint_vi: text,
});

export const listening = questionBase.extend({
  kind: z.literal("listening"),
  audio_text: text,
  prompt: text,
  prompt_vi: z.string().optional(),
  options: z.array(text).min(3).max(4),
  answer: text,
});

export const question = z.discriminatedUnion("kind", [
  multipleChoice,
  sentenceOrder,
  listening,
]);
export type Question = z.infer<typeof question>;

export const lesson = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    language: language.default("en"),
    category,
    level: lessonLevel,
    topic: text,
    title: text,
    title_vi: text,
    objectives: z.array(text).min(1).max(4),
    questions: z.array(question).min(5).max(12),
  })
  .refine(
    (l) =>
      l.language === "zh"
        ? l.level.startsWith("HSK")
        : !l.level.startsWith("HSK"),
    {
      message:
        "English lessons use CEFR levels and Chinese lessons use HSK levels",
    },
  );
export type Lesson = z.infer<typeof lesson>;

export const lessonFile = z.object({ lessons: z.array(lesson).min(1) });

export const loveQuestion = z.object({
  id: z.string().regex(/^love-[0-9]{3}$/),
  prompt: text,
  prompt_vi: text,
  helper_phrase: z.string().optional(),
});
export const loveQuestionFile = z.object({
  questions: z.array(loveQuestion).min(1),
});
export type LoveQuestion = z.infer<typeof loveQuestion>;
