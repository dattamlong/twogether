import { expect, test, type Page } from "@playwright/test";
import { createAccount, expectNoHorizontalOverflow, newSignedInPage, pairAccounts, waitForRoom } from "./helpers";

const AREA = {
  home: ["pink-sunset", "our-little-world", "home-with-you", "sakura-dreams"],
  learning: ["little-steps", "study-under-the-stars", "dreamy-library", "morning-notes"],
  games: ["tiny-victory", "playtime", "lucky-hearts", "ready-set-love"],
  world: ["beyond-our-home", "sakura-village", "little-adventures", "a-world-for-two"],
  legends: ["legends-of-love", "golden-hearts", "eternal-adventure"],
};

const snapshot = (page: Page) => page.evaluate(() => window.__twogetherAudio!.snapshot());
const go = (page: Page, href: string) => page.locator(`nav[aria-label="Main"]:visible a[href="${href}"]`).dispatchEvent("click");

async function freshPage(browser: import("@playwright/test").Browser, use: object) {
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const page = await newSignedInPage(browser, a.email, { ...use, storageState: undefined });
  await waitForRoom(page);
  return page;
}

test("Music: the invitation turns on real audio that follows each area with clean crossfades", async ({ browser }, testInfo) => {
  const page = await freshPage(browser, testInfo.project.use);
  const invite = page.getByTestId("music-invitation");
  await expect(invite).toBeVisible();
  await expect(invite.getByText("Make Our World Come Alive")).toBeVisible();
  await invite.getByRole("button", { name: "Enable Music 💗" }).click();
  await expect(invite).toHaveCount(0);

  await expect.poll(async () => (await snapshot(page))?.state).toBe("running");
  await expect.poll(async () => (await snapshot(page))?.current).toBeTruthy();
  expect(AREA.home).toContain((await snapshot(page))!.current);
  await expect.poll(async () => (await snapshot(page))?.level ?? 0, { timeout: 20_000 }).toBeGreaterThan(0.002);

  await go(page, "/learn");
  await expect.poll(async () => AREA.learning.includes((await snapshot(page))?.current ?? "")).toBe(true);
  await expect.poll(async () => (await snapshot(page))?.voices, { timeout: 6_000 }).toBe(1);

  await go(page, "/world");
  await go(page, "/legends");
  await go(page, "/games");
  await expect.poll(async () => AREA.games.includes((await snapshot(page))?.current ?? "")).toBe(true);
  await expect.poll(async () => (await snapshot(page))?.voices, { timeout: 6_000 }).toBe(1);
  await expect.poll(async () => (await snapshot(page))?.level ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.002);

  await page.getByTestId("radio-button").click();
  const radio = page.getByRole("dialog", { name: "TWOGETHER Radio" });
  await expect(radio.getByText("TWOGETHER RADIO 💗")).toBeVisible();
  await expect(radio.getByTestId("radio-panel")).toHaveAttribute("data-playing", "true");
  await expectNoHorizontalOverflow(page);
  await radio.getByLabel("Music", { exact: true }).fill("20");
  await radio.getByRole("radio", { name: /Rainy Night/ }).click();
  await expect.poll(async () => (await snapshot(page))?.ambient).toBe("rain");
  await radio.getByRole("radio", { name: /Cozy Fireplace/ }).click();
  await expect.poll(async () => (await snapshot(page))?.ambient).toBe("fireplace");
  await expect.poll(async () => (await snapshot(page))?.ambientVoices, { timeout: 5_000 }).toBe(1);

  await radio.getByRole("button", { name: "Next track" }).click();
  const picked = (await snapshot(page))!.current;
  await expect(radio.getByRole("switch", { name: "Auto Music" })).toHaveAttribute("aria-checked", "false");
  await go(page, "/home");
  await page.waitForTimeout(500);
  expect((await snapshot(page))!.current).toBe(picked);

  await page.reload();
  await waitForRoom(page);
  await page.mouse.click(5, 300);
  await expect.poll(async () => (await snapshot(page))?.current).toBe(picked);
  await page.getByTestId("radio-button").click();
  const reopened = page.getByRole("dialog", { name: "TWOGETHER Radio" });
  await expect(reopened.getByLabel("Music", { exact: true })).toHaveValue("20");
  await expect(reopened.getByRole("radio", { name: /Cozy Fireplace/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("music-invitation")).toHaveCount(0);

  await reopened.getByRole("button", { name: "Pause music" }).click();
  await reopened.getByRole("switch", { name: "Ambient Sounds" }).click();
  await expect.poll(async () => (await snapshot(page))?.voices, { timeout: 6_000 }).toBe(0);
  await expect.poll(async () => (await snapshot(page))?.ambientVoices, { timeout: 6_000 }).toBe(0);
});

test("Music: Maybe Later keeps the game silent and never asks again", async ({ browser }, testInfo) => {
  const page = await freshPage(browser, testInfo.project.use);
  const invite = page.getByTestId("music-invitation");
  await expect(invite).toBeVisible();
  await invite.getByRole("button", { name: "Maybe Later" }).click();
  await expect(invite).toHaveCount(0);
  await page.reload();
  await waitForRoom(page);
  await page.waitForTimeout(3_500);
  await expect(page.getByTestId("music-invitation")).toHaveCount(0);
  const snap = await snapshot(page);
  expect(snap === null || snap.current === null).toBe(true);
  await page.goto("/profile#music");
  await expect(page.locator("#music").getByTestId("radio-panel")).toHaveAttribute("data-playing", "false");
});
