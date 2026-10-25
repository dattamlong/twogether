import { describe, expect, it } from "vitest";
import { admin, createCouple, createUser, errorMessage, expectOk, type TestUser } from "./helpers";

type Room = { id: string; code: string; status: string; config: { controllers: { kind: string }[] } | null; members: { userId: string; slot: number; status: string; ready: boolean }[] };

const db = () => admin();
const rpc = async (user: TestUser, fn: string, args: Record<string, unknown>) => expectOk(await user.client.rpc(fn as never, args as never)) as unknown as Room;

async function ageMatches(roomId: string) {
  expectOk(await db().from("love_smash_matches").update({ started_at: new Date(Date.now() - 600_000).toISOString() }).eq("room_id", roomId).select("id"));
}

describe("Love Smash rooms", () => {
  it("invites the partner, notifies them, and starts a couple vs bots match once they are ready", async () => {
    const { a, b } = await createCouple();
    const room = await rpc(a, "create_love_smash_room", { room_mode: "couple_ai", room_difficulty: "hard", invite_partner: true });
    expect(room.members.map((m) => [m.slot, m.status])).toEqual([[0, "joined"], [2, "invited"]]);
    const { data: notes } = await db().from("notifications").select("type, destination, sender_user_id").eq("recipient_user_id", b.id);
    expect(notes).toContainEqual({ type: "game_invitation", destination: `/games/love-smash?room=${room.id}`, sender_user_id: a.id });

    expect(errorMessage(await a.client.rpc("start_love_smash_room", { target_room: room.id }))).toBe("players_missing");
    await rpc(b, "respond_love_smash_room", { target_room: room.id, accept: true });
    expect(errorMessage(await a.client.rpc("start_love_smash_room", { target_room: room.id }))).toBe("players_not_ready");
    expect(errorMessage(await b.client.rpc("start_love_smash_room", { target_room: room.id }))).toBe("not_host");
    await rpc(b, "set_love_smash_ready", { target_room: room.id, is_ready: true });
    const started = await rpc(a, "start_love_smash_room", { target_room: room.id });
    expect(started.status).toBe("playing");
    expect(started.config!.controllers.map((c) => c.kind)).toEqual(["human", "bot", "puppet", "bot"]);
    const { data: matches } = await db().from("love_smash_matches").select("user_id, mode, difficulty").eq("room_id", room.id);
    expect(matches).toHaveLength(2);
    expect(matches!.every((m) => m.mode === "couple_ai" && m.difficulty === "hard")).toBe(true);
  });

  it("refuses partner invitations for players without a partner", async () => {
    const solo = await createUser();
    expect(errorMessage(await solo.client.rpc("create_love_smash_room", { room_mode: "couple_ai", room_difficulty: "normal", invite_partner: true }))).toBe("no_partner");
  });

  it("fills a 2v2 room by code, lets players switch teams, and needs all four ready", async () => {
    const [host, p2, p3, p4, p5] = await Promise.all([createUser("Host"), createUser("Two"), createUser("Three"), createUser("Four"), createUser("Five")]);
    const room = await rpc(host, "create_love_smash_room", { room_mode: "versus", room_difficulty: "normal", invite_partner: false });
    const afterTwo = await rpc(p2, "join_love_smash_room", { room_code: room.code.toLowerCase() });
    expect(afterTwo.members.find((m) => m.userId === p2.id)!.slot).toBe(2);
    await rpc(p3, "join_love_smash_room", { room_code: room.code });
    await rpc(p4, "join_love_smash_room", { room_code: room.code });
    expect(errorMessage(await p5.client.rpc("join_love_smash_room", { room_code: room.code }))).toBe("room_full");
    expect(errorMessage(await p2.client.rpc("switch_love_smash_team", { target_room: room.id }))).toBe("team_full");
    for (const p of [p2, p3, p4]) await rpc(p, "set_love_smash_ready", { target_room: room.id, is_ready: true });
    const started = await rpc(host, "start_love_smash_room", { target_room: room.id });
    expect(started.config!.controllers.map((c) => c.kind)).toEqual(["human", "puppet", "puppet", "puppet"]);
    expect((await p5.client.from("love_smash_rooms").select("id").eq("id", room.id)).data).toEqual([]);
    expect(errorMessage(await p5.client.rpc("join_love_smash_room", { room_code: room.code }))).toBe("room_closed");
  });

  it("only the server can finish a room, rewarding each player by team", async () => {
    const { a, b } = await createCouple();
    const room = await rpc(a, "create_love_smash_room", { room_mode: "couple_ai", room_difficulty: "easy", invite_partner: true });
    await rpc(b, "respond_love_smash_room", { target_room: room.id, accept: true });
    await rpc(b, "set_love_smash_ready", { target_room: room.id, is_ready: true });
    await rpc(a, "start_love_smash_room", { target_room: room.id });
    const args = { target_room: room.id, winner_team: 0, final_scores: [7, 4], match_ticks: 3000, rally_record: 9, player_stats: { "0": { perfectHits: 3, smashes: 2 }, "2": { perfectHits: 1, smashes: 0 } } };
    expect((await a.client.rpc("finish_love_smash_room", args)).error).not.toBeNull();
    await ageMatches(room.id);
    const finished = expectOk(await db().rpc("finish_love_smash_room", args)) as unknown as { status: string; result: { rewards: Record<string, { xp: number; coins: number; won: boolean }> } };
    expect(finished.status).toBe("finished");
    expect(finished.result.rewards[a.id]).toEqual({ xp: 50, coins: 100, won: true });
    expect(finished.result.rewards[b.id]).toEqual({ xp: 50, coins: 100, won: true });
    const { data: stats } = await db().from("love_smash_stats").select("user_id, doubles_matches, couple_wins, perfect_hits").in("user_id", [a.id, b.id]);
    expect(stats!.find((s) => s.user_id === a.id)).toMatchObject({ doubles_matches: 1, couple_wins: 1, perfect_hits: 3 });
    expect(errorMessage(await db().rpc("finish_love_smash_room", args))).toBe("room_closed");
  });

  it("limits the realtime room channel to joined players", async () => {
    const { a, b } = await createCouple();
    const stranger = await createUser();
    const room = await rpc(a, "create_love_smash_room", { room_mode: "couple_ai", room_difficulty: "normal", invite_partner: true });
    const can = async (u: TestUser, topic: string) => expectOk(await u.client.rpc("can_join_love_smash_topic" as never, { topic } as never)) as unknown as boolean;
    expect(await can(a, `love-smash:${room.id}`)).toBe(true);
    expect(await can(a, `love-smash:${room.id}:up:0`)).toBe(true);
    expect(await can(a, `love-smash:${room.id}:up`)).toBe(false);
    expect(await can(b, `love-smash:${room.id}`)).toBe(false);
    expect(await can(stranger, `love-smash:${room.id}`)).toBe(false);
    await rpc(b, "respond_love_smash_room", { target_room: room.id, accept: true });
    expect(await can(b, `love-smash:${room.id}`)).toBe(true);
    await a.client.rpc("leave_love_smash_room", { target_room: room.id });
    const { data } = await db().from("love_smash_rooms").select("status").eq("id", room.id).single();
    expect(data!.status).toBe("abandoned");
  });
});
