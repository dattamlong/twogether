import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { admin, answerKey, createCouple, createUser, errorMessage, expectOk, giveCoins, type Client, type TestUser } from "./helpers";

type Message = { id: string; userId: string; body: string; clientId: string; author: { id: string; name: string; coupleName: string | null } };

const send = (user: TestUser, body: string, channel = "world", clientId = randomUUID()) =>
  user.client.rpc("send_world_message", { channel, body, client_id: clientId });

const messages = async (user: TestUser, channel = "world", before?: string, max = 40) =>
  expectOk(await user.client.rpc("get_world_messages", { channel, before_id: before, max_rows: max })) as unknown as Message[];

const opened: { client: Client; channel: RealtimeChannel }[] = [];

async function joinTopic(client: Client, topic: string) {
  await client.realtime.setAuth();
  const channel = client.channel(topic, { config: { private: true } });
  const status = await new Promise<string>((resolve) => {
    channel.subscribe((s) => {
      if (s !== "CLOSED") resolve(s);
    });
    setTimeout(() => resolve("TIMEOUT"), 8000);
  });
  opened.push({ client, channel });
  return status;
}

afterEach(async () => {
  for (const { client, channel } of opened.splice(0)) await client.removeChannel(channel);
});

async function clearChat() {
  await admin().from("world_chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

describe("World Chat", () => {
  it("persists messages with server-resolved identity and loads them in order", async () => {
    await clearChat();
    const { a, b } = await createCouple();
    const first = expectOk(await send(a, "  Anyone want to practice English?  ")) as unknown as Message;
    expect(first.body).toBe("Anyone want to practice English?");
    expect(first.author).toMatchObject({ id: a.id, name: "Mai" });
    expect(first.author.coupleName).toBeTruthy();
    expectOk(await send(b, "Let's do a vocabulary battle!"));

    const feed = await messages(b);
    expect(feed.map((m) => m.body)).toEqual(["Anyone want to practice English?", "Let's do a vocabulary battle!"]);
    expect(feed[1].author.id).toBe(b.id);
    expect(await messages(b, "english_cafe")).toEqual([]);
  });

  it("is idempotent per client id and rejects invalid or spammy messages", async () => {
    const user = await createUser("Spammy");
    const clientId = randomUUID();
    const one = expectOk(await send(user, "hello", "world", clientId)) as unknown as Message;
    const again = expectOk(await send(user, "hello", "world", clientId)) as unknown as Message;
    expect(again.id).toBe(one.id);
    expect(errorMessage(await send(user, "hello"))).toBe("duplicate_message");
    expect(errorMessage(await send(user, "   "))).toBe("empty_message");
    expect(errorMessage(await send(user, "x".repeat(501)))).toBe("message_too_long");
    expect(errorMessage(await send(user, "hi", "secret_room"))).toBe("invalid_channel");
    for (let i = 0; i < 4; i++) expectOk(await send(user, `burst ${i}`));
    expect(errorMessage(await send(user, "burst 5"))).toBe("slow_down");
  });

  it("paginates older messages", async () => {
    const user = await createUser();
    const other = await createUser();
    for (let i = 0; i < 5; i++) {
      await admin().from("world_chat_messages").insert({ channel: "english_cafe", user_id: i % 2 ? user.id : other.id, body: `cafe ${i}`, client_id: randomUUID(), created_at: new Date(Date.now() - (10 - i) * 1000).toISOString() });
    }
    const latest = await messages(user, "english_cafe", undefined, 2);
    expect(latest.map((m) => m.body)).toEqual(["cafe 3", "cafe 4"]);
    const older = await messages(user, "english_cafe", latest[0].id, 2);
    expect(older.map((m) => m.body)).toEqual(["cafe 1", "cafe 2"]);
  });

  it("cannot be written directly, impersonated, or read anonymously", async () => {
    const user = await createUser();
    const victim = await createUser();
    const direct = await user.client.from("world_chat_messages").insert({ channel: "world", user_id: victim.id, body: "I am the victim", client_id: randomUUID() });
    expect(direct.error).not.toBeNull();
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anon.rpc("send_world_message", { channel: "world", body: "hi", client_id: randomUUID() })).error).not.toBeNull();
    expect((await anon.rpc("get_world_messages", { channel: "world" })).error).not.toBeNull();
    const own = expectOk(await send(user, "delete me")) as unknown as Message;
    expect(errorMessage(await victim.client.rpc("delete_world_message", { message: own.id }))).toBe("not_allowed");
    expectOk(await user.client.rpc("delete_world_message", { message: own.id }));
    expect((await messages(victim)).some((m) => m.id === own.id)).toBe(false);
  });

  it("delivers new messages in realtime and hides blocked players both ways", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    await b.client.realtime.setAuth();
    const received = new Promise<Record<string, unknown>>((resolve) => {
      const channel = b.client
        .channel("world:lobby", { config: { private: true } })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "world_chat_messages" }, (p) => {
          if ((p.new as { user_id: string }).user_id === a.id) resolve(p.new);
        });
      opened.push({ client: b.client, channel });
      channel.subscribe();
    });
    await new Promise((r) => setTimeout(r, 1500));
    expectOk(await send(a, "realtime hello"));
    await expect(received).resolves.toMatchObject({ body: "realtime hello", user_id: a.id });

    expectOk(await b.client.rpc("block_player", { target: a.id }));
    expect((await messages(b)).some((m) => m.userId === a.id)).toBe(false);
    expectOk(await send(b, "can you see me?"));
    expect((await messages(a)).some((m) => m.userId === b.id)).toBe(false);
    const table = await a.client.from("world_chat_messages").select("id").eq("user_id", b.id);
    expect(table.data).toEqual([]);
  });
});

