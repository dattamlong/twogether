"use client";

import { Flag, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { readAvatar } from "@/features/session/types";
import { useGuestbook, useGuestbookActions } from "@/features/world/queries";
import { friendlyError } from "@/lib/errors";
import { sfx } from "@/lib/sfx";
import { toast } from "@/stores/toast-store";
import { useSocialSheets } from "./social-sheets";

const QUICK = ["Your home is adorable! 🌸", "So cozy here ☕", "Keep learning together! 📚", "Congrats on your progress! 🎉"];

export function GuestbookPanel({ open, onClose, coupleId, title, isHost, me }: { open: boolean; onClose: () => void; coupleId: string; title: string; isHost: boolean; me: string }) {
  const book = useGuestbook(open ? coupleId : null);
  const actions = useGuestbookActions(coupleId);
  const openPlayer = useSocialSheets((s) => s.openPlayer);
  const openReport = useSocialSheets((s) => s.openReport);
  const [draft, setDraft] = useState("");
  const entries = book.data?.pages.flat() ?? [];

  async function sign() {
    const text = draft.trim();
    if (!text) return;
    try {
      await actions.sign.mutateAsync(text);
      setDraft("");
      sfx.love();
      toast({ tone: "love", title: "Signed the guestbook!", vi: "Đã để lại lời chúc!" });
    } catch (e) {
      const f = friendlyError(e);
      toast({ tone: "error", title: f.en, vi: f.vi });
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Magical Guestbook" subtitle={title}>
      <div className="flex flex-col gap-3">
        {!isHost ? (
          <form
            className="flex flex-col gap-2 rounded-3xl bg-gradient-to-br from-sakura-50 to-lavender-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sign();
            }}
          >
            <label htmlFor="guestbook-note" className="font-display text-sm font-semibold text-plum-700">
              Leave a kind note
            </label>
            <textarea
              id="guestbook-note"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="Write something sweet…"
              className="rounded-2xl bg-white/90 p-3 outline-none ring-2 ring-white focus:ring-sakura-200"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setDraft(q)} className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-plum-500 hover:bg-white">
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-cocoa-400">{draft.length}/280</span>
              <Button type="submit" size="sm" disabled={!draft.trim()} loading={actions.sign.isPending}>
                Sign guestbook
              </Button>
            </div>
          </form>
        ) : (
          <Vi>Lời chúc từ những vị khách ghé thăm nhà bạn. Bạn có thể xoá bất kỳ lời nào.</Vi>
        )}

        {book.isLoading ? <LoadingBlock /> : null}
        {book.error ? <ErrorBlock error={book.error} onRetry={() => book.refetch()} /> : null}
        {book.data && entries.length === 0 ? (
          <p className="rounded-2xl bg-white/70 px-3 py-4 text-center text-sm text-plum-500">{isHost ? "No notes yet — visitors can sign your guestbook." : "Be the first to sign!"}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {entries.map((entry, i) => {
            const canDelete = isHost || entry.author?.id === me;
            return (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03 }}
                className="flex gap-2.5 rounded-3xl bg-[#fffaf0] p-3 ring-2 ring-gold-200/60"
              >
                <button type="button" onClick={() => entry.author && openPlayer(entry.author.id)} className="shrink-0" aria-label={`Open ${entry.author?.name ?? "player"}'s profile`}>
                  <AvatarFace avatar={readAvatar(entry.author?.avatar)} size={38} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-display font-semibold text-plum-700">{entry.author?.name ?? "Player"}</span>
                    <span className="text-cocoa-400">{new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words font-display italic text-plum-700">“{entry.body}”</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => actions.remove.mutateAsync(entry.id).catch((e) => toast({ tone: "error", title: friendlyError(e).en }))}
                      className="rounded-full p-1.5 text-cocoa-400 hover:bg-white hover:text-rose-err"
                      aria-label="Remove note"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                  {entry.author && entry.author.id !== me ? (
                    <button
                      type="button"
                      onClick={() => openReport({ userId: entry.author!.id, name: entry.author!.name, guestbook: entry.id })}
                      className="rounded-full p-1.5 text-cocoa-400 hover:bg-white hover:text-rose-err"
                      aria-label="Report note"
                    >
                      <Flag size={14} />
                    </button>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </ul>
        {book.hasNextPage ? (
          <Button variant="soft" onClick={() => void book.fetchNextPage()} loading={book.isFetchingNextPage}>
            Older notes
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
