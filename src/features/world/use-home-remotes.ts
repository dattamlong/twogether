"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { RemoteView } from "@/game/scenes/room-scene";
import { readAvatar } from "../session/types";
import { useHomeRealtime } from "./home-channel";
import { fetchPlayerCards, worldKeys } from "./queries";

export function useHomeRemotes({ hostIds, exclude }: { hostIds: string[]; exclude: string[] }) {
  const members = useHomeRealtime((s) => s.members);
  const visible = useMemo(() => members.filter((m) => !exclude.includes(m.userId)), [members, exclude]);
  const ids = useMemo(() => [...new Set(visible.map((m) => m.userId))].sort(), [visible]);
  const cards = useQuery({
    queryKey: [...worldKeys.cards, ...ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchPlayerCards(ids),
  });

  return useMemo<RemoteView[]>(() => {
    const byId = new Map((cards.data ?? []).map((c) => [c.id, c]));
    return visible.flatMap((m) => {
      const card = byId.get(m.userId);
      if (!card) return [];
      return [{
        id: m.userId,
        name: card.name,
        avatar: readAvatar(card.avatar),
        role: hostIds.includes(m.userId) ? "host" : "guest",
        tile: m.tile,
        facing: m.facing,
        anim: m.anim,
      } satisfies RemoteView];
    });
  }, [visible, cards.data, hostIds]);
}
