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
  await page.getByRole("button",{name:"Pro",exact:true}).click();
  await expect(page.locator(".ide")).toHaveClass(/mode-pro/);
  await expect(page.locator(".view-lines")).toContainText("guest-draft-42");
  await page.getByRole("button",{name:"Simple",exact:true}).click();
  await expect(page.locator(".ide")).toHaveClass(/mode-simple/);
  await page.reload();
  await openSaved();
  await page.getByRole("button",{name:"▶ Run",exact:true}).click();
  await expect(page.locator(".worktools [role=status]")).toContainText("guest-draft-42",{timeout:20000});
  await page.getByRole("button",{name:"Tests",exact:true}).click();
  await page.getByText("Test cases (1)").click();
  await page.getByLabel("Expected output").fill("guest-draft-42");
  await page.getByRole("button",{name:"Run all cases",exact:true}).click();
  await expect(page.getByText("Passed",{exact:true})).toBeVisible({timeout:20000});
  await page.getByRole("navigation",{name:"Workspace panels"}).getByRole("button",{name:"Output",exact:true}).click();
  if(process.env.AI_MOCK){
    await page.route("https://codecollab-ai-test.invalid/**",async route=>{
      const body=route.request().postDataJSON();
      if(body.action==="models")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({providers:[{provider:"groq",models:["test-current-model"]}]})});
      await route.fulfill({status:200,contentType:"text/event-stream",body:"data: "+JSON.stringify({text:"Review this replacement.\n"+String.fromCharCode(96).repeat(3)+"python\nprint('reviewed-ai-code')\n"+String.fromCharCode(96).repeat(3)})+"\n\ndata: "+JSON.stringify({done:true})+"\n\n"});
    });
    await page.getByRole("button",{name:"AI Assistant",exact:true}).click();
    await page.getByRole("button",{name:"Load available models",exact:true}).click();
    await page.getByLabel("Provider",{exact:true}).selectOption("groq");
    await page.getByLabel("Model",{exact:true}).selectOption("test-current-model");
    await page.getByLabel("Question",{exact:true}).fill("Refactor this file");
    await page.getByRole("button",{name:"Send selected context",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Review full-file replacement"})).toBeVisible();
    await expect(page.locator(".canvas>.editor-stack>.editor .view-lines")).toContainText("guest-draft-42");
    await page.getByRole("button",{name:"Apply reviewed replacement",exact:true}).click();
    await expect(page.locator(".canvas>.editor-stack>.editor .view-lines")).toContainText("reviewed-ai-code");
    await page.locator(".canvas>.editor-stack>.editor").click();
    await page.keyboard.press("Control+z");
    await expect(page.locator(".canvas>.editor-stack>.editor .view-lines")).toContainText("guest-draft-42");
    console.log("PASS mocked AI streaming UI, provider/model selection, diff approval and undo");
  }
  if(process.env.CAPTURE_UI){
    for(const width of [1920,1440,1366,768,390]){
      await page.setViewportSize({width,height:900});
      await page.screenshot({path:"qa/deployed/ide-viewport-"+width+".png"});
      if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error("IDE horizontal overflow");
    }

    await page.getByRole("button",{name:"Workspaces",exact:true}).click();
    await page.getByRole("button",{name:"Settings",exact:true}).click();
    await page.getByLabel("Display name",{exact:true}).fill("Settings QA");
    await page.getByLabel("Editor theme",{exact:true}).selectOption("hc-black");
    await page.getByLabel("minimap",{exact:true}).check();
    await page.getByLabel("notifications",{exact:true}).uncheck();
    await page.getByRole("button",{name:"Save preferences",exact:true}).click();
    await expect(page.locator(".success-toast")).toHaveText("Preferences saved.");
    await page.reload();
    await page.getByRole("button",{name:"Settings",exact:true}).click();
    await expect(page.getByLabel("Display name",{exact:true})).toHaveValue("Settings QA");
    await expect(page.getByLabel("Editor theme",{exact:true})).toHaveValue("hc-black");
    await expect(page.getByLabel("minimap",{exact:true})).toBeChecked();
    await expect(page.getByLabel("notifications",{exact:true})).not.toBeChecked();
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[881,741],[768,1024],[390,844],[360,800]]){
      await page.setViewportSize({width,height});
      await page.screenshot({path:"qa/deployed/settings-review-"+width+".png"});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      if(overflow>1)throw Error("Settings overflow "+width);
    }
  }
  console.log("PASS guest draft, registration, atomic save, workspace Monaco content and refresh");
} finally {await browser.close();}
