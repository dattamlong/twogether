import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createAccount, newSignedInPage, pairAccounts, waitForRoom } from "./helpers";

test.describe.configure({ mode: "serial" });

test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});

async function couple(browser: Browser, use: object, names: [string, string]) {
  const users = await Promise.all(names.map((n) => createAccount(n)));
  await pairAccounts(users[0], users[1]);
  const pages = await Promise.all(users.map((u) => newSignedInPage(browser, u.email, use)));
  await Promise.all(pages.map((p) => waitForRoom(p)));
  return users.map((user, i) => ({ user, page: pages[i] }));
}

async function play(pages: Page[]) {
  for (const page of pages) await expect(page.getByTestId("love-smash-online")).toBeVisible({ timeout: 20_000 });
  for (const page of pages) await page.getByRole("button", { name: "Skip ›" }).click().catch(() => undefined);
  for (const page of pages) await page.waitForFunction(() => Boolean(window.__loveSmashOnline));
  for (const page of pages) await page.evaluate(() => window.__loveSmashOnline!.autopilot(true));
}

test("Couple vs Bots: partners on two devices finish a synchronized doubles match", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-device run once");
  test.setTimeout(360_000);
  const [a, b] = await couple(browser, testInfo.project.use, ["Dat", "An"]);
  const loadout = { movement: "lightning_dash", special: "frost_drop", ultimate: "sakura_meteor" };
  await admin().from("love_smash_stats").insert([a, b].map((p) => ({ user_id: p.user.id, matches: 30, wins: 15, drop_shots: 30, doubles_matches: 6, tutorial_done: true, loadout })));

  await a.page.goto("/games/love-smash");
  await a.page.getByTestId("play-with-partner").click();
  const lobby = a.page.getByTestId("room-lobby");
  await expect(lobby).toBeVisible();
  await expect(a.page.getByTestId("room-slot-2")).toHaveAttribute("data-status", "invited");
  await expect(a.page.getByTestId("room-slot-2")).toContainText("Invitation sent");
  await expect(a.page.getByTestId("room-start")).toBeDisabled();

  const { data: note } = await admin().from("notifications").select("destination").eq("recipient_user_id", b.user.id).eq("type", "game_invitation").single();
  await b.page.goto(note!.destination);
  await expect(b.page.getByTestId("room-invite")).toContainText("Dat invited you");
  await b.page.getByTestId("invite-accept").click();
  await expect(b.page.getByTestId("room-lobby")).toBeVisible();
  await b.page.getByTestId("room-ready").click();
  await expect(a.page.getByTestId("room-slot-2")).toContainText("Ready", { timeout: 10_000 });
  await expect(a.page.getByTestId("room-start")).toBeEnabled();
  await a.page.getByTestId("room-start").click();

  await play([a.page, b.page]);
  await expect(a.page.getByTestId("love-smash-online")).toHaveAttribute("data-host", "true");
  await expect(b.page.getByTestId("love-smash-online")).toHaveAttribute("data-host", "false");
  await expect.poll(async () => b.page.evaluate(() => window.__loveSmashOnline?.state().tick ?? 0), { timeout: 20_000 }).toBeGreaterThan(120);
  await expect(b.page.getByTestId("skill-sync")).toBeVisible();
  await expect.poll(async () => Number(await b.page.getByTestId("energy-fill").getAttribute("data-energy")), { timeout: 90_000 }).toBeGreaterThan(0);

  for (const page of [a.page, b.page]) await expect(page.getByTestId("online-results")).toBeVisible({ timeout: 300_000 });
  const scoreA = await a.page.getByTestId("online-final-score").innerText();
  await expect(b.page.getByTestId("online-final-score")).toHaveText(scoreA);
  for (const page of [a.page, b.page]) await expect(page.getByTestId("online-reward")).toContainText("XP");

  const { data: rooms } = await admin().from("love_smash_rooms").select("status, result").eq("host_id", a.user.id);
  expect(rooms![0].status).toBe("finished");
  const { data: matches } = await admin().from("love_smash_matches").select("user_id, finished_at, xp_awarded").eq("mode", "couple_ai").in("user_id", [a.user.id, b.user.id]);
  expect(matches).toHaveLength(2);
  expect(matches!.every((m) => m.finished_at && m.xp_awarded > 0)).toBe(true);
});

