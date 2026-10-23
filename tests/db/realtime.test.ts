import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { createCouple, createUser, type Client } from "./helpers";

const opened: { client: Client; channel: RealtimeChannel }[] = [];

async function join(client: Client, topic: string, key: string) {
  await client.realtime.setAuth();
  const channel = client.channel(topic, { config: { private: true, presence: { key, enabled: true }, broadcast: { self: false } } });
  const status = await new Promise<string>((resolve) => {
    channel.subscribe((s) => {
      if (s !== "CLOSED") resolve(s);
    });
    setTimeout(() => resolve("TIMEOUT"), 8000);
  });
  opened.push({ client, channel });
  return { channel, status };
}

afterEach(async () => {
  for (const { client, channel } of opened.splice(0)) await client.removeChannel(channel);
});

describe("couple realtime channel", () => {
  it("delivers broadcasts and presence between partners", async () => {
    const { a, b, coupleId } = await createCouple();
    const topic = `couple:${coupleId}`;
    const received = new Promise<unknown>((resolve) => {
      void join(b.client, topic, b.id).then(({ channel }) => {
        channel.on("broadcast", { event: "room" }, ({ payload }) => resolve(payload));
      });
    });
    const receiver = await new Promise<RealtimeChannel>((resolve) => setTimeout(() => resolve(opened[0].channel), 1500));
    const sender = await join(a.client, topic, a.id);
    expect(sender.status).toBe("SUBSCRIBED");
    await sender.channel.track({ userId: a.id, tile: { x: 5, y: 4 } });

    await new Promise((r) => setTimeout(r, 500));
    await sender.channel.send({ type: "broadcast", event: "room", payload: { type: "emote", emote: "wave" } });
    await expect(received).resolves.toEqual({ type: "emote", emote: "wave" });

    await new Promise((r) => setTimeout(r, 800));
    expect(Object.keys(receiver.presenceState())).toContain(a.id);
  });

  it("rejects users outside the couple", async () => {
    const { coupleId } = await createCouple();
    const outsider = await createUser();
    const { status } = await join(outsider.client, `couple:${coupleId}`, outsider.id);
    expect(status).not.toBe("SUBSCRIBED");
  });
});
