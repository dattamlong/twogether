"use client";

import { Hand, Paintbrush } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { GiftCabinet } from "@/components/couple/gift-cabinet";
import { Mailbox } from "@/components/couple/mailbox";
import { CoupleQuestPanel, DailyQuestPanel } from "@/components/rewards/quest-panels";
import { Button } from "@/components/ui/button";
import { EnergyIcon, FlameIcon, GiftIcon, HeartIcon, MailIcon, SparkleIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Panel, Vi } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { HOME_LEVELS } from "@/content/catalog";
import { useSendInteraction, useSendMessage } from "@/features/messages/queries";
import { useProgress } from "@/features/progression/queries";
import { useCoupleRealtime } from "@/features/realtime/couple-channel";
import { readAvatar } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { useInventory, usePlacements, useSaveLayout, useShopItems } from "@/features/shop/queries";
import type { RoomCallbacks } from "@/game/scenes/room-scene";
import { placementProblem, type Placement } from "@/game/world/placement";
import { friendlyError } from "@/lib/errors";
import { useRoomEvents } from "@/stores/room-events";
import { toast } from "@/stores/toast-store";
import { GuestbookPanel } from "@/components/world/guestbook-panel";
import { useSocialSheets } from "@/components/world/social-sheets";
import { homeChannel, useHomeRealtime } from "@/features/world/home-channel";
import { useHomeRemotes } from "@/features/world/use-home-remotes";
import { SPAWN_TILES } from "@/game/world/room";
import { DecorPanel } from "./decor-panel";
import { RoomCanvas } from "./room-canvas";

type ModalKind = "mailbox" | "gifts" | "partner" | "guestbook" | null;

