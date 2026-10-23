"use client";

import { useEffect, useRef, useState } from "react";
import { coupleChannel, useCoupleRealtime } from "@/features/realtime/couple-channel";
import { readAvatar, type SessionData } from "@/features/session/types";
import type { DecorDraft, PartnerView, RoomCallbacks, RoomScene } from "@/game/scenes/room-scene";
import type { Placement } from "@/game/world/placement";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useRoomEvents } from "@/stores/room-events";

type Props = {
  session: SessionData;
  homeLevel: number;
  placements: Placement[];
  decor: DecorDraft;
  callbacks: Omit<RoomCallbacks, "onBroadcast" | "onPresence">;
};

export function RoomCanvas({ session, homeLevel, placements, decor, callbacks }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RoomScene | null>(null);
  const callbacksRef = useRef(callbacks);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const reducedMotion = usePrefersReducedMotion();
  const partnerPresence = useCoupleRealtime((s) => s.partnerPresence);
  const events = useRoomEvents((s) => s.events);
  const consume = useRoomEvents((s) => s.consume);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const avatarKey = JSON.stringify(session.profile.avatar);
  const initial = useRef({ session, homeLevel, reducedMotion });

  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    let scene: RoomScene | null = null;
    const { session: s, homeLevel: level, reducedMotion: reduced } = initial.current;

    import("@/game/scenes/room-scene")
      .then(async ({ RoomScene }) => {
        if (cancelled || !host.current) return;
        scene = new RoomScene({
          host: host.current,
          self: { name: s.profile.display_name, avatar: readAvatar(s.profile.avatar), slot: s.slot ?? 0 },
          homeLevel: level,
          reducedMotion: reduced,
          callbacks: {
            onAction: (...args) => callbacksRef.current.onAction(...args),
            onPartnerTap: () => callbacksRef.current.onPartnerTap(),
            onPlaceTile: (tile) => callbacksRef.current.onPlaceTile(tile),
            onBlockedTap: () => callbacksRef.current.onBlockedTap(),
            onBroadcast: (event) => coupleChannel.send(event),
            onPresence: (patch) => coupleChannel.updatePresence(patch),
          },
        });
        await scene.init();
        if (cancelled) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        setStatus("ready");
      })
      .catch((error) => {
        console.error("Room failed to start", error);
        if (!cancelled) setStatus("error");
      });

    const offBroadcast = coupleChannel.onBroadcast((envelope) => sceneRef.current?.applyRemote(envelope));
    return () => {
      cancelled = true;
      offBroadcast();
      scene?.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setSelfAvatar(readAvatar(JSON.parse(avatarKey)), session.profile.display_name);
  }, [avatarKey, session.profile.display_name, status]);

  useEffect(() => {
    sceneRef.current?.setHomeLevel(homeLevel);
  }, [homeLevel, status]);

  useEffect(() => {
    sceneRef.current?.setPlacements(placements);
  }, [placements, status]);

  useEffect(() => {
    sceneRef.current?.setDecorMode(decor);
  }, [decor, status]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion, status]);

  useEffect(() => {
    const partner = session.partner;
    let view: PartnerView;
    if (!partner) view = { mode: "hidden" };
    else if (!partnerPresence) view = { mode: "resting", name: partner.display_name, avatar: readAvatar(partner.avatar) };
    else view = { mode: "present", name: partner.display_name, avatar: readAvatar(partner.avatar), presence: partnerPresence };
    sceneRef.current?.setPartner(view);
  }, [session.partner, partnerPresence, status]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const event of events) {
      consume(event.id);
      if (event.type === "hug") scene.playHug();
      else if (event.type === "gift") scene.playGiftReceived();
      else if (event.type === "celebrate") scene.celebrateSelf();
      else if (event.type === "self_emote") scene.emote(event.emote);
    }
  }, [events, consume, status]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.75rem]">
      <div ref={host} className="absolute inset-0" />
      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <div className="skeleton h-2/3 w-2/3 opacity-70" />
          <span className="sr-only">Loading room…</span>
        </div>
      ) : null}
      {status === "error" ? (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="font-display text-plum-700">
            The room couldn&apos;t start on this device (WebGL unavailable).
            <span lang="vi" className="block text-sm text-cocoa-400">Thiết bị không hỗ trợ hiển thị căn phòng.</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
