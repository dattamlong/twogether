"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import { toast } from "@/stores/toast-store";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";

export type LoveQuestionState = {
  day: string;
  question: { id: string; prompt: string; prompt_vi: string; helper_phrase: string | null };
  myAnswer: string | null;
  partnerAnswered: boolean;
  partnerAnswer: string | null;
};

const showError = (error: unknown) => {
  const message = friendlyError(error);
  toast({ tone: "error", title: message.en, vi: message.vi });
};

export function useLoveQuestion() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.loveQuestion,
    enabled: Boolean(session?.couple),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_today_love_question");
      if (error) throw error;
      return data as unknown as LoveQuestionState;
    },
  });
}

export function useAnswerLoveQuestion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (answer: string) => {
      const { data, error } = await getSupabase().rpc("answer_love_question", { answer_text: answer });
      if (error) throw error;
      return data as unknown as LoveQuestionState;
    },
    onSuccess: (state) => {
      client.setQueryData(qk.loveQuestion, state);
      toast({ tone: "love", title: state.partnerAnswer ? "Both answers revealed!" : "Answer saved", vi: state.partnerAnswer ? "Đã mở cả hai câu trả lời!" : "Đã lưu câu trả lời" });
    },
    onError: showError,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.loveHistory });
      client.invalidateQueries({ queryKey: qk.coupleQuests });
      client.invalidateQueries({ queryKey: qk.progress });
    },
  });
}

export function useLoveHistory() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.loveHistory,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_love_answer_history", { max_days: 14 });
      if (error) throw error;
      return data;
    },
  });
}

export function useMemories() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.memories,
    enabled: Boolean(session?.couple),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("memories").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useAddMemory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (m: { title: string; body: string; date: string }) => {
      const { error } = await getSupabase().rpc("add_special_memory", { memory_title: m.title, memory_body: m.body, memory_date: m.date });
      if (error) throw error;
    },
    onSuccess: () => toast({ tone: "love", title: "Memory saved", vi: "Đã lưu kỷ niệm" }),
    onError: showError,
    onSettled: () => client.invalidateQueries({ queryKey: qk.memories }),
  });
}

export function useDeleteMemory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("delete_memory", { memory: id });
      if (error) throw error;
    },
    onError: showError,
    onSettled: () => client.invalidateQueries({ queryKey: qk.memories }),
  });
}
