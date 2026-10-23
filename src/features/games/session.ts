"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { QuestionCard } from "../learning/types";

export type GameStart = { sessionId: string; questions: QuestionCard[] };
export type GameResult = { won: boolean; firstTryCorrect: number; solved: number; xp: number; coins: number; leveledUp: boolean; level: number };

export async function startGame(kind: "word_battle" | "sentence_puzzle") {
  const { data, error } = await getSupabase().rpc("start_game", { game: kind });
  if (error) throw error;
  return data as unknown as GameStart;
}

export async function finishGame(sessionId: string) {
  const { data, error } = await getSupabase().rpc("finish_game", { game_session: sessionId });
  if (error) throw error;
  return data as unknown as GameResult;
}
