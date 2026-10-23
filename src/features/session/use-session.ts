"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { qk } from "../query-keys";
import type { SessionData } from "./types";

export async function fetchSession(): Promise<SessionData | null> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const userId = auth.user.id;

  const [profile, membership] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("couple_members").select("couple_id, slot").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (membership.error) throw membership.error;

  let couple: SessionData["couple"] = null;
  let partner: SessionData["partner"] = null;
  if (membership.data) {
    const [coupleRow, members] = await Promise.all([
      supabase.from("couples").select("*").eq("id", membership.data.couple_id).maybeSingle(),
      supabase.from("couple_members").select("user_id").eq("couple_id", membership.data.couple_id).neq("user_id", userId),
    ]);
    if (coupleRow.error) throw coupleRow.error;
    couple = coupleRow.data;
    const partnerId = members.data?.[0]?.user_id;
    if (partnerId) {
      const partnerRow = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      if (partnerRow.error) throw partnerRow.error;
      partner = partnerRow.data;
    }
  }

  return {
    userId,
    email: auth.user.email ?? null,
    profile: profile.data,
    couple,
    slot: membership.data ? (membership.data.slot as 0 | 1) : null,
    partner,
  };
}

export function useSession() {
  return useQuery({ queryKey: qk.session, queryFn: fetchSession, staleTime: 60_000 });
}

export function useRequiredSession() {
  const { data } = useSession();
  if (!data) throw new Error("useRequiredSession used outside of an authenticated shell");
  return data;
}
