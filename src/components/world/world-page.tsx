"use client";

import { CalendarHeart, Compass, MessageCircleHeart, Trees, Users } from "lucide-react";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequiredSession } from "@/features/session/use-session";
import { useSocialOverview } from "@/features/world/queries";
import { useWorldLobby } from "@/features/world/world-channel";
import { cn } from "@/lib/utils";
import { Discover } from "./discover";
import { FriendsPanel } from "./friends-panel";
import { Neighborhood } from "./neighborhood";
import { WorldChat } from "./world-chat";

const TABS = [
  { id: "chat", label: "World Chat", vi: "Trò chuyện", icon: MessageCircleHeart },
  { id: "discover", label: "Discover", vi: "Khám phá", icon: Compass },
  { id: "town", label: "Neighborhood", vi: "Khu phố", icon: Trees },
  { id: "friends", label: "Friends", vi: "Bạn bè", icon: Users },
  { id: "events", label: "Events", vi: "Sự kiện", icon: CalendarHeart },
] as const;

type TabId = (typeof TABS)[number]["id"];

const EVENTS = [
  { title: "Weekly World Boss", vi: "Boss thế giới hằng tuần", body: "Every couple chips away at one giant boss with correct answers.", emoji: "🐉" },
  { title: "Sakura Festival", vi: "Lễ hội hoa anh đào", body: "A seasonal town decoration and limited festival items.", emoji: "🌸" },
  { title: "English Café Challenge", vi: "Thử thách quán cà phê", body: "Weekly conversation prompts in the English Café.", emoji: "☕" },
  { title: "Couple Tournament", vi: "Giải đấu cặp đôi", body: "Couple vs Couple brackets built on Word Duels.", emoji: "🏆" },
];

function EventsTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-2xl bg-white/70 px-4 py-2 text-sm text-plum-500 ring-2 ring-white">
        World events aren&apos;t live yet — these are what we&apos;re building next. Nothing here gives rewards today.
        <span lang="vi" className="block text-xs text-cocoa-400">Sự kiện cộng đồng sẽ sớm ra mắt.</span>
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {EVENTS.map((e) => (
          <li key={e.title} className="flex gap-3 rounded-3xl bg-white/70 p-4 opacity-90 ring-2 ring-white">
            <span className="text-4xl" aria-hidden>
              {e.emoji}
            </span>
            <div>
              <p className="font-display font-semibold text-plum-700">{e.title}</p>
              <p lang="vi" className="text-xs text-cocoa-400">{e.vi}</p>
              <p className="mt-1 text-sm text-plum-500">{e.body}</p>
              <span className="mt-2 inline-block rounded-full bg-lavender-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-plum-500">Coming soon</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorldPage() {
  const session = useRequiredSession();
  const search = useSearchParams();
  const router = useRouter();
  const requested = search.get("tab");
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "chat";
  const online = useWorldLobby((s) => s.online.size);
  const social = useSocialOverview();
  const requests = social.data?.incoming.length ?? 0;

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <header className="relative overflow-hidden rounded-[1.5rem] bg-[radial-gradient(120%_140%_at_0%_0%,#fde4ee_0%,#efeafb_45%,#e5f3fc_100%)] px-4 py-2 ring-2 ring-white sm:rounded-[2rem] sm:px-5 sm:py-3">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="absolute size-1.5 rounded-full bg-white"
            style={{ left: `${(i * 31) % 96}%`, top: `${(i * 43) % 85}%`, animation: `legend-twinkle ${2 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` }}
            aria-hidden
          />
        ))}
        <div className="relative flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-lavender-400">TWOGETHER World</p>
            <h1 className="text-lg font-bold leading-tight text-plum-700 sm:text-3xl">Many Homes. One Magical World.</h1>
          </div>
          <span className="hidden rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-plum-500 sm:inline">🌍 {online} player{online === 1 ? "" : "s"} online</span>
        </div>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="TWOGETHER World">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => router.replace(t.id === "chat" ? "/world" : `/world?tab=${t.id}`, { scroll: false })}
              className={cn("relative flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 font-display text-sm font-semibold transition", active ? "text-plum-700" : "text-cocoa-400 hover:bg-white/60 hover:text-plum-700")}
            >
              {active ? <motion.span layoutId="world-tab" className="absolute inset-0 rounded-2xl bg-white shadow-[var(--shadow-pop)] ring-2 ring-sakura-100" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} /> : null}
              <Icon size={17} className="relative" />
              <span className="relative">{t.label}</span>
              {t.id === "friends" && requests > 0 ? <span className="relative rounded-full bg-sakura-400 px-1.5 text-[10px] text-white">{requests}</span> : null}
            </button>
          );
        })}
      </nav>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === "chat" ? <WorldChat session={session} /> : null}
        {tab === "discover" ? <Discover /> : null}
        {tab === "town" ? <Neighborhood /> : null}
        {tab === "friends" ? <FriendsPanel me={session.userId} /> : null}
        {tab === "events" ? <EventsTab /> : null}
      </motion.div>
    </div>
  );
}
