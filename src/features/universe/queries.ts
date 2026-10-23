"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { useSession } from "../session/use-session";
import type { AdventureMapData, ChallengeResult, ChallengeStart, CoupleAdventure, PlacementResult, SubjectSummary } from "./types";

export const universeKeys = {
  all: ["universe"] as const,
  map: (subject: string, level: string) => ["universe", "map", subject, level] as const,
  adventures: ["universe", "adventures"] as const,
};

async function rpc<T>(name: string, args?: Record<string, unknown>) {
  const { data, error } = await getSupabase().rpc(name as never, args as never);
  if (error) throw error;
  return data as unknown as T;
}

export function useUniverse() {
  const { data: session } = useSession();
  return useQuery({ queryKey: universeKeys.all, enabled: Boolean(session), queryFn: () => rpc<SubjectSummary[]>("get_learning_universe") });
}

export function useAdventureMap(subject: string, level: string | null) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: universeKeys.map(subject, level ?? ""),
    enabled: Boolean(session && level),
    queryFn: () => rpc<AdventureMapData>("get_adventure_map", { subject, map_level: level }),
  });
}

export function useCoupleAdventures() {
  const { data: session } = useSession();
  return useQuery({ queryKey: universeKeys.adventures, enabled: Boolean(session?.couple), queryFn: () => rpc<CoupleAdventure[]>("get_couple_adventures") });
}

export const startUnitChallenge = (unitId: string, mode: "review" | "boss") => rpc<ChallengeStart>("start_unit_challenge", { target_unit: unitId, mode });
export const finishUnitChallenge = (sessionId: string) => rpc<ChallengeResult>("finish_unit_challenge", { game_session: sessionId });
export const startPlacement = (subject: string) => rpc<Omit<ChallengeStart, "unit">>("start_placement", { subject });
export const finishPlacement = (sessionId: string) => rpc<PlacementResult>("finish_placement", { game_session: sessionId });
export const startAdventurePart = (adventure: string) =>
  rpc<Omit<ChallengeStart, "unit"> & { part: CoupleAdventure["parts"][number] }>("start_adventure_part", { adventure });
export const finishAdventurePart = (sessionId: string) =>
  rpc<{ passed: boolean; correct: number; total: number; adventureCompleted: boolean; xp: number; coins: number }>("finish_adventure_part", { game_session: sessionId });
