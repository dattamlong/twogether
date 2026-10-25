import { expect, test } from "@playwright/test";
import { admin, createAccount, newSignedInPage, pairAccounts, waitForRoom } from "./helpers";

test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});

test("Road to Legend: a verified win advances the solo career and survives a reload", async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const page = await newSignedInPage(browser, a.email, testInfo.project.use);
  await waitForRoom(page);
  await page.goto("/games/love-smash");
  await page.getByTestId("road-to-legend-link").click();
  await expect(page.getByTestId("career-hub")).toBeVisible();
  await page.getByTestId("career-create").click();
  await expect(page.getByTestId("tier-1")).toHaveAttribute("data-status", "In progress");
  await expect(page.getByTestId("tier-2")).toHaveAttribute("data-status", "Locked");
  await expect(page.getByTestId("tournament-panel")).toHaveAttribute("data-round", "0");
  const firstOpponent = await page.getByTestId("next-opponent").innerText();

  await page.getByTestId("career-play").click();
  await expect(page.getByTestId("love-smash-game")).toBeVisible();
  await expect(page.getByTestId("intro-round")).toHaveText("QUARTERFINAL");
  await page.getByRole("button", { name: "Skip ›" }).click();
  await page.waitForFunction(() => Boolean(window.__loveSmash));
  await page.evaluate(() => window.__loveSmash!.autopilot(true));
  const result = page.getByTestId("career-result");
  await expect(result).toBeVisible({ timeout: 240_000 });
  await expect(result).toHaveAttribute("data-won", "true");
  await expect(page.getByTestId("career-reward")).toContainText("XP");
  await expect(page.getByTestId("career-next")).toBeVisible();
  await page.getByRole("button", { name: "Career hub" }).click();
  await expect(page.getByTestId("tournament-panel")).toHaveAttribute("data-round", "1");
  await expect(page.getByTestId("next-opponent")).not.toHaveText(firstOpponent);

  await page.reload();
  await expect(page.getByTestId("tournament-panel")).toHaveAttribute("data-round", "1");
  const { data: career } = await admin().from("love_smash_careers").select("state").eq("owner_id", a.id).single();
  expect((career!.state as { stats: { wins: number } }).stats.wins).toBe(1);
  const { data: matches } = await admin().from("love_smash_matches").select("mode, won, finished_at").eq("user_id", a.id);
  expect(matches).toEqual([expect.objectContaining({ mode: "career", won: true })]);

  const intruder = await createAccount("Eve");
  const evePage = await newSignedInPage(browser, intruder.email, testInfo.project.use);
  await evePage.waitForURL(/pair|home|onboard/, { timeout: 20_000 }).catch(() => undefined);
  const { data: careerRow } = await admin().from("love_smash_careers").select("id").eq("owner_id", a.id).single();
  const res = await evePage.request.post("/api/love-smash/career", { data: { action: "start", careerId: careerRow!.id } });
  expect(res.status()).toBe(404);
  const tier = await evePage.request.post("/api/love-smash/career", { data: { action: "tournament", careerId: careerRow!.id, tier: 1 } });
  expect(tier.status()).toBe(404);
});

test("Road to Legend: partners play a couple career match on two devices and share the progress", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-device run once");
  test.setTimeout(420_000);
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const [pa, pb] = await Promise.all([a, b].map((u) => newSignedInPage(browser, u.email, testInfo.project.use)));
  await Promise.all([pa, pb].map((p) => waitForRoom(p)));

  await pa.goto("/games/love-smash/career");
  await pa.getByTestId("career-tab-couple").click();
  await pa.getByTestId("career-create").click();
  await expect(pa.getByTestId("career-couple")).toBeVisible();
  await expect(pa.getByTestId("tournament-panel")).toHaveAttribute("data-round", "0");

  await pb.goto("/games/love-smash/career");
  await pb.getByTestId("career-tab-couple").click();
  await expect(pb.getByTestId("tournament-panel")).toHaveAttribute("data-round", "0");
  const opponent = await pb.getByTestId("next-opponent").innerText();
  await expect(pa.getByTestId("next-opponent")).toHaveText(opponent);

  await pa.getByTestId("career-play").click();
  await expect(pa.getByTestId("love-smash-room-view")).toBeVisible({ timeout: 20_000 });
  await expect(pa.getByTestId("room-lobby")).toContainText("Couple Career match");
  await expect(pa.getByTestId("room-slot-2")).toHaveAttribute("data-status", "invited");
  await pb.goto("/games/love-smash");
  await pb.getByTestId("invite-accept").click();
  await pb.getByTestId("room-ready").click();
  await expect(pa.getByTestId("room-start")).toBeEnabled({ timeout: 10_000 });
  await pa.getByTestId("room-start").click();

  for (const page of [pa, pb]) await expect(page.getByTestId("love-smash-online")).toBeVisible({ timeout: 20_000 });
  for (const page of [pa, pb]) await page.getByRole("button", { name: "Skip ›" }).click().catch(() => undefined);
  for (const page of [pa, pb]) await page.waitForFunction(() => Boolean(window.__loveSmashOnline));
  for (const page of [pa, pb]) await page.evaluate(() => window.__loveSmashOnline!.autopilot(true));
  for (const page of [pa, pb]) await expect(page.getByTestId("online-results")).toBeVisible({ timeout: 360_000 });
  await expect(pb.getByTestId("online-final-score")).toHaveText(await pa.getByTestId("online-final-score").innerText());
  for (const page of [pa, pb]) await expect(page.getByTestId("online-reward")).toContainText("XP");
  await expect(pb.getByTestId("career-progress-link")).toBeVisible();

  const { data: matches } = await admin().from("love_smash_matches").select("user_id, won, finished_at, career_id").eq("mode", "career").in("user_id", [a.id, b.id]);
  expect(matches).toHaveLength(2);
  expect(matches!.every((m) => m.finished_at && m.career_id)).toBe(true);
  const won = matches![0].won;
  const { data: career } = await admin().from("love_smash_careers").select("state").eq("id", matches![0].career_id!).single();
  const state = career!.state as { stats: { wins: number; losses: number }; current: { round: number; attempts: number } };
  if (won) {
    expect(state.stats.wins).toBe(1);
    expect(state.current.round).toBe(1);
  } else {
    expect(state.stats.losses).toBe(1);
    expect(state.current.attempts).toBe(1);
  }

  await pb.getByTestId("career-progress-link").click();
  await pb.getByTestId("career-tab-couple").click();
  await expect(pb.getByTestId("tournament-panel")).toHaveAttribute("data-round", won ? "1" : "0");
});
