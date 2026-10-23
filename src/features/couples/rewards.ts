"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import { requestId } from "@/lib/utils";
import { celebrate } from "@/stores/celebration-store";
import { toast } from "@/stores/toast-store";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";

const showError = (error: unknown) => {
  const message = friendlyError(error);
  toast({ tone: "error", title: message.en, vi: message.vi });
};

export function useCoupleRewards() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.rewards,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const supabase = getSupabase();
      const [rewards, redemptions] = await Promise.all([
        supabase.from("couple_rewards").select("*").neq("status", "archived").order("created_at", { ascending: false }),
        supabase.from("reward_redemptions").select("*").order("redeemed_at", { ascending: false }).limit(30),
      ]);
      if (rewards.error) throw rewards.error;
      if (redemptions.error) throw redemptions.error;
      return { rewards: rewards.data, redemptions: redemptions.data };
    },
  });
}

function useRewardMutation<T>(fn: (args: T) => Promise<unknown>, onSuccess?: (data: unknown) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess,
    onError: showError,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.rewards });
      client.invalidateQueries({ queryKey: qk.progress });
      client.invalidateQueries({ queryKey: qk.memories });
    },
  });
}

const call = async (name: string, args: Record<string, unknown>) => {
  const { data, error } = await getSupabase().rpc(name as never, args as never);
  if (error) throw error;
  return data;
};

export const useProposeReward = () =>
  useRewardMutation((r: { title: string; description: string; cost: number }) =>
    call("propose_reward", { reward_title: r.title, reward_description: r.description, reward_cost: r.cost }),
  );
export const useRespondReward = () => useRewardMutation((r: { id: string; approve: boolean }) => call("respond_reward", { reward: r.id, approve: r.approve }));
export const useArchiveReward = () => useRewardMutation((id: string) => call("archive_reward", { reward: id }));
export const useRedeemReward = () =>
  useRewardMutation(
    (id: string) => call("redeem_reward", { reward: id, request_id: requestId() }),
    (reward) => celebrate(reward, "Reward redeemed!"),
  );
export const useFulfillRedemption = () => useRewardMutation((id: string) => call("fulfill_redemption", { redemption: id }));
