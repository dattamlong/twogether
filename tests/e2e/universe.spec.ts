import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { Database } from "../../src/lib/supabase/database.types";
import { PASSWORD, admin, createAccount, newSignedInPage, pairAccounts } from "./helpers";

type Q = { id: string; prompt: string; answers: string[]; tokens: string[] | null };

async function unitQuestions(unitId: string): Promise<Q[]> {
  const db = admin();
  const { data: links, error } = await db.from("unit_lessons").select("lesson_id").eq("unit_id", unitId);
  if (error) throw error;
  const { data, error: qError } = await db
    .from("lesson_questions")
    .select("id, prompt, answers, tokens")
    .in("lesson_id", links.map((l) => l.lesson_id));
  if (qError) throw qError;
  return data as unknown as Q[];
}

async function answerCurrent(page: Page, pool: Q[]) {
  await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /Nice|Great job|You got it|Perfect|Wonderful/ })).toHaveCount(0);
  const prompts = new Set(pool.map((q) => q.prompt));
  let prompt = "";
  await expect
    .poll(async () => {
      const texts = await page.locator("h2").allTextContents();
      prompt = texts.map((t) => t.trim()).find((t) => prompts.has(t)) ?? "";
      return prompt;
    })
    .not.toBe("");
  const matches = pool.filter((q) => q.prompt === prompt);
  const choices = page.getByRole("radiogroup", { name: "Answer choices" });
  if (await choices.isVisible()) {
    const labels = await choices.getByRole("radio", { disabled: false }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    const q = matches.find((m) => labels.includes(m.answers[0])) ?? matches[0];
    await choices.getByRole("radio", { name: q.answers[0], exact: true, disabled: false }).click();
  } else {
    const q = matches.find((m) => m.tokens) ?? matches[0];
    let rest = q.answers[0];
    const bank = page.getByLabel("Word bank");
    while (rest.length) {
      const texts = await bank.getByRole("button").allTextContents();
      const next = texts.find((t) => rest === t || rest.startsWith(`${t} `));
      expect(next, `token for "${rest}"`).toBeTruthy();
      await bank.getByRole("button", { name: `Add ${next}`, exact: true }).first().click();
      rest = rest.slice(next!.length).trimStart();
    }
  }
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Nice|Great job|You got it|Perfect|Wonderful/ })).toBeVisible();
}

async function playAll(page: Page, pool: Q[], total: number) {
  for (let i = 0; i < total; i++) {
    await answerCurrent(page, pool);
    await page.getByRole("button", { name: i === total - 1 ? "Finish" : "Continue" }).click();
  }
}

async function userClient(email: string) {
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

test("Learning Universe: map → lesson → character moves → review → boss → reward → Unit 2", async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const a = await createAccount("Lan");
  const b = await createAccount("Khoa");
  await pairAccounts(a, b);
  const page = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(page).toHaveURL(/\/home/);

  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Learn Together. Explore Forever." })).toBeVisible();
  await expect(page.getByText("Science Lab")).toBeVisible();
  await page.getByRole("link", { name: /English Kingdom/ }).click();
  await expect(page).toHaveURL(/\/learn\/world\/english/);
  await page.getByRole("button", { name: "Start from the beginning" }).click();
  await page.getByRole("tab", { name: /^A1/ }).click();

  const unit1 = "en-a1-u1";
  const pool = await unitQuestions(unit1);
  const firstLesson = page.getByRole("button", { name: /Hello, You!.*unlocked/ });
  await expect(firstLesson).toBeVisible();
  await expect(page.getByRole("button", { name: /locked$/ }).first()).toBeVisible();
  await firstLesson.click();
  await page.getByRole("link", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/learn\/en-a1-greetings\?map=english\/A1/);

  await page.getByRole("button", { name: "Discover first" }).click();
  await expect(page.getByText("Discover", { exact: true })).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Practice now" }).click();
  const { count: lessonSize } = await admin().from("lesson_questions").select("id", { count: "exact", head: true }).eq("lesson_id", "en-a1-greetings");
  await playAll(page, pool, lessonSize!);
  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await page.getByRole("link", { name: "Back to map" }).click();

  await expect(page.getByRole("button", { name: /Hello, You!.*completed/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nice to Meet You.*unlocked/ }).first()).toBeVisible();

  const learner = await userClient(a.email);
  const { data: links } = await admin().from("unit_lessons").select("lesson_id, position").eq("unit_id", unit1).order("position");
  for (const { lesson_id } of links!.slice(1)) {
    const { data: attempt } = await learner.rpc("start_lesson", { target_lesson: lesson_id });
    const { data: qs } = await admin().from("lesson_questions").select("id, answers").eq("lesson_id", lesson_id);
    for (const q of qs!) await learner.rpc("submit_answer", { question: q.id, answer: (q.answers as string[])[0], lesson_attempt: attempt! });
    const { error } = await learner.rpc("complete_lesson", { lesson_attempt: attempt! });
    expect(error).toBeNull();
  }

  await page.reload();
  const review = page.getByRole("button", { name: /Unit Review.*unlocked/ }).first();
  await review.click();
  await page.getByRole("link", { name: "Start" }).click();
  await page.getByRole("button", { name: "Start review" }).click();
  const reviewTotal = Number((await page.getByText(/^1\/\d+$/).textContent())!.split("/")[1]);
  await playAll(page, pool, reviewTotal);
  await expect(page.getByRole("heading", { name: "Review complete!" })).toBeVisible();
  await page.getByRole("link", { name: "Back to map" }).click();

  await page.getByRole("button", { name: /The First Guardian.*unlocked/ }).first().click();
  await page.getByRole("link", { name: "Challenge the boss" }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.getByRole("meter", { name: "Guardian HP" })).toBeVisible();
  const bossTotal = Number((await page.getByText(/^1\/\d+$/).textContent())!.split("/")[1]);
  await playAll(page, pool, bossTotal);
  await expect(page.getByRole("heading", { name: /is defeated!/ })).toBeVisible();
  await expect(page.getByLabel("3 of 3 stars")).toBeVisible();
  await expect(page.getByText(/New home decoration/)).toBeVisible();
  await expect(page.getByText("The next unit is now unlocked!")).toBeVisible();

  const { data: couple } = await admin().from("couple_members").select("couple_id").eq("user_id", a.id).single();
  const { data: owned } = await admin().from("inventories").select("item_id").eq("couple_id", couple!.couple_id).eq("item_id", "magic_bookshelf");
  expect(owned).toHaveLength(1);

  await page.getByRole("link", { name: "Back to map" }).click();
  await expect(page.getByText(/Unit 2/).first()).toBeVisible();
  await expect(page.getByText(/Unit 1 · Cleared/)).toBeVisible();
  const { data: map } = await learner.rpc("get_adventure_map", { subject: "english", map_level: "A1" });
  const units = (map as unknown as { units: { number: number; unlocked: boolean }[] }).units;
  expect(units.find((u) => u.number === 2)?.unlocked).toBe(true);
});
