import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const browser = await chromium.launch({channel:"chrome"});
try {
  const page = await browser.newPage();
  const id = randomUUID();
  const project = "Playground QA " + id.slice(0,8);
  const email = "cc-qa-" + id + "@example.test";
  const password = randomUUID() + "Aa1!";
  await page.goto(process.env.TEST_URL + "/#playground");
  await page.locator(".pg-monaco .view-lines").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText('print("guest-draft-42")');
  await page.getByRole("button",{name:"Sign in to save"}).click();
  await page.getByRole("link",{name:"Register",exact:true}).click();
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(page.locator(".pg-monaco .view-lines")).toContainText("guest-draft-42",{timeout:30000});
  page.once("dialog",dialog=>dialog.accept(project));
  await page.getByRole("button",{name:"Save as project"}).click();
  await expect(page.getByText("Saved "+project+". Open Workspaces to continue.")).toBeVisible({timeout:30000});
  await page.getByRole("link",{name:"Workspaces",exact:true}).click();
  async function openSaved() {
    await page.getByRole("button",{name:new RegExp(project)}).click();
    await expect(page.locator(".view-lines")).toContainText("guest-draft-42",{timeout:30000});
  }
  await openSaved();
  await page.reload();
  await openSaved();
  console.log("PASS guest draft, registration, atomic save, workspace Monaco content and refresh");
} finally {await browser.close();}
