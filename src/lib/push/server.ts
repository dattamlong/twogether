import "server-only";
import webpush, { WebPushError } from "web-push";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isSafeDestination, pushCategory, type PushPayload } from "./shared";

const ACTIVE_WINDOW_MS = 70_000;
const CLAIM_WINDOW_MS = 15 * 60_000;

let configured: boolean | null = null;

export function pushConfigured() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@twogether.app";
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  return configured;
}

type Prefs = {
  love_ping_enabled: boolean;
  study_invites_enabled: boolean;
  game_invites_enabled: boolean;
  community_enabled: boolean;
  message_previews_enabled: boolean;
  quiet_start: number | null;
  quiet_end: number | null;
};

const DEFAULT_PREFS: Prefs = {
  love_ping_enabled: true,
  study_invites_enabled: true,
  game_invites_enabled: true,
  community_enabled: true,
  message_previews_enabled: false,
  quiet_start: null,
  quiet_end: null,
};

function categoryEnabled(prefs: Prefs, type: string) {
  switch (pushCategory(type)) {
    case "love":
      return prefs.love_ping_enabled;
    case "study":
      return prefs.study_invites_enabled;
    case "game":
      return prefs.game_invites_enabled;
    case "community":
      return prefs.community_enabled;
    default:
      return false;
  }
}

export function inQuietHours(prefs: Pick<Prefs, "quiet_start" | "quiet_end">, timezone: string, now = new Date()) {
  if (prefs.quiet_start === null || prefs.quiet_end === null || prefs.quiet_start === prefs.quiet_end) return false;
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: timezone }).format(now));
  } catch {
    hour = now.getUTCHours();
  }
  return prefs.quiet_start < prefs.quiet_end ? hour >= prefs.quiet_start && hour < prefs.quiet_end : hour >= prefs.quiet_start || hour < prefs.quiet_end;
}

export type DispatchResult = { id: string; status: "sent" | "skipped" | "failed" | "none"; note: string; devices: number };

export async function dispatchPending(senderId: string, ids?: string[]): Promise<DispatchResult[]> {
  const admin = getAdminSupabase();
  const since = new Date(Date.now() - CLAIM_WINDOW_MS).toISOString();
  let claim = admin
    .from("notifications")
    .update({ push_status: "sending" })
    .eq("sender_user_id", senderId)
    .eq("push_status", "pending")
    .gte("created_at", since);
  if (ids?.length) claim = claim.in("id", ids);
  const { data: claimed, error } = await claim.select("id, recipient_user_id, type, title, body, preview, destination, metadata");
  if (error) throw error;
  if (!claimed?.length) return [];

  const results: DispatchResult[] = [];
  for (const n of claimed) {
    const finish = async (status: DispatchResult["status"], note: string, devices = 0) => {
      await admin.from("notifications").update({ push_status: status, push_note: note }).eq("id", n.id);
      results.push({ id: n.id, status, note, devices });
    };

    if (!pushConfigured()) {
      await finish("none", "push_not_configured");
      continue;
    }
    if (!isSafeDestination(n.destination)) {
      await finish("failed", "unsafe_destination");
      continue;
    }

    const [prefsRow, profile, presence, subs] = await Promise.all([
      admin.from("notification_preferences").select("*").eq("user_id", n.recipient_user_id).maybeSingle(),
      admin.from("profiles").select("timezone").eq("id", n.recipient_user_id).maybeSingle(),
      admin
        .from("device_presence")
        .select("device_id")
        .eq("user_id", n.recipient_user_id)
        .eq("visible", true)
        .gte("last_seen_at", new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString())
        .limit(1),
      admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", n.recipient_user_id),
    ]);
    const prefs: Prefs = { ...DEFAULT_PREFS, ...(prefsRow.data ?? {}) };

    if (!categoryEnabled(prefs, n.type)) {
      await finish("skipped", "preference_off");
      continue;
    }
    if (inQuietHours(prefs, profile.data?.timezone ?? "Asia/Ho_Chi_Minh")) {
      await finish("skipped", "quiet_hours");
      continue;
    }
    if (presence.data?.length) {
      await finish("skipped", "recipient_active");
      continue;
    }
    if (!subs.data?.length) {
      await finish("none", "no_devices");
      continue;
    }

    const isPrivate = Boolean((n.metadata as Record<string, unknown> | null)?.private);
    const payload: PushPayload = {
      id: n.id,
      type: n.type,
      title: n.title,
      body: isPrivate && !prefs.message_previews_enabled ? n.preview : n.body,
      url: n.destination,
    };
    let sent = 0;
    let expired = 0;
    for (const sub of subs.data) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 24,
          urgency: "high",
          topic: n.type.replace(/_/g, "").slice(0, 32),
          timeout: 10_000,
        });
        sent++;
        await Promise.all([
          admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", sub.id),
          admin.from("notification_delivery_attempts").insert({ notification_id: n.id, subscription_id: sub.id, status: "sent", status_code: 201 }),
        ]);
      } catch (e) {
        const code = e instanceof WebPushError ? e.statusCode : null;
        const gone = code === 404 || code === 410;
        if (gone) {
          expired++;
          await admin.from("notification_delivery_attempts").insert({ notification_id: n.id, subscription_id: null, status: "expired", status_code: code, error_code: "subscription_gone" });
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          await admin.from("notification_delivery_attempts").insert({
            notification_id: n.id,
            subscription_id: sub.id,
            status: "failed",
            status_code: code,
            error_code: e instanceof Error ? e.message.slice(0, 120) : "unknown",
          });
          const { data: current } = await admin.from("push_subscriptions").select("failure_count").eq("id", sub.id).maybeSingle();
          await admin.from("push_subscriptions").update({ failure_count: (current?.failure_count ?? 0) + 1 }).eq("id", sub.id);
        }
      }
    }
    if (sent > 0) await finish("sent", `delivered_to_${sent}`, sent);
    else if (expired === subs.data.length) await finish("none", "no_devices");
    else await finish("failed", "push_service_error");
  }
  return results;
}
