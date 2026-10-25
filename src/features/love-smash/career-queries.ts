"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { CareerKind, CareerState, Entrant, Outcome } from "./career";
import type { MatchConfig, MatchLogs } from "./net";
import type { LoveSmashReward } from "./queries";
import type { MatchStats } from "./sim";

export type CareerRow = { id: string; kind: CareerKind; owner_id: string; couple_id: string | null; state: CareerState; updated_at: string };

export const careerKey = ["love-smash-careers"] as const;

export function useCareers(userId: string | undefined) {
  return useQuery({
    queryKey: careerKey,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("love_smash_careers").select("id, kind, owner_id, couple_id, state, updated_at");
      if (error) throw error;
      return (data ?? []) as unknown as CareerRow[];
    },
  });
}

export class CareerError extends Error {}

async function post<T>(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new CareerError(json.error ?? "request_failed");
  return json;
}

export const createCareer = (kind: CareerKind) => post<{ career: CareerRow }>("/api/love-smash/career", { action: "create", kind });
export const chooseTournament = (careerId: string, tier: number) => post<{ career: CareerRow }>("/api/love-smash/career", { action: "tournament", careerId, tier });
export const createCareerRoom = (careerId: string) => post<{ roomId: string }>("/api/love-smash/career", { action: "room", careerId });
export const startCareerMatch = (careerId: string) =>
  post<{ matchId: string; seed: number; config: MatchConfig; version: number; opponent: Entrant; tier: number; round: number }>("/api/love-smash/career", { action: "start", careerId });
export const finishCareerMatch = (matchId: string, logs: MatchLogs) =>
  post<{ reward: LoveSmashReward; state: CareerState; outcome: Outcome; score: [number, number]; stats: MatchStats }>("/api/love-smash/career/finish", { matchId, logs });

export const CAREER_ERRORS: Record<string, string> = {
  no_partner: "Pair with your partner first.",
  tier_locked: "Win the previous championship to unlock this tournament.",
  tournament_in_progress: "Finish (or keep playing) your current tournament first.",
  too_many_open_matches: "Too many unfinished matches — wait a few minutes.",
  career_conflict: "Your career changed on another device — refreshed.",
  no_active_tournament: "Pick a tournament on the map first.",
};
