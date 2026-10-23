"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import { toast } from "@/stores/toast-store";
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

export function useSetLegendVisibility() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (makePublic: boolean) => {
      const { error } = await getSupabase().rpc("set_legend_visibility", { make_public: makePublic });
      if (error) throw error;
      return makePublic;
    },
    onSuccess: (isPublic) =>
      toast({
        tone: "love",
        title: isPublic ? "You joined Love Legends!" : "Your couple is now hidden from Love Legends",
        vi: isPublic ? "Hai bạn đã tham gia bảng xếp hạng!" : "Cặp đôi đã được ẩn khỏi bảng xếp hạng",
      }),
    onError: (error) => {
      const m = friendlyError(error);
      toast({ tone: "error", title: m.en, vi: m.vi });
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["legends"] }),
  });
}

export async function ackLegendCelebration(milestone: "top3" | "first") {
  await getSupabase().rpc("ack_legend_celebration", { milestone });
}
