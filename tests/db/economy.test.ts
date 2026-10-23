import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, createCouple, createUser, errorMessage, expectOk, giveCoins } from "./helpers";

async function ledgerMatchesBalance(userId: string) {
  const db = admin();
  const ledger = expectOk(await db.from("currency_transactions").select("amount").eq("user_id", userId));
  const progress = expectOk(await db.from("user_progress").select("coins").eq("user_id", userId).single());
  return { ledger: ledger.reduce((sum, row) => sum + row.amount, 0), balance: progress.coins };
}

describe("Love Coins and the shop", () => {
  it("buys an item, records the transaction and puts it in the couple inventory", async () => {
    const { a, coupleId } = await createCouple();
    await giveCoins(a.id, 500);
    const result = expectOk(await a.client.rpc("purchase_item", { item: "armchair", request_id: randomUUID() })) as Record<string, unknown>;
    expect(result.coins).toBe(-220);
    expect(result.balance).toBe(280);

    const inventory = expectOk(await a.client.from("inventories").select("item_id, couple_id").eq("user_id", a.id));
    expect(inventory).toEqual([{ item_id: "armchair", couple_id: coupleId }]);
    const achievement = expectOk(await a.client.from("user_achievements").select("achievement_id").eq("user_id", a.id));
    expect(achievement.map((x) => x.achievement_id)).toContain("first_purchase");
  });

  it("prevents negative balances and duplicate requests", async () => {
    const { a } = await createCouple();
    await giveCoins(a.id, 100);
    expect(errorMessage(await a.client.rpc("purchase_item", { item: "armchair", request_id: randomUUID() }))).toBe("insufficient_coins");

    const requestId = randomUUID();
    expectOk(await a.client.rpc("purchase_item", { item: "cactus", request_id: requestId }));
    expect(errorMessage(await a.client.rpc("purchase_item", { item: "cactus", request_id: requestId }))).toBe("duplicate_transaction");
    const inventory = expectOk(await a.client.from("inventories").select("id").eq("item_id", "cactus"));
    expect(inventory).toHaveLength(1);
    const progress = expectOk(await a.client.from("user_progress").select("coins").eq("user_id", a.id).single());
    expect(progress.coins).toBe(100 - 40 + 10);
  });

  it("keeps the ledger consistent with the balance", async () => {
    const user = await createUser();
    expectOk(await admin().rpc("grant_reward", { uid: user.id, add_xp: 0, add_coins: 300, reason: "test", ref: randomUUID() }));
    expectOk(await user.client.rpc("purchase_item", { item: "glasses", request_id: randomUUID() }));
    const { ledger, balance } = await ledgerMatchesBalance(user.id);
    expect(ledger).toBe(balance);
  });

  it("does not let clients call internal reward functions", async () => {
    const user = await createUser();
    const attempt = await user.client.rpc("grant_reward", { uid: user.id, add_xp: 1000, add_coins: 1000, reason: "cheat", ref: "x" });
    expect(attempt.error).not.toBeNull();
    const progress = expectOk(await user.client.from("user_progress").select("coins, xp").eq("user_id", user.id).single());
    expect(progress).toEqual({ coins: 0, xp: 0 });
  });

  it("allows wearables once and only equips owned items", async () => {
    const user = await createUser();
    await giveCoins(user.id, 400);
    const equipUnowned = await user.client
      .from("profiles")
      .update({ avatar: { hair: "bob", hairColor: "#5b4256", skin: "#ffe3d3", eyes: "#45365b", outfit: "tee", outfitColor: "#f8bbd0", accessory: "bow" } })
      .eq("id", user.id);
    expect(equipUnowned.error?.message).toBe("item_not_owned");

    expectOk(await user.client.rpc("purchase_item", { item: "bow", request_id: randomUUID() }));
    expect(errorMessage(await user.client.rpc("purchase_item", { item: "bow", request_id: randomUUID() }))).toBe("already_owned");
    const equip = await user.client
      .from("profiles")
      .update({ avatar: { hair: "bob", hairColor: "#5b4256", skin: "#ffe3d3", eyes: "#45365b", outfit: "tee", outfitColor: "#f8bbd0", accessory: "bow" } })
      .eq("id", user.id);
    expect(equip.error).toBeNull();
  });

  it("validates room placement bounds and collisions", async () => {
    const { a, b } = await createCouple();
    await giveCoins(a.id, 1000);
    const lamp = expectOk(await a.client.rpc("purchase_item", { item: "floor_lamp", request_id: randomUUID() })) as { inventoryId: string };
    const table = expectOk(await a.client.rpc("purchase_item", { item: "side_table", request_id: randomUUID() })) as { inventoryId: string };

    expect(errorMessage(await a.client.rpc("save_room_layout", { layout: [{ inventoryId: lamp.inventoryId, x: 0, y: 0 }] }))).toBe(
      "tile_occupied",
    );
    expect(errorMessage(await a.client.rpc("save_room_layout", { layout: [{ inventoryId: lamp.inventoryId, x: 10, y: 3 }] }))).toBe(
      "out_of_bounds",
    );
    expect(
      errorMessage(
        await a.client.rpc("save_room_layout", {
          layout: [
            { inventoryId: lamp.inventoryId, x: 8, y: 7 },
            { inventoryId: table.inventoryId, x: 8, y: 7 },
          ],
        }),
      ),
    ).toBe("tile_occupied");

    expectOk(
      await b.client.rpc("save_room_layout", {
        layout: [
          { inventoryId: lamp.inventoryId, x: 8, y: 7 },
          { inventoryId: table.inventoryId, x: 7, y: 7, flipped: true },
        ],
      }),
    );
    const placed = expectOk(await a.client.from("furniture_placements").select("x, y, flipped").order("x"));
    expect(placed).toEqual([
      { x: 7, y: 7, flipped: true },
      { x: 8, y: 7, flipped: false },
    ]);

    expectOk(await a.client.rpc("save_room_layout", { layout: [{ inventoryId: lamp.inventoryId, x: 8, y: 6 }] }));
    expect(expectOk(await a.client.from("furniture_placements").select("id"))).toHaveLength(1);
  });

  it("sends gifts that arrive in the partner's inventory and mailbox", async () => {
    const { a, b } = await createCouple();
    await giveCoins(a.id, 100);
    expectOk(await a.client.rpc("send_gift", { item: "gift_rose", note: "For you", request_id: randomUUID() }));
    const gifts = expectOk(await b.client.from("love_messages").select("id, kind, item_id, body").eq("kind", "gift"));
    expect(gifts).toMatchObject([{ item_id: "gift_rose", body: "For you" }]);
    expectOk(await b.client.rpc("open_gift", { message: gifts[0].id }));
    expect(errorMessage(await a.client.rpc("open_gift", { message: gifts[0].id }))).toBe("gift_not_found");
  });
});
