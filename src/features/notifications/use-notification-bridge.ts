"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SessionData } from "@/features/session/types";
import { worldLobby } from "@/features/world/world-channel";
import { getSupabase } from "@/lib/supabase/client";
import { sfx } from "@/lib/sfx";
import { useRoomEvents } from "@/stores/room-events";
import { toast } from "@/stores/toast-store";
import { registerServiceWorker, syncExistingSubscription } from "./push";
import { notificationKeys } from "./queries";
import { safeDestination, type NotificationSettings } from "./types";

const HEARTBEAT_MS = 45_000;

function deviceId() {
  try {
    const existing = localStorage.getItem("twogether:device");
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem("twogether:device", created);
    return created;
  } catch {
    return "ephemeral-device";
  }
}

function touch(device: string, visible: boolean) {
  void getSupabase().rpc("touch_device_presence", { device, visible }).then(() => undefined);
}

const TOAST_TYPES = new Set(["love_ping", "study_invitation", "game_invitation", "gift_received", "friend_request", "guestbook_signed", "couple_quest_completed"]);

export function useNotificationBridge(session: SessionData | null | undefined) {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session?.userId;

  useEffect(() => {
    if (!userId) return;
    const device = deviceId();
    const beat = () => touch(device, document.visibilityState === "visible");
    beat();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") beat();
    }, HEARTBEAT_MS);
    const onVisibility = () => beat();
    const onHide = () => touch(device, false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      touch(device, false);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void registerServiceWorker().then(() => syncExistingSubscription());
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type !== "twogether:navigate" || typeof data.url !== "string") return;
      const url = new URL(data.url, window.location.origin);
      const opened = url.searchParams.get("notification");
      url.searchParams.delete("notification");
      if (opened && /^[0-9a-f-]{36}$/i.test(opened)) {
        void getSupabase()
          .rpc("mark_notifications_read", { ids: [opened] })
          .then(() => client.invalidateQueries({ queryKey: notificationKeys.all }));
      }
      router.push(safeDestination(url.pathname + url.search));
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [userId, router, client]);

  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const opened = params.get("notification");
    if (opened && /^[0-9a-f-]{36}$/i.test(opened)) {
      void getSupabase()
        .rpc("mark_notifications_read", { ids: [opened] })
        .then(() => client.invalidateQueries({ queryKey: notificationKeys.all }));
      params.delete("notification");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, [userId, pathname, client]);

  useEffect(() => {
    if (!userId) return;
    const seen = new Set<string>();
    return worldLobby.onRow((table, row) => {
      if (table !== "notifications") return;
      client.invalidateQueries({ queryKey: notificationKeys.all });
      const id = row.id as string;
      if (!id || seen.has(id) || row.recipient_user_id !== userId || row.read_at || row.deleted_at) return;
      if (Date.now() - new Date(String(row.created_at)).getTime() > 60_000) return;
      seen.add(id);
      const type = String(row.type);
      const prefs = client.getQueryData<NotificationSettings>(notificationKeys.settings);
      if ((type === "love_ping" || type === "study_invitation") && window.location.pathname === "/home") useRoomEvents.getState().emit({ type: "love_ping_received" });
      if (!TOAST_TYPES.has(type)) return;
      if (prefs?.sound !== false) {
        if (type === "love_ping" || type === "study_invitation" || type === "gift_received") sfx.love();
        else sfx.pop();
      }
      const destination = safeDestination(String(row.destination ?? "/home"));
      toast({
        tone: type === "love_ping" || type === "gift_received" || type === "study_invitation" ? "love" : "info",
        title: String(row.title ?? "TWOGETHER"),
        vi: String(row.body ?? ""),
        durationMs: type === "love_ping" ? 12_000 : 6_000,
        action: {
          label: destination === "/home" ? "Go home" : "Open",
          onClick: () => {
            void getSupabase()
              .rpc("mark_notifications_read", { ids: [id] })
              .then(() => client.invalidateQueries({ queryKey: notificationKeys.all }));
            router.push(destination);
          },
        },
      });
    });
  }, [userId, client, router]);
}
