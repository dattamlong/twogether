import { expect, test } from "@playwright/test";
import {
  answerKey,
  createAccount,
  expectNoHorizontalOverflow,
  lessonQuestionIds,
  newSignedInPage,
  pairAccounts,
  waitForRoom,
} from "./helpers";

test("a new user registers and is guided to pairing", async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@twogether.test`;
  await page.goto("/");
  await page.getByRole("link", { name: "Start our adventure" }).click();
  await page.getByLabel("Your name").fill("Lan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/pair/);
  await expect(page.getByRole("heading", { name: /Hi Lan/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("two partners pair with an invitation code and meet in the shared room", async ({ browser }, testInfo) => {
  const a = await createAccount("Mai");
  const b = await createAccount("Minh");
  const options = testInfo.project.use;

  const pageA = await newSignedInPage(browser, a.email, options);
  await expect(pageA).toHaveURL(/\/pair/);
  await pageA.getByRole("button", { name: "Create invitation code" }).click();
  const codeDisplay = pageA.locator('[aria-label^="Invitation code "]');
  await expect(codeDisplay).toBeVisible();
  const codeLabel = await codeDisplay.getAttribute("aria-label");
  const code = codeLabel!.replace("Invitation code", "").replaceAll(" ", "");
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  const pageB = await newSignedInPage(browser, b.email, options);
  await expect(pageB).toHaveURL(/\/pair/);
  await pageB.getByLabel("Invitation code").fill(code);
  await pageB.getByRole("button", { name: "Join" }).click();
  await expect(pageB).toHaveURL(/\/home/);
  await waitForRoom(pageB);

  await pageA.goto("/home");
  await waitForRoom(pageA);
  await expect(pageA.getByText("Minh is here")).toBeVisible();
  await expect(pageB.getByText("Mai is here")).toBeVisible();
  await expect(pageA.locator("[data-partner-mode='present']")).toBeVisible();
  await expectNoHorizontalOverflow(pageA);
});

test("a learner completes a lesson and receives XP and coins", async ({ browser }, testInfo) => {
  const a = await createAccount("Mai");
  const b = await createAccount("Minh");
  await pairAccounts(a, b);
  const page = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(page).toHaveURL(/\/home/);

  const lessonId = "grammar-a1-articles";
  const questions = await lessonQuestionIds(lessonId);
  await page.goto(`/learn/${lessonId}`);
  await page.getByRole("button", { name: "Start lesson" }).click();

  for (const [i, q] of questions.entries()) {
    await expect(page.getByRole("heading", { name: q.prompt })).toBeVisible();
    const answer = await answerKey(q.id);
    await page.getByRole("radio", { name: answer, exact: true }).click();
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Nice|Great job|You got it|Perfect|Wonderful/ })).toBeVisible();
    await page.getByRole("button", { name: i === questions.length - 1 ? "Finish" : "Continue" }).click();
  }

  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  const expectedXp = questions.length * 10 + 20;
  await expect(page.getByText(`+${expectedXp} XP`).first()).toBeVisible();
  await page.getByRole("link", { name: "Go home" }).click();
  await expect(page.getByRole("progressbar", { name: "Level 2 progress" })).toBeAttached();
});

test("a user buys a decoration with Love Coins", async ({ browser }, testInfo) => {
  const a = await createAccount("Mai");
  const b = await createAccount("Minh");
  await pairAccounts(a, b);
  const { admin } = await import("./helpers");
  await admin().rpc("grant_reward", { uid: a.id, add_xp: 0, add_coins: 100, reason: "e2e", ref: a.id });

  const page = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/shop");
  const card = page.locator("li").filter({ hasText: "Happy Cactus" });
  await card.getByRole("button", { name: "Buy" }).click();
  await page.getByRole("button", { name: "Buy for 40" }).click();
  await expect(page.getByLabel("70 Love Coins")).toBeVisible();
  await expect(card.getByRole("button", { name: /Buy another \(1\)/ })).toBeVisible();
});

test("partners send a wave and share an accepted hug", async ({ browser }, testInfo) => {
  const a = await createAccount("Mai");
  const b = await createAccount("Minh");
  await pairAccounts(a, b);
  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await waitForRoom(pageA);
  await waitForRoom(pageB);
  await expect(pageA.locator("[data-partner-mode='present']")).toBeVisible();

  await pageA.getByRole("toolbar", { name: "Room actions" }).getByRole("button", { name: "Wave" }).click();
  await expect(pageB.getByText("Mai waved at you")).toBeVisible();

  await pageA.getByRole("button", { name: "Hug…" }).click();
  await pageA.getByRole("dialog").getByRole("button", { name: /^Hug/ }).click();
  await expect(pageB.getByText("Mai wants a hug!")).toBeVisible();
  await pageB.getByRole("button", { name: "Hug back" }).click();
  await expect(pageA.locator("[data-self-anim='hug']")).toBeAttached({ timeout: 15_000 });
  await expect(pageB.locator("[data-self-anim='hug']")).toBeAttached({ timeout: 15_000 });
});

test("partners decorate the shared room and the layout persists for both", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Tile tapping is covered on desktop; mobile shares the same code path.");
  const a = await createAccount("Mai");
  const b = await createAccount("Minh");
  const coupleId = await pairAccounts(a, b);
  const { admin } = await import("./helpers");
  await admin().rpc("grant_reward", { uid: a.id, add_xp: 0, add_coins: 200, reason: "e2e", ref: a.id });

  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await pageA.goto("/shop");
  await pageA.locator("li").filter({ hasText: "Paper Floor Lamp" }).getByRole("button", { name: "Buy" }).click();
  await pageA.getByRole("button", { name: "Buy for 120" }).click();
  await expect(pageA.getByLabel("90 Love Coins")).toBeVisible();

  await pageA.goto("/home");
  await waitForRoom(pageA);
  await pageA.getByRole("button", { name: "Decorate" }).click();
  await pageA.getByRole("button", { name: /^Paper Floor Lamp/ }).click();
  const host = pageA.locator("[data-camera]");
  const [cx, cy, scale] = (await host.getAttribute("data-camera"))!.split(",").map(Number);
  const box = (await host.boundingBox())!;
  const tile = { x: 8, y: 6 };
  await pageA.mouse.click(box.x + cx + (tile.x - tile.y) * 32 * scale, box.y + cy + (tile.x + tile.y + 1) * 16 * scale);
  await pageA.getByRole("button", { name: "Save" }).click();
  await expect(pageA.getByText("Room saved")).toBeVisible();

  const { data } = await admin().from("furniture_placements").select("x, y").eq("couple_id", coupleId);
  expect(data).toEqual([{ x: 8, y: 6 }]);
  await pageB.goto("/home");
  await waitForRoom(pageB);
  await pageB.getByRole("button", { name: "Decorate" }).click();
  await expect(pageB.getByRole("button", { name: /^Paper Floor Lamp/ })).toContainText("Placed");
});

test("a couple joins Love Legends, climbs to #1 and sees the celebration", async ({ browser }, testInfo) => {
  const a = await createAccount("Mai");
  const b = await createAccount("Minh");
  const coupleId = await pairAccounts(a, b);
  const { admin } = await import("./helpers");
  await admin().from("couple_public_profiles").update({ is_public: false }).neq("couple_id", coupleId);
  const page = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(page).toHaveURL(/\/home/);

  await page.goto("/legends");
  await expect(page.getByRole("heading", { name: "Love Legends" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Weekly Legends/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /^Join/ }).first().click();
  await expect(page.getByText("You joined Love Legends!")).toBeVisible();

  await admin().rpc("grant_reward", { uid: a.id, add_xp: 5000, add_coins: 0, reason: "lesson", ref: `e2e-${a.id}` });
  await admin().rpc("grant_reward", { uid: b.id, add_xp: 5000, add_coins: 0, reason: "lesson", ref: `e2e-${b.id}` });
  await page.reload();

  const celebration = page.getByRole("dialog", { name: "You are the number one couple" });
  await expect(celebration).toBeVisible();
  await celebration.getByRole("button", { name: "Keep shining" }).click();
  await expect(page.getByRole("button", { name: /^Rank 1: Mai and Minh, 800 points/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "You are the number one couple" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