describe("Moderation", () => {
  it("auto-hides a message after three distinct reports and limits report targets", async () => {
    const spammer = await createUser();
    const msg = expectOk(await send(spammer, "buy cheap coins")) as unknown as Message;
    const reporters = await Promise.all([createUser(), createUser(), createUser()]);
    for (const [i, r] of reporters.entries()) {
      const res = expectOk(await r.client.rpc("report_player", { target: spammer.id, reason: "spam", message: msg.id })) as { hidden: boolean };
      expect(res.hidden).toBe(i === 2);
    }
    expect((await messages(reporters[0])).some((m) => m.id === msg.id)).toBe(false);
    const innocent = await createUser();
    expect(errorMessage(await reporters[0].client.rpc("report_player", { target: innocent.id, reason: "spam", message: msg.id }))).toBe("invalid_target");
    expect(errorMessage(await spammer.client.rpc("report_player", { target: spammer.id, reason: "spam" }))).toBe("invalid_target");
  });
});

describe("Profiles and discovery", () => {
  it("exposes only public profile fields", async () => {
    const { a, b } = await createCouple();
    const outsider = await createUser("Out");
    const profile = expectOk(await outsider.client.rpc("get_player_profile", { target: a.id })) as Record<string, unknown>;
    expect(profile).toMatchObject({ id: a.id, name: "Mai", partnerName: "Minh", friendship: "none", canInteract: true, isSelf: false });
    expect(JSON.stringify(profile)).not.toContain(a.email);
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("timezone");
    const privateMessages = await outsider.client.from("love_messages").select("*");
    expect(privateMessages.data).toEqual([]);
    const otherProfile = await outsider.client.from("profiles").select("*").eq("id", b.id);
    expect(otherProfile.data).toEqual([]);
  });

  it("discovers real couples, excluding your own and blocked ones", async () => {
    const mine = await createCouple();
    const other = await createCouple();
    const blocked = await createCouple();
    expectOk(await mine.a.client.rpc("block_player", { target: blocked.b.id }));
    const ids: string[] = [];
    for (let page = 0; page < 50; page++) {
      const res = expectOk(await mine.a.client.rpc("get_discover_couples", { sort: "level", page, page_size: 30 })) as unknown as { items: { coupleId: string }[]; hasMore: boolean };
      ids.push(...res.items.map((i) => i.coupleId));
      if (!res.hasMore) break;
    }
    expect(ids).toContain(other.coupleId);
    expect(ids).not.toContain(mine.coupleId);
    expect(ids).not.toContain(blocked.coupleId);

    expectOk(await mine.a.client.rpc("send_friend_request", { target: other.a.id }));
    expectOk(await other.a.client.rpc("send_friend_request", { target: mine.a.id }));
    const friends = expectOk(await mine.a.client.rpc("get_discover_couples", { sort: "friends" })) as unknown as { items: { coupleId: string; isFriend: boolean }[] };
    expect(friends.items).toEqual([expect.objectContaining({ coupleId: other.coupleId, isFriend: true })]);
  });
});

