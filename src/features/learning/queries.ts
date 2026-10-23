"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";
import type { Database } from "@/lib/supabase/database.types";
import type { AnswerFeedback, QuestionCard, StudyLanguage } from "./types";

export function useLessons() {
  return useQuery({
    queryKey: qk.lessons,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const supabase = getSupabase();
      const [categories, lessons, counts] = await Promise.all([
        supabase.from("learning_categories").select("*").order("sort_order"),
        supabase.from("lessons").select("*").order("sort_order"),
        supabase.from("question_cards").select("lesson_id"),
      ]);
      for (const r of [categories, lessons, counts]) if (r.error) throw r.error;
      const questionCount = new Map<string, number>();
      for (const row of counts.data ?? []) questionCount.set(row.lesson_id!, (questionCount.get(row.lesson_id!) ?? 0) + 1);
      return {
        categories: categories.data!,
        lessons: lessons.data!.map((l) => ({ ...l, questionCount: questionCount.get(l.id) ?? 0 })),
      };
    },
  });
}

export function useLessonHistory() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.lessonHistory,
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("lesson_attempts")
        .select("lesson_id, correct_count, total_count, completed_at")
        .not("completed_at", "is", null);
      if (error) throw error;
      const best = new Map<string, { correct: number; total: number; times: number }>();
      for (const a of data) {
        const prev = best.get(a.lesson_id);
        best.set(a.lesson_id, {
          correct: Math.max(prev?.correct ?? 0, a.correct_count ?? 0),
          total: a.total_count ?? 0,
          times: (prev?.times ?? 0) + 1,
        });
      }
      return best;
    },
  });
}

export function useLessonCards(lessonId: string) {
  return useQuery({
    queryKey: qk.lessonCards(lessonId),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const supabase = getSupabase();
      const [lesson, cards] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
        supabase.from("question_cards").select("*").eq("lesson_id", lessonId).order("position"),
      ]);
      if (lesson.error) throw lesson.error;
      if (cards.error) throw cards.error;
      return { lesson: lesson.data, cards: cards.data as QuestionCard[] };
    },
  });
}

export function useReviewStats() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: [...qk.reviewQueue, "stats", session?.profile.learning_language],
    enabled: Boolean(session),
    queryFn: async () => {
      const supabase = getSupabase();
      const now = new Date().toISOString();
      const language = session!.profile.learning_language;
      const inLanguage = () =>
        supabase.from("review_progress").select("question_id, lesson_questions!inner(lessons!inner(language))", { count: "exact", head: true }).eq("lesson_questions.lessons.language", language);
      const [due, learned, mastered] = await Promise.all([
        inLanguage().lte("next_review_at", now),
        inLanguage().not("first_learned_at", "is", null),
        inLanguage().gte("box", 4),
      ]);
      for (const r of [due, learned, mastered]) if (r.error) throw r.error;
      return { due: due.count ?? 0, learned: learned.count ?? 0, mastered: mastered.count ?? 0 };
    },
  });
}

export function useReviewQueue(enabled: boolean) {
  return useQuery({
    queryKey: qk.reviewQueue,
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_review_queue", { max_items: 10 });
      if (error) throw error;
      return data as QuestionCard[];
    },
  });
}

export function useWordBank() {
  return useQuery({
    queryKey: qk.wordBank,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_word_bank");
      if (error) throw error;
      return data;
    },
  });
}

export async function submitAnswer(args: { question: string; answer: string; lessonAttempt?: string; gameSession?: string; review?: boolean }) {
  const { data, error } = await getSupabase().rpc("submit_answer", {
    question: args.question,
    answer: args.answer,
    lesson_attempt: args.lessonAttempt,
    game_session: args.gameSession,
    review: args.review ?? false,
  });
  if (error) throw error;
  return data as unknown as AnswerFeedback;
}

export type LearningSettings = { language?: StudyLanguage; level?: string };

export function useSetLearning() {
  const client = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn: async ({ language, level }: LearningSettings) => {
      const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
      if (language) patch.learning_language = language;
      if (level?.startsWith("HSK")) patch.chinese_level = Number(level.slice(3));
      else if (level) patch.english_level = level as Database["public"]["Enums"]["cefr_level"];
      const { error } = await getSupabase().from("profiles").update(patch).eq("id", session!.userId);
      if (error) throw error;
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.session });
      client.invalidateQueries({ queryKey: qk.reviewQueue });
      client.invalidateQueries({ queryKey: qk.wordBank });
    },
  });
}

export function currentLevel(profile: { learning_language: string; english_level: string; chinese_level: number }) {
  return profile.learning_language === "zh" ? `HSK${profile.chinese_level}` : profile.english_level;
}
