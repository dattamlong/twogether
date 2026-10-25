import { describe, expect, it } from "vitest";
import { admin, answerKey, createCouple, expectOk, playLesson, type TestUser } from "./helpers";

const RETIRED = ["boss_attempt_1", "minigame_1", "battle_win_1", "puzzle_3"];

async function finishLesson(user: TestUser, lessonId: string) {
  const { attempt } = await playLesson(user, lessonId, 100);
  return expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: attempt }));
}

async function quests(user: TestUser) {
  return expectOk(await user.client.rpc("get_daily_quests"));
}

async function mapLesson() {
  return expectOk(await admin().from("unit_lessons").select("lesson_id").eq("unit_id", "en-a1-u1").eq("position", 1).single()).lesson_id;
}

describe("refreshed daily quests", () => {
  it("never rotates retired quests in and always offers the together quest", async () => {
    for (let i = 0; i < 30; i++) {
      const day = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
      const picked = expectOk(await admin().rpc("quests_for_day", { target_day: day }));
      expect(picked.map((q) => q.slot)).toEqual(["together", "learn", "lesson", "review", "play", "explore"]);
      expect(picked.some((q) => RETIRED.includes(q.id))).toBe(false);
      expect(picked[0].id).toBe("together_lesson_1");
    }
  });

  it("completes the together quest for both partners only once each has finished a lesson", async () => {
    const { a, b } = await createCouple();
    const lesson = await mapLesson();
    await finishLesson(a, lesson);
    for (const user of [a, b]) {
      const together = (await quests(user)).find((q) => q.id === "together_lesson_1")!;
      expect(together).toMatchObject({ progress: 0, completed: false });
    }
    await finishLesson(b, lesson);
    for (const user of [a, b]) {
      const together = (await quests(user)).find((q) => q.id === "together_lesson_1")!;
      expect(together).toMatchObject({ progress: 1, completed: true });
    }
  });

  it("counts Adventure Map lessons for the map quests", async () => {
    const { a } = await createCouple();
    await finishLesson(a, await mapLesson());
    const today = await quests(a);
    for (const id of ["map_lessons_2", "map_step_1"]) {
      const q = today.find((x) => x.id === id);
      if (q) expect(q.progress).toBe(1);
    }
  });

  it("counts a finished adventure part for the adventure quest", async () => {
    const { a } = await createCouple();
    const part = expectOk(await a.client.rpc("start_adventure_part", { adventure: "lost_love_letter" })) as unknown as { sessionId: string; questions: { id: string }[] };
    for (const q of part.questions) {
      const key = (await answerKey(q.id)).answers as string[];
      expectOk(await a.client.rpc("submit_answer", { question: q.id, answer: key[0], game_session: part.sessionId }));
    }
    expectOk(await a.client.rpc("finish_adventure_part", { game_session: part.sessionId }));
    const adventure = (await quests(a)).find((q) => q.id === "adventure_part_1");
    if (adventure) expect(adventure).toMatchObject({ progress: 1, completed: true });
    const progress = expectOk(await admin().from("user_quest_progress").select("quest_id").eq("user_id", a.id));
    expect(progress.some((p) => RETIRED.includes(p.quest_id))).toBe(false);
  });
});
