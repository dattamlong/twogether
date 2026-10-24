import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, createCouple, createUser, errorMessage, expectOk, type TestUser } from "./helpers";

type N = { id: string; type: string; title: string; body: string; destination: string; readAt: string | null; metadata: Record<string, unknown>; sender: { id: string } | null };

const ping = (user: TestUser, kind: string, message?: string, clientId: string = randomUUID()) =>
  user.client.rpc("send_love_ping", { kind, message: message ?? undefined, client_id: clientId });

const inbox = async (user: TestUser, before?: string, max = 20) =>
  expectOk(await user.client.rpc("get_notifications", { before_id: before, max_rows: max })) as unknown as N[];

describe("Love Ping", () => {
  it("delivers one notification to the connected partner with server-resolved identity", async () => {
    const { a, b } = await createCouple();
    const sent = expectOk(await ping(a, "miss_you")) as unknown as { notification: N; duplicate: boolean };
    expect(sent.duplicate).toBe(false);

    const box = await inbox(b);
    expect(box).toHaveLength(1);
    expect(box[0]).toMatchObject({ type: "love_ping", title: "💌 Mai misses you!", body: "I miss you! Come spend some time with me 🥺💕", destination: "/home", readAt: null });
    expect(box[0].sender?.id).toBe(a.id);
    expect(await inbox(a)).toEqual([]);
    expect(expectOk(await b.client.rpc("unread_notification_count"))).toBe(1);

    const study = expectOk(await ping(a, "study")) as unknown as { notification: N };
    expect(study.notification).toMatchObject({ type: "study_invitation", destination: "/learn" });
    const play = expectOk(await ping(a, "play")) as unknown as { notification: N };
    expect(play.notification.destination).toBe("/games");
  });

  it("validates custom messages and supports unicode", async () => {
    const { a, b } = await createCouple();
    expect(errorMessage(await ping(a, "custom", "   "))).toBe("empty_message");
    expect(errorMessage(await ping(a, "custom", "x".repeat(201)))).toBe("message_too_long");
    expect(errorMessage(await ping(a, "teleport"))).toBe("invalid_love_ping");
    expectOk(await ping(a, "custom", "Em nhớ anh 🥺💕 你好"));
    const [n] = await inbox(b);
    expect(n.body).toBe("Em nhớ anh 🥺💕 你好");
    expect(n.metadata.private).toBe(true);
    const row = await admin().from("notifications").select("preview").eq("id", n.id).single();
    expect(row.data?.preview).toBe("Mai sent you a little love note 💗");
  });

  it("rate-limits to 3 per 30 minutes and is idempotent per request", async () => {
    const { a, b } = await createCouple();
    const clientId = randomUUID();
    expectOk(await ping(a, "miss_you", undefined, clientId));
    const again = expectOk(await ping(a, "miss_you", undefined, clientId)) as unknown as { duplicate: boolean };
    expect(again.duplicate).toBe(true);
    expectOk(await ping(a, "come_home"));
    expectOk(await ping(a, "play"));
    expect(errorMessage(await ping(a, "miss_you"))).toBe("love_ping_cooldown");
    expect(await inbox(b)).toHaveLength(3);
    expectOk(await ping(b, "miss_you"));
  });

  it("requires a connected partner and cannot be forged", async () => {
    const lonely = await createUser();
    const pair = await lonely.client.rpc("create_invitation");
    expect(pair.error).toBeNull();
    expect(errorMessage(await ping(lonely, "miss_you"))).toBe("partner_missing");

    const { a, b } = await createCouple();
    const stranger = await createUser();
    const forged = await stranger.client.from("notifications").insert({
      recipient_user_id: b.id, sender_user_id: a.id, type: "love_ping", title: "fake", body: "fake", preview: "fake", destination: "/home",
    });
    expect(forged.error).not.toBeNull();
    expect((await stranger.client.rpc("notify" as never, { recipient: b.id } as never)).error).not.toBeNull();
    expectOk(await ping(a, "miss_you"));
    expect((await stranger.client.from("notifications").select("*")).data).toEqual([]);
    const bad = await admin().from("notifications").insert({
      recipient_user_id: b.id, type: "love_ping", title: "x", body: "x", preview: "x", destination: "https://evil.example",
    });
    expect(bad.error).not.toBeNull();
    const protocolRelative = await admin().from("notifications").insert({
      recipient_user_id: b.id, type: "love_ping", title: "x", body: "x", preview: "x", destination: "//evil.example",
    });
    expect(protocolRelative.error).not.toBeNull();
  });
});

