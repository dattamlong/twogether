"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SPAWN_TILES } from "@/game/world/room";
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { sfx } from "@/lib/sfx";
import { toast } from "@/stores/toast-store";
import { useRoomEvents } from "@/stores/room-events";
import { qk } from "../query-keys";
import type { SessionData } from "../session/types";
import { coupleChannel } from "./couple-channel";

type Row = Record<string, unknown>;

export async function respondToHug(interactionId: string, accept: boolean) {
  const { error } = await getSupabase().rpc("respond_interaction", { interaction: interactionId, accept });
  if (error) {
    const message = friendlyError(error);
    toast({ tone: "error", title: message.en, vi: message.vi });
    return false;
  }
  if (accept) useRoomEvents.getState().emit({ type: "hug" });
  return true;
}

const promptedHugs = new Set<string>();

export function promptHug(interactionId: string, partnerName: string) {
  if (promptedHugs.has(interactionId)) return;
  promptedHugs.add(interactionId);
  sfx.love();
  toast({
    tone: "love",
    title: `${partnerName} wants a hug!`,
    vi: "Người ấy muốn ôm bạn!",
    durationMs: 15_000,
    action: { label: "Hug back", onClick: () => void respondToHug(interactionId, true) },
  });
}

export function useRealtimeBridge(session: SessionData | null | undefined) {
  const client = useQueryClient();
  const coupleId = session?.couple?.id;
  const userId = session?.userId;
  const partnerName = session?.partner?.display_name ?? "Your partner";
  const name = session?.profile.display_name ?? "";
  const slot = session?.slot ?? 0;

  useEffect(() => {
    if (!coupleId || !userId) return;
    coupleChannel.connect(coupleId, userId, {
      userId,
      name,
      tile: SPAWN_TILES[slot],
      facing: "se",
      anim: "idle",
      away: typeof document !== "undefined" && document.hidden,
      onlineAt: new Date().toISOString(),
    });

    const invalidate = (...keys: (readonly string[])[]) => keys.forEach((queryKey) => client.invalidateQueries({ queryKey }));

    const offChange = coupleChannel.onChange(({ table, payload }) => {
      const row = (payload.new ?? {}) as Row;
      const isInsert = payload.eventType === "INSERT";
      switch (table) {
        case "love_messages":
          invalidate(qk.messages);
          if (isInsert && row.recipient_id === userId) {
            if (row.kind === "gift") {
              toast({ tone: "love", title: `${partnerName} sent you a gift!`, vi: "Bạn nhận được một món quà!" });
              useRoomEvents.getState().emit({ type: "gift" });
              invalidate(qk.inventory);
            } else if (row.kind === "heart") {
              useRoomEvents.getState().emit({ type: "partner_emote", emote: "heart" });
            } else {
              toast({ tone: "love", title: `New message from ${partnerName}`, vi: "Bạn có tin nhắn mới" });
            }
          }
          break;
        case "couple_interactions":
          invalidate(qk.interactions);
          if (isInsert && row.to_user === userId && row.kind === "hug" && row.status === "pending") promptHug(String(row.id), partnerName);
          if (isInsert && row.to_user === userId && row.kind === "wave") {
            toast({ tone: "love", title: `${partnerName} waved at you`, vi: "Người ấy vẫy tay chào bạn" });
          }
          if (payload.eventType === "UPDATE" && row.from_user === userId && row.kind === "hug" && row.status === "accepted") {
            useRoomEvents.getState().emit({ type: "hug" });
          }
          break;
        case "furniture_placements":
          invalidate(qk.placements);
          break;
        case "couple_progress":
          invalidate(qk.progress);
          break;
        case "memories":
          invalidate(qk.memories);
          break;
        case "daily_love_answers":
          invalidate(qk.loveQuestion, qk.loveHistory);
          break;
        case "couple_members":
          invalidate(qk.session, qk.progress);
          break;
      }
    });

    const offReconnect = coupleChannel.onReconnect(() => {
      client.invalidateQueries();
    });

    const onVisibility = () => coupleChannel.updatePresence({ away: document.hidden });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      offChange();
      offReconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      coupleChannel.disconnect();
    };
  }, [client, coupleId, userId, partnerName, name, slot]);
}