test("2v2 Room: four players on four devices complete a couple vs couple match", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-device run once");
  test.setTimeout(420_000);
  const players = [...(await couple(browser, testInfo.project.use, ["Dat", "An"])), ...(await couple(browser, testInfo.project.use, ["Minh", "Linh"]))];
  const [host, ...others] = players;
  await host.page.goto("/games/love-smash");
  await host.page.getByTestId("create-versus-room").click();
  const code = (await host.page.getByTestId("room-code").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  for (const p of others) {
    await p.page.goto("/games/love-smash");
    await p.page.getByLabel("Room code").fill(code);
    await p.page.getByTestId("join-room").click();
    await expect(p.page.getByTestId("room-lobby")).toBeVisible();
  }
  await expect(host.page.getByTestId("room-slot-3")).toHaveAttribute("data-status", "joined", { timeout: 10_000 });
  for (const p of others) await p.page.getByTestId("room-ready").click();
  await expect(host.page.getByTestId("room-start")).toBeEnabled({ timeout: 10_000 });
  await host.page.getByTestId("room-start").click();

  await play(players.map((p) => p.page));
  for (const p of players) await expect(p.page.getByTestId("online-results")).toBeVisible({ timeout: 360_000 });
  const score = await host.page.getByTestId("online-final-score").innerText();
  for (const p of others) await expect(p.page.getByTestId("online-final-score")).toHaveText(score);
  const { data: matches } = await admin().from("love_smash_matches").select("user_id, won").eq("mode", "versus").in("user_id", players.map((p) => p.user.id));
  expect(matches).toHaveLength(4);
  expect(matches!.filter((m) => m.won)).toHaveLength(2);
});

test("Couple vs Bots: the match pauses for a disconnected partner and resumes when they rejoin", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-device run once");
  test.setTimeout(420_000);
  const [a, b] = await couple(browser, testInfo.project.use, ["Dat", "An"]);
  await a.page.goto("/games/love-smash");
  await a.page.getByTestId("play-with-partner").click();
  await expect(a.page.getByTestId("room-slot-2")).toHaveAttribute("data-status", "invited");
  const { data: note } = await admin().from("notifications").select("destination").eq("recipient_user_id", b.user.id).eq("type", "game_invitation").single();
  await b.page.goto(note!.destination);
  await b.page.getByTestId("invite-accept").click();
  await b.page.getByTestId("room-ready").click();
  await expect(a.page.getByTestId("room-start")).toBeEnabled({ timeout: 10_000 });
  await a.page.getByTestId("room-start").click();
  await play([a.page, b.page]);
  await expect.poll(async () => a.page.evaluate(() => window.__loveSmashOnline?.state().tick ?? 0), { timeout: 20_000 }).toBeGreaterThan(300);

  const context = b.page.context();
  await b.page.close();
  await expect(a.page.getByTestId("waiting-overlay")).toContainText("Waiting for An", { timeout: 20_000 });
  const frozen = await a.page.evaluate(() => window.__loveSmashOnline!.state().tick);
  await a.page.waitForTimeout(1000);
  expect(await a.page.evaluate(() => window.__loveSmashOnline!.state().tick)).toBe(frozen);

  const back = await context.newPage();
  await back.goto("/games/love-smash");
  await back.getByTestId("resume-button").click();
  await play([back]);
  await expect(a.page.getByTestId("waiting-overlay")).toHaveCount(0, { timeout: 20_000 });
  for (const page of [a.page, back]) await expect(page.getByTestId("online-results")).toBeVisible({ timeout: 300_000 });
  await expect(back.getByTestId("online-reward")).toContainText("XP");
});

test("Couple vs Bots: leaving ends the room for everyone right away", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-device run once");
  const [a, b] = await couple(browser, testInfo.project.use, ["Dat", "An"]);
  await a.page.goto("/games/love-smash");
  await a.page.getByTestId("play-with-partner").click();
  await expect(a.page.getByTestId("love-smash-room-view")).toBeVisible();
  await expect(a.page.getByTestId("room-slot-2")).toHaveAttribute("data-status", "invited");
  await expect(a.page.getByTestId("room-next-steps")).toContainText("An got a notification");
  await b.page.goto("/games/love-smash");
  await expect(b.page.getByTestId("room-invite")).toContainText("Dat invited you");
  await b.page.getByTestId("invite-accept").click();
  await expect(b.page.getByTestId("room-next-steps")).toContainText("I'm ready");
  await b.page.getByTestId("room-ready").click();
  await expect(a.page.getByTestId("room-start")).toBeEnabled({ timeout: 10_000 });
  await a.page.getByTestId("room-start").click();
  await play([a.page, b.page]);
  await b.page.getByRole("button", { name: "Leave match" }).click();
  await expect(b.page.getByTestId("love-smash-lobby")).toBeVisible();
  await expect(a.page.getByTestId("love-smash-lobby")).toBeVisible({ timeout: 15_000 });
  await expect(a.page.getByTestId("play-together")).toContainText("disconnected");
  const { data: room } = await admin().from("love_smash_rooms").select("status").eq("host_id", a.user.id).single();
  expect(room!.status).toBe("abandoned");
});