describe("Notification Center", () => {
  it("marks read, marks all read, deletes and paginates — only for the owner", async () => {
    const { a, b } = await createCouple();
    for (const kind of ["miss_you", "come_home", "play"]) expectOk(await ping(a, kind));
    const box = await inbox(b);
    expect(box).toHaveLength(3);
    const page1 = await inbox(b, undefined, 2);
    const page2 = await inbox(b, page1.at(-1)!.id, 2);
    expect(page1.map((n) => n.id).concat(page2.map((n) => n.id))).toEqual(box.map((n) => n.id));

    expect(expectOk(await a.client.rpc("mark_notifications_read", { ids: [box[0].id] }))).toBe(0);
    expect(expectOk(await b.client.rpc("mark_notifications_read", { ids: [box[0].id] }))).toBe(1);
    expect(expectOk(await b.client.rpc("unread_notification_count"))).toBe(2);
    expect(errorMessage(await a.client.rpc("delete_notification", { notification: box[1].id }))).toBe("not_allowed");
    expectOk(await b.client.rpc("delete_notification", { notification: box[1].id }));
    expect((await inbox(b)).map((n) => n.id)).toEqual([box[0].id, box[2].id]);
    expect(expectOk(await b.client.rpc("mark_notifications_read", {}))).toBe(1);
    expect(expectOk(await b.client.rpc("unread_notification_count"))).toBe(0);
  });

  it("plays the reunion only once per recent ping", async () => {
    const { a, b } = await createCouple();
    expect(expectOk(await b.client.rpc("claim_love_ping_reunion")) ?? null).toBeNull();
    expectOk(await ping(a, "come_home"));
    expectOk(await ping(a, "miss_you"));
    const first = (await b.client.rpc("claim_love_ping_reunion")).data as unknown as N;
    expect(first.sender?.id).toBe(a.id);
    expect((await b.client.rpc("claim_love_ping_reunion")).data).toBeNull();
    expect((await a.client.rpc("claim_love_ping_reunion")).data).toBeNull();
  });
});

describe("Existing features feed notifications", () => {
  it("creates notifications for friend requests, duels, guestbook notes and achievements", async () => {
    const host = await createCouple();
    const guest = await createUser("Linh");
    expectOk(await guest.client.rpc("send_friend_request", { target: host.a.id }));
    expectOk(await guest.client.rpc("send_game_invitation", { target: host.a.id, game: "word_duel" }));
    expectOk(await guest.client.rpc("sign_guestbook", { target: host.coupleId, body: "So cozy!" }));
    const box = await inbox(host.a);
    expect(box.map((n) => n.type).sort()).toEqual(["friend_request", "game_invitation", "guestbook_signed"]);
    expect(box.find((n) => n.type === "friend_request")?.destination).toBe("/world?tab=friends");
    expect((await inbox(host.b)).map((n) => n.type)).toEqual(["guestbook_signed"]);

    const { incoming } = expectOk(await host.a.client.rpc("get_social_overview")) as unknown as { incoming: { id: string }[] };
    expectOk(await host.a.client.rpc("respond_friend_request", { request: incoming[0].id, accept: true }));
    const guestBox = await inbox(guest);
    expect(guestBox.map((n) => n.type)).toEqual(expect.arrayContaining(["friend_request", "achievement_unlocked"]));
    const achievement = await admin().from("notifications").select("push_status").eq("recipient_user_id", guest.id).eq("type", "achievement_unlocked").limit(1).single();
    expect(achievement.data?.push_status).toBe("none");
    const pending = await admin().from("notifications").select("push_status").eq("recipient_user_id", host.a.id).eq("type", "friend_request").single();
    expect(pending.data?.push_status).toBe("pending");
  });

  it("does not notify across a block", async () => {
    const host = await createCouple();
    const rude = await createUser();
    expectOk(await host.a.client.rpc("block_player", { target: rude.id }));
    await rude.client.rpc("send_friend_request", { target: host.a.id });
    expect(await inbox(host.a)).toEqual([]);
  });
});

