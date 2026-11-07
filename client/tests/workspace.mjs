import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const base = process.env.TEST_URL || "http://127.0.0.1:5178";
const suffix = Date.now();
async function register(label) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("Browser error", e.message));
  await page.goto(base + "/#register");
  await page
    .getByLabel("Email", { exact: true })
    .fill(label + suffix + "@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Example-pass-859");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible({
    timeout: 20000,
  });
  return page;
}
async function action(page, label, reply) {
  page.once("dialog", (d) => d.accept(reply));
  await page.getByRole("button", { name: label, exact: true }).click();
}
try {
  const owner = await register("owner"),
    editor = await register("editor");
  await action(owner, "Create project", "Browser workspace");
  await expect(
    owner.getByRole("heading", { name: "Browser workspace" }),
  ).toBeVisible({ timeout: 30000 });
  await action(owner, "+ File", "main.js");
  await expect(owner.locator(".monaco-editor")).toBeVisible();
  await owner.getByText("Members and workspace settings").click();
  await owner.getByRole("button", { name: "Invite editor" }).click();
  const code = await owner.locator("code").innerText({ timeout: 15000 });
  await action(editor, "Join via invite", code);
  await editor.getByRole("button", { name: /Browser workspace/ }).click();
  for (const page of [owner, editor])
    await expect(page.locator(".canvas [role=status]")).toContainText(
      "Synced",
      { timeout: 15000 },
    );
  if (process.env.CHECK_PRESENCE)
    await expect(owner.getByText(/Online:/)).toContainText(", ", {
      timeout: 15000,
    });
  await Promise.all(
    [owner, editor].map(async (page, i) => {
      await page.locator(".monaco-editor").click();
      await page.keyboard.insertText(i ? "beta" : "alpha");
    }),
  );
  for (const page of [owner, editor]) {
    await expect(page.locator(".view-lines")).toContainText("alpha");
    await expect(page.locator(".view-lines")).toContainText("beta");
  }
  await editor.context().setOffline(true);
  await editor.locator(".monaco-editor").click();
  await editor.keyboard.press("Control+End");
  await editor.keyboard.insertText("offline");
  await editor.context().setOffline(false);
  await expect(owner.locator(".view-lines")).toContainText("offline", {
    timeout: 25000,
  });
  await editor.getByLabel("Chat message").fill("hello team");
  await editor.getByRole("button", { name: "Send", exact: true }).click();
  await expect(owner.locator(".messages")).toContainText("hello team");
  await expect(
    owner.getByRole("button", { name: "Notifications (1)" }),
  ).toBeVisible({ timeout: 15000 });
  await owner.reload();
  await owner.getByRole("button", { name: /Browser workspace/ }).click();
  await expect(owner.locator(".view-lines")).toContainText("alpha");
  await expect(owner.locator(".messages")).toContainText("hello team");
  await owner.getByText("Version history", { exact: true }).click();
  await owner.getByRole("button", { name: "Create snapshot" }).click();
  await action(owner, "Restore copy");
  await expect(
    owner.getByRole("heading", { name: "Browser workspace · Restored" }),
  ).toBeVisible();
  await expect(owner.locator(".view-lines")).toContainText("beta");
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [768, 900],
    [390, 844],
  ]) {
    await owner.setViewportSize({ width, height });
    await expect(owner.locator(".editor")).toBeVisible();
    if (
      await owner.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Layout overflow at " + width);
  }
  console.log(
    "PASS registration, project and file creation, invitation, simultaneous two-browser edits, chat, refresh persistence and five viewport overflow checks",
  );
} finally {
  await browser.close();
}
