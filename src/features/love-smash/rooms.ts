"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { MatchConfig, MatchLogs } from "./net";
import type { PlayerStats } from "./sim";

export type RoomMode = "couple_ai" | "versus";
export type RoomDifficulty = "easy" | "normal" | "hard";

export type RoomMember = { userId: string; slot: number; status: "invited" | "joined" | "declined"; ready: boolean; name: string; avatar: unknown };

export type RoomResult = {
  winner: 0 | 1;
  score: [number, number];
  ticks: number;
  longestRally: number;
  players: Record<string, PlayerStats>;
  rewards: Record<string, { xp: number; coins: number; won: boolean }>;
};

export type Room = {
  id: string;
  code: string;
  hostId: string;
  mode: RoomMode;
  difficulty: RoomDifficulty;
  status: "lobby" | "playing" | "finished" | "abandoned";
  seed: number | null;
  config: MatchConfig | null;
  result: RoomResult | null;
  startedAt: string | null;
  careerId?: string | null;
  members: RoomMember[];
};

export class RoomError extends Error {}

async function call<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabase().rpc(fn as never, args as never);
  if (error) throw new RoomError(error.message);
  return data as unknown as T;
}

export const createRoom = (mode: RoomMode, difficulty: RoomDifficulty, invitePartner: boolean) =>
  call<Room>("create_love_smash_room", { room_mode: mode, room_difficulty: difficulty, invite_partner: invitePartner });
export const joinRoomByCode = (code: string) => call<Room>("join_love_smash_room", { room_code: code });
export const respondToRoom = (roomId: string, accept: boolean) => call<Room | { declined: true }>("respond_love_smash_room", { target_room: roomId, accept });
export const getRoom = (roomId: string) => call<Room>("get_love_smash_room", { target_room: roomId });
export const leaveRoom = (roomId: string) => call<null>("leave_love_smash_room", { target_room: roomId });
export const setReady = (roomId: string, ready: boolean) => call<Room>("set_love_smash_ready", { target_room: roomId, is_ready: ready });
export const switchTeam = (roomId: string) => call<Room>("switch_love_smash_team", { target_room: roomId });
export const setRoomDifficulty = (roomId: string, difficulty: RoomDifficulty) => call<Room>("set_love_smash_room_difficulty", { target_room: roomId, room_difficulty: difficulty });
export const startRoom = (roomId: string) => call<Room>("start_love_smash_room", { target_room: roomId });

export async function startCareerRoom(roomId: string) {
  const response = await fetch("/api/love-smash/career", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "room_start", roomId }) });
  const body = (await response.json().catch(() => ({}))) as { room?: Room; error?: string };
  if (!response.ok || !body.room) throw new RoomError(body.error ?? "start_failed");
  return body.room;
}
export const activeRoom = () => call<Room | null>("my_active_love_smash_room", {});
export const abandonRoom = (roomId: string) => call<null>("abandon_love_smash_room", { target_room: roomId });

export async function finishRoom(roomId: string, logs: MatchLogs) {
  const response = await fetch("/api/love-smash/room/finish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, logs }),
  });
  const body = (await response.json().catch(() => ({}))) as { room?: Room; error?: string };
  if (!response.ok || !body.room) throw new RoomError(body.error ?? "save_failed");
  return body.room;
}

export const teamOfSlot = (slot: number) => (slot % 2) as 0 | 1;

export const ROOM_ERRORS: Record<string, string> = {
  no_partner: "You need to be paired with your partner first.",
  room_not_found: "That room doesn't exist (check the code).",
  room_closed: "That room already started or closed.",
  room_full: "That room is full.",
  team_full: "The other team is full.",
  players_missing: "Waiting for everyone to join.",
  players_not_ready: "Everyone needs to press Ready.",
  not_host: "Only the host can do that.",
};

export async function pendingInvite(userId: string) {
  const { data } = await getSupabase()
    .from("love_smash_room_members")
    .select("room_id, updated_at, love_smash_rooms!inner(status)")
    .eq("user_id", userId)
    .eq("status", "invited")
    .eq("love_smash_rooms.status", "lobby")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.room_id ?? null;
}