describe("Push subscriptions, preferences and presence", () => {
  const sub = () => ({ endpoint: `https://push.example.test/${randomUUID()}`, p256dh: "B".repeat(87), auth: "A".repeat(22) });

  it("stores subscriptions per device and only for the signed-in user", async () => {
    const a = await createUser();
    const b = await createUser();
    const one = sub();
    const two = sub();
    expectOk(await a.client.rpc("save_push_subscription", { ...one, device_label: "iPhone · Safari (app)" }));
    expectOk(await a.client.rpc("save_push_subscription", { ...two, device_label: "Mac · Chrome" }));
    expectOk(await a.client.rpc("save_push_subscription", { ...one }));
    const mine = await a.client.from("push_subscriptions").select("endpoint, device_label");
    expect(mine.data).toHaveLength(2);
    expect((await b.client.from("push_subscriptions").select("*")).data).toEqual([]);

    expectOk(await b.client.rpc("remove_push_subscription", { endpoint: one.endpoint }));
    expect((await a.client.from("push_subscriptions").select("id")).data).toHaveLength(2);
    expect((await a.client.from("push_subscriptions").insert({ user_id: b.id, ...two })).error).not.toBeNull();
    expect(errorMessage(await a.client.rpc("save_push_subscription", { endpoint: "http://insecure.test/x", p256dh: "B".repeat(87), auth: "A".repeat(22) }))).toMatch(/violates check constraint/);

    expectOk(await b.client.rpc("save_push_subscription", { ...two }));
    expect((await a.client.from("push_subscriptions").select("endpoint")).data?.map((r) => r.endpoint)).toEqual([one.endpoint]);
    expectOk(await a.client.rpc("remove_push_subscription", { endpoint: one.endpoint }));
    expect((await a.client.from("push_subscriptions").select("id")).data).toEqual([]);
  });

  it("reads and updates preferences with validation", async () => {
    const user = await createUser();
    const initial = expectOk(await user.client.rpc("get_notification_settings")) as Record<string, unknown>;
    expect(initial).toMatchObject({ lovePing: true, sound: true, messagePreviews: false, quietStart: null, devices: [] });
    const updated = expectOk(await user.client.rpc("update_notification_settings", { settings: { lovePing: false, quietStart: 22, quietEnd: 7 } })) as Record<string, unknown>;
    expect(updated).toMatchObject({ lovePing: false, quietStart: 22, quietEnd: 7, gameInvites: true });
    expect(errorMessage(await user.client.rpc("update_notification_settings", { settings: { quietStart: 22, quietEnd: null } }))).toBe("invalid_quiet_hours");
    const cleared = expectOk(await user.client.rpc("update_notification_settings", { settings: { quietStart: null, quietEnd: null } })) as Record<string, unknown>;
    expect(cleared.quietStart).toBeNull();
    expect((await user.client.from("notification_preferences").update({ love_ping_enabled: true }).eq("user_id", user.id).select()).data ?? []).toEqual([]);
  });

  it("records device presence through the RPC only", async () => {
    const user = await createUser();
    expectOk(await user.client.rpc("touch_device_presence", { device: "device-12345678", visible: true }));
    const row = await admin().from("device_presence").select("visible").eq("user_id", user.id).single();
    expect(row.data?.visible).toBe(true);
    expect((await user.client.from("device_presence").select("*")).error).not.toBeNull();
  });
});
