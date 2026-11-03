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
