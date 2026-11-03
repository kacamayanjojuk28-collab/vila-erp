const { chromium } = require("@playwright/test");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  const c = JSON.parse(fs.readFileSync(".local/demo-credentials.json"));
  await page.goto("http://localhost:3000");
  await page.getByLabel("E-posta", { exact: true }).fill(c.email);
  await page.locator("input[name=password]").fill(c.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.locator(".overview").waitFor();
  fs.mkdirSync("docs/verification", { recursive: true });
  for (const name of [
    "overview",
    "settings",
    "customers",
    "products",
    "sales",
    "purchases",
    "finance",
    "projects",
    "tasks",
  ]) {
    await page.goto("http://localhost:3000/#" + name);
    await page.locator("main").waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: "docs/verification/" + name + ".png",
      fullPage: true,
    });
    console.log(name, (await page.locator("main").innerText()).slice(0, 90));
  }
  await browser.close();
})();