describe("Home visiting", () => {
  it("loads the host's real saved home read-only and records the visit once", async () => {
    const host = await createCouple();
    await giveCoins(host.a.id, 1000);
    const lamp = expectOk(await host.a.client.rpc("purchase_item", { item: "floor_lamp", request_id: randomUUID() })) as { inventoryId: string };
    expectOk(await host.a.client.rpc("save_room_layout", { layout: [{ inventoryId: lamp.inventoryId, x: 8, y: 7 }] }));

    const guest = await createUser("Guest");
    const home = expectOk(await guest.client.rpc("start_home_visit", { target: host.coupleId })) as unknown as {
      isOwn: boolean;
      placements: { inventoryId: string; itemId: string; x: number; y: number }[];
      members: { id: string }[];
    };
    expect(home.isOwn).toBe(false);
    expect(home.placements).toEqual([expect.objectContaining({ inventoryId: lamp.inventoryId, itemId: "floor_lamp", x: 8, y: 7 })]);
    expect(home.members.map((m) => m.id).sort()).toEqual([host.a.id, host.b.id].sort());
    expectOk(await guest.client.rpc("start_home_visit", { target: host.coupleId }));
    const visits = await admin().from("home_visits").select("id").eq("visitor_id", guest.id);
    expect(visits.data).toHaveLength(1);
    const unlocked = await admin().from("user_achievements").select("achievement_id").eq("user_id", guest.id);
    expect(unlocked.data?.map((r) => r.achievement_id)).toContain("first_home_visit");

    const moved = await guest.client.from("furniture_placements").update({ x: 1 }).eq("inventory_id", lamp.inventoryId).select();
    expect(moved.data ?? []).toEqual([]);
    const layout = await guest.client.rpc("save_room_layout", { layout: [{ inventoryId: lamp.inventoryId, x: 2, y: 8 }] });
    expect(layout.error).not.toBeNull();
    const after = await admin().from("furniture_placements").select("x, y").eq("inventory_id", lamp.inventoryId).single();
    expect(after.data).toEqual({ x: 8, y: 7 });
    expect((await guest.client.from("memories").select("*").eq("couple_id", host.coupleId)).data).toEqual([]);
  });

  it("lets guests join the home channel but not the private couple channel, and blocks shut both", async () => {
    const host = await createCouple();
    const guest = await createUser();
    expect(await joinTopic(guest.client, `home:${host.coupleId}`)).toBe("SUBSCRIBED");
    expect(await joinTopic(guest.client, `couple:${host.coupleId}`)).not.toBe("SUBSCRIBED");

    const rude = await createUser();
    expectOk(await host.b.client.rpc("block_player", { target: rude.id }));
    expect(errorMessage(await rude.client.rpc("start_home_visit", { target: host.coupleId }))).toBe("cannot_interact");
    expect(await joinTopic(rude.client, `home:${host.coupleId}`)).not.toBe("SUBSCRIBED");
    expect(errorMessage(await rude.client.rpc("sign_guestbook", { target: host.coupleId, body: "hi" }))).toBe("cannot_interact");
  });

  it("awards Community Explorer after five different homes", async () => {
    const guest = await createUser();
    for (let i = 0; i < 5; i++) {
      const { coupleId } = await createCouple();
      expectOk(await guest.client.rpc("start_home_visit", { target: coupleId }));
    }
    const unlocked = await admin().from("user_achievements").select("achievement_id").eq("user_id", guest.id);
    expect(unlocked.data?.map((r) => r.achievement_id)).toEqual(expect.arrayContaining(["first_home_visit", "community_explorer"]));
  });
});

