import { z } from "zod";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
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
export const ACADEMY_LEVELS = ["L1", "L2", "L3", "L4", "L5"] as const;
export const LESSON_LEVELS = [...CEFR_LEVELS, ...HSK_LEVELS, ...ACADEMY_LEVELS] as const;

export const SUBJECTS = ["english", "chinese", "brain", "explorer", "science", "money", "tech"] as const;
export const subjectId = z.enum(SUBJECTS);
export type SubjectId = z.infer<typeof subjectId>;
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
  "reading",
  "logic",
  "knowledge",
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

export const introCard = z.object({
  title: text,
  body: text,
  body_vi: text,
  examples: z.array(z.object({ text, translation_vi: text, note: z.string().optional() })).max(6).default([]),
});

const LANGUAGE_OF_SUBJECT: Partial<Record<SubjectId, Language>> = { english: "en", chinese: "zh" };

export const lesson = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    subject: subjectId.optional(),
    language: language.optional(),
    category,
    level: lessonLevel,
    topic: text,
    title: text,
    title_vi: text,
    objectives: z.array(text).min(1).max(4),
    intro: z.array(introCard).max(4).optional(),
    questions: z.array(question).min(5).max(12),
  })
  .transform((l) => {
    const subject: SubjectId = l.subject ?? (l.language === "zh" ? "chinese" : "english");
    return { ...l, subject, language: LANGUAGE_OF_SUBJECT[subject] ?? null };
  })
  .refine(
    (l) =>
      l.subject === "chinese"
        ? l.level.startsWith("HSK")
        : l.subject === "english"
          ? (CEFR_LEVELS as readonly string[]).includes(l.level)
          : (ACADEMY_LEVELS as readonly string[]).includes(l.level),
    { message: "English uses CEFR levels, Chinese uses HSK levels, other worlds use L1-L5" },
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

export const UNIT_LOCATIONS = [
  "village", "garden", "library", "cafe", "forest", "castle", "mountain", "temple",
  "harbor", "island", "lab", "market", "city", "observatory", "bamboo", "lantern_street",
] as const;

export const curriculumUnit = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  title_vi: text,
  description: text,
  location: z.enum(UNIT_LOCATIONS),
  status: z.enum(["available", "planned"]),
  lessons: z.array(z.string()).default([]),
  boss: z.object({ name: text, questions: z.number().int().min(5).max(12) }).optional(),
  reward_item: z.string().optional(),
});

export const curriculumFile = z.object({
  subject: subjectId,
  levels: z
    .array(
      z.object({
        level: lessonLevel,
        title: text,
        title_vi: text,
        lesson_target: z.number().int().min(0),
        units: z.array(curriculumUnit).min(1),
      }),
    )
    .min(1),
});
export type CurriculumFile = z.infer<typeof curriculumFile>;
