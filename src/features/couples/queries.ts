"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";

export function useActiveInvitation() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.invitations,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("couple_invitations")
        .select("*")
        .is("used_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc("create_invitation");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.invitations });
      client.invalidateQueries({ queryKey: qk.session });
    },
  });
}

export function useRevokeInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("revoke_invitation", { invitation_id: id });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.invitations }),
  });
}

export function useAcceptInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await getSupabase().rpc("accept_invitation", { invite_code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useSignOut() {
  const client = useQueryClient();
  const router = useRouter();
  return async () => {
    await getSupabase().auth.signOut();
    client.clear();
    router.replace("/login");
    router.refresh();
  };
}
