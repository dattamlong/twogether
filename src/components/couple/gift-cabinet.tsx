"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CoinIcon, GiftIcon } from "@/components/ui/icons";
import { Vi } from "@/components/ui/panel";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useMessages, useOpenGift, useSendGift } from "@/features/messages/queries";
import { useProgress } from "@/features/progression/queries";
import { useSession } from "@/features/session/use-session";
import { useShopItems } from "@/features/shop/queries";
import { useRoomEvents } from "@/stores/room-events";
import { cn } from "@/lib/utils";
import { ItemArt } from "@/components/rewards/item-art";

export function GiftCabinet() {
  const { data: session } = useSession();
  const { data: messages, isLoading } = useMessages();
  const items = useShopItems();
  const open = useOpenGift();
  const [revealed, setRevealed] = useState<string | null>(null);
  const gifts = messages?.filter((m) => m.kind === "gift" && m.recipient_id === session?.userId) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="font-display text-lg font-semibold">Gifts for you</h3>
        <Vi>Quà dành cho bạn</Vi>
        {isLoading ? <LoadingBlock className="mt-3" /> : null}
        {!isLoading && gifts.length === 0 ? <div className="mt-3"><EmptyState title="Your cabinet is waiting" vi="Tủ quà đang chờ" art={<GiftIcon size={40} />} /></div> : null}
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gifts.map((g) => {
            const item = items.data?.find((i) => i.id === g.item_id);
            const isOpen = Boolean(g.opened_at) || revealed === g.id;
            return (
              <li key={g.id}>
                <button
                  className={cn("relative flex h-36 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl p-3 text-center ring-2 transition", isOpen ? "bg-white ring-white" : "bg-sakura-100 ring-sakura-200 hover:-translate-y-0.5")}
                  onClick={() => {
                    if (isOpen) return;
                    setRevealed(g.id);
                    open.mutate(g.id);
                    useRoomEvents.getState().emit({ type: "gift" });
                  }}
                  aria-label={isOpen ? `${item?.name ?? "Gift"}${g.body ? `: ${g.body}` : ""}` : "Open gift"}
                >
                  <AnimatePresence mode="wait">
                    {isOpen ? (
                      <motion.div key="open" initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0.55 }} className="flex flex-col items-center">
                        <ItemArt itemId={item?.id ?? ""} size={56} />
                        <span className="font-display text-sm font-semibold">{item?.name}</span>
                        {g.body ? <span className="line-clamp-2 text-xs text-cocoa-400">“{g.body}”</span> : null}
                      </motion.div>
                    ) : (
                      <motion.div key="closed" exit={{ scale: 1.3, opacity: 0 }} animate={{ rotate: [0, -6, 6, -4, 0] }} transition={{ repeat: Infinity, repeatDelay: 1.6, duration: 0.6 }}>
                        <GiftIcon size={56} />
                        <span className="font-display text-sm font-semibold">Tap to open</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <SendGift />
    </div>
  );
}

export function SendGift() {
  const { data: session } = useSession();
  const items = useShopItems();
  const progress = useProgress();
  const send = useSendGift();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const gifts = items.data?.filter((i) => i.category === "gifts") ?? [];
  const coins = progress.data?.mine.coins ?? 0;

  return (
    <section>
      <h3 className="font-display text-lg font-semibold">Send a gift to {session?.partner?.display_name ?? "your partner"}</h3>
      <Vi>Gửi quà cho người ấy</Vi>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {gifts.map((g) => (
          <li key={g.id}>
            <button
              onClick={() => setSelected(g.id)}
              aria-pressed={selected === g.id}
              className={cn("flex w-full flex-col items-center gap-1 rounded-2xl bg-white/80 p-2 ring-2 transition", selected === g.id ? "ring-sakura-300" : "ring-white hover:ring-sakura-100")}
            >
              <ItemArt itemId={g.id} size={44} />
              <span className="text-center text-xs font-semibold leading-tight">{g.name}</span>
              <span className="flex items-center gap-1 text-xs font-bold">
                <CoinIcon size={14} /> {g.price}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder="Add a little note (optional)"
          aria-label="Gift note"
          className="h-11 flex-1 rounded-2xl border-2 border-lavender-100 bg-white px-3 outline-none focus:border-sakura-300"
        />
        <Button
          disabled={!selected || !session?.partner || (gifts.find((g) => g.id === selected)?.price ?? 0) > coins}
          loading={send.isPending}
          onClick={() => selected && send.mutate({ itemId: selected, note }, { onSuccess: () => { setNote(""); setSelected(null); } })}
        >
          <GiftIcon size={18} /> Send gift
        </Button>
      </div>
    </section>
  );
}