export function HomeScreen() {
  const session = useRequiredSession();
  const router = useRouter();
  const progress = useProgress();
  const placements = usePlacements();
  const inventory = useInventory();
  const shopItems = useShopItems();
  const saveLayout = useSaveLayout();
  const sendInteraction = useSendInteraction();
  const sendMessage = useSendMessage();
  const partnerPresence = useCoupleRealtime((s) => s.partnerPresence);
  const emit = useRoomEvents((s) => s.emit);

  const [modal, setModal] = useState<ModalKind>(null);
  const [decorating, setDecorating] = useState(false);
  const [draft, setDraft] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const openPlayer = useSocialSheets((s) => s.openPlayer);
  const coupleId = session.couple?.id;
  const hostIds = useMemo(() => [session.userId, ...(session.partner ? [session.partner.id] : [])], [session.userId, session.partner]);
  const remotes = useHomeRemotes({ hostIds, exclude: hostIds });
  const guestCount = useHomeRealtime((s) => s.members.filter((m) => !hostIds.includes(m.userId)).length);

  useEffect(() => {
    if (!coupleId) return;
    homeChannel.connect(coupleId, session.userId, {
      userId: session.userId,
      role: "host",
      tile: SPAWN_TILES[session.slot ?? 0],
      facing: "se",
      anim: "idle",
      onlineAt: new Date().toISOString(),
    });
    return () => homeChannel.disconnect();
  }, [coupleId, session.userId, session.slot]);

  const homeLevel = progress.data?.couple?.home_level ?? 1;
  const energy = progress.data?.couple?.love_energy ?? 0;
  const nextHome = HOME_LEVELS.find((l) => l.level === homeLevel + 1);
  const currentHome = HOME_LEVELS.find((l) => l.level === homeLevel) ?? HOME_LEVELS[0];
  const partner = session.partner;
  const ownedEmotes = new Set(inventory.data?.filter((i) => i.user_id === session.userId && i.item_id.startsWith("emote_")).map((i) => i.item_id));

  const ownedPlaceables = useMemo(
    () =>
      (inventory.data ?? []).flatMap((inv) => {
        const item = shopItems.data?.find((s) => s.id === inv.item_id);
        return item && item.footprint_w > 0 && inv.couple_id === session.couple?.id ? [{ inventoryId: inv.id, item }] : [];
      }),
    [inventory.data, shopItems.data, session.couple?.id],
  );

  const roomPlacements = decorating ? draft : (placements.data ?? []);
  const selectedOwned = ownedPlaceables.find((o) => o.inventoryId === selected);
  const decorDraft = decorating && selectedOwned
    ? {
        inventoryId: selectedOwned.inventoryId,
        itemId: selectedOwned.item.id,
        w: selectedOwned.item.footprint_w,
        h: selectedOwned.item.footprint_h,
        flipped: draft.find((p) => p.inventoryId === selectedOwned.inventoryId)?.flipped ?? false,
      }
    : null;

  const callbacks: Omit<RoomCallbacks, "onBroadcast" | "onPresence"> = {
    onAction: (action) => {
      switch (action) {
        case "study":
          toast({ tone: "info", title: "Study time!", vi: "Đến giờ học rồi!" });
          setTimeout(() => router.push("/learn"), 900);
          break;
        case "games":
          setTimeout(() => router.push("/games"), 900);
          break;
        case "memories":
          router.push("/story");
          break;
        case "mailbox":
          setModal("mailbox");
          break;
        case "gifts":
          setModal("gifts");
          break;
        case "sleep":
          toast({
            tone: "love",
            title: "Sweet dreams",
            vi: "Chúc ngủ ngon",
            action: partner ? { label: "Say goodnight", onClick: () => sendMessage.mutate({ kind: "text", body: "Goodnight! Sleep well and dream of us." }) } : undefined,
          });
          break;
        case "sofa_together":
          toast({ tone: "love", title: "Cozy time together", vi: "Khoảnh khắc ấm áp bên nhau" });
          break;
        case "sofa":
          if (partner && !partnerPresence) toast({ tone: "info", title: `Saving a seat for ${partner.display_name}`, vi: "Giữ chỗ cho người ấy" });
          break;
      }
    },
    onPartnerTap: () => setModal("partner"),
    onBlockedTap: () => undefined,
    onRemoteTap: (id) => openPlayer(id),
    onGuestbook: () => setModal("guestbook"),
    onPlaceTile: (tile) => {
      if (!selectedOwned) {
        toast({ tone: "info", title: "Pick an item first", vi: "Hãy chọn một món đồ trước" });
        return;
      }
      const candidate: Placement = {
        inventoryId: selectedOwned.inventoryId,
        itemId: selectedOwned.item.id,
        x: tile.x,
        y: tile.y,
        w: selectedOwned.item.footprint_w,
        h: selectedOwned.item.footprint_h,
        flipped: draft.find((p) => p.inventoryId === selectedOwned.inventoryId)?.flipped ?? false,
      };
      const problem = placementProblem(candidate, draft);
      if (problem) {
        const message = friendlyError({ message: problem });
        toast({ tone: "error", title: message.en, vi: message.vi });
        return;
      }
      setDraft((d) => [...d.filter((p) => p.inventoryId !== candidate.inventoryId), candidate]);
      setSelected(null);
    },
  };

  function startDecorating() {
    setDraft(placements.data ?? []);
    setSelected(null);
    setDecorating(true);
  }

  function interact(kind: "hug" | "wave" | "heart") {
    setModal(null);
    if (kind === "heart") {
      emit({ type: "self_emote", emote: "heart" });
      sendMessage.mutate({ kind: "heart" });
      return;
    }
    if (kind === "wave") emit({ type: "self_emote", emote: "wave" });
    sendInteraction.mutate(kind, {
      onSuccess: () => {
        if (kind === "hug") {
          toast({
            tone: "love",
            title: partnerPresence ? `Waiting for ${partner?.display_name} to hug back…` : `${partner?.display_name} will see your hug when they're back`,
            vi: partnerPresence ? "Đang chờ người ấy ôm lại…" : "Người ấy sẽ thấy cái ôm khi quay lại",
          });
        }
      },
    });
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(placements.data ?? []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <section aria-label="Our room" className="panel relative h-[min(62dvh,620px)] min-h-[340px] overflow-hidden p-0">
          <RoomCanvas session={session} homeLevel={homeLevel} placements={roomPlacements} decor={decorDraft} callbacks={callbacks} remotes={remotes} />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
            <span className="rounded-full bg-white/85 px-3 py-1 font-display text-sm font-semibold shadow-[var(--shadow-pop)]">{session.couple?.name}</span>
            <span className="w-fit rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-cocoa-400">
              Home Lv. {homeLevel} · {currentHome.title}
            </span>
            {guestCount > 0 ? (
              <span className="w-fit rounded-full bg-lavender-200 px-2.5 py-0.5 text-[11px] font-bold text-plum-700" data-testid="guest-count">
                🌸 {guestCount} visitor{guestCount === 1 ? "" : "s"} here
              </span>
            ) : null}
          </div>
          {partner ? (
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full bg-white/85 py-1 pl-1 pr-3 shadow-[var(--shadow-pop)]">
              <AvatarFace avatar={readAvatar(partner.avatar)} size={30} sleeping={!partnerPresence} />
              <span className="text-xs font-bold">
                {partnerPresence ? (partnerPresence.away ? `${partner.display_name} · away` : `${partner.display_name} is here`) : `${partner.display_name} · resting`}
              </span>
            </div>
          ) : (
            <Link href="/pair" className="absolute right-3 top-3 rounded-full bg-sakura-400 px-3 py-1.5 text-xs font-bold text-white shadow-[var(--shadow-pop)]">
              Invite your partner
            </Link>
          )}
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] font-semibold text-cocoa-400/90">
            {decorating ? "Choose an item below, then tap a free tile" : "Tap the floor to walk · tap furniture to interact"}
          </p>
        </section>

        {decorating ? (
          <DecorPanel
            owned={ownedPlaceables}
            draft={draft}
            selected={selected}
            onSelect={setSelected}
            onRemove={(id) => setDraft((d) => d.filter((p) => p.inventoryId !== id))}
            onFlip={(id) => setDraft((d) => d.map((p) => (p.inventoryId === id ? { ...p, flipped: !p.flipped } : p)))}
            onCancel={() => {
              setDecorating(false);
              setSelected(null);
            }}
            onSave={() =>
              saveLayout.mutate(draft, {
                onSuccess: () => {
                  setDecorating(false);
                  setSelected(null);
                },
              })
            }
            saving={saveLayout.isPending}
            dirty={dirty}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Room actions">
            <Button variant="soft" size="sm" onClick={() => interact("wave")} disabled={!partner}>
              <Hand size={16} /> Wave
            </Button>
            <Button variant="soft" size="sm" onClick={() => interact("heart")} disabled={!partner}>
              <HeartIcon size={18} /> Heart
            </Button>
            <Button variant="soft" size="sm" onClick={() => setModal("partner")} disabled={!partner}>
              <SparkleIcon size={18} /> Hug…
            </Button>
            {ownedEmotes.has("emote_twirl") ? (
              <Button variant="soft" size="sm" onClick={() => emit({ type: "self_emote", emote: "twirl" })}>
                Twirl
              </Button>
            ) : null}
            {ownedEmotes.has("emote_heart_burst") ? (
              <Button variant="soft" size="sm" onClick={() => emit({ type: "self_emote", emote: "heart_burst" })}>
                Heart Burst
              </Button>
            ) : null}
            <Button variant="soft" size="sm" onClick={() => setModal("mailbox")}>
              <MailIcon size={18} /> Mailbox
            </Button>
            <Button variant="soft" size="sm" onClick={() => setModal("gifts")}>
              <GiftIcon size={18} /> Gifts
            </Button>
            <Button variant="soft" size="sm" onClick={() => setModal("guestbook")}>
              <SparkleIcon size={18} /> Guestbook
            </Button>
            <Button variant="secondary" size="sm" className="ml-auto" onClick={startDecorating}>
              <Paintbrush size={16} /> Decorate
            </Button>
          </div>
        )}

        <Panel className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <EnergyIcon size={40} />
            <div>
              <p className="font-display font-semibold">Love Energy · {energy}</p>
              <Vi className="text-xs">Năng lượng tình yêu làm ngôi nhà lớn dần</Vi>
            </div>
          </div>
          <div className="flex-1 sm:pl-4">
            {nextHome ? (
              <>
                <ProgressBar value={energy - currentHome.loveEnergy} max={nextHome.loveEnergy - currentHome.loveEnergy} tone="mint" label="Home level progress" />
                <p className="mt-1 text-xs text-cocoa-400">
                  {nextHome.loveEnergy - energy} more to unlock <b>{nextHome.title}</b> ({nextHome.title_vi})
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-mint-600">Your dream home is complete!</p>
            )}
          </div>
        </Panel>
      </div>

      <aside className="flex flex-col gap-4">
        <DailyQuestPanel />
        <Panel className="flex items-center gap-3">
          <FlameIcon size={40} lit={(progress.data?.coupleStreak?.current ?? 0) > 0} />
          <div className="flex-1">
            <p className="font-display font-semibold">Couple streak · {progress.data?.coupleStreak?.current ?? 0} days</p>
            <p className="text-xs text-plum-500">Both finish a lesson, a mini-game, or 5 reviews on the same day.</p>
            <Vi className="text-xs">Cả hai cùng xong 1 bài học, 1 mini-game hoặc 5 câu ôn tập trong ngày</Vi>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/learn">Study</Link>
          </Button>
        </Panel>
        <CoupleQuestPanel />
      </aside>

      {coupleId ? (
        <GuestbookPanel open={modal === "guestbook"} onClose={() => setModal(null)} coupleId={coupleId} title={session.couple?.name ?? ""} isHost me={session.userId} />
      ) : null}
      <Modal open={modal === "mailbox"} onOpenChange={(open) => setModal(open ? "mailbox" : null)} title="Mailbox" subtitle="Hộp thư của hai bạn">
        <Mailbox compact />
      </Modal>
      <Modal open={modal === "gifts"} onOpenChange={(open) => setModal(open ? "gifts" : null)} title="Gift Cabinet" subtitle="Tủ quà">
        <GiftCabinet />
      </Modal>
      <Modal
        open={modal === "partner"}
        onOpenChange={(open) => setModal(open ? "partner" : null)}
        title={partner ? `Be sweet to ${partner.display_name}` : "Your partner"}
        subtitle={partnerPresence ? "Người ấy đang ở đây" : "Người ấy đang nghỉ — họ sẽ thấy khi quay lại"}
      >
        <div className="grid grid-cols-3 gap-3">
          <button className="flex flex-col items-center gap-2 rounded-3xl bg-sakura-50 p-4 font-display font-semibold ring-2 ring-white hover:bg-sakura-100" onClick={() => interact("hug")}>
            <SparkleIcon size={40} /> Hug
            <span lang="vi" className="text-xs font-normal text-cocoa-400">Ôm</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-3xl bg-lavender-100 p-4 font-display font-semibold ring-2 ring-white hover:bg-lavender-200" onClick={() => interact("wave")}>
            <Hand size={40} className="text-plum-500" /> Wave
            <span lang="vi" className="text-xs font-normal text-cocoa-400">Vẫy tay</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-3xl bg-peach-100 p-4 font-display font-semibold ring-2 ring-white hover:bg-peach-200" onClick={() => interact("heart")}>
            <HeartIcon size={40} /> Heart
            <span lang="vi" className="text-xs font-normal text-cocoa-400">Thả tim</span>
          </button>
        </div>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => {
            setModal("gifts");
          }}
        >
          <GiftIcon size={18} /> Send a gift
        </Button>
        <p className="mt-3 text-center text-xs text-cocoa-400">Hugs need a hug back — they&apos;re always optional.</p>
      </Modal>
    </div>
  );
}
