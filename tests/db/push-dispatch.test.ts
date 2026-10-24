import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { admin, createCouple, expectOk, type TestUser } from "./helpers";

const sent: { endpoint: string; payload: Record<string, string>; options: Record<string, unknown> }[] = [];
const failures = new Map<string, number>();

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => {
  class WebPushError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    WebPushError,
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async (sub: { endpoint: string }, body: string, options: Record<string, unknown>) => {
        const code = failures.get(sub.endpoint);
        if (code) throw new WebPushError(`push failed ${code}`, code);
        sent.push({ endpoint: sub.endpoint, payload: JSON.parse(body), options });
        return { statusCode: 201 };
      }),
    },
  };
});

const { dispatchPending, inQuietHours } = await import("@/lib/push/server");

const device = () => ({ endpoint: `https://push.example.test/${randomUUID()}`, p256dh: "B".repeat(87), auth: "A".repeat(22) });

async function ping(user: TestUser, kind = "miss_you", message?: string) {
  const res = expectOk(await user.client.rpc("send_love_ping", { kind, message, client_id: randomUUID() })) as unknown as { notification: { id: string } };
  return res.notification.id;
}

beforeEach(() => {
  sent.length = 0;
  failures.clear();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||= "test-public";
  process.env.VAPID_PRIVATE_KEY ||= "test-private";
});

describe("push dispatch", () => {
  it("sends one push per registered device with a safe payload, once", async () => {
    const { a, b } = await createCouple();
    const phone = device();
    const laptop = device();
    expectOk(await b.client.rpc("save_push_subscription", { ...phone, device_label: "iPhone" }));
    expectOk(await b.client.rpc("save_push_subscription", { ...laptop, device_label: "Mac" }));
    const id = await ping(a);

    const [result] = await dispatchPending(a.id, [id]);
    expect(result).toMatchObject({ id, status: "sent", devices: 2 });
    expect(sent.map((s) => s.endpoint).sort()).toEqual([phone.endpoint, laptop.endpoint].sort());
    expect(sent[0].payload).toEqual({ id, type: "love_ping", title: "💌 Mai misses you!", body: "I miss you! Come spend some time with me 🥺💕", url: "/home" });
    expect(sent[0].options).toMatchObject({ TTL: 86400, urgency: "high" });

    expect(await dispatchPending(a.id, [id])).toEqual([]);
    expect(sent).toHaveLength(2);
    const attempts = await admin().from("notification_delivery_attempts").select("status").eq("notification_id", id);
    expect(attempts.data?.map((r) => r.status)).toEqual(["sent", "sent"]);
    expect((await b.client.rpc("get_notifications", {})).data).toHaveLength(1);
  });

  it("never lets someone else dispatch your notifications", async () => {
    const { a, b } = await createCouple();
    expectOk(await b.client.rpc("save_push_subscription", { ...device() }));
    const id = await ping(a);
    expect(await dispatchPending(b.id, [id])).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("hides private custom text on the lock screen unless previews are enabled", async () => {
    const { a, b } = await createCouple();
    expectOk(await b.client.rpc("save_push_subscription", { ...device() }));
    const hidden = await ping(a, "custom", "secret sweet words");
    await dispatchPending(a.id, [hidden]);
    expect(sent[0].payload.body).toBe("Mai sent you a little love note 💗");

    expectOk(await b.client.rpc("update_notification_settings", { settings: { messagePreviews: true } }));
    const shown = await ping(a, "custom", "secret sweet words");
    await dispatchPending(a.id, [shown]);
    expect(sent[1].payload.body).toBe("secret sweet words");
  });

  it("skips push when the recipient is active, opted out, or in quiet hours — but keeps the inbox", async () => {
    const { a, b } = await createCouple();
    expectOk(await b.client.rpc("save_push_subscription", { ...device() }));

    expectOk(await b.client.rpc("touch_device_presence", { device: "device-active-1", visible: true }));
    const active = await ping(a);
    expect((await dispatchPending(a.id, [active]))[0]).toMatchObject({ status: "skipped", note: "recipient_active" });
    expectOk(await b.client.rpc("touch_device_presence", { device: "device-active-1", visible: false }));

    expectOk(await b.client.rpc("update_notification_settings", { settings: { lovePing: false } }));
    const off = await ping(a);
    expect((await dispatchPending(a.id, [off]))[0]).toMatchObject({ status: "skipped", note: "preference_off" });
    expectOk(await b.client.rpc("update_notification_settings", { settings: { lovePing: true } }));

    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
    expectOk(await b.client.rpc("update_notification_settings", { settings: { quietStart: hour, quietEnd: (hour + 1) % 24 } }));
    const quiet = await ping(a);
    expect((await dispatchPending(a.id, [quiet]))[0]).toMatchObject({ status: "skipped", note: "quiet_hours" });

    expect(sent).toEqual([]);
    expect((await b.client.rpc("get_notifications", {})).data).toHaveLength(3);
  });

  it("removes expired subscriptions, keeps temporarily failing ones, and reports no devices honestly", async () => {
    const { a, b } = await createCouple();
    const gone = device();
    const flaky = device();
    const healthy = device();
    for (const d of [gone, flaky, healthy]) expectOk(await b.client.rpc("save_push_subscription", { ...d }));
    failures.set(gone.endpoint, 410);
    failures.set(flaky.endpoint, 503);

    const id = await ping(a);
    expect((await dispatchPending(a.id, [id]))[0]).toMatchObject({ status: "sent", devices: 1 });
    const remaining = await admin().from("push_subscriptions").select("endpoint, failure_count").eq("user_id", b.id);
    expect(remaining.data?.map((r) => r.endpoint).sort()).toEqual([flaky.endpoint, healthy.endpoint].sort());
    expect(remaining.data?.find((r) => r.endpoint === flaky.endpoint)?.failure_count).toBe(1);

    failures.set(healthy.endpoint, 404);
    failures.set(flaky.endpoint, 500);
    const second = await ping(a);
    expect((await dispatchPending(a.id, [second]))[0]).toMatchObject({ status: "failed", note: "push_service_error" });

    const { a: c, b: d } = await createCouple();
    const lonely = await ping(c);
    expect((await dispatchPending(c.id, [lonely]))[0]).toMatchObject({ status: "none", note: "no_devices" });
    expect((await d.client.rpc("get_notifications", {})).data).toHaveLength(1);
  });

  it("computes quiet hours across midnight", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 9, 24, h - 7, 30));
    expect(inQuietHours({ quiet_start: 22, quiet_end: 7 }, "Asia/Ho_Chi_Minh", at(23))).toBe(true);
    expect(inQuietHours({ quiet_start: 22, quiet_end: 7 }, "Asia/Ho_Chi_Minh", at(6))).toBe(true);
    expect(inQuietHours({ quiet_start: 22, quiet_end: 7 }, "Asia/Ho_Chi_Minh", at(12))).toBe(false);
    expect(inQuietHours({ quiet_start: null, quiet_end: null }, "Asia/Ho_Chi_Minh", at(23))).toBe(false);
  });
});
