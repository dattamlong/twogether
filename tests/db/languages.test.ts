import { describe, expect, it } from "vitest";
import { admin, createUser, expectOk, playLesson } from "./helpers";

async function chineseLesson(category: string) {
  const { data, error } = await admin().from("lessons").select("id, level").eq("language", "zh").eq("category_id", category).order("sort_order").limit(1).single();
  if (error) throw error;
  return data;
}

describe("multiple study languages", () => {
  it("stores the learner's language and validates HSK levels", async () => {
    const user = await createUser();
    expectOk(await user.client.from("profiles").update({ learning_language: "zh", chinese_level: 3 }).eq("id", user.id));
    const profile = expectOk(await user.client.from("profiles").select("learning_language, chinese_level").eq("id", user.id).single());
    expect(profile).toEqual({ learning_language: "zh", chinese_level: 3 });

    const invalidLevel = await user.client.from("profiles").update({ chinese_level: 10 }).eq("id", user.id);
    expect(invalidLevel.error).not.toBeNull();
    const invalidLanguage = await user.client.from("profiles").update({ learning_language: "fr" }).eq("id", user.id);
    expect(invalidLanguage.error).not.toBeNull();
  });

  it("serves mini-game questions in the learner's language", async () => {
    const user = await createUser();
    const english = expectOk(await user.client.rpc("start_game", { game: "word_battle" })) as { questions: { language: string }[] };
    expect(new Set(english.questions.map((q) => q.language))).toEqual(new Set(["en"]));

    expectOk(await user.client.from("profiles").update({ learning_language: "zh" }).eq("id", user.id));
    const battle = expectOk(await user.client.rpc("start_game", { game: "word_battle" })) as { questions: { language: string }[] };
    expect(battle.questions.length).toBeGreaterThan(0);
    expect(new Set(battle.questions.map((q) => q.language))).toEqual(new Set(["zh"]));

    const puzzle = expectOk(await user.client.rpc("start_game", { game: "sentence_puzzle" })) as { questions: { language: string }[] };
    expect(new Set(puzzle.questions.map((q) => q.language))).toEqual(new Set(["zh"]));
  });

  it("keeps reviews and the word bank separate per language", async () => {
    const user = await createUser();
    await playLesson(user, "grammar-a1-articles", 0);
    expect(expectOk(await user.client.rpc("get_review_queue", { max_items: 30 })).length).toBeGreaterThan(0);

    expectOk(await user.client.from("profiles").update({ learning_language: "zh" }).eq("id", user.id));
    expect(expectOk(await user.client.rpc("get_review_queue", { max_items: 30 }))).toHaveLength(0);

    const vocab = await chineseLesson("vocabulary");
    await playLesson(user, vocab.id, 10);
    const bank = expectOk(await user.client.rpc("get_word_bank"));
    expect(bank.length).toBe(10);
    expect(bank.every((w) => w.language === "zh" && typeof (w.word as { pinyin?: string }).pinyin === "string")).toBe(true);
  });

  it("checks Chinese sentence puzzles that are written without spaces in the UI", async () => {
    const user = await createUser();
    const puzzle = await chineseLesson("writing");
    const { attempt } = await playLesson(user, puzzle.id, 10);
    const result = expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: attempt })) as Record<string, number>;
    expect(result.correct).toBe(result.total);
  });
});
