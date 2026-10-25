"use client";

import { Check, Copy, Crown, Loader2, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { CoinIcon, StarIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { RoomNet, type RoomPresence } from "@/features/love-smash/room-net";
import { getRoom, leaveRoom, respondToRoom, ROOM_ERRORS, setReady, setRoomDifficulty, startRoom, switchTeam, type Room, type RoomDifficulty } from "@/features/love-smash/rooms";
import { readAvatar } from "@/features/session/types";
import { cn } from "@/lib/utils";
import { BOT_TEAMMATES, roomCompetitors } from "./online-game";

const TEAM_NAMES = ["Team Sakura 🌸", "Team Lavender 💜"] as const;
const message = (e: unknown) => {
  const raw = e instanceof Error ? e.message : String(e);
  return ROOM_ERRORS[raw] ?? raw;
};

export function RoomLobby({ roomId, userId, onStart, onExit }: { roomId: string; userId: string; onStart: (room: Room) => void; onExit: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set([userId]));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const netRef = useRef<RoomNet | null>(null);
  const startRef = useRef(onStart);
  const exitRef = useRef(onExit);

  useEffect(() => {
    startRef.current = onStart;
    exitRef.current = onExit;
  });

  const refresh = useCallback(async () => {
    try {
      const next = await getRoom(roomId);
      setRoom(next);
      if (next.status === "playing") startRef.current(next);
      if (next.status === "abandoned") exitRef.current();
    } catch (e) {
      setError(message(e));
    }
  }, [roomId]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 2500);
    const net = new RoomNet(roomId, { userId, slot: -1, host: false, at: Date.now() }, { onRoomChanged: () => void refresh(), onPresence: (members: RoomPresence[]) => setOnline(new Set([userId, ...members.map((m) => m.userId)])) }, [], false);
    netRef.current = net;
    void net.open();
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      net.close();
      netRef.current = null;
    };
  }, [roomId, userId, refresh]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (result && typeof result === "object" && "id" in result) {
        setRoom(result as Room);
        if ((result as Room).status === "playing") startRef.current(result as Room);
      }
      netRef.current?.roomChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (!room) {
    return (
      <Panel className="grid place-items-center py-10" data-testid="room-lobby" aria-busy>
        <Loader2 className="animate-spin text-plum-500" />
        {error ? <p className="mt-2 text-sm text-rose-err">{error}</p> : null}
      </Panel>
    );
  }

  const me = room.members.find((m) => m.userId === userId);
  const isHost = room.hostId === userId;
  const joined = room.members.filter((m) => m.status === "joined");
  const needed = room.mode === "couple_ai" ? 2 : 4;
  const everyoneReady = joined.length === needed && joined.every((m) => m.ready || m.userId === room.hostId);
  const competitors = roomCompetitors(room);

  const slotCard = (slot: number) => {
    const member = room.members.find((m) => m.slot === slot && m.status !== "declined");
    const declined = room.members.find((m) => m.slot === slot && m.status === "declined");
    const bot = room.mode === "couple_ai" && slot % 2 === 1;
    return (
      <li key={slot} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2" data-testid={`room-slot-${slot}`} data-status={member?.status ?? (bot ? "bot" : "open")}>
        {member ? (
          <AvatarFace avatar={readAvatar(member.avatar)} size={40} />
        ) : bot ? (
          <AvatarFace avatar={competitors[slot].avatar} size={40} />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-lavender-100 text-plum-500">
            <Users size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate font-display font-semibold text-plum-700">
            {member ? member.name : bot ? competitors[slot].name : "Open spot"}
            {member?.userId === room.hostId ? <Crown size={14} className="text-gold-500" aria-label="Host" /> : null}
          </p>
          <p className="text-xs text-cocoa-400">
            {member
              ? member.status === "invited"
                ? `Invitation sent${online.has(member.userId) ? "" : " — not here yet"}`
                : `${online.has(member.userId) ? "In the room" : "Away"} · ${member.ready || member.userId === room.hostId ? "Ready ✅" : "Not ready"}`
              : bot
                ? `AI · ${room.difficulty}`
                : declined
                  ? `${declined.name} declined`
                  : `Share code ${room.code}`}
          </p>
        </div>
      </li>
    );
  };

  return (
    <Panel className="flex flex-col gap-4" data-testid="room-lobby" data-room={room.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-plum-700">{room.mode === "couple_ai" ? "💗 Couple vs Bots" : "🏸 2v2 Room"}</h2>
          <Vi>{room.mode === "couple_ai" ? "Hai bạn cùng đội đấu với 2 bot" : "Hai đội 2 người — cặp đôi hoặc bạn bè"}</Vi>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(room.code).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 font-display text-lg font-bold tracking-[0.25em] text-plum-700 shadow-[var(--shadow-pop)]"
          aria-label={`Room code ${room.code}, copy`}
          data-testid="room-code"
        >
          {room.code} {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((team) => (
          <section key={team} className={cn("rounded-3xl p-3 ring-2", team === 0 ? "bg-sakura-50 ring-sakura-200" : "bg-lavender-100 ring-lavender-200")}>
            <p className="mb-2 font-display font-semibold text-plum-700">{room.mode === "couple_ai" && team === 1 ? "Bot Team 🤖" : TEAM_NAMES[team]}</p>
            <ul className="flex flex-col gap-2">{[team, team + 2].map(slotCard)}</ul>
          </section>
        ))}
      </div>
      {room.mode === "couple_ai" ? (
        <div role="radiogroup" aria-label="Bot difficulty" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-plum-500">Bots:</span>
          {(["easy", "normal", "hard"] as RoomDifficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={room.difficulty === d}
              disabled={!isHost || busy}
              onClick={() => void act(() => setRoomDifficulty(room.id, d))}
              className={cn("rounded-full px-3 py-1 text-sm font-semibold capitalize ring-2", room.difficulty === d ? "bg-sakura-100 ring-sakura-300 text-plum-700" : "bg-white/70 ring-white text-plum-500", !isHost && "cursor-default")}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-sakura-50 px-3 py-2 text-sm font-semibold text-rose-err">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {isHost ? (
          <Button onClick={() => void act(() => startRoom(room.id))} disabled={!everyoneReady} loading={busy} data-testid="room-start">
            🏸 Start match
          </Button>
        ) : me?.status === "joined" ? (
          <Button variant={me.ready ? "secondary" : "primary"} onClick={() => void act(() => setReady(room.id, !me.ready))} loading={busy} data-testid="room-ready">
            {me.ready ? "Not ready" : "I'm ready!"}
          </Button>
        ) : null}
        {room.mode === "versus" && me && me.slot !== 0 ? (
          <Button variant="soft" onClick={() => void act(() => switchTeam(room.id))} disabled={busy}>
            Switch team
          </Button>
        ) : null}
        <Button
          variant="ghost"
          onClick={() =>
            void act(async () => {
              await leaveRoom(room.id);
              exitRef.current();
            })
          }
        >
          <LogOut size={16} /> Leave
        </Button>
      </div>
      {!everyoneReady ? (
        <p className="text-sm text-cocoa-400" data-testid="room-hint">
          {joined.length < needed ? `Waiting for ${needed - joined.length} more player${needed - joined.length > 1 ? "s" : ""} — share the code ${room.code}.` : "Waiting for everyone to press Ready."}
        </p>
      ) : null}
    </Panel>
  );
}

export function InviteCard({ roomId, onJoined, onDismiss }: { roomId: string; onJoined: (room: Room) => void; onDismiss: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getRoom(roomId)
      .then(setRoom)
      .catch((e) => setError(message(e)));
  }, [roomId]);
  const host = room?.members.find((m) => m.userId === room.hostId);
  return (
    <Panel className="flex flex-col gap-3 ring-2 ring-sakura-300" data-testid="room-invite">
      <p className="font-display text-xl font-semibold text-plum-700">{host ? `💗 ${host.name} invited you to Love Smash doubles!` : "Love Smash invitation"}</p>
      {room ? <p className="text-sm text-plum-500">{room.mode === "couple_ai" ? `Team up against two ${room.difficulty} bots.` : "Join a 2v2 match."}</p> : null}
      {error ? <p className="text-sm font-semibold text-rose-err">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          loading={busy}
          disabled={!room || room.status !== "lobby"}
          onClick={async () => {
            setBusy(true);
            try {
              onJoined((await respondToRoom(roomId, true)) as Room);
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
          data-testid="invite-accept"
        >
          Join 💗
        </Button>
        <Button
          variant="soft"
          onClick={async () => {
            await respondToRoom(roomId, false).catch(() => undefined);
            onDismiss();
          }}
        >
          Decline
        </Button>
      </div>
    </Panel>
  );
}

export function OnlineResults({ room, userId, onLobby }: { room: Room; userId: string; onLobby: () => void }) {
  const result = room.result!;
  const competitors = roomCompetitors(room);
  const mySlot = room.members.find((m) => m.userId === userId)?.slot ?? 0;
  const myTeam = mySlot % 2;
  const won = result.winner === myTeam;
  const teamName = (side: number) => `${competitors[side].name.replace(" 🤖", "")} & ${competitors[side + 2].name.replace(" 🤖", "")}`;
  const reward = result.rewards[userId];
  const couple = room.mode === "couple_ai";
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-plum-900/30 p-4 backdrop-blur-sm" role="dialog" aria-label="Match results" data-testid="online-results" data-won={won}>
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-[2rem] bg-[#fffaf6] p-6 text-center shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-center gap-2">
          {[result.winner, result.winner + 2].map((slot) => (
            <AvatarFace key={slot} avatar={competitors[slot].avatar} size={64} className={cn("rounded-full ring-4 ring-white", won && "animate-[legend-hop_.8s_ease-in-out_infinite]")} />
          ))}
        </div>
        <p className="font-display text-3xl font-bold text-plum-700">
          {couple && result.winner === 0 ? "💗 " : "🏆 "}
          {teamName(result.winner)} — VICTORY!
        </p>
        <p className="font-display text-2xl font-semibold tabular-nums text-plum-500" data-testid="online-final-score">
          {teamName(0)} {result.score[0]} – {result.score[1]} {teamName(1)}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-cocoa-400">
                <th className="text-left">Player</th>
                <th>Hits</th>
                <th>Perfect</th>
                <th>Smash</th>
                <th>Saves</th>
              </tr>
            </thead>
            <tbody>
              {[0, 2, 1, 3].map((slot) => {
                const s = result.players[String(slot)];
                return (
                  <tr key={slot} className={cn(slot % 2 === result.winner ? "text-plum-700" : "text-cocoa-400")}>
                    <td className="truncate py-1 text-left font-semibold">{competitors[slot].name}</td>
                    <td>{s?.hits ?? 0}</td>
                    <td>{s?.perfectHits ?? 0}</td>
                    <td>
                      {s?.smashWinners ?? 0}/{s?.smashes ?? 0}
                    </td>
                    <td>{s?.saves ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-cocoa-400">
          Longest rally {result.longestRally} hits · Match time {Math.floor(result.ticks / 3600)}:{String(Math.floor((result.ticks / 60) % 60)).padStart(2, "0")}
        </p>
        <div className="rounded-2xl bg-sakura-50 px-4 py-3" data-testid="online-reward">
          {reward ? (
            <div className="flex items-center justify-center gap-4 font-display text-lg font-semibold text-plum-700">
              <span className="flex items-center gap-1">
                <StarIcon size={20} /> +{reward.xp} XP
              </span>
              {reward.coins > 0 ? (
                <span className="flex items-center gap-1">
                  <CoinIcon size={20} /> +{reward.coins}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-cocoa-400">No reward recorded for this match.</p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onLobby}>Back to Love Smash</Button>
          <Button variant="soft" asChild>
            <Link href="/games">🏡 Back to Games</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export { BOT_TEAMMATES };
