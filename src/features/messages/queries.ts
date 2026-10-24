"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import { requestId } from "@/lib/utils";
import { celebrate } from "@/stores/celebration-store";
import { toast } from "@/stores/toast-store";
import { dispatchPending } from "../notifications/queries";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";

const showError = (error: unknown) => {
  const message = friendlyError(error);
  toast({ tone: "error", title: message.en, vi: message.vi });
};

export function useMessages() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.messages,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("love_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount() {
  const { data: session } = useSession();
  const { data } = useMessages();
  return data?.filter((m) => m.recipient_id === session?.userId && !m.read_at).length ?? 0;
}

export function useSendMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, body }: { kind: "text" | "heart"; body?: string }) => {
      const { data, error } = await getSupabase().rpc("send_love_message", { message_kind: kind, message_body: body });
      if (error) throw error;
      return data;
    },
    onError: showError,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.messages });
      client.invalidateQueries({ queryKey: qk.coupleQuests });
      client.invalidateQueries({ queryKey: qk.dailyQuests });
      client.invalidateQueries({ queryKey: qk.progress });
    },
  });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc("mark_messages_read");
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: qk.messages }),
  });
}

export function useOpenGift() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await getSupabase().rpc("open_gift", { message: messageId });
      if (error) throw error;
    },
    onError: showError,
    onSettled: () => client.invalidateQueries({ queryKey: qk.messages }),
  });
}

export function useSaveMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await getSupabase().rpc("save_message_as_memory", { message: messageId });
      if (error) throw error;
    },
    onSuccess: () => toast({ tone: "love", title: "Saved to Our Story", vi: "Đã lưu vào Chuyện chúng mình" }),
    onError: showError,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.messages });
      client.invalidateQueries({ queryKey: qk.memories });
    },
  });
}

export function useSendGift() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, note }: { itemId: string; note: string }) => {
      const { data, error } = await getSupabase().rpc("send_gift", { item: itemId, note, request_id: requestId() });
      if (error) throw error;
      return data;
    },
    onSuccess: (reward) => {
      void dispatchPending();
      celebrate(reward, "Gift sent!");
      toast({ tone: "love", title: "Your gift is on its way", vi: "Quà đang được gửi đi" });
    },
    onError: showError,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.messages });
      client.invalidateQueries({ queryKey: qk.progress });
    },
  });
}

export function useSendInteraction() {
  return useMutation({
    mutationFn: async (kind: "hug" | "wave") => {
      const { data, error } = await getSupabase().rpc("send_interaction", { interaction_kind: kind });
      if (error) throw error;
      return data;
    },
    onError: showError,
  });
}

export function usePendingHugs() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.interactions,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await getSupabase()
        .from("couple_interactions")
        .select("*")
        .eq("to_user", session!.userId)
        .eq("status", "pending")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