describe("Guestbook", () => {
  it("persists messages, paginates, and lets authors and hosts remove them", async () => {
    const host = await createCouple();
    const guest = await createUser("Linh");
    const signed = expectOk(await guest.client.rpc("sign_guestbook", { target: host.coupleId, body: "Your home is adorable! 🌸" })) as { id: string };
    expect(errorMessage(await guest.client.rpc("sign_guestbook", { target: host.coupleId, body: "again" }))).toBe("slow_down");
    expect(errorMessage(await host.a.client.rpc("sign_guestbook", { target: host.coupleId, body: "self" }))).toBe("own_guestbook");

    const book = expectOk(await host.b.client.rpc("get_guestbook", { target: host.coupleId })) as unknown as { id: string; body: string; author: { name: string } }[];
    expect(book).toEqual([expect.objectContaining({ id: signed.id, body: "Your home is adorable! 🌸", author: expect.objectContaining({ name: "Linh" }) })]);

    const stranger = await createUser();
    expect(errorMessage(await stranger.client.rpc("delete_guestbook_message", { message: signed.id }))).toBe("not_allowed");
    expectOk(await host.b.client.rpc("delete_guestbook_message", { message: signed.id }));
    expect(expectOk(await guest.client.rpc("get_guestbook", { target: host.coupleId }))).toEqual([]);

    const another = await createUser();
    const second = expectOk(await another.client.rpc("sign_guestbook", { target: host.coupleId, body: "Congrats!" })) as { id: string };
    expectOk(await another.client.rpc("delete_guestbook_message", { message: second.id }));
    const unlocked = await admin().from("user_achievements").select("achievement_id").eq("user_id", another.id);
    expect(unlocked.data?.map((r) => r.achievement_id)).toContain("first_guestbook_message");
    expect((await another.client.from("home_guestbook_messages").insert({ couple_id: host.coupleId, author_id: another.id, body: "direct" })).error).not.toBeNull();
  });
});

