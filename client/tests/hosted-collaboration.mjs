import {chromium,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
const base=process.env.TEST_URL||"https://codecollab-rudra.web.app";
const browser=await chromium.launch({channel:"chrome"});
const tag=randomUUID().slice(0,12),project="Live collaboration "+tag;
async function register(name){
 const page=await browser.newPage();
 page.on("pageerror",error=>console.error("Browser error",error.message));
 page.on("requestfailed",request=>console.error("Failed resource",new URL(request.url()).pathname,request.failure()?.errorText));
 await page.goto(base+"/#register");
 await page.getByLabel("Email",{exact:true}).fill("cc-live-"+name+"-"+tag+"@example.test");
 await page.getByLabel("Password",{exact:true}).fill(randomUUID()+"Aa1!");
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByRole("heading",{name:/Welcome,/})).toBeVisible({timeout:60000});
 console.log("Signed in test session",name);
 return page;
}
try{
 const owner=await register("owner"),editor=await register("editor");
 await owner.getByRole("button",{name:"Create project",exact:true}).click();
 await owner.getByLabel("Workspace name").fill(project);
 await owner.getByRole("button",{name:"Create workspace",exact:true}).click();
 await expect(owner.locator(".monaco-editor")).toBeVisible({timeout:30000});
 await owner.getByRole("button",{name:"Share / Settings",exact:true}).click();
 await owner.getByRole("button",{name:"Invite editor",exact:true}).click();
 const code=await owner.locator(".workspace-drawer code").innerText({timeout:15000});
 editor.once("dialog",dialog=>dialog.accept(code));
 await editor.getByRole("button",{name:"Join via invite",exact:true}).click();
 await expect(editor.getByText("Invitation accepted.",{exact:true})).toBeVisible({timeout:20000});
 await editor.getByRole("button",{name:new RegExp(project)}).click();
 await owner.locator(".workspace-drawer>summary").click();
 for(const page of [owner,editor]){
  await expect(page.locator(".canvas [role=status]").first()).toContainText("Synced",{timeout:20000});
  await page.getByRole("button",{name:"Pro",exact:true}).click();
  await page.getByRole("button",{name:"Chat",exact:true}).click();
 }
 await expect(owner.locator(".editor-stack")).toContainText(/Online:[\s\S]*,/,{timeout:25000});
 await expect(editor.locator(".editor-stack")).toContainText(/Online:[\s\S]*,/,{timeout:25000});
 console.log("PASS PUBLIC invitation redemption and authenticated presence in two browser sessions");
 await Promise.all([owner,editor].map(async(page,i)=>{
  await page.locator(".editor-stack>.editor").click();
  await page.keyboard.press(i?"Control+End":"Control+Home");
  await page.keyboard.insertText(i?"\n// collaborator-beta":"// owner-alpha\n");
 }));
 for(const page of [owner,editor]){
  await expect(page.locator(".canvas .view-lines")).toContainText("collaborator-beta",{timeout:20000});
  await expect(page.locator(".canvas .view-lines")).toContainText("owner-alpha",{timeout:20000});
 }
 async function readDocument(page){
  await page.context().grantPermissions(["clipboard-read","clipboard-write"]);
  await page.bringToFront();
  await page.locator(".editor-stack>.editor").click();
  await page.keyboard.press("Control+a");await page.keyboard.press("Control+c");
  await page.waitForTimeout(100);
  const text=await page.evaluate(()=>navigator.clipboard.readText());
  await page.keyboard.press("ArrowRight");
  return text;
 }
 let documentOwner="",documentEditor="";
 await expect.poll(async()=>{documentOwner=await readDocument(owner);documentEditor=await readDocument(editor);return documentOwner===documentEditor},{timeout:20000}).toBe(true).catch(error=>{
   console.error("Synthetic fixture documents",JSON.stringify({owner:documentOwner,editor:documentEditor}));throw error;
 });
 console.log("PASS PUBLIC simultaneous edit convergence");
 await editor.getByLabel("Chat message").fill("Live public chat "+tag);
 await editor.getByRole("button",{name:"Send",exact:true}).click();
 await expect(owner.locator(".messages")).toContainText(tag,{timeout:20000});
 await editor.context().setOffline(true);
 await editor.locator(".editor-stack>.editor").click();await editor.keyboard.press("Control+End");
 await editor.keyboard.insertText("\n// reconnect-marker");
 await editor.context().setOffline(false);
 await expect(owner.locator(".canvas .view-lines")).toContainText("reconnect-marker",{timeout:30000});
 await owner.getByRole("button",{name:"Pro",exact:true}).click();
 await owner.setViewportSize({width:1440,height:900});
 await owner.screenshot({path:"qa/deployed/live-two-user-collaboration.png"});
 console.log("PASS PUBLIC two-account invitation, simultaneous editing convergence, authenticated presence, chat and offline reconnect");
}finally{await browser.close();}
