"use client";

import { Bell, CheckCheck, Gamepad2, Gift, Heart, Trash2, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { BookIcon, SparkleIcon, TrophyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { ErrorBlock, Skeleton } from "@/components/ui/states";
import { useNotificationActions, useNotifications, useUnreadNotifications } from "@/features/notifications/queries";
import { safeDestination, type AppNotification } from "@/features/notifications/types";
import { readAvatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { PushSetup } from "./push-setup";

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function TypeIcon({ type }: { type: AppNotification["type"] }) {
  const cls = "grid size-6 place-items-center rounded-full ring-2 ring-white";
  switch (type) {
    case "love_ping":
      return <span className={cn(cls, "bg-sakura-400 text-white")}><Heart size={13} fill="currentColor" /></span>;
    case "study_invitation":
      return <span className={cn(cls, "bg-white")}><BookIcon size={16} /></span>;
    case "game_invitation":
      return <span className={cn(cls, "bg-lavender-300 text-white")}><Gamepad2 size={13} /></span>;
    case "gift_received":
      return <span className={cn(cls, "bg-gold-300 text-plum-700")}><Gift size={13} /></span>;
    case "friend_request":
      return <span className={cn(cls, "bg-mint-400 text-white")}><UserPlus size={13} /></span>;
    case "achievement_unlocked":
      return <span className={cn(cls, "bg-white")}><TrophyIcon size={16} /></span>;
    default:
      return <span className={cn(cls, "bg-white")}><SparkleIcon size={16} /></span>;
  }
}

function Card({ n, onOpen, onRead, onDelete, index }: { n: AppNotification; onOpen: () => void; onRead: () => void; onDelete: () => void; index: number }) {
  const reduced = usePrefersReducedMotion();
  const unread = !n.readAt;
  return (
    <motion.li
      layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className={cn("group relative flex gap-3 rounded-3xl p-3 ring-2 transition", unread ? "bg-gradient-to-r from-sakura-50 to-lavender-100 ring-sakura-100" : "bg-white/75 ring-white")}
      data-notification-type={n.type}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 gap-3 text-left" aria-label={`${n.title}. ${n.body}`}>
        <span className="relative shrink-0">
          {n.sender ? (
            <AvatarFace avatar={readAvatar(n.sender.avatar)} size={44} />
          ) : (
            <span className="grid size-11 place-items-center rounded-full bg-white">
              <TrophyIcon size={26} />
            </span>
          )}
          <span className="absolute -bottom-1 -right-1">
            <TypeIcon type={n.type} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className={cn("min-w-0 flex-1 font-display leading-snug text-plum-700", unread ? "font-bold" : "font-semibold")}>{n.title}</span>
            {unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sakura-400" aria-label="Unread" /> : null}
          </span>
          <span className="line-clamp-2 block text-sm text-plum-500">{n.body}</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-cocoa-400">{ago(n.createdAt)}</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {unread ? (
          <button type="button" onClick={onRead} className="rounded-full p-1.5 text-cocoa-400 hover:bg-white hover:text-plum-700" aria-label="Mark as read">
            <CheckCheck size={15} />
          </button>
        ) : null}
        <button type="button" onClick={onDelete} className="rounded-full p-1.5 text-cocoa-400 hover:bg-white hover:text-rose-err" aria-label="Delete notification">
          <Trash2 size={15} />
        </button>
      </div>
    </motion.li>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = useUnreadNotifications();
  const list = useNotifications(open);
  const actions = useNotificationActions();
  const items = list.data?.pages.flat() ?? [];
  const count = unread.data ?? 0;

  function openItem(n: AppNotification) {
    if (!n.readAt) actions.markRead.mutate([n.id]);
    setOpen(false);
    router.push(safeDestination(n.destination));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-lavender-100 text-plum-700 transition hover:bg-lavender-200"
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        data-testid="notification-bell"
      >
        <Bell size={20} className={cn(count > 0 && "motion-safe:animate-[wiggle_1.6s_ease-in-out_infinite]")} />
        <AnimatePresence>
          {count > 0 ? (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sakura-400 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white"
              data-testid="notification-count"
            >
              {count > 99 ? "99+" : count}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>

      <Modal open={open} onOpenChange={setOpen} title="Notifications" subtitle="Những bất ngờ nhỏ dành cho bạn">
        <div className="flex flex-col gap-3">
          <PushSetup compact />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cocoa-400">{count ? `${count} unread` : "All caught up"}</span>
            <Button size="sm" variant="ghost" onClick={() => actions.markAll.mutate()} disabled={!count}>
              <CheckCheck size={16} /> Mark all as read
            </Button>
          </div>
          {list.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-20 rounded-3xl" />
              ))}
            </div>
          ) : null}
          {list.error ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : null}
          {list.data && items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/70 px-4 py-8 text-center">
              <motion.span className="text-5xl" animate={{ y: [0, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity }} aria-hidden>
                💌
              </motion.span>
              <p className="font-display text-lg font-semibold text-plum-700">No little surprises yet 💌</p>
              <p className="text-sm text-plum-500">Your notifications will appear here.</p>
            </div>
          ) : null}
          <ul className="flex flex-col gap-2" aria-label="Notification list">
            <AnimatePresence initial={false}>
              {items.map((n, i) => (
                <Card key={n.id} n={n} index={i} onOpen={() => openItem(n)} onRead={() => actions.markRead.mutate([n.id])} onDelete={() => actions.remove.mutate(n.id)} />
              ))}
            </AnimatePresence>
          </ul>
          {list.hasNextPage ? (
            <Button variant="soft" onClick={() => void list.fetchNextPage()} loading={list.isFetchingNextPage}>
              Older notifications
            </Button>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
