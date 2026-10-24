"use client";

import { Ban, Flag, Gamepad2, UserCheck, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { create } from "zustand";
import { AvatarFace } from "@/components/couple/avatar-face";
import { TierBadge } from "@/components/legends/legend-art";
import { Button } from "@/components/ui/button";
import { BookIcon, FlameIcon, HeartIcon, HouseIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { tierById } from "@/features/legends/tiers";
import { readAvatar } from "@/features/session/types";
import { useCoupleWorldProfile, useFriendActions, useInvitationActions, usePlayerProfile, useReportPlayer } from "@/features/world/queries";
import type { ReportReason } from "@/features/world/types";
import { useIsOnline, worldLobby } from "@/features/world/world-channel";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";
import { HomePreview } from "./home-preview";

type ReportTarget = { userId: string; name: string; message?: string; channel?: string; guestbook?: string };

type SheetState = {
  player: string | null;
  couple: string | null;
  report: ReportTarget | null;
  openPlayer: (id: string) => void;
  openCouple: (id: string) => void;
  openReport: (target: ReportTarget) => void;
  close: (kind: "player" | "couple" | "report") => void;
};

export const useSocialSheets = create<SheetState>((set) => ({
  player: null,
  couple: null,
  report: null,
  openPlayer: (player) => set({ player, couple: null }),
  openCouple: (couple) => set({ couple, player: null }),
  openReport: (report) => set({ report }),
  close: (kind) => set({ [kind]: null } as Partial<SheetState>),
}));

export function OnlineDot({ userId, className }: { userId: string; className?: string }) {
  const online = useIsOnline(userId);
  return (
    <span
      className={cn("relative block size-3 rounded-full ring-2 ring-white", online ? "bg-mint-400" : "bg-cocoa-400/40", className)}
      aria-label={online ? "Online" : "Offline"}
      title={online ? "Online" : "Offline"}
    >
      {online ? <span className="absolute inset-0 animate-ping rounded-full bg-mint-400/60 motion-reduce:hidden" /> : null}
    </span>
  );
}

function notify(error: unknown) {
  const f = friendlyError(error);
  toast({ tone: "error", title: f.en, vi: f.vi });
}

function PlayerProfileSheet() {
  const id = useSocialSheets((s) => s.player);
  const close = useSocialSheets((s) => s.close);
  const openCouple = useSocialSheets((s) => s.openCouple);
  const openReport = useSocialSheets((s) => s.openReport);
  const { data, isLoading, error } = usePlayerProfile(id);
  const friends = useFriendActions();
  const invites = useInvitationActions();
  const online = useIsOnline(id);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const tier = data?.tier ? tierById(data.tier) : null;

  const act = async (fn: () => Promise<unknown>, success: string, vi: string) => {
    try {
      await fn();
      toast({ tone: "success", title: success, vi });
    } catch (e) {
      notify(e);
    }
  };

  return (
    <Modal
      open={Boolean(id)}
      onOpenChange={(o) => {
        if (!o) {
          close("player");
          setConfirmBlock(false);
        }
      }}
      title={data?.name ?? "Player"}
      subtitle={data?.coupleName ?? undefined}
    >
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} /> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-sakura-50 to-lavender-100 p-4">
            <span className="relative">
              <AvatarFace avatar={readAvatar(data.avatar)} size={84} />
              <span className="absolute bottom-1 right-1">
                <OnlineDot userId={data.id} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold text-plum-700">{data.name}</p>
              <p className="text-sm text-plum-500">
                Level {data.level} · {online ? "Online now" : "Offline"}
              </p>
              {data.coupleName ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-cocoa-400">
                  <HeartIcon size={14} /> {data.partnerName ? `with ${data.partnerName}` : data.coupleName}
                </p>
              ) : null}
              {tier ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">
                  <TierBadge tier={tier.id} size={18} /> {tier.name}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
                <BookIcon size={18} /> {data.lessonsCompleted}
              </p>
              <p className="text-[11px] font-bold text-cocoa-400">Lessons</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
                <TrophyIcon size={18} /> {data.unitsCleared}
              </p>
              <p className="text-[11px] font-bold text-cocoa-400">Units cleared</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
                <FlameIcon size={18} /> {data.streak}
              </p>
              <p className="text-[11px] font-bold text-cocoa-400">Day streak</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-cocoa-400">
            Learning {data.learning.language === "zh" ? `Chinese · ${data.learning.chinese}` : `English · ${data.learning.english}`}
          </p>

          {data.achievements.length ? (
            <div>
              <p className="mb-1.5 font-display font-semibold">Achievements</p>
              <ul className="flex flex-wrap gap-1.5">
                {data.achievements.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex items-center gap-1 rounded-full bg-gold-200/60 px-2.5 py-1 text-xs font-bold" title={a.title_vi}>
                    <StarIcon size={13} /> {a.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.isSelf ? (
            <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-plum-500">This is how other players see you.</p>
          ) : data.blockedByMe ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-3">
              <p className="text-sm text-plum-500">You blocked this player. You won&apos;t see each other in chat, guestbooks or homes.</p>
              <Button variant="soft" onClick={() => act(() => friends.unblock.mutateAsync(data.id), "Unblocked", "Đã bỏ chặn")} loading={friends.unblock.isPending}>
                Unblock
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {data.coupleId ? (
                <Button asChild className="col-span-2">
                  <Link href={`/world/visit/${data.coupleId}`} onClick={() => close("player")}>
                    <HouseIcon size={20} /> Visit Couple Home
                  </Link>
                </Button>
              ) : null}
              {data.friendship === "friends" ? (
                <Button variant="soft" onClick={() => act(() => friends.remove.mutateAsync(data.id), "Friend removed", "Đã xoá bạn")} loading={friends.remove.isPending}>
                  <UserMinus size={18} /> Remove friend
                </Button>
              ) : data.friendship === "outgoing" ? (
                <Button variant="soft" disabled>
                  <UserCheck size={18} /> Request sent
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => act(() => friends.request.mutateAsync(data.id), data.friendship === "incoming" ? "You're now friends!" : "Friend request sent", "Đã gửi lời mời kết bạn")}
                  loading={friends.request.isPending}
                >
                  <UserPlus size={18} /> {data.friendship === "incoming" ? "Accept friend" : "Add friend"}
                </Button>
              )}
              <Button variant="soft" onClick={() => act(() => invites.invite.mutateAsync(data.id), "Word Duel invitation sent!", "Đã gửi lời mời đấu từ vựng")} loading={invites.invite.isPending}>
                <Gamepad2 size={18} /> Invite to Word Duel
              </Button>
              {data.coupleId ? (
                <Button variant="soft" onClick={() => openCouple(data.coupleId!)}>
                  <HeartIcon size={18} /> Couple profile
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => openReport({ userId: data.id, name: data.name })}>
                <Flag size={16} /> Report
              </Button>
              {confirmBlock ? (
                <div className="col-span-2 flex flex-col gap-2 rounded-2xl bg-rose-err/10 p-3">
                  <p className="text-sm text-plum-700">Block {data.name}? You won&apos;t see each other&apos;s chat messages, guestbook notes, friend requests, invitations or homes.</p>
                  <div className="flex gap-2">
                    <Button variant="soft" className="flex-1" onClick={() => setConfirmBlock(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      loading={friends.block.isPending}
                      onClick={() =>
                        act(async () => {
                          await friends.block.mutateAsync(data.id);
                          setConfirmBlock(false);
                        }, "Player blocked", "Đã chặn người chơi")
                      }
                    >
                      Block
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" className={cn(data.coupleId ? "" : "col-span-2")} onClick={() => setConfirmBlock(true)}>
                  <Ban size={16} /> Block
                </Button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function CoupleSheet() {
  const id = useSocialSheets((s) => s.couple);
  const close = useSocialSheets((s) => s.close);
  const openPlayer = useSocialSheets((s) => s.openPlayer);
  const { data, isLoading, error } = useCoupleWorldProfile(id);
  const [a, b] = data?.members ?? [];
  const tier = data ? tierById(data.tier) : null;

  return (
    <Modal open={Boolean(id)} onOpenChange={(o) => !o && close("couple")} title={data ? data.members.map((m) => m.name).join(" ❤️ ") : "Couple"} subtitle={data?.name}>
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} /> : null}
      {data && tier ? (
        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-lavender-100 to-sakura-50 p-4">
            <div className="flex items-end justify-center gap-2">
              {[a, b].filter(Boolean).map((m, i) => (
                <button key={m!.id} type="button" onClick={() => openPlayer(m!.id)} className="flex flex-col items-center gap-1 rounded-2xl p-1 transition hover:-translate-y-1">
                  <span className="relative">
                    <AvatarFace avatar={readAvatar(m!.avatar)} size={76} />
                    <span className="absolute bottom-1 right-1">
                      <OnlineDot userId={m!.id} />
                    </span>
                  </span>
                  <span className="text-sm font-bold text-plum-700">{m!.name}</span>
                  {i === 0 && b ? <HeartIcon size={20} className="absolute left-1/2 top-12 -translate-x-1/2" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="font-display text-xl font-bold">{data.level}</p>
              <p className="text-[11px] font-bold text-cocoa-400">Couple level</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <span className="flex justify-center">
                <TierBadge tier={tier.id} size={28} />
              </span>
              <p className="text-[11px] font-bold text-cocoa-400">{tier.name}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="font-display text-xl font-bold">{data.bestRank ? `#${data.bestRank}` : "—"}</p>
              <p className="text-[11px] font-bold text-cocoa-400">Best weekly rank</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-2">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
                <HouseIcon size={18} />
                {data.homeLevel}
              </p>
              <p className="text-[11px] font-bold text-cocoa-400">Home level</p>
            </div>
          </div>
          <HomePreview homeLevel={data.homeLevel} items={data.items} className="h-36" />
          <p className="-mt-2 text-center text-xs text-cocoa-400">
            {data.itemCount} decoration{data.itemCount === 1 ? "" : "s"} · {data.guestbookCount} guestbook note{data.guestbookCount === 1 ? "" : "s"}
          </p>
          {data.achievements.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {data.achievements.slice(0, 8).map((ach) => (
                <li key={ach.id} className="flex items-center gap-1 rounded-full bg-gold-200/60 px-2.5 py-1 text-xs font-bold">
                  <StarIcon size={13} /> {ach.title}
                </li>
              ))}
            </ul>
          ) : null}
          {data.isOwn ? (
            <Button asChild>
              <Link href="/home" onClick={() => close("couple")}>
                <HouseIcon size={20} /> Go to Our Home
              </Link>
            </Button>
          ) : data.canVisit ? (
            <Button asChild size="lg">
              <Link href={`/world/visit/${data.coupleId}`} onClick={() => close("couple")}>
                <HouseIcon size={22} /> Visit Home
              </Link>
            </Button>
          ) : (
            <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-plum-500">You can&apos;t visit this home.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

const REASONS: { id: ReportReason; label: string; vi: string }[] = [
  { id: "spam", label: "Spam or ads", vi: "Spam, quảng cáo" },
  { id: "harassment", label: "Harassment or bullying", vi: "Quấy rối, bắt nạt" },
  { id: "inappropriate", label: "Inappropriate content", vi: "Nội dung không phù hợp" },
  { id: "other", label: "Something else", vi: "Lý do khác" },
];

function ReportSheet() {
  const target = useSocialSheets((s) => s.report);
  const close = useSocialSheets((s) => s.close);
  const report = useReportPlayer();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");

  async function submit() {
    if (!target) return;
    try {
      const res = await report.mutateAsync({ target: target.userId, reason, message: target.message, guestbook: target.guestbook, details });
      if (res.hidden && target.message) worldLobby.announceRemoved(target.message, target.channel ?? "world");
      toast({ tone: "success", title: res.hidden ? "Thanks — that message is now hidden." : "Thanks for reporting. We'll take a look.", vi: "Cảm ơn bạn đã báo cáo." });
      setDetails("");
      close("report");
    } catch (e) {
      notify(e);
    }
  }

  return (
    <Modal open={Boolean(target)} onOpenChange={(o) => !o && close("report")} title={`Report ${target?.name ?? ""}`} subtitle={target?.message ? "Reporting a chat message" : target?.guestbook ? "Reporting a guestbook note" : "Reporting a player"}>
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Reason" className="grid gap-2">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={reason === r.id}
              onClick={() => setReason(r.id)}
              className={cn("rounded-2xl px-4 py-2 text-left ring-2 transition", reason === r.id ? "bg-sakura-100 ring-sakura-300" : "bg-white/80 ring-white hover:ring-lavender-200")}
            >
              <span className="block font-semibold">{r.label}</span>
              <span lang="vi" className="block text-xs text-cocoa-400">{r.vi}</span>
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 300))}
          rows={3}
          placeholder="Anything else we should know? (optional)"
          aria-label="Details"
          className="rounded-2xl bg-white/80 p-3 outline-none ring-2 ring-white focus:ring-sakura-200"
        />
        <Vi>Tin nhắn bị 3 người báo cáo sẽ tự động bị ẩn. Bạn cũng có thể chặn người này từ hồ sơ của họ.</Vi>
        <Button variant="danger" onClick={submit} loading={report.isPending}>
          <Flag size={16} /> Send report
        </Button>
      </div>
    </Modal>
  );
}

export function SocialSheets() {
  return (
    <>
      <PlayerProfileSheet />
      <CoupleSheet />
      <ReportSheet />
    </>
  );
}
