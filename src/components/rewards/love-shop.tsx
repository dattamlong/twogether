"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SendGift } from "@/components/couple/gift-cabinet";
import { Button } from "@/components/ui/button";
import { CoinIcon, GiftIcon, HeartIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { useArchiveReward, useCoupleRewards, useFulfillRedemption, useProposeReward, useRedeemReward, useRespondReward } from "@/features/couples/rewards";
import { useProgress } from "@/features/progression/queries";
import { useRequiredSession } from "@/features/session/use-session";
import { useInventory, usePurchase, useShopItems, type ShopItemRow } from "@/features/shop/queries";
import { cn } from "@/lib/utils";
import { ItemArt } from "./item-art";

const CATEGORIES = [
  { id: "all", label: "All", vi: "Tất cả" },
  { id: "furniture", label: "Furniture", vi: "Nội thất" },
  { id: "plants", label: "Plants", vi: "Cây cảnh" },
  { id: "decorations", label: "Decor", vi: "Trang trí" },
  { id: "clothing", label: "Clothing", vi: "Quần áo" },
  { id: "accessories", label: "Accessories", vi: "Phụ kiện" },
  { id: "animations", label: "Animations", vi: "Hoạt ảnh" },
  { id: "gifts", label: "Gifts", vi: "Quà tặng" },
];

export function LoveShop() {
  const [tab, setTab] = useState<"shop" | "rewards">("shop");
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Love Shop</h1>
          <Vi>Dùng Xu tình yêu để làm đẹp ngôi nhà và tặng quà</Vi>
        </div>
        <div className="flex gap-1 rounded-2xl bg-white/70 p-1" role="tablist">
          {[
            { id: "shop" as const, label: "Shop" },
            { id: "rewards" as const, label: "Real-life rewards" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn("rounded-xl px-4 py-2 font-display text-sm font-semibold", tab === t.id ? "bg-sakura-400 text-white" : "text-plum-500")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      {tab === "shop" ? <Catalog /> : <CoupleRewards />}
    </div>
  );
}

function Catalog() {
  const session = useRequiredSession();
  const items = useShopItems();
  const inventory = useInventory();
  const progress = useProgress();
  const purchase = usePurchase();
  const [category, setCategory] = useState("all");
  const [confirm, setConfirm] = useState<ShopItemRow | null>(null);
  const [gifting, setGifting] = useState(false);

  if (items.isLoading) return <LoadingBlock />;
  if (items.error) return <ErrorBlock error={items.error} onRetry={() => items.refetch()} />;

  const coins = progress.data?.mine.coins ?? 0;
  const homeLevel = progress.data?.couple?.home_level ?? 1;
  const visible = items.data!.filter((i) => i.shop_visible && (category === "all" || i.category === category));
  const ownedCount = (id: string) => inventory.data?.filter((i) => i.item_id === id && (i.user_id === session.userId || i.couple_id === session.couple?.id) && i.source !== "gift").length ?? 0;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={cn("shrink-0 rounded-2xl px-3 py-1.5 text-left ring-2", category === c.id ? "bg-sakura-100 ring-sakura-300" : "bg-white/70 ring-white")}
          >
            <span className="block text-sm font-bold">{c.label}</span>
            <span lang="vi" className="block text-[11px] text-cocoa-400">{c.vi}</span>
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((item) => {
          const owned = ownedCount(item.id);
          const single = ["clothing", "accessories", "animations"].includes(item.category);
          const locked = item.min_home_level > homeLevel;
          const affordable = coins >= item.price;
          return (
            <li key={item.id} className="panel flex flex-col items-center gap-2 p-4 text-center">
              <div className="grid h-20 place-items-center">
                <ItemArt itemId={item.id} size={72} />
              </div>
              <div>
                <p className="font-display font-semibold leading-tight">{item.name}</p>
                <p lang="vi" className="text-[11px] text-cocoa-400">{item.name_vi}</p>
              </div>
              <p className="line-clamp-2 text-xs text-plum-500">{item.description}</p>
              <p className="flex items-center gap-1 font-display font-bold">
                <CoinIcon size={18} /> {item.price}
              </p>
              <div className="mt-auto w-full">
                {item.category === "gifts" ? (
                  <Button size="sm" className="w-full" variant="secondary" onClick={() => setGifting(true)} disabled={!session.partner}>
                    <GiftIcon size={16} /> Send
                  </Button>
                ) : single && owned ? (
                  <Button size="sm" className="w-full" variant="mint" asChild>
                    <Link href={item.category === "animations" ? "/home" : "/profile"}>
                      <Check size={14} /> {item.category === "animations" ? "Use in room" : "Owned · wear"}
                    </Link>
                  </Button>
                ) : locked ? (
                  <Button size="sm" className="w-full" variant="soft" disabled>
                    <Lock size={14} /> Home Lv. {item.min_home_level}
                  </Button>
                ) : (
                  <Button size="sm" className="w-full" variant={affordable ? "primary" : "soft"} disabled={!affordable} onClick={() => setConfirm(item)}>
                    {affordable ? (owned ? `Buy another (${owned})` : "Buy") : "Need more coins"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)} title={confirm ? `Buy ${confirm.name}?` : ""} subtitle={confirm?.name_vi}>
        {confirm ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <ItemArt itemId={confirm.id} size={96} />
            <p className="text-plum-500">{confirm.description}</p>
            <p className="flex items-center gap-1 font-display text-lg font-bold">
              <CoinIcon size={22} /> {confirm.price} · you have {coins}
            </p>
            {confirm.footprint_w > 0 ? <p className="text-xs text-cocoa-400">It goes into your shared inventory — place it with “Decorate” in Our Home.</p> : null}
            <Button
              size="lg"
              className="w-full"
              loading={purchase.isPending}
              onClick={() => purchase.mutate(confirm.id, { onSuccess: () => setConfirm(null) })}
            >
              Buy for {confirm.price}
            </Button>
          </div>
        ) : null}
      </Modal>
      <Modal open={gifting} onOpenChange={setGifting} title="Send a gift" subtitle="Gửi quà">
        <SendGift />
      </Modal>
    </>
  );
}

function CoupleRewards() {
  const session = useRequiredSession();
  const { data, isLoading, error, refetch } = useCoupleRewards();
  const progress = useProgress();
  const propose = useProposeReward();
  const respond = useRespondReward();
  const archive = useArchiveReward();
  const redeem = useRedeemReward();
  const fulfill = useFulfillRedemption();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(100);

  function submit(event: FormEvent) {
    event.preventDefault();
    propose.mutate({ title, description, cost }, { onSuccess: () => { setTitle(""); setDescription(""); } });
  }

  const partnerName = session.partner?.display_name ?? "your partner";
  const coins = progress.data?.mine.coins ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel>
        <PanelTitle icon={<HeartIcon size={32} />} title="Our real-life rewards" subtitle="Phần thưởng ngoài đời thật — cả hai cùng đồng ý" />
        <p className="mb-3 rounded-2xl bg-lavender-100 px-4 py-2 text-sm text-plum-500">
          These are sweet ideas, never obligations. A reward becomes redeemable only after both of you agree.
        </p>
        {isLoading ? <LoadingBlock /> : null}
        {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}
        {data && data.rewards.length === 0 ? <EmptyState title="No rewards yet" vi="Hãy đề xuất phần thưởng đầu tiên" /> : null}
        <ul className="flex flex-col gap-2">
          {data?.rewards.map((r) => {
            const mine = r.created_by === session.userId;
            return (
              <li key={r.id} className="flex flex-col gap-2 rounded-2xl bg-white/75 p-3 ring-2 ring-white sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-display font-semibold">{r.title}</p>
                  {r.description ? <p className="text-sm text-plum-500">{r.description}</p> : null}
                  <p className="mt-1 flex items-center gap-2 text-xs font-bold text-cocoa-400">
                    <CoinIcon size={14} /> {r.cost}
                    <span className={cn("rounded-full px-2 py-0.5", r.status === "approved" ? "bg-mint-100 text-mint-600" : r.status === "declined" ? "bg-sakura-50" : "bg-gold-200/70")}>
                      {r.status === "proposed" ? (mine ? `Waiting for ${partnerName}` : "Needs your answer") : r.status}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "proposed" && !mine ? (
                    <>
                      <Button size="sm" variant="mint" onClick={() => respond.mutate({ id: r.id, approve: true })}>
                        Agree
                      </Button>
                      <Button size="sm" variant="soft" onClick={() => respond.mutate({ id: r.id, approve: false })}>
                        Not now
                      </Button>
                    </>
                  ) : null}
                  {r.status === "approved" ? (
                    <Button size="sm" disabled={coins < r.cost} loading={redeem.isPending && redeem.variables === r.id} onClick={() => redeem.mutate(r.id)}>
                      Redeem
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => archive.mutate(r.id)} aria-label={`Archive ${r.title}`}>
                    Archive
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {data?.redemptions.length ? (
          <div className="mt-5">
            <h3 className="font-display font-semibold">Redeemed</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.redemptions.map((rd) => {
                const reward = data.rewards.find((r) => r.id === rd.reward_id);
                const mine = rd.redeemed_by === session.userId;
                return (
                  <li key={rd.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
                    <span className="flex-1">
                      {mine ? "You" : partnerName} redeemed <b>{reward?.title ?? "a reward"}</b> · {new Date(rd.redeemed_at).toLocaleDateString()}
                    </span>
                    {rd.fulfilled_at ? (
                      <span className="text-xs font-bold text-mint-600">Done</span>
                    ) : !mine ? (
                      <Button size="sm" variant="mint" onClick={() => fulfill.mutate(rd.id)}>
                        Mark done
                      </Button>
                    ) : (
                      <span className="text-xs text-cocoa-400">Waiting</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Panel>
      <Panel>
        <h3 className="font-display text-lg font-semibold">Suggest a reward</h3>
        <Vi>Đề xuất một phần thưởng dễ thương</Vi>
        <form className="mt-3 flex flex-col gap-3" onSubmit={submit}>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Choose our movie night" required aria-label="Reward title" className="h-11 rounded-2xl border-2 border-lavender-100 bg-white px-3 outline-none focus:border-sakura-300" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 300))} placeholder="Details (optional)" rows={3} aria-label="Reward description" className="rounded-2xl border-2 border-lavender-100 bg-white p-3 outline-none focus:border-sakura-300" />
          <label className="flex items-center gap-2 text-sm font-semibold">
            Cost
            <input type="number" min={10} max={5000} step={10} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="h-11 w-28 rounded-2xl border-2 border-lavender-100 bg-white px-3 outline-none" />
            <CoinIcon size={18} />
          </label>
          <Button type="submit" loading={propose.isPending} disabled={!title.trim() || cost < 10}>
            Suggest to {partnerName}
          </Button>
        </form>
        <p className="mt-3 text-xs text-cocoa-400">Ideas: special video call, favorite meal date, surprise message, choose our next trip.</p>
      </Panel>
    </div>
  );
}
