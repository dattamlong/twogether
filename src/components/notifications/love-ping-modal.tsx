"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { HeartIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import { notificationKeys, sendLovePing } from "@/features/notifications/queries";
import { LOVE_PING_PRESETS, type DispatchResult, type LovePingKind } from "@/features/notifications/types";
import { readAvatar, type SessionData } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { friendlyError } from "@/lib/errors";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { useRoomEvents } from "@/stores/room-events";
import { toast } from "@/stores/toast-store";

function deliveryText(delivery: DispatchResult | null, name: string) {
  if (!delivery) return { en: `Saved in ${name}'s notifications.`, vi: "Đã lưu vào hộp thông báo của người ấy." };
  if (delivery.status === "sent") return { en: `Sent to ${delivery.devices} of ${name}'s device${delivery.devices === 1 ? "" : "s"} 📱`, vi: "Đã gửi tới điện thoại/máy của người ấy." };
  if (delivery.note === "recipient_active") return { en: `${name} is using TWOGETHER right now — they'll see it instantly.`, vi: "Người ấy đang online nên sẽ thấy ngay." };
  if (delivery.note === "quiet_hours") return { en: `It's ${name}'s quiet hours — it'll be waiting in their notifications.`, vi: "Đang giờ yên tĩnh của người ấy — tin sẽ chờ trong hộp thông báo." };
  if (delivery.note === "preference_off") return { en: `${name} turned off Love Ping alerts — it's saved in their notifications.`, vi: "Người ấy tắt thông báo Love Ping — tin vẫn được lưu." };
  if (delivery.note === "no_devices") return { en: `${name} hasn't turned on phone notifications yet — it's waiting in their inbox.`, vi: "Người ấy chưa bật thông báo trên điện thoại — tin đang chờ trong hộp thông báo." };
  return { en: `Saved in ${name}'s notifications.`, vi: "Đã lưu vào hộp thông báo của người ấy." };
}

export function LovePingModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: SessionData }) {
  const partner = session.partner;
  const client = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const [kind, setKind] = useState<LovePingKind>("miss_you");
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ en: string; vi: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef<string | null>(null);

  function reset() {
    setSent(null);
    setError(null);
    setCustom("");
    setKind("miss_you");
    clientId.current = null;
  }

  async function send() {
    if (!partner || sending) return;
    if (kind === "custom" && !custom.trim()) {
      setError("Write a little message first 💗");
      return;
    }
    setSending(true);
    setError(null);
    clientId.current ??= crypto.randomUUID();
    try {
      const result = await sendLovePing(kind, kind === "custom" ? custom.trim() : null, clientId.current);
      useRoomEvents.getState().emit({ type: "love_ping_sent" });
      sfx.love();
      const text = deliveryText(result.delivery, partner.display_name);
      setSent(text);
      toast({ tone: "love", title: "Love Ping Sent! 💌", vi: "Your love is on its way · Tình yêu đang được gửi đi" });
      client.invalidateQueries({ queryKey: notificationKeys.all });
    } catch (e) {
      const f = friendlyError(e);
      setError(f.en);
      if ((e as { message?: string })?.message === "love_ping_cooldown") clientId.current = null;
    } finally {
      setSending(false);
    }
  }

  const preset = LOVE_PING_PRESETS.find((p) => p.kind === kind);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
      title="Send a Little Love 💗"
      subtitle="Let your favorite person know you're thinking of them."
    >
      {!partner ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/80 p-5 text-center">
          <HeartIcon size={48} />
          <p className="font-display text-lg font-semibold">Invite your partner first</p>
          <p className="text-sm text-plum-500">Love Pings go to your connected partner. Share your invite code so they can join your home.</p>
          <Button asChild>
            <Link href="/pair" onClick={onClose}>
              Invite your partner
            </Link>
          </Button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-b from-sakura-50 to-lavender-100 p-6 text-center">
              {!reduced
                ? Array.from({ length: 10 }, (_, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-lg"
                      style={{ left: `${8 + i * 9}%`, top: "-10%" }}
                      animate={{ y: [0, 260], rotate: [0, 160], opacity: [0, 1, 0] }}
                      transition={{ duration: 2.4 + (i % 3) * 0.4, delay: i * 0.12, repeat: Infinity }}
                      aria-hidden
                    >
                      🌸
                    </motion.span>
                  ))
                : null}
              <motion.div animate={reduced ? undefined : { y: [0, -10, 0], scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <HeartIcon size={72} />
              </motion.div>
              <p className="font-display text-2xl font-bold text-plum-700">Love Ping Sent! 💌</p>
              <p className="text-sm text-plum-500">{sent.en}</p>
              <Vi className="text-xs">{sent.vi}</Vi>
              <div className="relative flex gap-2">
                <Button variant="soft" onClick={reset}>
                  Send another
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    reset();
                  }}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-sakura-50 to-lavender-100 p-3">
                <AvatarFace avatar={readAvatar(partner.avatar)} size={48} />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-cocoa-400">To</p>
                  <p className="truncate font-display text-lg font-semibold text-plum-700">{partner.display_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Love Ping message">
                {LOVE_PING_PRESETS.map((p) => (
                  <button
                    key={p.kind}
                    type="button"
                    role="radio"
                    aria-checked={kind === p.kind}
                    onClick={() => setKind(p.kind)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-3xl p-3 text-left ring-2 transition",
                      kind === p.kind ? "bg-sakura-100 ring-sakura-300" : "bg-white/80 ring-white hover:ring-lavender-200",
                    )}
                  >
                    <span className="text-2xl" aria-hidden>
                      {p.emoji}
                    </span>
                    <span className="font-display font-semibold text-plum-700">{p.label}</span>
                    <span lang="vi" className="text-[11px] text-cocoa-400">{p.vi}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={kind === "custom"}
                  onClick={() => setKind("custom")}
                  className={cn("col-span-2 flex items-center gap-2 rounded-3xl p-3 text-left ring-2 transition", kind === "custom" ? "bg-lavender-100 ring-lavender-300" : "bg-white/80 ring-white hover:ring-lavender-200")}
                >
                  <span className="text-2xl" aria-hidden>
                    💌
                  </span>
                  <span className="font-display font-semibold text-plum-700">Custom Message</span>
                  <span lang="vi" className="text-[11px] text-cocoa-400">· Tự viết lời nhắn</span>
                </button>
              </div>
              {kind === "custom" ? (
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Your message</span>
                  <textarea
                    value={custom}
                    onChange={(e) => setCustom(e.target.value.slice(0, 200))}
                    rows={3}
                    autoFocus
                    placeholder="Write something sweet…"
                    className="rounded-2xl bg-white/90 p-3 outline-none ring-2 ring-white focus:ring-sakura-200"
                    aria-label="Your Love Ping message"
                  />
                  <span className={cn("self-end text-[11px]", custom.length >= 190 ? "text-rose-err" : "text-cocoa-400")}>{custom.length}/200</span>
                </label>
              ) : preset ? (
                <p className="rounded-2xl bg-white/70 px-4 py-3 font-display italic text-plum-700">“{preset.message}”</p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-2xl bg-rose-err/10 px-3 py-2 text-sm text-rose-err">
                  {error}
                </p>
              ) : null}
              <Button size="lg" onClick={send} loading={sending}>
                <HeartIcon size={20} /> Send Love Ping
              </Button>
              <p className="text-center text-[11px] text-cocoa-400">Up to 3 Love Pings every 30 minutes — sweet, never spammy.</p>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Modal>
  );
}
