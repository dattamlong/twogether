"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { celebrate } from "@/stores/celebration-store";
import { toast } from "@/stores/toast-store";
import { friendlyError } from "@/lib/errors";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";

export function useProgress() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.progress,
    enabled: Boolean(session),
    queryFn: async () => {
      const supabase = getSupabase();
      const userId = session!.userId;
      const coupleId = session!.couple?.id;
      const partnerId = session!.partner?.id;
      const [mine, partner, couple, streaks] = await Promise.all([
        supabase.from("user_progress").select("*").eq("user_id", userId).single(),
        partnerId ? supabase.from("user_progress").select("*").eq("user_id", partnerId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        coupleId ? supabase.from("couple_progress").select("*").eq("couple_id", coupleId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from("streaks").select("*"),
      ]);
      for (const r of [mine, partner, couple, streaks]) if (r.error) throw r.error;
      const find = (type: string, id?: string | null) => streaks.data?.find((s) => s.subject_type === type && s.subject_id === id) ?? null;
      return {
        mine: mine.data!,
        partner: partner.data,
        couple: couple.data,
        myStreak: find("user", userId),
        partnerStreak: find("user", partnerId),
        coupleStreak: find("couple", coupleId),
      };
    },
  });
}

export function useDailyQuests() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.dailyQuests,
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_daily_quests");
      if (error) throw error;
      return data;
    },
  });
}

export function useCoupleQuests() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.coupleQuests,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_couple_quests");
      if (error) throw error;
      return data;
    },
  });
}

export function useAchievements() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.achievements,
    enabled: Boolean(session),
    queryFn: async () => {
      const supabase = getSupabase();
      const [defs, unlocked] = await Promise.all([
        supabase.from("achievements").select("*"),
        supabase.from("user_achievements").select("achievement_id, unlocked_at, user_id"),
      ]);
      if (defs.error) throw defs.error;
      if (unlocked.error) throw unlocked.error;
      return defs.data.map((a) => ({
        ...a,
        unlockedByMe: unlocked.data.find((u) => u.achievement_id === a.id && u.user_id === session!.userId)?.unlocked_at ?? null,
        unlockedByPartner: unlocked.data.find((u) => u.achievement_id === a.id && u.user_id !== session!.userId)?.unlocked_at ?? null,
      }));
    },
  });
}

export function useInvalidateProgress() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: qk.progress }),
      client.invalidateQueries({ queryKey: qk.dailyQuests }),
      client.invalidateQueries({ queryKey: qk.coupleQuests }),
      client.invalidateQueries({ queryKey: qk.achievements }),
      client.invalidateQueries({ queryKey: qk.memories }),
      client.invalidateQueries({ queryKey: qk.inventory }),
    ]);
}

export function useClaimQuest() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: async (questId: string) => {
      const { data, error } = await getSupabase().rpc("claim_daily_quest", { quest: questId });
      if (error) throw error;
      return data;
    },
    onSuccess: (reward) => celebrate(reward, "Quest complete!"),
    onError: (error) => {
      const message = friendlyError(error);
      toast({ tone: "error", title: message.en, vi: message.vi });
    },
    onSettled: invalidate,
  });
}
