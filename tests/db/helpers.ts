import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const noSession = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
};

export const admin = () => createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, noSession);

export type TestUser = { id: string; email: string; client: Client };

export async function createUser(displayName = "Tester"): Promise<TestUser> {
  const email = `test-${randomUUID()}@twogether.test`;
  const password = "correct-horse-battery";
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (created.error) throw created.error;

  const client = createClient<Database>(url(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, noSession);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { id: created.data.user.id, email, client };
}

export async function createCouple() {
  const a = await createUser("Mai");
  const b = await createUser("Minh");
  const invite = await a.client.rpc("create_invitation");
  if (invite.error) throw invite.error;
  const joined = await b.client.rpc("accept_invitation", { invite_code: invite.data.code });
  if (joined.error) throw joined.error;
  return { a, b, coupleId: joined.data };
}

export async function giveCoins(userId: string, coins: number) {
  const db = admin();
  const { error } = await db.from("user_progress").update({ coins }).eq("user_id", userId);
  if (error) throw error;
}

export function expectOk<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw new Error(`Expected success, got ${JSON.stringify(result.error)}`);
  return result.data as NonNullable<T>;
}

export function errorMessage(result: { error: { message: string } | null }) {
  return result.error?.message ?? null;
}

export async function answerKey(questionId: string) {
  const { data, error } = await admin().from("lesson_questions").select("answers, kind, options").eq("id", questionId).single();
  if (error) throw error;
  return data;
}

export async function playLesson(user: TestUser, lessonId: string, correctCount: number) {
  const attempt = expectOk(await user.client.rpc("start_lesson", { target_lesson: lessonId }));
  const questions = expectOk(await user.client.from("question_cards").select("id").eq("lesson_id", lessonId).order("position"));
  for (const [index, q] of questions.entries()) {
    const key = await answerKey(q.id!);
    const right = (key.answers as string[])[0];
    const answer = index < correctCount ? right : "definitely wrong";
    expectOk(await user.client.rpc("submit_answer", { question: q.id!, answer, lesson_attempt: attempt }));
    if (index >= correctCount) {
      expectOk(await user.client.rpc("submit_answer", { question: q.id!, answer: right, lesson_attempt: attempt }));
    }
  }
  await humanPace("lesson_attempts", attempt as string);
  return { attempt, total: questions.length };
}

export async function humanPace(table: "lesson_attempts" | "game_sessions", id: string, seconds = 600) {
  const startedAt = new Date(Date.now() - seconds * 1000).toISOString();
  expectOk(await admin().from(table).update({ started_at: startedAt }).eq("id", id).select("id"));
}
