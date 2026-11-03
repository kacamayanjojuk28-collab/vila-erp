import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const credentials = JSON.parse(
  readFileSync((process.env.VILA_VISUAL_CREDENTIALS || ".local/visual-credentials.json"), "utf8"),
);
test("Reference shell geometry and stable visual baselines: dark/light/mobile", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: (process.env.VILA_TEST_ORIGIN || "http://localhost:3000"),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime( new Date("2026-11-01T12:00:00+03:00"));
  await page.goto("/");
  await page.getByLabel("E-posta", { exact: true }).fill(credentials.email);
  await page.getByLabel("Parola", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.locator(".overview")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const dock = await page.locator(".dock").boundingBox();
  expect(dock!.x).toBeCloseTo(20, 0);
  expect(dock!.width).toBeCloseTo(62, 0);
  expect(dock!.height).toBeCloseTo(507, 0);
  const revenue = await page.locator(".revenue").boundingBox();
  expect(revenue!.x).toBeCloseTo(103, 0);
  expect(revenue!.width).toBeCloseTo(760, 0);
  expect(revenue!.y).toBeCloseTo(199.4, 0);
  for (const route of [
    "overview",
    "settings",
    "customers",
    "finance",
    "projects",
    "calendar",
  ]) {
    await page.goto("/#" + route);
    await expect(page.locator("main")).toHaveAttribute("data-view", route);
    await expect(page.locator(".skeleton")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(route + "-dark.png", {
      animations: "disabled",
      fullPage: true,
      maxDiffPixelRatio: 0.003,
      mask: [page.locator("input[type=email]")],
    });
  }
  await page.goto("/#settings");
  await page.getByRole("button", { name: "Temayı değiştir" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page).toHaveScreenshot("settings-light.png", {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.003,
      mask: [page.locator("input[type=email]")],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot("settings-mobile.png", {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.003,
      mask: [page.locator("input[type=email]")],
  });
  await context.close();
});

// Broader coverage uses the same authenticated demo GET fixtures captured during
// reference parity. Existing live login/geometry checks above remain mandatory.
test("Release visual matrix: six views in desktop/mobile and dark/light", async ({browser}) => {
  const fixtures = JSON.parse(readFileSync(".local/rc-visual-fixtures.json", "utf8"));
  for (const [width,height] of [[1440,1000],[390,844]]) for (const theme of ["dark","light"]) {
    const context = await browser.newContext({baseURL:process.env.VILA_TEST_ORIGIN,viewport:{width,height},reducedMotion:"reduce"});
    const page = await context.newPage();
    await page.addInitScript(t => localStorage.setItem("vila-theme",t),theme);
    await page.clock.setFixedTime(new Date("2026-11-01T09:00:00Z"));
    await page.route("**/api/**", async route => {
      const u=new URL(route.request().url()),fixture=fixtures[u.pathname+u.search];
      if(!fixture) throw Error("Missing deterministic visual fixture: "+u.pathname+u.search);
      await route.fulfill(fixture);
    });
    for(const view of ["overview","settings","customers","finance","projects","calendar"]) {
      await page.goto("/#"+view);
      await expect(page.locator("main")).toHaveAttribute("data-view",view);
      await expect(page.locator(".skeleton")).toHaveCount(0);
      await page.evaluate(()=>document.fonts.ready);
      await expect(page.locator(".nav-pill")).toHaveCSS("opacity", ["settings","calendar"].includes(view) ? "0" : "1");
      await expect(page.locator(".top .brand")).toHaveText("VILA");
      await expect(page).toHaveScreenshot(`${view}-${theme}-${width}.png`,{animations:"disabled",fullPage:true,maxDiffPixelRatio:0.003,mask:[page.locator("input[type=email]")]});
    }
    await context.close();
  }
});
