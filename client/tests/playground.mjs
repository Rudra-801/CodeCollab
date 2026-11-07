import { chromium, expect } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome" });
try {
  const p = await b.newPage();
  await p.goto(
    (process.env.TEST_URL || "http://127.0.0.1:5179") + "/#playground",
  );
  for (const language of ["javascript", "typescript"]) {
    await p.getByLabel("Language").selectOption(language);
    await p.getByLabel("Standard input").fill("Rudra");
    await p.getByRole("button", { name: "Run program" }).click();
    await expect(p.getByRole("status")).toContainText("Hello, Rudra!", {
      timeout: 20000,
    });
    for (const [source, expected] of [
      [
        "console.log(typeof fetch, typeof process, typeof window)",
        "undefined undefined undefined",
      ],
      ['throw Error("sample error")', "sample error"],
      ["while(true){}", "interrupted"],
      ['console.log("a".repeat(40000))', "Output limit exceeded"],
    ]) {
      await p.getByLabel("Source code").fill(source);
      await p.getByRole("button", { name: "Run program" }).click();
      await expect(p.getByRole("status")).toContainText(expected, {
        timeout: 20000,
      });
    }
    await p.getByLabel("Source code").fill("while(true){}");
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
