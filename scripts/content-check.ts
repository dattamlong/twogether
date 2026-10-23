import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lessonFile, loveQuestionFile, type Lesson, type LoveQuestion } from "../src/content/schema";

export const CONTENT_DIR = join(import.meta.dirname, "..", "src", "content", "data");

const sortedTokens = (sentence: string[]) => [...sentence].map((t) => t.trim()).sort().join("\u0000");

export function loadContent() {
  const lessons: Lesson[] = [];
  const loveQuestions: LoveQuestion[] = [];
  const errors: string[] = [];

  for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(CONTENT_DIR, file), "utf8"));
    const parsed = file.startsWith("love") ? loveQuestionFile.safeParse(raw) : lessonFile.safeParse(raw);
    if (!parsed.success) {
      errors.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    if ("lessons" in parsed.data) lessons.push(...parsed.data.lessons);
    else loveQuestions.push(...parsed.data.questions);
  }

  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenPrompts = new Set<string>();
  const seenWords = new Set<string>();
  const claim = (set: Set<string>, key: string, label: string) => {
    if (set.has(key)) errors.push(`duplicate ${label}: ${key}`);
    set.add(key);
  };

  for (const lesson of lessons) {
    claim(seenSlugs, lesson.slug, "lesson slug");
    for (const q of lesson.questions) {
      claim(seenIds, q.id, "question id");
      const promptKey = q.kind === "listening" ? `${q.audio_text}|${q.prompt}` : q.kind === "sentence_order" ? q.answers[0] : q.prompt;
      claim(seenPrompts, promptKey.toLowerCase(), "question prompt");

      if (q.kind === "sentence_order") {
        const expected = sortedTokens(q.tokens);
        for (const answer of q.answers) {
          if (sortedTokens(answer.split(" ")) !== expected) {
            errors.push(`${q.id}: answer "${answer}" does not use exactly the tokens [${q.tokens.join(" | ")}]`);
          }
        }
        if (q.tokens.join(" ") === q.answers[0]) errors.push(`${q.id}: tokens are already in the correct order`);
      } else {
        if (!q.options.includes(q.answer)) errors.push(`${q.id}: answer "${q.answer}" is not one of the options`);
        if (new Set(q.options).size !== q.options.length) errors.push(`${q.id}: duplicate options`);
      }
      if (q.kind === "multiple_choice" && q.word) claim(seenWords, q.word.term.toLowerCase(), "vocabulary word");
      if (lesson.category === "vocabulary" && q.kind === "multiple_choice" && !q.word) {
        errors.push(`${q.id}: vocabulary questions need a word card`);
      }
    }
  }
  for (const lq of loveQuestions) claim(seenIds, lq.id, "love question id");

  return { lessons, loveQuestions, errors };
}

function summarize(lessons: Lesson[], loveQuestions: LoveQuestion[]) {
  const counts = new Map<string, number>();
  for (const l of lessons) {
    for (const q of l.questions) {
      const key = q.kind === "sentence_order" ? "sentence puzzles" : l.category;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  counts.set("love questions", loveQuestions.length);
  return [...counts].map(([k, v]) => `${k}: ${v}`).join(", ");
}

if (process.argv[1] === import.meta.filename) {
  const { lessons, loveQuestions, errors } = loadContent();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(`OK — ${lessons.length} lessons; ${summarize(lessons, loveQuestions)}`);
}
