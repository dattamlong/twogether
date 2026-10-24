"use client";

import { AlertCircle, ChevronDown, Coffee, Flag, Globe2, RotateCcw, Search, SendHorizontal, Smile, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { TierBadge } from "@/components/legends/legend-art";
import { Button } from "@/components/ui/button";
import { ErrorBlock } from "@/components/ui/states";
import { tierById } from "@/features/legends/tiers";
import { readAvatar, type SessionData } from "@/features/session/types";
import { deleteWorldMessage } from "@/features/world/queries";
import type { ChatChannel, ChatItem } from "@/features/world/types";
import { useWorldChat } from "@/features/world/use-world-chat";
import { useWorldLobby, worldLobby } from "@/features/world/world-channel";
import { friendlyError } from "@/lib/errors";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";
import { useSocialSheets } from "./social-sheets";
import { WordLookup } from "./word-lookup";

const CHANNELS: { id: ChatChannel; name: string; vi: string; icon: typeof Globe2; hint: string }[] = [
  { id: "world", name: "World Chat", vi: "Trò chuyện chung", icon: Globe2, hint: "Say hi to every couple in TWOGETHER." },
  { id: "english_cafe", name: "English Café", vi: "Quán cà phê tiếng Anh", icon: Coffee, hint: "Practice English together. Tap any word to look it up and save it." },
];

const EMOJI = ["❤️", "🥰", "😂", "😊", "🌸", "✨", "👍", "🙏", "🎉", "😭", "🔥", "📚", "☕", "💪", "👋", "😴"];

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function Body({ text, lookup }: { text: string; lookup: ((word: string) => void) | null }) {
  if (!lookup) return <>{text}</>;
  const parts = text.split(/([A-Za-z][A-Za-z'’-]*)/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <button key={i} type="button" onClick={() => lookup(part.replace(/[’']s$/, ""))} className="rounded underline decoration-lavender-200 decoration-dotted underline-offset-4 hover:bg-lavender-100">
            {part}
          </button>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Bubble({
  item,
  mine,
  grouped,
  error,
  onRetry,
  onDiscard,
  lookup,
}: {
  item: ChatItem;
  mine: boolean;
  grouped: boolean;
  error?: string;
  onRetry: () => void;
  onDiscard: () => void;
  lookup: ((word: string) => void) | null;
}) {
  const openPlayer = useSocialSheets((s) => s.openPlayer);
  const openReport = useSocialSheets((s) => s.openReport);
  const reduced = usePrefersReducedMotion();
  const author = item.author;
  const tier = author?.tier ? tierById(author.tier) : null;

  return (
    <motion.li
      layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn("group flex gap-2", mine ? "flex-row-reverse" : "", grouped ? "mt-0.5" : "mt-3")}
      data-message-id={item.id}
    >
      <div className="w-10 shrink-0">
        {!grouped ? (
          <button type="button" onClick={() => openPlayer(item.userId)} className="block rounded-full ring-2 ring-white transition hover:scale-105" aria-label={`Open ${author?.name ?? "player"}'s profile`}>
            <AvatarFace avatar={readAvatar(author?.avatar)} size={40} />
          </button>
        ) : null}
      </div>
      <div className={cn("flex min-w-0 max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {!grouped ? (
          <div className={cn("mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-xs", mine ? "justify-end" : "")}>
            {tier ? (
              <span className="flex items-center gap-0.5 rounded-full bg-white/80 py-0.5 pl-0.5 pr-1.5 text-[10px] font-bold" title={tier.name}>
                <TierBadge tier={tier.id} size={14} />
                {tier.name}
              </span>
            ) : null}
            <button type="button" onClick={() => openPlayer(item.userId)} className="font-display font-semibold text-plum-700 hover:underline">
              {author?.name ?? "Player"}
            </button>
            {author?.partnerName ? <span className="text-cocoa-400">❤️ {author.partnerName}</span> : null}
            <span className="text-cocoa-400">· Lv {author?.level ?? 1}</span>
          </div>
        ) : null}
        <div className={cn("flex items-end gap-1", mine ? "flex-row-reverse" : "")}>
          <p
            className={cn(
              "whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-relaxed shadow-[0_2px_10px_-6px_rgba(69,54,91,0.35)]",
              mine ? "rounded-br-lg bg-gradient-to-br from-sakura-300 to-sakura-400 text-white" : "rounded-bl-lg bg-white/90 text-plum-700 ring-1 ring-white",
              item.status === "sending" && "opacity-70",
              item.status === "failed" && "bg-none bg-rose-err/15 text-plum-700 ring-2 ring-rose-err/40",
            )}
          >
            <Body text={item.body} lookup={lookup} />
          </p>
          <div className="flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
            {item.status === "sent" && !mine ? (
              <button
                type="button"
                onClick={() => openReport({ userId: item.userId, name: author?.name ?? "player", message: item.id, channel: item.channel })}
                className="rounded-full p-1 text-cocoa-400 hover:bg-white hover:text-rose-err"
                aria-label="Report message"
              >
                <Flag size={13} />
              </button>
            ) : null}
            {item.status === "sent" && mine ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteWorldMessage(item.id);
                    worldLobby.announceRemoved(item.id, item.channel);
                  } catch (e) {
                    toast({ tone: "error", title: friendlyError(e).en });
                  }
                }}
                className="rounded-full p-1 text-cocoa-400 hover:bg-white hover:text-rose-err"
                aria-label="Delete message"
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        </div>
        <span className="mt-0.5 px-2 text-[10px] text-cocoa-400">
          {item.status === "sending" ? "Sending…" : item.status === "failed" ? "Not sent" : timeLabel(item.createdAt)}
        </span>
        {item.status === "failed" ? (
          <div className="mt-1 flex items-center gap-1 text-xs" role="alert">
            <AlertCircle size={13} className="text-rose-err" />
            <span className="text-rose-err">{error || "Couldn't send."}</span>
            <button type="button" onClick={onRetry} className="flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 font-semibold text-plum-700 hover:bg-sakura-50">
              <RotateCcw size={12} /> Retry
            </button>
            <button type="button" onClick={onDiscard} className="rounded-full p-1 text-cocoa-400 hover:bg-white" aria-label="Discard message">
              <X size={12} />
            </button>
          </div>
        ) : null}
      </div>
    </motion.li>
  );
}