describe("Friends", () => {
  it("sends, accepts, lists and removes friends without duplicates", async () => {
    const a = await createUser("Dat");
    const b = await createUser("An");
    expect(expectOk(await a.client.rpc("send_friend_request", { target: b.id }))).toBe("outgoing");
    expect(expectOk(await a.client.rpc("send_friend_request", { target: b.id }))).toBe("outgoing");
    const overview = expectOk(await b.client.rpc("get_social_overview")) as unknown as { incoming: { id: string; player: { id: string } }[] };
    expect(overview.incoming).toHaveLength(1);
    expect(overview.incoming[0].player.id).toBe(a.id);
    expect(errorMessage(await a.client.rpc("respond_friend_request", { request: overview.incoming[0].id, accept: true }))).toBe("request_not_found");
    expect(expectOk(await b.client.rpc("respond_friend_request", { request: overview.incoming[0].id, accept: true }))).toBe("friends");
    const mine = expectOk(await a.client.rpc("get_social_overview")) as unknown as { friends: { id: string }[] };
    expect(mine.friends.map((f) => f.id)).toEqual([b.id]);
    const unlocked = await admin().from("user_achievements").select("achievement_id").eq("user_id", a.id);
    expect(unlocked.data?.map((r) => r.achievement_id)).toContain("first_friend");

    expectOk(await a.client.rpc("remove_friend", { target: b.id }));
    expect((expectOk(await b.client.rpc("get_social_overview")) as unknown as { friends: unknown[] }).friends).toEqual([]);
  });

  it("declines requests and blocks remove friendships and stop new requests", async () => {
    const a = await createUser();
    const b = await createUser();
    expectOk(await a.client.rpc("send_friend_request", { target: b.id }));
    const { incoming } = expectOk(await b.client.rpc("get_social_overview")) as unknown as { incoming: { id: string }[] };
    expect(expectOk(await b.client.rpc("respond_friend_request", { request: incoming[0].id, accept: false }))).toBe("none");
    expectOk(await a.client.rpc("send_friend_request", { target: b.id }));
    expectOk(await b.client.rpc("send_friend_request", { target: a.id }));
    expectOk(await b.client.rpc("block_player", { target: a.id }));
    expect((expectOk(await a.client.rpc("get_social_overview")) as unknown as { friends: unknown[] }).friends).toEqual([]);
    expect(errorMessage(await a.client.rpc("send_friend_request", { target: b.id }))).toBe("cannot_interact");
    expect(errorMessage(await a.client.rpc("send_game_invitation", { target: b.id, game: "word_duel" }))).toBe("cannot_interact");
    expectOk(await b.client.rpc("unblock_player", { target: a.id }));
    expect(expectOk(await a.client.rpc("send_friend_request", { target: b.id }))).toBe("outgoing");
  });
});

describe("Game invitations", () => {
  it("runs a Word Duel on the same questions for both players", async () => {
    const a = await createUser("Dat");
    const b = await createUser("Linh");
    expect(errorMessage(await a.client.rpc("send_game_invitation", { target: b.id, game: "sentence_puzzle" }))).toBe("game_not_multiplayer");
    const inv = expectOk(await a.client.rpc("send_game_invitation", { target: b.id, game: "word_duel" })) as { id: string; status: string };
    expect(inv.status).toBe("pending");
    expect(errorMessage(await a.client.rpc("send_game_invitation", { target: b.id, game: "word_duel" }))).toBe("invitation_pending");
    expect(errorMessage(await a.client.rpc("start_duel", { invitation: inv.id }))).toBe("invitation_not_found");
    const accepted = expectOk(await b.client.rpc("respond_game_invitation", { invitation: inv.id, accept: true })) as { status: string };
    expect(accepted.status).toBe("accepted");

    const play = async (user: TestUser, correct: number) => {
      const duel = expectOk(await user.client.rpc("start_duel", { invitation: inv.id })) as unknown as { sessionId: string; questions: { id: string }[] };
      expect(duel.questions).toHaveLength(8);
      for (const [i, q] of duel.questions.entries()) {
        const key = (await answerKey(q.id)).answers as string[];
        expectOk(await user.client.rpc("submit_answer", { question: q.id, answer: i < correct ? key[0] : "nope", game_session: duel.sessionId }));
      }
      return { duel, result: expectOk(await user.client.rpc("finish_duel", { game_session: duel.sessionId })) as unknown as { results: { userId: string; correct: number; finished: boolean }[] } };
    };
    const first = await play(a, 6);
    const second = await play(b, 8);
    expect(second.duel.questions.map((q) => q.id)).toEqual(first.duel.questions.map((q) => q.id));
    expect(second.result.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: a.id, correct: 6, finished: true }), expect.objectContaining({ userId: b.id, correct: 8, finished: true })]),
    );
    expect(errorMessage(await a.client.rpc("start_duel", { invitation: inv.id }))).toBe("already_completed");
    const outsider = await createUser();
    expect(errorMessage(await outsider.client.rpc("start_duel", { invitation: inv.id }))).toBe("invitation_not_found");
  });
});
