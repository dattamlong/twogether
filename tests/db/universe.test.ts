import { describe, expect, it } from "vitest";
import { admin, answerKey, createCouple, createUser, errorMessage, expectOk, playLesson, type TestUser } from "./helpers";

type Node = { kind: string; lessonId?: string; completed: boolean; unlocked: boolean };
type Unit = { id: string; unlocked: boolean; stars: number; bossCleared: boolean; reviewDone: boolean; nodes: Node[]; status: string };

async function map(user: TestUser, subject: string, level: string) {
  return expectOk(await user.client.rpc("get_adventure_map", { subject, map_level: level })) as unknown as { units: Unit[]; current: { unitId: string; nodeIndex: number } | null };
}

async function answerSession(user: TestUser, sessionId: string, questions: { id: string }[], correct: (i: number) => boolean) {
  for (const [i, q] of questions.entries()) {
    const key = (await answerKey(q.id)).answers as string[];
    expectOk(await user.client.rpc("submit_answer", { question: q.id, answer: correct(i) ? key[0] : "definitely wrong", game_session: sessionId }));
  }
}

async function finishLesson(user: TestUser, lessonId: string) {
  const { attempt } = await playLesson(user, lessonId, 100);
  return expectOk(await user.client.rpc("complete_lesson", { lesson_attempt: attempt }));
}

