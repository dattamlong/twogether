"use client";

import { Bookmark, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { GiftIcon, HeartIcon } from "@/components/ui/icons";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { useMarkRead, useMessages, useSaveMessage, useSendMessage } from "@/features/messages/queries";
import { useSession } from "@/features/session/use-session";
import { useShopItems } from "@/features/shop/queries";
import { useRoomEvents } from "@/stores/room-events";
import { cn } from "@/lib/utils";

const MAX = 500;

export function Mailbox({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const { data, isLoading, error, refetch } = useMessages();
  const items = useShopItems();
  const send = useSendMessage();
  const markRead = useMarkRead();
  const save = useSaveMessage();
  const [draft, setDraft] = useState("");
  const unread = data?.some((m) => m.recipient_id === session?.userId && !m.read_at);

  useEffect(() => {
    if (unread && !markRead.isPending) markRead.mutate();
  }, [unread, markRead]);

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    send.mutate({ kind: "text", body: draft.trim() }, { onSuccess: () => setDraft("") });
  }

  function sendHeart() {
    send.mutate({ kind: "heart" });
    useRoomEvents.getState().emit({ type: "self_emote", emote: "heart" });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-3xl bg-white/70 p-3 ring-2 ring-white">
        <label htmlFor="love-note" className="font-display font-semibold">
          Write to {session?.partner?.display_name ?? "your partner"} <span lang="vi" className="text-xs font-normal text-cocoa-400">· Viết cho người ấy</span>
        </label>
        <textarea
          id="love-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          rows={compact ? 2 : 3}
          placeholder="Try writing in English! e.g. I'm proud of you for studying today."
          className="resize-none rounded-2xl border-2 border-lavender-100 bg-white p-3 outline-none focus:border-sakura-300"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("text-xs", words >= 12 ? "font-bold text-mint-600" : "text-cocoa-400")}>
            {words >= 12 ? "Love Letter length reached!" : `${words}/12 words for a Love Letter`} · {draft.length}/{MAX}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="soft" size="sm" onClick={sendHeart} disabled={!session?.partner} aria-label="Send a heart">
              <HeartIcon size={18} /> Heart
            </Button>
            <Button type="submit" size="sm" loading={send.isPending && send.variables?.kind === "text"} disabled={!draft.trim() || !session?.partner}>
              <Send size={16} /> Send
            </Button>
          </div>
        </div>
      </form>

      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}
      {data && data.length === 0 ? <EmptyState title="No letters yet" vi="Chưa có thư nào" art={<HeartIcon size={40} />} /> : null}

      <ul className={cn("flex flex-col gap-2", compact && "max-h-[40dvh] overflow-y-auto pr-1")}>
        {data?.map((m) => {
          const mine = m.sender_id === session?.userId;
          const item = m.item_id ? items.data?.find((i) => i.id === m.item_id) : null;
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-3xl px-4 py-2.5 shadow-[var(--shadow-pop)]", mine ? "rounded-br-lg bg-sakura-100" : "rounded-bl-lg bg-white")}>
                {m.kind === "heart" ? (
                  <p className="flex items-center gap-1.5 font-display font-semibold">
                    <HeartIcon size={20} /> {mine ? "You sent a heart" : "Sent you a heart"}
                  </p>
                ) : m.kind === "gift" ? (
                  <p className="flex items-center gap-1.5 font-display font-semibold">
                    <GiftIcon size={20} /> {mine ? "You sent" : "Gift:"} {item?.name ?? "a gift"}
                  </p>
                ) : null}
                {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-cocoa-400">
                  <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</time>
                  {m.kind === "text" ? (
                    <button
                      className="flex items-center gap-1 font-semibold hover:text-sakura-500 disabled:opacity-60"
                      disabled={m.saved || save.isPending}
                      onClick={() => save.mutate(m.id)}
                      aria-label={m.saved ? "Saved to memories" : "Save to memories"}
                    >
                      <Bookmark size={12} fill={m.saved ? "currentColor" : "none"} /> {m.saved ? "Saved" : "Keep"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
