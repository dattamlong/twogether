import { createClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import type { Database } from "../../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

export const PASSWORD = "e2e-password-123";

export const admin = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function createAccount(name: string) {
  const email = `e2e-${randomUUID()}@twogether.test`;
  const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } });
  if (error) throw error;
  return { email, id: data.user.id, name };
}

export async function pairAccounts(a: { id: string }, b: { id: string }) {
  const db = admin();
  const { data: couple, error } = await db.from("couples").insert({ created_by: a.id }).select().single();
  if (error) throw error;
  await db.from("couple_members").insert([
    { couple_id: couple.id, user_id: a.id, slot: 0 },
    { couple_id: couple.id, user_id: b.id, slot: 1 },
  ]);
  await db.from("couple_progress").insert({ couple_id: couple.id });
  await db.from("streaks").insert({ subject_type: "couple", subject_id: couple.id });
  return couple.id;
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function newSignedInPage(browser: Browser, email: string, contextOptions = {}) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

export async function answerKey(questionId: string) {
  const { data, error } = await admin().from("lesson_questions").select("answers").eq("id", questionId).single();
  if (error) throw error;
  return (data.answers as string[])[0];
}

export async function lessonQuestionIds(lessonId: string) {
  const { data, error } = await admin().from("lesson_questions").select("id, prompt").eq("lesson_id", lessonId).order("position");
  if (error) throw error;
  return data;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function waitForRoom(page: Page) {
  await expect(page.locator("[data-camera]")).toBeVisible();
}
