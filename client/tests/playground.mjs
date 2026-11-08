import { chromium, expect } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome" });
try {
  const p = await b.newPage();
  async function replaceSource(source) {
    await p.locator(".pg-monaco .view-lines").click();
    await p.keyboard.press("Control+a");
    await p.keyboard.insertText(source);
  }
  await p.goto(
    (process.env.TEST_URL || "http://127.0.0.1:5179") + "/#playground",
  );
  await p.getByLabel("Language").selectOption("python");
  await p.getByLabel("Standard input").fill("7");
  await p.getByRole("button", {name:"Run program"}).click();
  await expect(p.getByRole("status")).toContainText("49", {timeout:20000});
  await p.getByText("Test cases (1)").click();
  await p.getByLabel("Case input").fill("8");
  await p.getByLabel("Expected output").fill("64");
  await p.getByRole("button", {name:"Run all cases"}).click();
  await expect(p.getByText("Passed", {exact:true})).toBeVisible({timeout:20000});
  await replaceSource("raise ValueError('invalid input')");
  await p.getByRole("button", {name:"Run program"}).click();
  await expect(p.getByRole("status")).toContainText("invalid input", {timeout:20000});
  console.log("PASS guest Python stdin, square calculation, case verdict and runtime error");
  for (const language of ["javascript", "typescript"]) {
    await p.getByLabel("Language").selectOption(language);
    await p.getByLabel("Standard input").fill("Rudra");
    await p.getByRole("button", { name: "Run program" }).click();
    await expect(p.getByRole("status")).toContainText("Hello, Rudra!", {
      timeout: 20000,
    });
    await replaceSource("const x=2;console.log(x)");
    await p.getByRole("button",{name:"Format",exact:true}).click();
    await expect.poll(()=>p.evaluate(()=>JSON.parse(sessionStorage.getItem("cc-playground")).source)).toContain("x = 2");
    const download=p.waitForEvent("download");
    await p.getByRole("button",{name:"Download",exact:true}).click();
    if (!(await download).suggestedFilename().startsWith("main.")) throw Error("Missing source download");
    await expect(p.getByText("Execution history (1)")).toBeVisible();
    for (const [source, expected] of [
      [
        "console.log(typeof fetch, typeof process, typeof window)",
        "undefined undefined undefined",
      ],
      ['throw Error("sample error")', "sample error"],
      ["while(true){}", "interrupted"],
      ['console.log("a".repeat(40000))', "Output limit exceeded"],
    ]) {
      await replaceSource(source);
      await p.getByRole("button", { name: "Run program" }).click();
      await expect(p.getByRole("status")).toContainText(expected, {
        timeout: 20000,
      });
    }
    await replaceSource("while(true){}");
    await p.getByRole("button", { name: "Run program" }).click();
    await p.getByRole("button", { name: "Stop program" }).click();
    await expect(p.getByRole("status")).toContainText("Cancelled");
  }
  console.log(
    "PASS both browser runtimes: stdin, output, runtime errors, absent host globals, deadlines, output cap and cancellation",
  );
} finally {
  await b.close();
}
