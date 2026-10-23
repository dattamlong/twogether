import { describe, expect, it } from "vitest";
import { createCouple, errorMessage, expectOk } from "./helpers";

describe("love space", () => {
  it("delivers messages only between partners and counts a love letter", async () => {
    const { a, b } = await createCouple();
    const letter = "I am so proud of you for studying every day, and I can't wait to see you again soon.";
    expectOk(await a.client.rpc("send_love_message", { message_kind: "text", message_body: letter }));
    const inbox = expectOk(await b.client.from("love_messages").select("body, sender_id, read_at"));
    expect(inbox).toMatchObject([{ body: letter, sender_id: a.id, read_at: null }]);
    expect(expectOk(await b.client.rpc("mark_messages_read"))).toBe(1);

    const quest = expectOk(await a.client.rpc("get_couple_quests")).find((q) => q.id === "love_letter")!;
    expect(quest.completed).toBe(true);
    expect(errorMessage(await a.client.rpc("send_love_message", { message_kind: "text", message_body: "   " }))).not.toBeNull();
  });

  it("reveals the partner's daily answer only after you answer", async () => {
    const { a, b } = await createCouple();
    expectOk(await a.client.rpc("answer_love_question", { answer_text: "Your voice message this morning." }));

    const beforeAnswering = expectOk(await b.client.rpc("get_today_love_question")) as Record<string, unknown>;
    expect(beforeAnswering.partnerAnswered).toBe(true);
    expect(beforeAnswering.partnerAnswer).toBeNull();
    expect(expectOk(await b.client.from("daily_love_answers").select("answer"))).toHaveLength(0);

    const afterAnswering = expectOk(await b.client.rpc("answer_love_question", { answer_text: "Our call last night." })) as Record<
      string,
      unknown
    >;
    expect(afterAnswering.partnerAnswer).toBe("Your voice message this morning.");
    expect(expectOk(await b.client.from("daily_love_answers").select("answer"))).toHaveLength(2);
    expect(errorMessage(await b.client.rpc("answer_love_question", { answer_text: "again" }))).toBe("already_answered");
  });

  it("requires acceptance for hugs and records the first hug", async () => {
    const { a, b, coupleId } = await createCouple();
    const hug = expectOk(await a.client.rpc("send_interaction", { interaction_kind: "hug" }));
    expect(hug.status).toBe("pending");
    expect(errorMessage(await a.client.rpc("respond_interaction", { interaction: hug.id, accept: true }))).toBe("interaction_not_found");

    const accepted = expectOk(await b.client.rpc("respond_interaction", { interaction: hug.id, accept: true }));
    expect(accepted.status).toBe("accepted");
    expect(errorMessage(await b.client.rpc("respond_interaction", { interaction: hug.id, accept: true }))).toBe("interaction_closed");

    const energy = expectOk(await a.client.from("couple_progress").select("love_energy").eq("couple_id", coupleId).single());
    expect(energy.love_energy).toBe(5);
    const unlocked = expectOk(await a.client.from("user_achievements").select("achievement_id").eq("user_id", a.id));
    expect(unlocked.map((x) => x.achievement_id)).toContain("first_hug");

    const wave = expectOk(await b.client.rpc("send_interaction", { interaction_kind: "wave" }));
    expect(wave.status).toBe("delivered");
  });

  it("requires the partner to approve a real-life reward before redemption", async () => {
    const { a, b } = await createCouple();
    const rewardId = expectOk(await a.client.rpc("propose_reward", { reward_title: "Movie night pick", reward_description: "", reward_cost: 50 }));
    expect(errorMessage(await a.client.rpc("respond_reward", { reward: rewardId, approve: true }))).toBe("reward_not_pending");
    expect(errorMessage(await a.client.rpc("redeem_reward", { reward: rewardId, request_id: crypto.randomUUID() }))).toBe(
      "reward_not_approved",
    );
    expectOk(await b.client.rpc("respond_reward", { reward: rewardId, approve: true }));
    expect(errorMessage(await a.client.rpc("redeem_reward", { reward: rewardId, request_id: crypto.randomUUID() }))).toBe(
      "insufficient_coins",
    );
  });

  it("lets couples keep special memories and saved messages", async () => {
    const { a, b } = await createCouple();
    const memoryId = expectOk(await a.client.rpc("add_special_memory", { memory_title: "First date", memory_body: "Bánh mì by the lake", memory_date: "2024-02-14" }));
    const seen = expectOk(await b.client.from("memories").select("title, occurred_on").eq("id", memoryId).single());
    expect(seen).toEqual({ title: "First date", occurred_on: "2024-02-14" });
    expectOk(await b.client.rpc("delete_memory", { memory: memoryId }));
  });
});