export function WorldChat({ session }: { session: SessionData }) {
  const [channel, setChannel] = useState<ChatChannel>("world");
  const chat = useWorldChat(channel, session);
  const online = useWorldLobby((s) => s.online.size);
  const lobbyStatus = useWorldLobby((s) => s.status);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [lookupTerm, setLookupTerm] = useState<string | null>(null);
  const [dictionary, setDictionary] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(0);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const info = CHANNELS.find((c) => c.id === channel)!;
  const lookup = channel === "english_cafe" ? setLookupTerm : null;

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (anchor.current) {
      el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.top;
      anchor.current = null;
    } else if (chat.items.length > lastCount.current) {
      const last = chat.items.at(-1);
      if (atBottom || last?.userId === session.userId) el.scrollTop = el.scrollHeight;
      else setUnseen((n) => n + chat.items.length - lastCount.current);
    }
    lastCount.current = chat.items.length;
  }, [chat.items, atBottom, session.userId]);

  useEffect(() => {
    const target = topRef.current;
    const root = listRef.current;
    if (!target || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && chat.hasOlder && !chat.loadingOlder && chat.loaded) {
          anchor.current = { height: root.scrollHeight, top: root.scrollTop };
          void chat.loadOlder();
        }
      },
      { root, rootMargin: "120px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [chat]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    if (text.length > 500) {
      toast({ tone: "error", title: "Messages can be up to 500 characters.", vi: "Tin nhắn tối đa 500 ký tự." });
      return;
    }
    setDraft("");
    setEmojiOpen(false);
    void chat.send(text);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="flex h-[calc(100dvh-20.5rem-var(--safe-bottom,0px))] min-h-[340px] flex-col overflow-hidden rounded-[2rem] bg-white/55 shadow-[var(--shadow-soft)] ring-2 ring-white backdrop-blur-md md:h-[calc(100dvh-13rem)]" aria-label="World chat">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-white/80 bg-white/50 px-3 py-2">
        <div className="flex gap-1 rounded-2xl bg-white/70 p-1" role="tablist" aria-label="Chat channels">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={channel === c.id}
                onClick={() => {
                  lastCount.current = 0;
                  setUnseen(0);
                  setAtBottom(true);
                  setChannel(c.id);
                }}
                className={cn("relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-display text-sm font-semibold transition-colors", channel === c.id ? "text-white" : "text-plum-500 hover:bg-white")}
              >
                {channel === c.id ? <motion.span layoutId="chat-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-sakura-400 to-lavender-400" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} /> : null}
                <Icon size={15} className="relative" />
                <span className="relative">{c.name}</span>
              </button>
            );
          })}
        </div>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-plum-500">
          <span className={cn("relative size-2 rounded-full", lobbyStatus === "connected" ? "bg-mint-400" : "bg-gold-500")}>
            {lobbyStatus === "connected" ? <span className="absolute inset-0 animate-ping rounded-full bg-mint-400 motion-reduce:hidden" /> : null}
          </span>
          {lobbyStatus === "connected" ? `${online} online` : lobbyStatus === "reconnecting" ? "Reconnecting…" : "Connecting…"}
        </span>
      </div>
      <p className="border-b border-white/70 bg-white/30 px-4 py-1.5 text-xs text-plum-500">
        {info.hint} <span lang="vi" className="text-cocoa-400">· {info.vi}</span>
      </p>
      {channel === "english_cafe" ? (
        <form
          className="flex items-center gap-2 border-b border-white/70 bg-white/40 px-3 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (dictionary.trim()) setLookupTerm(dictionary.trim());
          }}
        >
          <Search size={15} className="text-cocoa-400" />
          <input
            value={dictionary}
            onChange={(e) => setDictionary(e.target.value.slice(0, 40))}
            placeholder="Look up a word or phrase…"
            aria-label="Look up a word"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-cocoa-400"
          />
          <Button type="submit" size="sm" variant="soft" disabled={!dictionary.trim()}>
            Look up
          </Button>
        </form>
      ) : null}

      <div
        ref={listRef}
        className="relative flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAtBottom(bottom);
          if (bottom) setUnseen(0);
        }}
        aria-live="polite"
        aria-relevant="additions"
      >
        <div ref={topRef} className="h-px" />
        {chat.loadingOlder ? <p className="py-2 text-center text-xs text-cocoa-400">Loading older messages…</p> : null}
        {chat.loaded && !chat.hasOlder && chat.items.length > 0 ? <p className="py-3 text-center text-xs text-cocoa-400">✨ The beginning of {info.name}</p> : null}
        {chat.error && !chat.loaded ? <ErrorBlock error={chat.error} onRetry={() => void chat.reload()} className="mt-4" /> : null}
        {!chat.loaded && !chat.error ? (
          <div className="flex flex-col gap-3 pt-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={cn("flex gap-2", i % 2 ? "flex-row-reverse" : "")}>
                <div className="skeleton size-10 rounded-full" />
                <div className="skeleton h-10 w-2/3 rounded-3xl" />
              </div>
            ))}
          </div>
        ) : null}
        {chat.loaded && chat.items.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-4xl">{channel === "world" ? "🌍" : "☕"}</p>
              <p className="mt-2 font-display text-lg font-semibold text-plum-700">No messages yet</p>
              <p className="text-sm text-plum-500">Be the first to say hello!</p>
              <p lang="vi" className="text-xs text-cocoa-400">Hãy là người đầu tiên chào mọi người nhé!</p>
            </div>
          </div>
        ) : null}
        <ul>
          {chat.items.map((item, i) => {
            const prev = chat.items[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
            const grouped = !newDay && prev?.userId === item.userId && new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() < 3 * 60_000;
            return (
              <Fragment key={item.id}>
                {newDay ? (
                  <li className="my-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-cocoa-400">
                    <span className="h-px flex-1 bg-white" />
                    {dayLabel(item.createdAt)}
                    <span className="h-px flex-1 bg-white" />
                  </li>
                ) : null}
                <Bubble
                  item={item}
                  mine={item.userId === session.userId}
                  grouped={grouped}
                  error={chat.errors[item.id]}
                  onRetry={() => chat.retry(item.id)}
                  onDiscard={() => chat.discard(item.id)}
                  lookup={lookup}
                />
              </Fragment>
            );
          })}
        </ul>
      </div>

      <AnimatePresence>
        {unseen > 0 && !atBottom ? (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })}
            className="mx-auto -mt-12 mb-2 flex items-center gap-1 rounded-full bg-plum-700 px-3 py-1.5 text-xs font-bold text-white shadow-[var(--shadow-pop)]"
          >
            <ChevronDown size={14} /> {unseen} new message{unseen === 1 ? "" : "s"}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <div className="relative border-t-2 border-white/80 bg-white/60 p-2 sm:p-3">
        <AnimatePresence>
          {emojiOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="absolute bottom-full left-2 mb-2 grid grid-cols-8 gap-1 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)] ring-2 ring-lavender-100"
              role="listbox"
              aria-label="Emoji"
            >
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setDraft((d) => (d + e).slice(0, 500));
                    inputRef.current?.focus();
                  }}
                  className="grid size-9 place-items-center rounded-xl text-xl hover:bg-sakura-50"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <button type="button" onClick={() => setEmojiOpen((o) => !o)} aria-expanded={emojiOpen} aria-label="Emoji" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/90 text-plum-500 hover:bg-white">
            <Smile size={20} />
          </button>
          <label className="relative flex-1">
            <span className="sr-only">Message {info.name}</span>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              onKeyDown={onKeyDown}
              rows={1}
              enterKeyHint="send"
              placeholder={channel === "english_cafe" ? "Write in English…" : "Message everyone…"}
              className="block max-h-32 min-h-11 w-full resize-none rounded-2xl bg-white/95 px-4 py-2.5 text-[15px] outline-none ring-2 ring-white focus:ring-sakura-200 [field-sizing:content]"
            />
            {draft.length > 400 ? <span className="absolute bottom-1 right-3 text-[10px] text-cocoa-400">{draft.length}/500</span> : null}
          </label>
          <Button type="submit" size="icon" aria-label="Send message" disabled={!draft.trim()}>
            <SendHorizontal size={20} />
          </Button>
        </form>
        <p className="mt-1 hidden px-1 text-[10px] text-cocoa-400 sm:block">Enter to send · Shift+Enter for a new line · Be kind — reported messages are reviewed.</p>
      </div>
      <WordLookup term={lookupTerm} onClose={() => setLookupTerm(null)} />
    </section>
  );
}
