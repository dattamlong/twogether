import { describe, expect, it } from "vitest";
import { lessonRewards } from "@/features/progression/xp";
import { admin, answerKey, createUser, errorMessage, expectOk, playLesson } from "./helpers";

const LESSON = "grammar-a1-articles";

describe("learning engine", () => {
  it("never exposes answers to clients", async () => {
    const user = await createUser();
    const direct = await user.client.from("lesson_questions").select("answers").limit(1);
    expect(direct.error).not.toBeNull();
    const cards = expectOk(await user.client.from("question_cards").select("*").eq("lesson_id", LESSON).limit(1));
    expect(cards[0]).not.toHaveProperty("answers");
    expect(cards[0]).not.toHaveProperty("explanation");
  });

  it("validates answers server-side and returns feedback", async () => {
    const user = await createUser();
    const attempt = expectOk(await user.client.rpc("start_lesson", { target_lesson: LESSON }));
    const [card] = expectOk(await user.client.from("question_cards").select("id").eq("lesson_id", LESSON).order("position").limit(1));
    const key = await answerKey(card.id!);

    const wrong = expectOk(await user.client.rpc("submit_answer", { question: card.id!, answer: "nope", lesson_attempt: attempt })) as Record<string, unknown>;
    expect(wrong.correct).toBe(false);
    expect(wrong.correctAnswer).toBe((key.answers as string[])[0]);
    expect(wrong.explanation).toBeTruthy();
    expect(wrong.explanationVi).toBeTruthy();

    const retry = expectOk(
      await user.client.rpc("submit_answer", { question: card.id!, answer: `  ${(key.answers as string[])[0]} `, lesson_attempt: attempt }),
    ) as Record<string, unknown>;
    expect(retry.correct).toBe(true);
    expect(retry.attemptNo).toBe(2);
  });

  it("awards XP and coins for a completed lesson, scoring first tries only", async () => {
    const user = await createUser();
    const { attempt, total } = await playLesson(user, LESSON, 7);
    const result = expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: attempt })) as Record<string, number | boolean>;
    const expected = lessonRewards(7, true);
    const firstLessonBonus = 20;

    expect(result.correct).toBe(7);
    expect(result.total).toBe(total);
    expect(result.xp).toBe(expected.xp);
    expect(result.coins).toBe(expected.coins);

    const progress = expectOk(await user.client.from("user_progress").select("*").eq("user_id", user.id).single());
    expect(progress.xp).toBe(expected.xp);
    expect(progress.coins).toBe(expected.coins + firstLessonBonus);
    expect(progress.lessons_completed).toBe(1);

    expect(errorMessage(await user.client.rpc("complete_lesson", { lesson_attempt: attempt }))).toBe("already_completed");

    const replay = await playLesson(user, LESSON, 10);
    const second = expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: replay.attempt })) as Record<string, number>;
    expect(second.xp).toBe(lessonRewards(10, false).xp);
    expect(second.coins).toBe(lessonRewards(10, false).coins);
  });

  it("refuses to complete a lesson with unanswered questions", async () => {
    const user = await createUser();
    const attempt = expectOk(await user.client.rpc("start_lesson", { target_lesson: LESSON }));
    expect(errorMessage(await user.client.rpc("complete_lesson", { lesson_attempt: attempt }))).toBe("lesson_incomplete");
  });

  it("rejects answers to another user's attempt or another lesson's question", async () => {
    const owner = await createUser();
    const other = await createUser();
    const attempt = expectOk(await owner.client.rpc("start_lesson", { target_lesson: LESSON }));
    const [card] = expectOk(await owner.client.from("question_cards").select("id").eq("lesson_id", LESSON).limit(1));
    expect(errorMessage(await other.client.rpc("submit_answer", { question: card.id!, answer: "a", lesson_attempt: attempt }))).toBe(
      "invalid_lesson_attempt",
    );
    const [foreign] = expectOk(await owner.client.from("question_cards").select("id").neq("lesson_id", LESSON).limit(1));
    expect(errorMessage(await owner.client.rpc("submit_answer", { question: foreign.id!, answer: "a", lesson_attempt: attempt }))).toBe(
      "invalid_lesson_attempt",
    );
  });

  it("schedules spaced repetition and serves due items for review", async () => {
    const user = await createUser();
    await playLesson(user, LESSON, 5);
    const progress = expectOk(await user.client.from("review_progress").select("*").order("question_id"));
    expect(progress).toHaveLength(10);
    const wrongOnes = progress.filter((p) => p.box === 0);
    expect(wrongOnes).toHaveLength(5);
    for (const right of progress.filter((p) => p.box === 1)) {
      expect(new Date(right.next_review_at).getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    }

    const queue = expectOk(await user.client.rpc("get_review_queue", { max_items: 20 }));
    expect(new Set(queue.map((q) => q.id))).toEqual(new Set(wrongOnes.map((p) => p.question_id)));

    const target = wrongOnes[0].question_id;
    const key = await answerKey(target);
    const reviewed = expectOk(await user.client.rpc("submit_answer", { question: target, answer: (key.answers as string[])[0], review: true })) as Record<string, unknown>;
    expect(reviewed.correct).toBe(true);
    const after = expectOk(await user.client.from("review_progress").select("box").eq("question_id", target).single());
    expect(after.box).toBe(1);

    const retry = expectOk(await user.client.rpc("submit_answer", { question: target, answer: (key.answers as string[])[0], review: true })) as Record<string, unknown>;
    expect(retry.attemptNo).toBe(2);
    const unchanged = expectOk(await user.client.from("review_progress").select("box, review_count").eq("question_id", target).single());
    expect(unchanged.box).toBe(1);
  });

  it("validates sentence puzzles against every accepted order", async () => {
    const user = await createUser();
    const game = expectOk(await user.client.rpc("start_game", { game: "sentence_puzzle" })) as {
      sessionId: string;
      questions: { id: string; tokens: string[] }[];
    };
    expect(game.questions.length).toBe(5);
    expect(game.questions[0]).not.toHaveProperty("answers");

    for (const q of game.questions) {
      const key = await answerKey(q.id);
      const result = expectOk(
        await user.client.rpc("submit_answer", { question: q.id, answer: (key.answers as string[]).at(-1)!, game_session: game.sessionId }),
      ) as Record<string, unknown>;
      expect(result.correct).toBe(true);
    }
    const finished = expectOk(await user.client.rpc("finish_game", { game_session: game.sessionId })) as Record<string, unknown>;
    expect(finished.won).toBe(true);
    expect(finished.solved).toBe(5);
    expect(errorMessage(await user.client.rpc("finish_game", { game_session: game.sessionId }))).toBe("already_completed");
  });

  it("decides Word Battle wins on the server", async () => {
    const user = await createUser();
    const game = expectOk(await user.client.rpc("start_game", { game: "word_battle" })) as { sessionId: string; questions: { id: string }[] };
    for (const q of game.questions.slice(0, 4)) {
      const key = await answerKey(q.id);
      await user.client.rpc("submit_answer", { question: q.id, answer: (key.answers as string[])[0], game_session: game.sessionId });
    }
    const lost = expectOk(await user.client.rpc("finish_game", { game_session: game.sessionId })) as Record<string, unknown>;
    expect(lost.won).toBe(false);
    const stats = expectOk(await admin().from("user_progress").select("games_won").eq("user_id", user.id).single());
    expect(stats.games_won).toBe(0);
  });
});
