import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHOP_ITEMS } from "../src/content/catalog";
import { curriculumFile, lessonFile, loveQuestionFile, type CurriculumFile, type Lesson, type LoveQuestion } from "../src/content/schema";

export const CONTENT_DIR = join(import.meta.dirname, "..", "src", "content", "data");
export const CURRICULUM_DIR = join(import.meta.dirname, "..", "src", "content", "curriculum");

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
      if (q.kind === "multiple_choice" && q.word) claim(seenWords, `${lesson.language}:${q.word.term.toLowerCase()}`, "vocabulary word");
      if (q.kind === "multiple_choice" && q.word && (lesson.language === "zh") !== Boolean(q.word.pinyin)) {
        errors.push(`${q.id}: ${lesson.language === "zh" ? "Chinese word cards need pinyin" : "English word cards need ipa"}`);
      }
      if (lesson.category === "vocabulary" && q.kind === "multiple_choice" && !q.word) {
        errors.push(`${q.id}: vocabulary questions need a word card`);
      }
    }
  }
  for (const lq of loveQuestions) claim(seenIds, lq.id, "love question id");

  const curricula: CurriculumFile[] = [];
  const lessonBySlug = new Map(lessons.map((l) => [l.slug, l]));
  const assigned = new Map<string, string>();
  const unitIds = new Set<string>();
  for (const file of readdirSync(CURRICULUM_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const parsed = curriculumFile.safeParse(JSON.parse(readFileSync(join(CURRICULUM_DIR, file), "utf8")));
    if (!parsed.success) {
      errors.push(`curriculum/${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    curricula.push(parsed.data);
    for (const level of parsed.data.levels) {
      let seenPlanned = false;
      for (const unit of level.units) {
        claim(unitIds, unit.id, "unit id");
        if (unit.status === "planned") {
          seenPlanned = true;
          if (unit.lessons.length) errors.push(`${unit.id}: planned units cannot list lessons`);
          continue;
        }
        if (seenPlanned) errors.push(`${unit.id}: available unit follows a planned unit in ${level.level}`);
        if (unit.lessons.length < 2) errors.push(`${unit.id}: available units need at least 2 lessons`);
        if (!unit.boss) errors.push(`${unit.id}: available units need a boss`);
        let pooled = 0;
        for (const slug of unit.lessons) {
          const lesson = lessonBySlug.get(slug);
          if (!lesson) {
            errors.push(`${unit.id}: unknown lesson ${slug}`);
            continue;
          }
          if (lesson.subject !== parsed.data.subject || lesson.level !== level.level) {
            errors.push(`${unit.id}: lesson ${slug} is ${lesson.subject}/${lesson.level}, expected ${parsed.data.subject}/${level.level}`);
          }
          if (assigned.has(slug)) errors.push(`${slug}: in both ${assigned.get(slug)} and ${unit.id}`);
          assigned.set(slug, unit.id);
          pooled += lesson.questions.length;
        }
        if (unit.boss && unit.boss.questions > pooled) errors.push(`${unit.id}: boss needs ${unit.boss.questions} questions but unit has ${pooled}`);
        if (unit.reward_item) {
          const item = SHOP_ITEMS.find((i) => i.id === unit.reward_item);
          if (!item) errors.push(`${unit.id}: unknown reward item ${unit.reward_item}`);
          else if (item.shop_visible) errors.push(`${unit.id}: reward item ${unit.reward_item} must not be sold in the shop`);
        }
      }
    }
  }
  const unassigned = lessons.filter((l) => !assigned.has(l.slug)).map((l) => l.slug);

  return { lessons, loveQuestions, curricula, unassigned, errors };
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
  const { curricula, unassigned } = loadContent();
  const units = curricula.flatMap((c) => c.levels.flatMap((l) => l.units));
  console.log(`OK — ${lessons.length} lessons; ${summarize(lessons, loveQuestions)}`);
  console.log(`Curriculum — ${curricula.length} worlds, ${units.filter((u) => u.status === "available").length} playable units, ${units.filter((u) => u.status === "planned").length} planned units`);
  if (unassigned.length) console.log(`Free-learning only (not in a unit): ${unassigned.join(", ")}`);
}
