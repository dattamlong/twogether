import { expect, test } from "@playwright/test";
import { admin, createAccount, newSignedInPage, pairAccounts, waitForRoom } from "./helpers";

test("Love Ping: partner online gets a realtime toast, bell badge, and opens the destination", async ({ browser }, testInfo) => {
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await expect(pageB).toHaveURL(/\/home/);
  await pageB.goto("/learn");
  await expect(pageB.getByTestId("notification-bell")).toBeVisible();

  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  await waitForRoom(pageA);
  await pageA.getByRole("toolbar", { name: "Room actions" }).getByRole("button", { name: /Love Ping/ }).click();
  const modal = pageA.getByRole("dialog");
  await expect(modal.getByText("Send a Little Love 💗")).toBeVisible();
  await modal.getByRole("radio", { name: /Custom Message/ }).click();
  const message = "Em ơi về nhà học cùng anh nha 🥺💕";
  await modal.getByLabel("Your Love Ping message").fill(message);
  await expect(modal.getByText(`${message.length}/200`)).toBeVisible();
  await modal.getByRole("button", { name: "Send Love Ping" }).click();
  await expect(modal.getByText("Love Ping Sent! 💌")).toBeVisible();
  await expect(modal.getByText(/An is using TWOGETHER right now/)).toBeVisible();

  await expect(pageB.getByText("💌 Dat sent you a Love Ping")).toBeVisible();
  await expect(pageB.getByText(message).first()).toBeVisible();
  await expect(pageB.getByTestId("notification-count")).toHaveText("1");

  await pageB.getByTestId("notification-bell").click();
  const panel = pageB.getByRole("dialog");
  const card = panel.getByRole("listitem").filter({ hasText: "Dat sent you a Love Ping" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /Dat sent you a Love Ping/ }).click();
  await expect(pageB).toHaveURL(/\/home$/);
  await expect(pageB.getByTestId("notification-count")).toHaveCount(0);

  const { data } = await admin().from("notifications").select("read_at, push_status, push_note").eq("recipient_user_id", b.id).single();
  expect(data?.read_at).not.toBeNull();
  expect(data?.push_status).not.toBe("sent");
});

test("Love Ping: cooldown after three pings, and the inbox keeps exactly three", async ({ browser }, testInfo) => {
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  await waitForRoom(pageA);
  await pageA.getByRole("toolbar", { name: "Room actions" }).getByRole("button", { name: /Love Ping/ }).click();
  const modal = pageA.getByRole("dialog");
  for (let i = 0; i < 3; i++) {
    await modal.getByRole("button", { name: "Send Love Ping" }).click();
    await expect(modal.getByText("Love Ping Sent! 💌")).toBeVisible();
    await modal.getByRole("button", { name: "Send another" }).click();
  }
  await modal.getByRole("button", { name: "Send Love Ping" }).click();
  await expect(modal.getByRole("alert")).toContainText("Your love is already on its way!");
  const { count } = await admin().from("notifications").select("id", { count: "exact", head: true }).eq("recipient_user_id", b.id);
  expect(count).toBe(3);
});

test("Notification settings: blocked permission is explained, never re-prompted, and preferences persist", async ({ browser }, testInfo) => {
  const a = await createAccount("Dat");
  const b = await createAccount("An");
  await pairAccounts(a, b);
  const page = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/profile#notifications");
  const section = page.locator("#notifications");
  await expect(section.locator("[data-push-state='denied']")).toBeVisible();
  await expect(section.getByText("Notifications are blocked on this device")).toBeVisible();
  await expect(section.getByRole("button", { name: "Enable" })).toHaveCount(0);

  await section.getByRole("switch", { name: "Game invitations" }).click();
  await expect(section.getByRole("switch", { name: "Game invitations" })).toHaveAttribute("aria-checked", "false");
  await section.getByRole("switch", { name: "Quiet hours" }).click();
  await expect(section.getByRole("combobox").first()).toHaveValue("23");
  await page.reload();
  await expect(page.locator("#notifications").getByRole("switch", { name: "Game invitations" })).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#notifications").getByRole("combobox").first()).toHaveValue("23");
});

test("PWA: manifest, icons and service worker are served publicly", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const json = await manifest.json();
  expect(json).toMatchObject({ short_name: "TWOGETHER", display: "standalone", start_url: "/home", scope: "/" });
  for (const icon of json.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(await sw.text()).toContain("notificationclick");
  expect((await request.get("/icon.svg")).ok()).toBe(true);
});
