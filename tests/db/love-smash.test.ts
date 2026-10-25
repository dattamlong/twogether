import { describe, expect, it } from "vitest";
import { admin, createCouple, createUser, errorMessage, expectOk, type TestUser } from "./helpers";

const db = () => admin();

async function start(user: TestUser, difficulty = "normal") {
  return expectOk(await user.client.rpc("start_love_smash", { difficulty })) as { matchId: string; seed: number };
}

async function age(matchId: string, seconds: number) {
  expectOk(await db().from("love_smash_matches").update({ started_at: new Date(Date.now() - seconds * 1000).toISOString() }).eq("id", matchId).select("id"));
}

function finish(user: TestUser, matchId: string, won: boolean, ticks = 3600) {
  return db().rpc("finish_love_smash", {
    match_id: matchId,
    player: user.id,
    player_won: won,
    final_player_score: won ? 7 : 3,
    final_bot_score: won ? 3 : 7,
    match_ticks: ticks,
    rally_record: 9,
    perfect_count: 4,
    smash_count: 2,
  });
}

describe("Love Smash rewards", () => {
  it("starts a seeded match for the signed-in player only", async () => {
    const user = await createUser();
    const match = await start(user, "easy");
    expect(match.seed).toBeGreaterThan(0);
    expect(errorMessage(await user.client.rpc("start_love_smash", { difficulty: "impossible" }))).toBe("invalid_difficulty");
    const { data } = await user.client.from("love_smash_matches").select("id, difficulty").eq("id", match.matchId).single();
    expect(data).toEqual({ id: match.matchId, difficulty: "easy" });
    const other = await createUser();
    expect((await other.client.from("love_smash_matches").select("id").eq("id", match.matchId)).data).toEqual([]);
  });

  it("never lets a player report their own result", async () => {
    const user = await createUser();
    const { matchId } = await start(user);
    await age(matchId, 120);
    const direct = await user.client.rpc("finish_love_smash", {
      match_id: matchId, player: user.id, player_won: true, final_player_score: 7, final_bot_score: 0,
      match_ticks: 600, rally_record: 1, perfect_count: 0, smash_count: 0,
    });
    expect(direct.error).not.toBeNull();
    expect((await user.client.from("love_smash_stats").insert({ user_id: user.id, wins: 99 })).error).not.toBeNull();
  });

  it("rejects results faster than the match could be played and replays of a finished match", async () => {
    const user = await createUser();
    const { matchId } = await start(user);
    expect(errorMessage(await finish(user, matchId, true, 3600))).toBe("too_fast");
    await age(matchId, 70);
    expectOk(await finish(user, matchId, true, 3600));
    expect(errorMessage(await finish(user, matchId, true, 3600))).toBe("already_finished");
    const stranger = await createUser();
    expect(errorMessage(await finish(stranger, matchId, true, 60))).toBe("invalid_match");
  });

  it("pays XP per match, a coin bonus for the first win of the day, and keeps stats", async () => {
    const { a, coupleId } = await createCouple();
    const before = expectOk(await db().from("user_progress").select("xp, coins").eq("user_id", a.id).single());
    const loss = await start(a);
    await age(loss.matchId, 70);
    const lost = expectOk(await finish(a, loss.matchId, false)) as Record<string, unknown>;
    expect(lost).toMatchObject({ xp: 20, coins: 0, won: false, firstWinToday: false });
    const win = await start(a);
    await age(win.matchId, 70);
    expect(expectOk(await finish(a, win.matchId, true))).toMatchObject({ xp: 50, coins: 100, firstWinToday: true });
    const win2 = await start(a);
    await age(win2.matchId, 70);
    const second = expectOk(await finish(a, win2.matchId, true)) as { xp: number; coins: number; stats: Record<string, number> };
    expect(second).toMatchObject({ xp: 50, coins: 0 });
    expect(second.stats).toMatchObject({ matches: 3, wins: 2, losses: 1, longest_rally: 9, perfect_hits: 12, smashes: 6 });
    const after = expectOk(await db().from("user_progress").select("xp, coins").eq("user_id", a.id).single());
    expect(after.xp - before.xp).toBe(120);
    expect(after.coins - before.coins).toBe(100);
    const week = expectOk(await db().rpc("legend_week_start"));
    const score = (await db().from("leaderboard_scores").select("score").eq("couple_id", coupleId).eq("week_start", week).maybeSingle()).data;
    expect(score?.score ?? 0).toBe(0);
    expect((await a.client.from("love_smash_stats").select("matches").single()).data).toEqual({ matches: 3 });
  });

  it("stops paying XP after ten matches a day and limits open matches", async () => {
    const user = await createUser();
    for (let i = 0; i < 10; i++) {
      const { matchId } = await start(user);
      await age(matchId, 70);
      expectOk(await finish(user, matchId, false));
    }
    const { matchId } = await start(user);
    await age(matchId, 70);
    expect(expectOk(await finish(user, matchId, false))).toMatchObject({ xp: 0, dailyLimitReached: true });
    for (let i = 0; i < 5; i++) await start(user);
    expect(errorMessage(await user.client.rpc("start_love_smash", { difficulty: "easy" }))).toBe("too_many_open_matches");
  });
});
