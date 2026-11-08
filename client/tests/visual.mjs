import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const base = process.env.TEST_URL || "http://127.0.0.1:5179",
  publicOnly = new URL(base).hostname !== "127.0.0.1",
  dir = path.resolve("qa", publicOnly ? "deployed" : "emulator");
await mkdir(dir, { recursive: true });
const b = await chromium.launch({ channel: "chrome" }),
  p = await b.newPage(),
  sizes = [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [768, 900],
    [390, 844],
  ];
async function capture(name) {
  for (const [width, height] of sizes) {
    await p.setViewportSize({ width, height });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(dir, name + "-" + width + ".png") });
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    if (overflow > 1)
      throw Error(name + " overflows at " + width + " by " + overflow);
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}
async function nav(hash) {
  await p.goto(base + "/#" + hash);
}
async function shot() {
  await nav("");
  await expect(
    p.getByRole("heading", { name: "Code Together. Build Faster." }),
  ).toBeVisible();
  await capture("landing");
  await p.getByRole("button", { name: "utils.hpp" }).click();
  await expect(p.locator(".studio-tab")).toContainText("utils.hpp");
  await nav("playground");
  await expect(p.getByLabel("Source code")).toBeVisible();
  await capture("playground");
  for (const route of ["login", "forgot", "register"]) {
    await nav(route);
    await expect(p.getByLabel("Email", { exact: true })).toBeVisible();
    await capture(route);
  }
  if (publicOnly) return;
  const email = "visual-" + Date.now() + "@example.test";
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Password", { exact: true }).fill("Visual-test-439");
  await p.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(p.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
  await p.getByRole("button", { name: "Create project", exact: true }).click();
  await capture("create-project");
  await p.getByLabel("Workspace name").fill("Orbit workspace");
  await p
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    p.getByRole("heading", { name: "Orbit workspace" }),
  ).toBeVisible();
  p.once("dialog", (d) => d.accept("main.js"));
  await p.getByRole("button", { name: "+ File", exact: true }).click();
  await expect(p.locator(".canvas [role=status]")).toContainText("Synced");
  await p.locator(".monaco-editor").click();
  await p.keyboard.insertText(
    'const team = ["Ada", "Kai", "Mira"];\nfor (const member of team) {\n  console.log("Welcome, " + member);\n}',
  );
  await p.getByLabel("Chat message").fill("The workspace is ready for review.");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await expect(p.locator(".messages")).toContainText("ready for review");
  await capture("ide-chat");
  await p.getByText("Version history", { exact: true }).click();
  await p.getByRole("button", { name: "Create snapshot" }).click();
  await expect(p.getByRole("button", { name: "Restore copy" })).toBeVisible();
  await p
    .getByText("Version history", { exact: true })
    .scrollIntoViewIfNeeded();
  await capture("history");
  await p.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    p.getByRole("button", { name: /Orbit workspace/ }),
  ).toBeVisible();
  await capture("dashboard");
  await p
    .locator(".app-nav")
    .getByRole("button", { name: "Teams", exact: true })
    .click();
  await capture("teams");
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await capture("settings");
  await p.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(p.getByText("Password reset requested.")).toBeVisible();
  const codes = await (
    await fetch(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-codecollab/oobCodes",
    )
  ).json();
  const code = codes.oobCodes
    .filter((c) => c.email === email && c.requestType === "PASSWORD_RESET")
    .at(-1)?.oobCode;
  if (!code) throw Error("Missing reset link");
  await p.goto(
    base + "/?mode=resetPassword&oobCode=" + encodeURIComponent(code),
  );
  await expect(p.getByLabel("Confirm password", { exact: true })).toBeVisible();
  await capture("reset-password");
}
try {
  await shot();
  console.log("Visual capture passed:", dir);
} finally {
  await b.close();
}
