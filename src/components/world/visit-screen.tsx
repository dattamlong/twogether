"use client";

import { ArrowLeft, Hand, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { TierBadge } from "@/components/legends/legend-art";
import { RoomCanvas } from "@/components/room/room-canvas";
import { Button } from "@/components/ui/button";
import { HeartIcon, HouseIcon, SparkleIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock } from "@/components/ui/states";
import { tierById } from "@/features/legends/tiers";
import { readAvatar } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { HOME_GUEST_CAPACITY, homeChannel, useHomeRealtime } from "@/features/world/home-channel";
import { useHomeVisit } from "@/features/world/queries";
import { useHomeRemotes } from "@/features/world/use-home-remotes";
import { GUEST_SPAWN, type RoomCallbacks } from "@/game/scenes/room-scene";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { useRoomEvents } from "@/stores/room-events";
import { toast } from "@/stores/toast-store";
import { GuestbookPanel } from "./guestbook-panel";
import { useSocialSheets } from "./social-sheets";

function Travel({ names, reduced }: { names: string; reduced: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 z-20 grid place-items-center overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_50%_40%,#fde4ee_0%,#efeafb_55%,#c7b8ea_100%)]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: reduced ? 0.1 : 0.6 }}
      role="status"
    >
      {!reduced
        ? Array.from({ length: 18 }, (_, i) => (
            <motion.span
              key={i}
              className="absolute size-2 rounded-full bg-white"
              style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
              animate={{ y: [-10, -60], opacity: [0, 1, 0], scale: [0.6, 1.2, 0.4] }}
              transition={{ duration: 1.6 + (i % 4) * 0.3, repeat: Infinity, delay: i * 0.12 }}
            />
          ))
        : null}
      <div className="relative flex flex-col items-center gap-3 text-center">
        <motion.div animate={reduced ? undefined : { rotate: [0, 8, -8, 0], y: [0, -6, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <HouseIcon size={72} />
        </motion.div>
        <p className="font-display text-xl font-semibold text-plum-700">Traveling to {names}&apos;s home…</p>
        <p lang="vi" className="text-sm text-cocoa-400">Đang bay đến nhà {names}…</p>
      </div>
    </motion.div>
  );
}

export function VisitScreen() {
  const { coupleId } = useParams<{ coupleId: string }>();
  const session = useRequiredSession();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const visit = useHomeVisit(coupleId);
  const status = useHomeRealtime((s) => s.status);
  const members = useHomeRealtime((s) => s.members);
  const openPlayer = useSocialSheets((s) => s.openPlayer);
  const openCouple = useSocialSheets((s) => s.openCouple);
  const emit = useRoomEvents((s) => s.emit);
  const [arrived, setArrived] = useState(false);
  const [guestbook, setGuestbook] = useState(false);
  const data = visit.data;
  const hostIds = useMemo(() => data?.members.map((m) => m.id) ?? [], [data?.members]);
  const exclude = useMemo(() => [session.userId], [session.userId]);
  const remotes = useHomeRemotes({ hostIds, exclude });
  const hostsHere = data?.members.filter((m) => members.some((p) => p.userId === m.id)) ?? [];
  const guestsHere = members.filter((m) => !hostIds.includes(m.userId)).length;
  const names = data ? data.members.map((m) => m.name).join(" & ") : "their";
  const placements = useMemo(() => data?.placements ?? [], [data?.placements]);
  const tier = data ? tierById(data.tier) : null;

  useEffect(() => {
    if (data?.isOwn) router.replace("/home");
  }, [data?.isOwn, router]);

  const ready = Boolean(data) && !data?.isOwn;

  useEffect(() => {
    if (!ready) return;
    homeChannel.connect(coupleId, session.userId, {
      userId: session.userId,
      role: "guest",
      tile: GUEST_SPAWN,
      facing: "se",
      anim: "idle",
      onlineAt: new Date().toISOString(),
    });
    return () => homeChannel.disconnect();
  }, [ready, coupleId, session.userId]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      setArrived(true);
      sfx.pop();
    }, reduced ? 50 : 1100);
    return () => clearTimeout(t);
  }, [ready, reduced]);

  const callbacks: Omit<RoomCallbacks, "onBroadcast" | "onPresence"> = {
    onAction: () => undefined,
    onPartnerTap: () => undefined,
    onPlaceTile: () => undefined,
    onBlockedTap: () => toast({ tone: "info", title: "You can't walk there", vi: "Không đi tới đó được" }),
    onRemoteTap: (id) => openPlayer(id),
    onGuestbook: () => setGuestbook(true),
  };

  if (visit.error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <ErrorBlock error={visit.error} onRetry={() => visit.refetch()} />
        <Button asChild variant="soft">
          <Link href="/world?tab=discover">Back to TWOGETHER World</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to TWOGETHER World">
          <Link href="/world?tab=discover">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-lavender-400">Visiting</p>
          <h1 className="truncate text-xl font-bold text-plum-700 sm:text-2xl">{data ? `${names}'s home` : "A cozy home"}</h1>
        </div>
        <Button asChild variant="secondary" className="max-sm:h-10 max-sm:px-3">
          <Link href="/home" aria-label="Return to Our Home">
            <HouseIcon size={20} /> <span className="sm:hidden">Home</span>
            <span className="hidden sm:inline">Return to Our Home</span>
          </Link>
        </Button>
      </div>

      <section aria-label="Visited home" className="panel relative h-[min(64dvh,640px)] min-h-[360px] overflow-hidden p-0">
        {data && !data.isOwn && status !== "full" ? (
          <RoomCanvas
            key={coupleId}
            session={session}
            homeLevel={data.homeLevel}
            placements={placements}
            decor={null}
            callbacks={callbacks}
            mode="visit"
            spawn={GUEST_SPAWN}
            remotes={remotes}
          />
        ) : null}
        {status === "full" ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <p className="text-4xl">🏡</p>
              <p className="font-display text-lg font-semibold text-plum-700">This home is full right now</p>
              <p className="text-sm text-plum-500">Up to {HOME_GUEST_CAPACITY} guests can visit at once. Try again in a little while!</p>
            </div>
          </div>
        ) : null}
        <AnimatePresence>{!arrived ? <Travel names={names} reduced={reduced} /> : null}</AnimatePresence>

        {data && tier ? (
          <>
            <div className="absolute left-3 top-3 flex max-w-[60%] flex-col gap-1">
              <button type="button" onClick={() => openCouple(data.coupleId)} className="flex w-fit items-center gap-1.5 rounded-full bg-white/90 py-1 pl-1 pr-3 shadow-[var(--shadow-pop)]">
                {data.members.map((m) => (
                  <AvatarFace key={m.id} avatar={readAvatar(m.avatar)} size={26} />
                ))}
                <span className="truncate font-display text-sm font-semibold">{data.name}</span>
              </button>
              <span className="flex w-fit items-center gap-1 rounded-full bg-white/75 px-2.5 py-0.5 text-[11px] font-semibold text-cocoa-400">
                <TierBadge tier={tier.id} size={14} /> {tier.name} · Lv {data.level} · Home Lv {data.homeLevel}
              </span>
            </div>
            <div className="absolute right-3 top-3 flex flex-col items-end gap-1" data-testid="visit-presence">
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold shadow-[var(--shadow-pop)]">
                {hostsHere.length ? `${hostsHere.map((h) => h.name).join(" & ")} ${hostsHere.length > 1 ? "are" : "is"} home` : "Hosts are away"}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-cocoa-400">
                <Users size={12} /> {guestsHere + 1} guest{guestsHere ? "s" : ""} visiting
              </span>
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-2 px-3 text-center text-[11px] font-semibold text-cocoa-400/90">
              Tap the floor to walk · tap the glowing book to sign the guestbook · you&apos;re a guest, so nothing here can be moved
            </p>
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Guest actions">
        <Button variant="soft" size="sm" onClick={() => emit({ type: "self_emote", emote: "wave" })} disabled={!arrived}>
          <Hand size={16} /> Wave
        </Button>
        <Button variant="soft" size="sm" onClick={() => emit({ type: "self_emote", emote: "heart" })} disabled={!arrived}>
          <HeartIcon size={18} /> Heart
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setGuestbook(true)} disabled={!data}>
          <SparkleIcon size={18} /> Guestbook
        </Button>
        {data ? (
          <Button variant="soft" size="sm" onClick={() => openCouple(data.coupleId)}>
            Couple profile
          </Button>
        ) : null}
      </div>

      {data && !hostsHere.length && arrived ? (
        <Panel className="flex items-center gap-3 py-3">
          <span className="text-2xl" aria-hidden>
            💌
          </span>
          <p className="text-sm text-plum-500">
            {names} aren&apos;t home right now. Leave a note in their guestbook — they&apos;ll see it when they&apos;re back.
            <Vi className="text-xs">Chủ nhà đang vắng — hãy để lại lời chúc nhé!</Vi>
          </p>
        </Panel>
      ) : null}

      {data ? <GuestbookPanel open={guestbook} onClose={() => setGuestbook(false)} coupleId={data.coupleId} title={`${names}'s home`} isHost={false} me={session.userId} /> : null}
    </div>
  );
}
