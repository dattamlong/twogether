import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, createCouple, createUser, errorMessage, expectOk, giveCoins, playLesson } from "./helpers";

const db = () => admin();

async function weeklyScore(coupleId: string) {
  const week = expectOk(await db().rpc("legend_week_start"));
  const { data } = await db().from("leaderboard_scores").select("score, member_points").eq("couple_id", coupleId).eq("week_start", week).maybeSingle();
  return data ?? { score: 0, member_points: {} };
}

async function publicCouple() {
  const couple = await createCouple();
  expectOk(await couple.a.client.rpc("set_legend_visibility", { make_public: true }));
  return couple;
}

describe("Love Legends scoring", () => {
  it("turns validated learning XP into weekly points for the couple, per member", async () => {
    const { a, coupleId } = await createCouple();
    const { attempt } = await playLesson(a, "grammar-a1-articles", 10);
    const result = expectOk(await a.client.rpc("complete_lesson", { lesson_attempt: attempt })) as Record<string, number>;
    const score = await weeklyScore(coupleId);
    expect(score.score).toBe(result.xp);
    expect((score.member_points as Record<string, number>)[a.id]).toBe(result.xp);
  });

  it("never awards points for purchases or coin-only rewards", async () => {
    const { a, coupleId } = await createCouple();
    await giveCoins(a.id, 500);
    expectOk(await a.client.rpc("purchase_item", { item: "armchair", request_id: randomUUID() }));
    expect((await weeklyScore(coupleId)).score).toBe(0);
  });

  it("caps learning points per member per day to discourage grinding", async () => {
    const { a, b, coupleId } = await createCouple();
    await db().rpc("grant_reward", { uid: a.id, add_xp: 350, add_coins: 0, reason: "lesson", ref: randomUUID() });
    await db().rpc("grant_reward", { uid: a.id, add_xp: 350, add_coins: 0, reason: "word_battle", ref: randomUUID() });
    await db().rpc("grant_reward", { uid: a.id, add_xp: 100, add_coins: 0, reason: "lesson", ref: randomUUID() });
    expect((await weeklyScore(coupleId)).score).toBe(400);
    await db().rpc("grant_reward", { uid: b.id, add_xp: 50, add_coins: 0, reason: "lesson", ref: randomUUID() });
    const score = await weeklyScore(coupleId);
    expect(score.score).toBe(450);
    expect(score.member_points).toEqual({ [a.id]: 400, [b.id]: 50 });
  });

  it("adds a cooperative bonus once per day when both partners learn", async () => {
    const { a, b, coupleId } = await createCouple();
    await db().rpc("record_qualifying_activity", { uid: a.id });
    expect((await weeklyScore(coupleId)).score).toBe(0);
    await db().rpc("record_qualifying_activity", { uid: b.id });
    await db().rpc("record_qualifying_activity", { uid: b.id });
    expect((await weeklyScore(coupleId)).score).toBe(30);
  });

  it("does not let clients write scores or run ranking internals", async () => {
    const { a, coupleId } = await createCouple();
    const week = expectOk(await db().rpc("legend_week_start"));
    const write = await a.client.from("leaderboard_scores").insert({ couple_id: coupleId, week_start: week, score: 99999 });
    expect(write.error).not.toBeNull();
    const internal = await a.client.rpc("add_ranking_points", { cid: coupleId, uid: a.id, add_points: 9999, point_source: "learning", point_ref: "x" });
    expect(internal.error).not.toBeNull();
    const finalize = await a.client.rpc("finalize_legend_week", { week: "2024-01-01" });
    expect(finalize.error).not.toBeNull();
    expect((await weeklyScore(coupleId)).score).toBe(0);
  });

  it("raises the permanent tier and unlocks its reward", async () => {
    const { a, coupleId } = await createCouple();
    for (let i = 0; i < 2; i++) await db().rpc("grant_reward", { uid: a.id, add_xp: 300, add_coins: 0, reason: "lesson", ref: randomUUID() });
    await db().rpc("add_ranking_points", { cid: coupleId, uid: null as unknown as string, add_points: 200, point_source: "couple_quest", point_ref: "q1" });
    const tier = expectOk(await a.client.from("couple_rank_tiers").select("tier, legend_points").eq("couple_id", coupleId).single());
    expect(tier).toEqual({ tier: 2, legend_points: 600 });
    const unlocked = expectOk(await a.client.from("user_achievements").select("achievement_id").eq("user_id", a.id));
    expect(unlocked.map((u) => u.achievement_id)).toContain("tier_silver");
  });
});

