import { expect, test, type Page } from "@playwright/test";

test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});
import { admin, createAccount, expectNoHorizontalOverflow, newSignedInPage, pairAccounts, waitForRoom } from "./helpers";

const state = (page: Page) => page.evaluate(() => window.__loveSmash!.state());

async function lobby(browser: import("@playwright/test").Browser, use: object) {
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const page = await newSignedInPage(browser, a.email, use);
  await waitForRoom(page);
  await page.goto("/games");
  await page.getByRole("link", { name: /Love Smash!/ }).click();
  await expect(page.getByTestId("love-smash-lobby")).toBeVisible();
  return { page, user: a };
}

test("Love Smash: a full practice match against the bot is verified and rewarded", async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  const { page, user } = await lobby(browser, testInfo.project.use);
  await expect(page.getByRole("heading", { name: /Love Smash!/ })).toBeVisible();
  for (const mode of ["Online 1v1", "Ranked"]) await expect(page.getByText(mode, { exact: true })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="smash-soon"]').getByText("Coming soon")).toHaveCount(2);
  await expect(page.getByTestId("play-together")).toContainText("Play With My Partner");
  await expectNoHorizontalOverflow(page);

  await admin().from("love_smash_stats").insert({ user_id: user.id, matches: 30, wins: 15, drop_shots: 30, tutorial_done: true });
  await page.reload();
  await expect(page.getByTestId("skill-card-sakura_meteor")).toHaveAttribute("data-unlocked", "true");
  await page.getByTestId("equip-phoenix_drive").click();
  await expect(page.getByTestId("skill-card-phoenix_drive")).toHaveAttribute("data-equipped", "true");
  await page.getByRole("radio", { name: /Easy/ }).click();
  await page.getByTestId("start-practice").click();
  await expect(page.getByTestId("skill-special")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("skill-special")).toHaveAttribute("data-ready", "false");
  const game = page.getByTestId("love-smash-game");
  await expect(game).toBeVisible();
  await expect(page.getByTestId("scoreline")).toHaveText(/0\s*-\s*0/);
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(30);

  if (testInfo.project.name === "desktop") {
    await page.waitForTimeout(400);
    await page.keyboard.press("KeyJ");
    await expect.poll(async () => (await state(page)).phase).not.toBe("serve");
    const before = (await state(page)).player;
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(300);
    await page.keyboard.up("KeyA");
    expect((await state(page)).player.x).toBeLessThan(before.x);
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByTestId("touch-controls")).toBeVisible();
    await page.getByRole("button", { name: "HIT" }).dispatchEvent("pointerdown");
    await expect.poll(async () => (await state(page)).phase).not.toBe("serve");
    await page.getByTestId("pause-button").click();
  }
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  const frozen = (await state(page)).tick;
  await page.waitForTimeout(500);
  expect((await state(page)).tick).toBe(frozen);
  await page.getByRole("dialog", { name: "Paused" }).getByRole("button", { name: "Resume" }).click();
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(frozen);

  await page.evaluate(() => window.__loveSmash!.autopilot(true));
  const results = page.getByTestId("love-smash-results");
  await expect(results).toBeVisible({ timeout: 240_000 });
  const reward = page.getByTestId("love-smash-reward");
  await expect(reward).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const won = (await results.getAttribute("data-won")) === "true";
  await expect(reward).toContainText(won ? "+50 XP" : "+20 XP");
  if (won) await expect(reward).toContainText("+100");

  const { data: rows } = await admin().from("love_smash_matches").select("won, player_score, bot_score, xp_awarded").eq("user_id", user.id);
  expect(rows).toHaveLength(1);
  expect(rows![0].won).toBe(won);
  await expect(page.getByTestId("final-score")).toContainText(`${rows![0].player_score} – ${rows![0].bot_score}`);
  const { data: stats } = await admin().from("love_smash_stats").select("matches, wins").eq("user_id", user.id).single();
  expect(stats).toEqual({ matches: 31, wins: won ? 16 : 15 });

  await page.getByTestId("play-again").click();
  await expect(game).toBeVisible();
  await expect(page.getByTestId("scoreline")).toHaveText(/0\s*-\s*0/);
  await page.getByTestId("pause-button").click();
  await page.getByRole("dialog", { name: "Paused" }).getByRole("button", { name: "Quit to lobby" }).click();
  await expect(page.getByTestId("love-smash-stats")).toContainText("1");
});

test("Love Smash: the tutorial teaches movement with the touch joystick", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch joystick");
  const { page } = await lobby(browser, testInfo.project.use);
  await page.getByTestId("start-tutorial").click();
  await expect(page.getByTestId("tutorial-step")).toHaveAttribute("data-step", "move");
  const stick = page.getByRole("application", { name: "Movement joystick" });
  const box = (await stick.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy - 20, { steps: 4 });
  await page.waitForTimeout(900);
  await page.mouse.move(cx - 40, cy + 20, { steps: 4 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect(page.getByTestId("tutorial-step")).toHaveAttribute("data-step", "hit");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await expect(page.getByTestId("love-smash-lobby")).toBeVisible();
});

test("Love Smash: the server refuses forged or foreign match results", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "api only");
  const { page, user } = await lobby(browser, testInfo.project.use);
  const { data: mine } = await admin().from("love_smash_matches").insert({ user_id: user.id, difficulty: "easy", seed: 42, started_at: new Date(Date.now() - 600_000).toISOString() }).select("id").single();
  const unfinished = await page.request.post("/api/love-smash/finish", { data: { matchId: mine!.id, log: [40, 600] } });
  expect(unfinished.status()).toBe(422);
  expect(await unfinished.json()).toEqual({ error: "unfinished" });
  const garbage = await page.request.post("/api/love-smash/finish", { data: { matchId: mine!.id, log: [9999, 1] } });
  expect(garbage.status()).toBe(422);
  const other = await createAccount("Eve");
  const { data: theirs } = await admin().from("love_smash_matches").insert({ user_id: other.id, difficulty: "easy", seed: 42 }).select("id").single();
  const foreign = await page.request.post("/api/love-smash/finish", { data: { matchId: theirs!.id, log: [40, 600] } });
  expect(foreign.status()).toBe(404);
  const { data: row } = await admin().from("love_smash_matches").select("finished_at").eq("id", mine!.id).single();
  expect(row!.finished_at).toBeNull();
});
