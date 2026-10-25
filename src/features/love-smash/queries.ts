"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { qk } from "../query-keys";
import type { Difficulty } from "./bot";
import type { Loadout, UnlockId } from "./skills";

export type PlayableDifficulty = Exclude<Difficulty, "feeder">;

export type LoveSmashStats = {
  matches: number;
  wins: number;
  losses: number;
  longest_rally: number;
  perfect_hits: number;
  smashes: number;
  couple_wins: number;
};

export type LoveSmashReward = {
  xp: number;
  coins: number;
  level: number;
  leveledUp: boolean;
  won: boolean;
  firstWinToday: boolean;
  dailyLimitReached: boolean;
  stats: LoveSmashStats;
};

export class LoveSmashError extends Error {}

export async function startLoveSmash(difficulty: PlayableDifficulty) {
  const { data, error } = await getSupabase().rpc("start_love_smash", { difficulty });
  if (error) throw new LoveSmashError(error.message);
  return data as unknown as { matchId: string; seed: number; difficulty: PlayableDifficulty; loadout: Loadout };
}

export async function submitLoveSmash(matchId: string, log: number[]) {
  const response = await fetch("/api/love-smash/finish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchId, log }),
  });
  const body = (await response.json().catch(() => ({}))) as { result?: LoveSmashReward; error?: string };
  if (!response.ok || !body.result) throw new LoveSmashError(body.error ?? "save_failed");
  return body.result;
}

export function useLoveSmashStats(userId: string | undefined) {
  return useQuery({
    queryKey: qk.loveSmashStats,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("love_smash_stats").select("matches, wins, losses, longest_rally, perfect_hits, smashes, couple_wins").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return (data ?? { matches: 0, wins: 0, losses: 0, longest_rally: 0, perfect_hits: 0, smashes: 0, couple_wins: 0 }) as LoveSmashStats;
    },
  });
}

export type LoveSmashProgress = { unlocked: UnlockId[]; loadout: Loadout; level: number; dropShots: number; tutorialDone: boolean };

export function useLoveSmashProgress(userId: string | undefined) {
  return useQuery({
    queryKey: [...qk.loveSmashStats, "progress"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_love_smash_progress");
      if (error) throw error;
      return data as unknown as LoveSmashProgress;
    },
  });
}

export async function saveLoadout(loadout: Loadout) {
  const { data, error } = await getSupabase().rpc("set_love_smash_loadout", { new_loadout: loadout });
  if (error) throw new LoveSmashError(error.message);
  return data as unknown as Loadout;
}

export async function completeTutorial() {
  const { data, error } = await getSupabase().rpc("complete_love_smash_tutorial");
  if (error) throw new LoveSmashError(error.message);
  return data as unknown as LoveSmashProgress;
}
