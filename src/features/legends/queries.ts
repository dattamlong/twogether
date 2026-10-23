"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Avatar } from "../session/types";
import { useSession } from "../session/use-session";
import type { BoardId } from "./tiers";

export const legendKeys = {
  board: (board: BoardId) => ["legends", "board", board] as const,
  status: ["legends", "status"] as const,
  profile: (id: string) => ["legends", "profile", id] as const,
};

export type LegendMember = { name: string; avatar: Partial<Avatar> };

export type LeaderboardRow = {
  rank: number;
  couple_id: string;
  couple_name: string;
  members: LegendMember[];
  score: number;
  tier: number;
  movement: number | null;
  effect: string | null;
  is_me: boolean;
};

export type LegendStatus = {
  coupleId: string;
  isPublic: boolean;
  weekStart: string;
  weekEndsAt: string;
  season: { id: number; name: string } | null;
  score: number;
  rank: number | null;
  pointsToNext: number | null;
  movement: number | null;
  tier: number;
  legendPoints: number;
  nextTierAt: number | null;
  tierFloor: number;
  bestRank: number | null;
  memberPoints: Record<string, number> | null;
  dailyCap: number;
  celebrations: string[];
};

export type CoupleLegendProfile = {
  coupleId: string;
  name: string;
  members: LegendMember[];
  tier: number;
  legendPoints: number;
  bestRank: number | null;
  weeklyScore: number;
  coupleStreakBest: number;
  homeLevel: number;
  achievements: { id: string; title: string; title_vi: string; scope: string }[];
  trophies: { week: string; rank: number }[];
};

export function useLeaderboard(board: BoardId) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: legendKeys.board(board),
    enabled: Boolean(session?.couple),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_leaderboard", { board, max_rows: 100 });
      if (error) throw error;
      return data as unknown as LeaderboardRow[];
    },
  });
}

export function useLegendStatus() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: legendKeys.status,
    enabled: Boolean(session?.couple),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_my_legend_status");
      if (error) throw error;
      return data as unknown as LegendStatus;
    },
  });
}

export function useCoupleLegendProfile(coupleId: string | null) {
  return useQuery({
    queryKey: legendKeys.profile(coupleId ?? ""),
    enabled: Boolean(coupleId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_couple_legend_profile", { target: coupleId! });
      if (error) throw error;
      return data as unknown as CoupleLegendProfile;
    },
  });
}

export async function ackLegendCelebration(milestone: "top3" | "first") {
  await getSupabase().rpc("ack_legend_celebration", { milestone });
}
