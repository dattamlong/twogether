"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { TierBadge } from "@/components/legends/legend-art";
import { Button } from "@/components/ui/button";
import { HeartIcon, HouseIcon } from "@/components/ui/icons";
import { ErrorBlock, Skeleton } from "@/components/ui/states";
import { tierById } from "@/features/legends/tiers";
import { readAvatar } from "@/features/session/types";
import { useDiscoverCouples } from "@/features/world/queries";
import type { CoupleCard, DiscoverSort } from "@/features/world/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { HomePreview } from "./home-preview";
import { OnlineDot, useSocialSheets } from "./social-sheets";

const SORTS: { id: DiscoverSort; label: string; vi: string }[] = [
  { id: "recent", label: "Recently active", vi: "Mới hoạt động" },
  { id: "level", label: "Highest level", vi: "Cấp cao nhất" },
  { id: "legends", label: "Love Legends", vi: "Huyền thoại" },
  { id: "friends", label: "Friends", vi: "Bạn bè" },
];

function activeLabel(day: string | null) {
  if (!day) return "New home";
  const days = Math.round((Date.now() - new Date(`${day}T12:00:00Z`).getTime()) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days} days ago`;
  return "Quiet lately";
}

export function CoupleCollectible({ couple, index }: { couple: CoupleCard; index: number }) {
  const openCouple = useSocialSheets((s) => s.openCouple);
  const reduced = usePrefersReducedMotion();
  const tier = tierById(couple.tier);
  const [a, b] = couple.members;

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 18, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, type: "spring", bounce: 0.35 }}
      whileHover={reduced ? undefined : { y: -6, rotate: 0.6 }}
      className="relative"
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-[1.75rem] p-[3px] shadow-[var(--shadow-soft)]"
        style={{ background: `linear-gradient(140deg, ${tier.colors.from}, ${tier.colors.to})` }}
      >
        <div className="flex h-full flex-col gap-2 rounded-[1.6rem] bg-white/95 p-3">
          <button type="button" onClick={() => openCouple(couple.coupleId)} className="text-left" aria-label={`Open ${couple.name} profile`}>
            <div className="flex items-start justify-between">
              <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 ring-lavender-100" title={tier.name}>
                <TierBadge tier={tier.id} size={16} /> {tier.name}
              </span>
              <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-[10px] font-bold text-plum-700">Lv {couple.level}</span>
            </div>
            <div className="mt-1 flex items-end justify-center gap-1">
              {[a, b].map((m, i) =>
                m ? (
                  <span key={m.id} className="relative">
                    <AvatarFace avatar={readAvatar(m.avatar)} size={58} />
                    <span className="absolute bottom-0.5 right-0.5">
                      <OnlineDot userId={m.id} />
                    </span>
                  </span>
                ) : (
                  <span key={i} className="grid size-[58px] place-items-center rounded-full bg-cream-100 text-xs text-cocoa-400">?</span>
                ),
              )}
            </div>
            <p className="mt-1 truncate text-center font-display text-base font-semibold text-plum-700">
              {a?.name}
              {b ? (
                <>
                  {" "}
                  <HeartIcon size={13} className="inline" /> {b.name}
                </>
              ) : null}
            </p>
            <p className="truncate text-center text-xs text-cocoa-400">{couple.name}</p>
          </button>
          <HomePreview homeLevel={couple.homeLevel} items={couple.items} className="h-24" />
          <div className="flex items-center justify-between text-[11px] font-semibold text-cocoa-400">
            <span>{activeLabel(couple.lastActive)}</span>
            {couple.isFriend ? <span className="rounded-full bg-mint-100 px-2 py-0.5 text-mint-600">Friend</span> : <span>{couple.weeklyScore.toLocaleString()} pts this week</span>}
          </div>
          <Button asChild size="sm" className="mt-auto">
            <Link href={`/world/visit/${couple.coupleId}`}>
              <HouseIcon size={16} /> Visit Home
            </Link>
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

export function Discover() {
  const [sort, setSort] = useState<DiscoverSort>("recent");
  const query = useDiscoverCouples(sort);
  const more = useRef<HTMLDivElement>(null);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-white/70 p-1" role="tablist" aria-label="Sort couples">
          {SORTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={sort === s.id}
              onClick={() => setSort(s.id)}
              className={cn("rounded-xl px-3 py-1.5 text-sm font-semibold transition", sort === s.id ? "bg-plum-700 text-white" : "text-plum-500 hover:bg-white")}
            >
              {s.label}
            </button>
          ))}
        </div>
        {query.data ? <span className="text-xs text-cocoa-400">{total} couple{total === 1 ? "" : "s"}</span> : null}
      </div>
      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-[1.75rem]" />
          ))}
        </div>
      ) : null}
      {query.error ? <ErrorBlock error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && items.length === 0 ? (
        <div className="rounded-[2rem] bg-white/70 p-8 text-center ring-2 ring-white">
          <p className="text-4xl">{sort === "friends" ? "🤝" : "🏡"}</p>
          <p className="mt-2 font-display text-lg font-semibold text-plum-700">{sort === "friends" ? "No friends' homes yet" : "The world is still quiet"}</p>
          <p className="text-sm text-plum-500">
            {sort === "friends" ? "Add friends from World Chat and their homes will appear here." : "Invite your friends to TWOGETHER — every couple who joins gets a home here."}
          </p>
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c, i) => (
          <CoupleCollectible key={c.coupleId} couple={c} index={i} />
        ))}
      </ul>
      <div ref={more} className="h-4" />
      {isFetchingNextPage ? <p className="text-center text-xs text-cocoa-400">Loading more couples…</p> : null}
    </div>
  );
}