describe("Learning Universe", () => {
  it("lists seven worlds and only marks real content as available", async () => {
    const user = await createUser();
    const worlds = expectOk(await user.client.rpc("get_learning_universe")) as unknown as { id: string; status: string; lessonsTotal: number }[];
    expect(worlds.map((w) => w.id)).toEqual(["english", "chinese", "brain", "explorer", "science", "money", "tech"]);
    for (const w of worlds) {
      if (["science", "money", "tech"].includes(w.id)) expect(w).toMatchObject({ status: "coming_soon", lessonsTotal: 0 });
      else expect(w.lessonsTotal).toBeGreaterThan(0);
    }
  });

  it("plays the full English A1 loop: lessons unlock in order, review, boss, rewards, next unit", async () => {
    const user = await createUser();
    let m = await map(user, "english", "A1");
    const [u1, u2] = m.units;
    expect(u1.unlocked).toBe(true);
    expect(u2.unlocked).toBe(false);
    expect(u1.nodes.map((n) => n.unlocked)).toEqual([true, false, false, false, false, false, false]);
    expect(m.current).toEqual({ unitId: u1.id, nodeIndex: 0 });
    expect(errorMessage(await user.client.rpc("start_unit_challenge", { target_unit: u1.id, mode: "boss" }))).toBe("boss_locked");

    await finishLesson(user, u1.nodes[0].lessonId!);
    m = await map(user, "english", "A1");
    expect(m.units[0].nodes[1].unlocked).toBe(true);
    expect(m.current?.nodeIndex).toBe(1);

    for (const node of u1.nodes.slice(1).filter((n) => n.kind === "lesson")) await finishLesson(user, node.lessonId!);
    expect(errorMessage(await user.client.rpc("start_unit_challenge", { target_unit: u1.id, mode: "boss" }))).toBe("boss_locked");

    const review = expectOk(await user.client.rpc("start_unit_challenge", { target_unit: u1.id, mode: "review" })) as unknown as { sessionId: string; questions: { id: string }[] };
    expect(errorMessage(await user.client.rpc("finish_unit_challenge", { game_session: review.sessionId }))).toBe("challenge_incomplete");
    await answerSession(user, review.sessionId, review.questions, () => true);
    expectOk(await user.client.rpc("finish_unit_challenge", { game_session: review.sessionId }));

    const boss = expectOk(await user.client.rpc("start_unit_challenge", { target_unit: u1.id, mode: "boss" })) as unknown as { sessionId: string; questions: { id: string }[] };
    expect(boss.questions).toHaveLength(8);
    await answerSession(user, boss.sessionId, boss.questions, (i) => i !== 7);
    const failed = expectOk(await user.client.rpc("finish_unit_challenge", { game_session: boss.sessionId })) as Record<string, unknown>;
    expect(failed).toMatchObject({ pct: 87, stars: 1, firstClear: true, rewardItemId: "magic_bookshelf" });

    const coinsAfterClear = expectOk(await admin().from("user_progress").select("coins").eq("user_id", user.id).single()).coins;
    const again = expectOk(await user.client.rpc("start_unit_challenge", { target_unit: u1.id, mode: "boss" })) as unknown as { sessionId: string; questions: { id: string }[] };
    await answerSession(user, again.sessionId, again.questions, () => true);
    const perfect = expectOk(await user.client.rpc("finish_unit_challenge", { game_session: again.sessionId })) as Record<string, unknown>;
    expect(perfect).toMatchObject({ stars: 3, firstClear: false, bestStars: 3, coins: 20 });
    const bossLedger = expectOk(await admin().from("currency_transactions").select("amount").eq("user_id", user.id).eq("reason", "boss").eq("ref_id", again.sessionId).single());
    expect(bossLedger.amount).toBe(20);
    expect(expectOk(await admin().from("user_progress").select("coins").eq("user_id", user.id).single()).coins).toBeGreaterThanOrEqual(coinsAfterClear + 20);

    m = await map(user, "english", "A1");
    expect(m.units[0]).toMatchObject({ bossCleared: true, stars: 3, reviewDone: true });
    expect(m.units[1].unlocked).toBe(true);
    expect(m.current?.unitId).toBe(m.units[1].id);
    const items = expectOk(await admin().from("inventories").select("item_id").eq("user_id", user.id));
    expect(items.map((i) => i.item_id).filter((i) => i === "magic_bookshelf")).toHaveLength(1);
  });

  it("does not unlock planned units or reward an unfinished boss", async () => {
    const user = await createUser();
    const m = await map(user, "brain", "L1");
    expect(m.units.find((u) => u.status === "planned")!.unlocked).toBe(false);
    expect(errorMessage(await user.client.rpc("start_unit_challenge", { target_unit: "brain-l1-u2", mode: "review" }))).toBe("unit_not_available");
  });

  it("recommends a starting level from the placement test without polluting reviews", async () => {
    const user = await createUser();
    const test = expectOk(await user.client.rpc("start_placement", { subject: "english" })) as unknown as { sessionId: string; questions: { id: string; level: string }[] };
    const levels = [...new Set(test.questions.map((q) => q.level))];
    expect(levels).toEqual(["A1", "A2", "B1", "B2"]);
    await answerSession(user, test.sessionId, test.questions, (i) => ["A1", "A2"].includes(test.questions[i].level));
    const result = expectOk(await user.client.rpc("finish_placement", { game_session: test.sessionId })) as Record<string, unknown>;
    expect(result.recommendedLevel).toBe("B1");
    expect(expectOk(await user.client.from("review_progress").select("question_id"))).toHaveLength(0);
    expect(errorMessage(await user.client.rpc("start_placement", { subject: "brain" }))).toBe("placement_not_available");
  });

  it("includes other worlds in Smart Review for every learner", async () => {
    const user = await createUser();
    await playLesson(user, "brain-l1-patterns", 0);
    const queue = expectOk(await user.client.rpc("get_review_queue", { max_items: 30 }));
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((q) => q.subject_id === "brain")).toBe(true);
  });

  it("completes The Lost Love Letter when both partners finish their parts", async () => {
    const { a, b, coupleId } = await createCouple();
    const before = expectOk(await a.client.rpc("get_couple_adventures")) as unknown as { id: string; letter: string | null; completed: boolean }[];
    expect(before[0]).toMatchObject({ id: "lost_love_letter", completed: false, letter: null });

    for (const user of [a, b]) {
      const part = expectOk(await user.client.rpc("start_adventure_part", { adventure: "lost_love_letter" })) as unknown as { sessionId: string; questions: { id: string }[] };
      await answerSession(user, part.sessionId, part.questions, (i) => i < 4);
      const result = expectOk(await user.client.rpc("finish_adventure_part", { game_session: part.sessionId })) as Record<string, unknown>;
      expect(result.passed).toBe(true);
      expect(result.adventureCompleted).toBe(user === b);
    }
    const after = expectOk(await b.client.rpc("get_couple_adventures")) as unknown as { completed: boolean; letter: string | null }[];
    expect(after[0].completed).toBe(true);
    expect(after[0].letter).toMatch(/one lesson at a time/);
    const box = expectOk(await admin().from("inventories").select("item_id").eq("couple_id", coupleId).eq("item_id", "love_letter_box"));
    expect(box).toHaveLength(1);
    expect(errorMessage(await a.client.rpc("start_adventure_part", { adventure: "lost_love_letter" }))).toBe("adventure_completed");
  });

  it("feeds unit challenges into Love Legends", async () => {
    const { a, coupleId } = await createCouple();
    await finishLesson(a, "brain-l1-patterns");
    const week = expectOk(await admin().rpc("legend_week_start"));
    const score = expectOk(await admin().from("leaderboard_scores").select("score").eq("couple_id", coupleId).eq("week_start", week).single());
    expect(score.score).toBeGreaterThan(0);
  });
});
