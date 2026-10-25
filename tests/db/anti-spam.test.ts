import { describe, expect, it } from "vitest";
import { admin, answerKey, createCouple, expectOk, playLesson, type TestUser } from "./helpers";

const db = () => admin();

async function weeklyScore(coupleId: string) {
  const week = expectOk(await db().rpc("legend_week_start"));
  const { data } = await db().from("leaderboard_scores").select("score").eq("couple_id", coupleId).eq("week_start", week).maybeSingle();
  return data?.score ?? 0;
}

async function rushLesson(user: TestUser, lessonId: string) {
  const attempt = expectOk(await user.client.rpc("start_lesson", { target_lesson: lessonId }));
  const questions = expectOk(await user.client.from("question_cards").select("id").eq("lesson_id", lessonId).order("position"));
  for (const q of questions) {
    const key = await answerKey(q.id!);
    expectOk(await user.client.rpc("submit_answer", { question: q.id!, answer: (key.answers as string[])[0], lesson_attempt: attempt }));
  }
  return expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: attempt })) as Record<string, number>;
}

async function finish(user: TestUser, lessonId: string) {
  const { attempt } = await playLesson(user, lessonId, 100);
  return expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: attempt })) as Record<string, number>;
}

describe("Love Legends anti-spam", () => {
  it("only counts the first completion of a lesson, while replays still earn XP", async () => {
    const { a, coupleId } = await createCouple();
    const first = await finish(a, "grammar-a1-articles");
    expect(await weeklyScore(coupleId)).toBe(first.xp);
    const replay = await finish(a, "grammar-a1-articles");
    expect(replay.xp).toBeGreaterThan(0);
    expect(await weeklyScore(coupleId)).toBe(first.xp);
  });

  it("gives no ranking points for a lesson finished faster than a human can", async () => {
    const { a, coupleId } = await createCouple();
    const rushed = await rushLesson(a, "grammar-a1-articles");
    expect(rushed.xp).toBeGreaterThan(0);
    expect(await weeklyScore(coupleId)).toBe(0);
    await finish(a, "brain-l1-patterns");
    expect(await weeklyScore(coupleId)).toBeGreaterThan(0);
  });

  it("stops counting learning points after 30 rewards in an hour", async () => {
    const { a, coupleId } = await createCouple();
    const week = expectOk(await db().rpc("legend_week_start"));
    const day = new Date().toISOString().slice(0, 10);
    expectOk(await db().from("leaderboard_point_events").insert(
      Array.from({ length: 30 }, (_, i) => ({ couple_id: coupleId, user_id: a.id, week_start: week, day, points: 1, source: "learning", ref: `lesson:burst-${i}:${a.id}` })),
    ).select("id"));
    await finish(a, "grammar-a1-articles");
    expect(await weeklyScore(coupleId)).toBe(0);
    await db().rpc("grant_reward", { uid: a.id, add_xp: 25, add_coins: 0, reason: "daily_quest", ref: "quest-after-burst" });
    expect(await weeklyScore(coupleId)).toBe(25);
  });
});
