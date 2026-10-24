import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { admin, createAccount, newSignedInPage, pairAccounts, waitForRoom } from "./helpers";

async function tapTile(page: Page, tile: { x: number; y: number }) {
  const host = page.locator("[data-camera]");
  const [cx, cy, scale] = (await host.getAttribute("data-camera"))!.split(",").map(Number);
  const box = (await host.boundingBox())!;
  await page.mouse.click(box.x + cx + (tile.x - tile.y) * 32 * scale, box.y + cy + (tile.x + tile.y + 1) * 16 * scale);
}

async function twoCouples() {
  const a = await createAccount("Lan");
  const a2 = await createAccount("Khoa");
  const b = await createAccount("Linh");
  const b2 = await createAccount("Dat");
  const coupleA = await pairAccounts(a, a2);
  const coupleB = await pairAccounts(b, b2);
  return { a, b, coupleA, coupleB };
}

test("World Chat: two players talk in realtime and history survives a refresh", async ({ browser }, testInfo) => {
  const { a, b } = await twoCouples();
  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await expect(pageA).toHaveURL(/\/home/);
  await expect(pageB).toHaveURL(/\/home/);
  await pageA.goto("/world");
  await pageB.goto("/world");
  await expect(pageA.getByText(/\d+ online/).first()).toBeVisible();
  await expect(pageB.getByText(/\d+ online/).first()).toBeVisible();

  const hello = `Anyone want to practice English? ${randomUUID().slice(0, 6)}`;
  const input = pageA.getByLabel("Message World Chat");
  await input.fill(hello);
  await input.press("Enter");
  await expect(pageB.getByText(hello)).toBeVisible();

  const reply = `Let's do a vocabulary battle! ${randomUUID().slice(0, 6)}`;
  await pageB.getByLabel("Message World Chat").fill(reply);
  await pageB.getByRole("button", { name: "Send message" }).click();
  await expect(pageA.getByText(reply)).toBeVisible();

  await pageA.reload();
  await pageB.reload();
  await expect(pageA.getByText(hello)).toBeVisible();
  await expect(pageA.getByText(reply)).toBeVisible();
  await expect(pageB.getByText(hello)).toBeVisible();

  await pageA.getByRole("tab", { name: "English Café" }).click();
  await expect(pageA.getByText(hello)).toHaveCount(0);
  await pageA.getByLabel("Look up a word").fill("hello");
  await pageA.getByRole("button", { name: "Look up" }).click();
  const dialog = pageA.getByRole("dialog");
  await expect(dialog.getByText("xin chào").first()).toBeVisible();
  await dialog.getByRole("button", { name: "Save to Word Bank" }).click();
  await expect(dialog.getByRole("button", { name: "In your Word Bank" })).toBeVisible();
});

test("Profiles: clicking a chat author opens their public profile with Visit Home", async ({ browser }, testInfo) => {
  const { a, b, coupleB } = await twoCouples();
  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await expect(pageB).toHaveURL(/\/home/);
  await pageB.goto("/world");
  const text = `hi from Linh ${randomUUID().slice(0, 6)}`;
  await pageB.getByLabel("Message World Chat").fill(text);
  await pageB.getByLabel("Message World Chat").press("Enter");

  await expect(pageA).toHaveURL(/\/home/);
  await pageA.goto("/world");
  const bubble = pageA.locator("li").filter({ hasText: text });
  await bubble.getByRole("button", { name: "Linh", exact: true }).click();
  const profile = pageA.getByRole("dialog");
  await expect(profile.getByText("Linh").first()).toBeVisible();
  await expect(profile.getByText("with Dat")).toBeVisible();
  await expect(profile.getByText("Online now")).toBeVisible();
  await expect(profile.getByRole("link", { name: /Visit Couple Home/ })).toHaveAttribute("href", `/world/visit/${coupleB}`);
  await profile.getByRole("button", { name: /Add friend/ }).click();
  await expect(profile.getByRole("button", { name: /Request sent/ })).toBeVisible();
});

