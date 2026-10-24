"use client";

import { Check, Clock, Gamepad2, Swords, X } from "lucide-react";
import Link from "next/link";
import { AvatarFace } from "@/components/couple/avatar-face";
import { TierBadge } from "@/components/legends/legend-art";
import { Button } from "@/components/ui/button";
import { HouseIcon } from "@/components/ui/icons";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { ErrorBlock, Skeleton } from "@/components/ui/states";
import { readAvatar } from "@/features/session/types";
import { useFriendActions, useGameInvitations, useInvitationActions, useSocialOverview } from "@/features/world/queries";
import type { GameInvitation, PlayerCard } from "@/features/world/types";
import { useWorldLobby } from "@/features/world/world-channel";
import { friendlyError } from "@/lib/errors";
import { toast } from "@/stores/toast-store";
import { OnlineDot, useSocialSheets } from "./social-sheets";

function notify(error: unknown) {
  const f = friendlyError(error);
  toast({ tone: "error", title: f.en, vi: f.vi });
}

function PlayerRow({ player, children }: { player: PlayerCard; children?: React.ReactNode }) {
  const openPlayer = useSocialSheets((s) => s.openPlayer);
  return (
    <li className="flex items-center gap-3 rounded-3xl bg-white/80 p-2.5 ring-2 ring-white">
      <button type="button" onClick={() => openPlayer(player.id)} className="relative shrink-0" aria-label={`Open ${player.name}'s profile`}>
        <AvatarFace avatar={readAvatar(player.avatar)} size={46} />
        <span className="absolute bottom-0 right-0">
          <OnlineDot userId={player.id} />
        </span>
      </button>
      <button type="button" onClick={() => openPlayer(player.id)} className="min-w-0 flex-1 text-left">
        <p className="flex items-center gap-1 truncate font-display font-semibold text-plum-700">
          {player.tier ? <TierBadge tier={player.tier} size={16} /> : null}
          {player.name}
        </p>
        <p className="truncate text-xs text-cocoa-400">
          Lv {player.level}
          {player.partnerName ? ` · with ${player.partnerName}` : player.coupleName ? ` · ${player.coupleName}` : ""}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}

function statusText(inv: GameInvitation, me: string) {
  const mine = inv.results.find((r) => r.userId === me);
  const theirs = inv.results.find((r) => r.userId !== me);
  if (inv.status === "accepted") {
    if (mine?.finished && theirs?.finished) return `You ${mine.correct}/${mine.total} · Them ${theirs.correct}/${theirs.total}`;
    if (mine?.finished) return `You scored ${mine.correct}/${mine.total} · waiting for them`;
    return theirs?.finished ? "They've played — your turn!" : "Ready to play";
  }
  if (inv.status === "pending") return inv.incoming ? "Wants to duel you" : "Waiting for them to accept";
  return inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
}

export function InvitationList({ me }: { me: string }) {
  const invitations = useGameInvitations();
  const actions = useInvitationActions();
  const list = invitations.data ?? [];

  return (
    <Panel>
      <PanelTitle icon={<Swords size={26} className="text-sakura-400" />} title="Word Duels" subtitle="Thách đấu từ vựng — cùng một bộ câu hỏi" />
      {invitations.isLoading ? <Skeleton className="h-16 rounded-3xl" /> : null}
      {invitations.error ? <ErrorBlock error={invitations.error} onRetry={() => invitations.refetch()} /> : null}
      {invitations.data && list.length === 0 ? (
        <p className="text-sm text-plum-500">Invite someone from their profile: you both answer the same 8 vocabulary questions and compare scores.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {list.map((inv) => {
          const other = inv.incoming ? inv.from : inv.to;
          const mine = inv.results.find((r) => r.userId === me);
          return (
            <PlayerRow key={inv.id} player={other}>
              <span className="hidden max-w-40 text-right text-xs text-plum-500 sm:block">{statusText(inv, me)}</span>
              {inv.status === "pending" && inv.incoming ? (
                <>
                  <Button size="icon" variant="mint" aria-label="Accept duel" onClick={() => actions.respond.mutateAsync({ invitation: inv.id, accept: true }).catch(notify)}>
                    <Check size={18} />
                  </Button>
                  <Button size="icon" variant="soft" aria-label="Decline duel" onClick={() => actions.respond.mutateAsync({ invitation: inv.id, accept: false }).catch(notify)}>
                    <X size={18} />
                  </Button>
                </>
              ) : inv.status === "pending" ? (
                <Button size="sm" variant="ghost" onClick={() => actions.respond.mutateAsync({ invitation: inv.id, accept: false }).catch(notify)}>
                  Cancel
                </Button>
              ) : inv.status === "accepted" && !mine?.finished ? (
                <Button size="sm" asChild>
                  <Link href={`/world/duel/${inv.id}`}>
                    <Gamepad2 size={16} /> Play
                  </Link>
                </Button>
              ) : inv.status === "accepted" ? (
                <Button size="sm" variant="soft" asChild>
                  <Link href={`/world/duel/${inv.id}`}>Results</Link>
                </Button>
              ) : null}
            </PlayerRow>
          );
        })}
      </ul>
    </Panel>
  );
}

export function FriendsPanel({ me }: { me: string }) {
  const overview = useSocialOverview();
  const actions = useFriendActions();
  const invites = useInvitationActions();
  const online = useWorldLobby((s) => s.online);
  const friends = [...(overview.data?.friends ?? [])].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)));

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        {overview.data?.incoming.length ? (
          <Panel className="bg-gradient-to-br from-sakura-50 to-lavender-100">
            <PanelTitle title="Friend requests" subtitle="Lời mời kết bạn" />
            <ul className="flex flex-col gap-2">
              {overview.data.incoming.map((r) => (
                <PlayerRow key={r.id} player={r.player}>
                  <Button size="icon" variant="mint" aria-label={`Accept ${r.player.name}`} onClick={() => actions.respond.mutateAsync({ request: r.id, accept: true }).catch(notify)}>
                    <Check size={18} />
                  </Button>
                  <Button size="icon" variant="soft" aria-label={`Decline ${r.player.name}`} onClick={() => actions.respond.mutateAsync({ request: r.id, accept: false }).catch(notify)}>
                    <X size={18} />
                  </Button>
                </PlayerRow>
              ))}
            </ul>
          </Panel>
        ) : null}
        <Panel>
          <PanelTitle title={`Friends${overview.data ? ` (${friends.length})` : ""}`} subtitle={`${friends.filter((f) => online.has(f.id)).length} online · Bạn bè`} />
          {overview.isLoading ? <Skeleton className="h-24 rounded-3xl" /> : null}
          {overview.error ? <ErrorBlock error={overview.error} onRetry={() => overview.refetch()} /> : null}
          {overview.data && friends.length === 0 ? (
            <p className="text-sm text-plum-500">No friends yet. Tap someone&apos;s avatar in World Chat and choose “Add friend”.</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <PlayerRow key={f.id} player={f}>
                {f.coupleId ? (
                  <Button size="icon" variant="soft" asChild aria-label={`Visit ${f.name}'s home`}>
                    <Link href={`/world/visit/${f.coupleId}`}>
                      <HouseIcon size={20} />
                    </Link>
                  </Button>
                ) : null}
                <Button size="icon" variant="soft" aria-label={`Invite ${f.name} to a Word Duel`} onClick={() => invites.invite.mutateAsync(f.id).then(() => toast({ tone: "success", title: "Duel invitation sent!", vi: "Đã gửi lời mời đấu" })).catch(notify)}>
                  <Gamepad2 size={18} />
                </Button>
              </PlayerRow>
            ))}
          </ul>
        </Panel>
        {overview.data?.outgoing.length ? (
          <Panel>
            <PanelTitle title="Sent requests" subtitle="Đang chờ đồng ý" />
            <ul className="flex flex-col gap-2">
              {overview.data.outgoing.map((r) => (
                <PlayerRow key={r.id} player={r.player}>
                  <span className="flex items-center gap-1 text-xs text-cocoa-400">
                    <Clock size={13} /> Pending
                  </span>
                </PlayerRow>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
      <InvitationList me={me} />
    </div>
  );
}
