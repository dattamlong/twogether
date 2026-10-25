import { describe, expect, it } from "vitest";
import { applyResult, newCareer } from "@/features/love-smash/career";
import { admin, createCouple, createUser, errorMessage, expectOk, type TestUser } from "./helpers";

const db = () => admin();

async function career(owner: TestUser, kind: "solo" | "couple" = "solo", coupleId: string | null = null) {
  const state = newCareer(kind, 42);
  const row = expectOk(await db().from("love_smash_careers").insert({ kind, owner_id: owner.id, couple_id: coupleId, state: state as never }).select("id").single()) as { id: string };
  return { id: row.id, state };
}

async function match(owner: TestUser, careerId: string) {
  const row = expectOk(
    await db().from("love_smash_matches").insert({ user_id: owner.id, seed: 7, difficulty: null, mode: "career", career_id: careerId, started_at: new Date(Date.now() - 120_000).toISOString() }).select("id").single(),
  ) as { id: string };
  return row.id;
}

function finish(owner: TestUser, matchId: string, careerId: string, version: number, newState: unknown, trophy: string | null = null) {
  return db().rpc("finish_love_smash_career", {
    match_id: matchId, player: owner.id, player_won: true, final_player_score: 7, final_bot_score: 3, match_ticks: 3600,
    rally_record: 5, perfect_count: 1, smash_count: 1, drop_count: 0, target_career: careerId, expected_version: version,
    new_state: newState as never, trophy: trophy as never,
  });
}

describe("Love Smash career", () => {
  it("lets players read only their own careers and never write them directly", async () => {
    const owner = await createUser();
    const { id } = await career(owner);
    expect((await owner.client.from("love_smash_careers").select("id")).data).toEqual([{ id }]);
    const stranger = await createUser();
    expect((await stranger.client.from("love_smash_careers").select("id")).data).toEqual([]);
    const forged = await owner.client.from("love_smash_careers").update({ state: {} as never }).eq("id", id).select("id");
    expect(forged.data ?? []).toEqual([]);
    expect(errorMessage(await owner.client.rpc("finish_love_smash_career", {
      match_id: id, player: owner.id, player_won: true, final_player_score: 7, final_bot_score: 0, match_ticks: 600,
      rally_record: 1, perfect_count: 0, smash_count: 0, drop_count: 0, target_career: id, expected_version: 1, new_state: {} as never, trophy: null as never,
    }))).toBeTruthy();
  });

  it("shares a couple career with both partners", async () => {
    const { a, b, coupleId } = await createCouple();
    const { id } = await career(a, "couple", coupleId);
    expect((await b.client.from("love_smash_careers").select("id")).data).toEqual([{ id }]);
  });

  it("applies a verified result once and rejects stale versions, foreign matches and other owners", async () => {
    const owner = await createUser();
    const { id, state } = await career(owner);
    const matchId = await match(owner, id);
    const { state: next } = applyResult(state, true, [7, 3], 1);
    const stranger = await createUser();
    expect(errorMessage(await finish(stranger, matchId, id, state.version, next))).toBe("career_not_found");
    const other = await career(stranger);
    expect(errorMessage(await finish(owner, await match(stranger, other.id), id, state.version, next))).toBe("invalid_match");
    expectOk(await finish(owner, matchId, id, state.version, next));
    const second = await match(owner, id);
    expect(errorMessage(await finish(owner, second, id, state.version, next))).toBe("career_conflict");
    const { data } = await db().from("love_smash_careers").select("state").eq("id", id).single();
    expect((data!.state as { version: number }).version).toBe(next.version);
  });

  it("grants a championship trophy only the first time", async () => {
    const owner = await createUser();
    const { id, state } = await career(owner);
    const first = applyResult(state, true, [7, 3], 1).state;
    expectOk(await finish(owner, await match(owner, id), id, state.version, first, "career_trophy_1"));
    const second = applyResult(first, true, [7, 3], 2).state;
    expectOk(await finish(owner, await match(owner, id), id, first.version, second, "career_trophy_1"));
    const { data } = await db().from("inventories").select("item_id").eq("user_id", owner.id).eq("item_id", "career_trophy_1");
    expect(data).toHaveLength(1);
  });
});