describe("Love Legends leaderboard", () => {
  it("lists only couples that opted in and hides private profiles", async () => {
    const shown = await publicCouple();
    const hidden = await createCouple();
    for (const c of [shown, hidden]) await db().rpc("grant_reward", { uid: c.a.id, add_xp: 50, add_coins: 0, reason: "lesson", ref: randomUUID() });

    const board = expectOk(await hidden.a.client.rpc("get_leaderboard", { board: "weekly", max_rows: 100 }));
    const ids = board.map((r) => r.couple_id);
    expect(ids).toContain(shown.coupleId);
    expect(ids).not.toContain(hidden.coupleId);
    expect(board.find((r) => r.couple_id === shown.coupleId)!.members).toHaveLength(2);

    const outsider = await createUser();
    expect(errorMessage(await outsider.client.rpc("get_couple_legend_profile", { target: hidden.coupleId }))).toBe("profile_private");
    const profile = expectOk(await outsider.client.rpc("get_couple_legend_profile", { target: shown.coupleId })) as Record<string, unknown>;
    expect(profile).not.toHaveProperty("messages");
    expect(JSON.stringify(profile)).not.toMatch(/love_answers|body|email/);
  });

  it("reports the couple's own rank and the gap to the next couple", async () => {
    const leader = await publicCouple();
    const chaser = await publicCouple();
    await db().rpc("grant_reward", { uid: leader.a.id, add_xp: 300, add_coins: 0, reason: "lesson", ref: randomUUID() });
    await db().rpc("grant_reward", { uid: chaser.a.id, add_xp: 120, add_coins: 0, reason: "lesson", ref: randomUUID() });
    const status = expectOk(await chaser.b.client.rpc("get_my_legend_status")) as Record<string, number | null>;
    const board = expectOk(await chaser.b.client.rpc("get_leaderboard", { board: "weekly", max_rows: 100 }));
    const leaderRow = board.find((r) => r.couple_id === leader.coupleId)!;
    const chaserRow = board.find((r) => r.couple_id === chaser.coupleId)!;
    expect(status.rank).toBe(chaserRow.rank);
    expect(chaserRow.is_me).toBe(true);
    expect(status.score).toBe(120);
    expect(status.pointsToNext).toBe(leaderRow.score - 120 + 1);
  });
});

describe("Love Legends weekly finalization", () => {
  it("ranks deterministically, rewards the top couples exactly once, and keeps history", async () => {
    const currentWeek = expectOk(await db().rpc("legend_week_start")) as string;
    const lastWeek = new Date(Date.parse(`${currentWeek}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    await db().from("ranking_reward_claims").delete().eq("week_start", lastWeek);
    await db().from("leaderboard_weeks").delete().eq("week_start", lastWeek);
    await db().from("leaderboard_scores").delete().eq("week_start", lastWeek);

    const [first, second, third] = [await publicCouple(), await publicCouple(), await publicCouple()];
    const t = (s: number) => new Date(Date.parse(`${lastWeek}T10:00:00Z`) + s * 1000).toISOString();
    await db().from("leaderboard_scores").insert([
      { couple_id: third.coupleId, week_start: lastWeek, score: 500, last_scored_at: t(30) },
      { couple_id: second.coupleId, week_start: lastWeek, score: 500, last_scored_at: t(10) },
      { couple_id: first.coupleId, week_start: lastWeek, score: 900, last_scored_at: t(20) },
    ]);
    const coinsBefore = expectOk(await db().from("user_progress").select("coins").eq("user_id", first.b.id).single()).coins;

    expectOk(await first.a.client.rpc("finalize_due_legend_weeks"));
    expect(expectOk(await db().rpc("finalize_legend_week", { week: lastWeek }))).toBe(0);
    expectOk(await second.a.client.rpc("get_leaderboard", { board: "weekly", max_rows: 10 }));

    const snapshots = expectOk(await db().from("leaderboard_snapshots").select("couple_id, rank").eq("week_start", lastWeek).order("rank"));
    expect(snapshots.map((s) => s.couple_id)).toEqual([first.coupleId, second.coupleId, third.coupleId]);

    const coinsAfter = expectOk(await db().from("user_progress").select("coins").eq("user_id", first.b.id).single()).coins;
    expect(coinsAfter - coinsBefore).toBe(500);
    const claims = expectOk(await db().from("ranking_reward_claims").select("couple_id, rank, coins_per_member, effect").eq("week_start", lastWeek).order("rank"));
    expect(claims.map((c) => [c.rank, c.coins_per_member, c.effect])).toEqual([
      [1, 500, "golden_aura"],
      [2, 300, "diamond_aura"],
      [3, 200, "burning_aura"],
    ]);
    const trophy = expectOk(await db().from("inventories").select("item_id").eq("couple_id", first.coupleId));
    expect(trophy.map((i) => i.item_id)).toContain("legend_trophy");

    const write = await first.a.client.from("leaderboard_snapshots").update({ rank: 99 }).eq("couple_id", first.coupleId);
    expect(write.error).not.toBeNull();
    const status = expectOk(await first.a.client.rpc("get_my_legend_status")) as Record<string, number>;
    expect(status.bestRank).toBe(1);
  });
});