test("Home visiting: the guest sees the real home, moves, is seen by the host, signs the guestbook, and returns home", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Tile tapping is covered on desktop; mobile shares the same code path.");
  const { a, b, coupleB } = await twoCouples();
  const { data: inv } = await admin().from("inventories").insert({ user_id: b.id, couple_id: coupleB, item_id: "floor_lamp", source: "purchase" }).select("id").single();
  await admin().from("furniture_placements").insert({ couple_id: coupleB, inventory_id: inv!.id, x: 8, y: 6, placed_by: b.id });
  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await expect(pageB).toHaveURL(/\/home/);
  await pageB.goto("/home");
  await waitForRoom(pageB);

  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(pageA).toHaveURL(/\/home/);
  await pageA.goto(`/world/visit/${coupleB}`);
  await expect(pageA.getByRole("heading", { name: "Linh & Dat's home" })).toBeVisible();
  await waitForRoom(pageA);
  await expect(pageA.getByTestId("visit-presence")).toContainText("Linh is home");
  await expect(pageA.locator(`[data-remotes*='${b.id}@']`)).toBeAttached();
  await expect(pageA.getByRole("button", { name: "Decorate" })).toHaveCount(0);

  await expect(pageB.getByTestId("guest-count")).toContainText("1 visitor");
  await expect(pageB.locator(`[data-remotes*='${a.id}@5,6']`)).toBeAttached();
  await expect(pageA.getByText(/Traveling to/)).toHaveCount(0);
  await tapTile(pageA, { x: 6, y: 8 });
  await expect(pageA.locator("[data-self-tile='6,8']")).toBeAttached({ timeout: 10_000 });
  await expect(pageB.locator(`[data-remotes*='${a.id}@6,8']`)).toBeAttached({ timeout: 10_000 });

  const { data: before } = await admin().from("furniture_placements").select("x, y").eq("couple_id", coupleB);
  expect(before).toEqual([{ x: 8, y: 6 }]);

  await pageA.getByRole("toolbar", { name: "Guest actions" }).getByRole("button", { name: "Guestbook" }).click();
  const note = `Your home is adorable! 🌸 ${randomUUID().slice(0, 4)}`;
  await pageA.getByLabel("Leave a kind note").fill(note);
  await pageA.getByRole("button", { name: "Sign guestbook" }).click();
  await expect(pageA.getByRole("dialog").getByText(note)).toBeVisible();
  await pageA.keyboard.press("Escape");

  await pageA.getByRole("link", { name: /Return to Our Home/ }).click();
  await expect(pageA).toHaveURL(/\/home$/);
  await waitForRoom(pageA);
  await expect(pageB.getByTestId("guest-count")).toHaveCount(0, { timeout: 15_000 });

  await pageB.getByRole("toolbar", { name: "Room actions" }).getByRole("button", { name: "Guestbook" }).click();
  const book = pageB.getByRole("dialog");
  await expect(book.getByText(note)).toBeVisible();
  await book.locator("li").filter({ hasText: note }).getByRole("button", { name: "Remove note" }).click();
  await expect(book.getByText(note)).toHaveCount(0);
  await expect(book.getByText("No notes yet")).toBeVisible();
});

test("Safety: chat spam is rate-limited and blocking hides a player's messages", async ({ browser }, testInfo) => {
  const { a, b } = await twoCouples();
  const pageA = await newSignedInPage(browser, a.email, testInfo.project.use);
  await expect(pageA).toHaveURL(/\/home/);
  await pageA.goto("/world");
  const input = pageA.getByLabel("Message World Chat");
  const tag = randomUUID().slice(0, 4);
  for (let i = 0; i < 6; i++) {
    await input.fill(`spam ${tag} ${i}`);
    await input.press("Enter");
  }
  await expect(pageA.getByText("Slow down a little.")).toBeVisible();
  await expect(pageA.getByRole("button", { name: "Retry" })).toBeVisible();

  const pageB = await newSignedInPage(browser, b.email, testInfo.project.use);
  await expect(pageB).toHaveURL(/\/home/);
  await pageB.goto("/world");
  const spam = pageB.locator("li").filter({ hasText: `spam ${tag} 0` });
  await expect(spam).toBeVisible();
  await spam.getByRole("button", { name: "Lan", exact: true }).click();
  await pageB.getByRole("dialog").getByRole("button", { name: /^Block$/ }).click();
  await pageB.getByRole("dialog").getByRole("button", { name: "Block", exact: true }).last().click();
  await expect(pageB.getByRole("dialog").getByText("You blocked this player.")).toBeVisible();
  await pageB.keyboard.press("Escape");
  await pageB.reload();
  await expect(pageB.getByText(/\d+ online/).first()).toBeVisible();
  await expect(pageB.getByText(`spam ${tag} 0`)).toHaveCount(0);
});
