import { describe, expect, it } from "vitest";
import { levelForXp, totalXpForLevel } from "@/features/progression/xp";
import { admin, createCouple, createUser, errorMessage, expectOk, playLesson } from "./helpers";

const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
};

describe("XP formula parity", () => {
  it("matches the TypeScript formula", async () => {
    const db = admin();
    for (const xp of [0, 99, 100, 249, 250, 700, 5000, 123456]) {
      expect(expectOk(await db.rpc("level_for_xp", { total_xp: xp }))).toBe(levelForXp(xp));
      expect(expectOk(await db.rpc("level_for_xp", { total_xp: xp, multiplier: 2 }))).toBe(levelForXp(xp, 2));
    }
    for (const level of [1, 2, 5, 12]) {
      expect(expectOk(await db.rpc("total_xp_for_level", { target_level: level }))).toBe(totalXpForLevel(level));
    }
  });
});

describe("daily quests", () => {
  it("tracks progress, validates and pays out exactly once", async () => {
    const user = await createUser();
    const quests = expectOk(await user.client.rpc("get_daily_quests"));
    expect(quests.map((q) => q.slot)).toEqual(["learn", "lesson", "review", "play", "explore"]);

    const quest = quests.find((q) => q.slot === "review")!;
    const def = expectOk(await admin().from("daily_quests").select("event, category, target").eq("id", quest.id).single());
    expect(errorMessage(await user.client.rpc("claim_daily_quest", { quest: quest.id }))).toBe("quest_not_complete");

    for (let i = 0; i < def.target; i++) {
      expectOk(await admin().rpc("emit_event", { uid: user.id, event_name: def.event, event_category: "grammar", amount: 1 }));
    }
    const after = expectOk(await user.client.rpc("get_daily_quests")).find((q) => q.id === quest.id)!;
    expect(after).toMatchObject({ completed: true, claimed: false, progress: def.target });

    const claim = expectOk(await user.client.rpc("claim_daily_quest", { quest: quest.id })) as Record<string, number>;
    expect(claim.xp).toBe(quest.xp_reward);
    expect(claim.balance).toBe(quest.coin_reward);
    expect(errorMessage(await user.client.rpc("claim_daily_quest", { quest: quest.id }))).toBe("already_claimed");
  });

  it("rejects quests that are not active today", async () => {
    const user = await createUser();
    const active = new Set(expectOk(await user.client.rpc("get_daily_quests")).map((q) => q.id));
    const all = expectOk(await user.client.from("daily_quests").select("id"));
    const inactive = all.find((q) => !active.has(q.id))!;
    expect(errorMessage(await user.client.rpc("claim_daily_quest", { quest: inactive.id }))).toBe("quest_not_active_today");
  });
});

describe("streaks", () => {
  const streakOf = async (userId: string) =>
    expectOk(await admin().from("streaks").select("current, longest, freezes, last_active_date").eq("subject_type", "user").eq("subject_id", userId).single());

  it("starts, continues, uses a freeze for one missed day, and resets after a long gap", async () => {
    const user = await createUser();
    const db = admin();

    await db.rpc("record_qualifying_activity", { uid: user.id });
    expect(await streakOf(user.id)).toMatchObject({ current: 1, freezes: 1 });

    await db.rpc("record_qualifying_activity", { uid: user.id });
    expect((await streakOf(user.id)).current).toBe(1);

    await db.from("streaks").update({ current: 4, last_active_date: daysAgo(1) }).eq("subject_id", user.id);
    await db.rpc("record_qualifying_activity", { uid: user.id });
    expect((await streakOf(user.id)).current).toBe(5);

    await db.from("streaks").update({ current: 5, last_active_date: daysAgo(2), freezes: 1 }).eq("subject_id", user.id);
    await db.rpc("record_qualifying_activity", { uid: user.id });
    expect(await streakOf(user.id)).toMatchObject({ current: 6, freezes: 0 });

    await db.from("streaks").update({ last_active_date: daysAgo(3), freezes: 1 }).eq("subject_id", user.id);
    await db.rpc("record_qualifying_activity", { uid: user.id });
    expect(await streakOf(user.id)).toMatchObject({ current: 1, longest: 6 });
  });

  it("unlocks a milestone achievement and earns a freeze at 7 days", async () => {
    const user = await createUser();
    const db = admin();
    await db.from("streaks").update({ current: 6, longest: 6, last_active_date: daysAgo(1), freezes: 0 }).eq("subject_id", user.id);
    await db.rpc("record_qualifying_activity", { uid: user.id });
    expect(await streakOf(user.id)).toMatchObject({ current: 7, freezes: 1 });
    const unlocked = expectOk(await user.client.from("user_achievements").select("achievement_id"));
    expect(unlocked.map((u) => u.achievement_id)).toContain("streak_7");
    const lamp = expectOk(await user.client.from("inventories").select("item_id").eq("user_id", user.id));
    expect(lamp.map((i) => i.item_id)).toContain("golden_lamp");
  });

  it("counts a couple day only when both partners learn", async () => {
    const { a, b, coupleId } = await createCouple();
    const db = admin();
    const coupleStreak = async () =>
      expectOk(await db.from("streaks").select("current").eq("subject_type", "couple").eq("subject_id", coupleId).single()).current;

    await db.rpc("record_qualifying_activity", { uid: a.id });
    expect(await coupleStreak()).toBe(0);
    await db.rpc("record_qualifying_activity", { uid: b.id });
    expect(await coupleStreak()).toBe(1);
    await db.rpc("record_qualifying_activity", { uid: b.id });
    expect(await coupleStreak()).toBe(1);
  });
});

describe("couple quests", () => {
  it("completes Study Together when each partner finishes a lesson, paying both", async () => {
    const { a, b, coupleId } = await createCouple();
    const first = await playLesson(a, "grammar-a1-articles", 10);
    expectOk(await a.client.rpc("complete_lesson", { lesson_attempt: first.attempt }));
    let quest = expectOk(await a.client.rpc("get_couple_quests")).find((q) => q.id === "study_together")!;
    expect(quest.completed).toBe(false);

    const second = await playLesson(b, "grammar-a1-articles", 10);
    expectOk(await b.client.rpc("complete_lesson", { lesson_attempt: second.attempt }));
    quest = expectOk(await b.client.rpc("get_couple_quests")).find((q) => q.id === "study_together")!;
    expect(quest.completed).toBe(true);

    const sameDay = expectOk(await b.client.rpc("get_couple_quests")).find((q) => q.id === "perfect_study_date")!;
    expect(sameDay.completed).toBe(true);

    const progress = expectOk(await a.client.from("couple_progress").select("love_energy, xp").eq("couple_id", coupleId).single());
    expect(progress.love_energy).toBe(15 + 25);
    const memories = expectOk(await a.client.from("memories").select("kind, title").eq("kind", "quest"));
    expect(memories.map((m) => m.title).sort()).toEqual(["Perfect Study Date", "Study Together"]);
  });
});
