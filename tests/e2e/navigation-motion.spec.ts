import { assertIsolated, tenantDb } from "../isolated";
import {test, expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("Animated navigation does not flash outgoing content and latest click wins", async ({browser}) => {
  assertIsolated();
  const context = await browser.newContext({baseURL: process.env.VILA_TEST_ORIGIN, reducedMotion: "no-preference"});
  const credentials = JSON.parse(readFileSync(process.env.VILA_VISUAL_CREDENTIALS!, "utf8"));
  expect((await context.request.post("/api/auth/login", {data: credentials, headers: {Origin: process.env.VILA_TEST_ORIGIN!}})).ok()).toBeTruthy();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".overview")).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await page.evaluate(() => {
    const root = document.querySelector("main")!;
    let faded = false;
    (window as any).outgoingFlash = false;
    const sample = () => {
      if (!root.isConnected) return;
      const opacity = Number(getComputedStyle(root).opacity);
      if (opacity < .15) faded = true;
      if (faded && opacity > .4) (window as any).outgoingFlash = true;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator(".tabs").getByRole("button", {name: "Müşteriler", exact: true}).click();
  await expect(page.locator("main")).toHaveAttribute("data-view", "customers");
  expect(await page.evaluate(() => (window as any).outgoingFlash)).toBe(false);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".tabs button")];
    buttons.find(b => b.textContent === "Satış")!.click();
    buttons.find(b => b.textContent === "Finans")!.click();
    buttons.find(b => b.textContent === "Projeler")!.click();
  });
  await expect(page.locator("main")).toHaveAttribute("data-view", "projects");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect(page.locator("main")).toHaveCSS("opacity", "1");
  await expect(page.locator("main h1 .title-char").first()).toHaveCSS("transform", "none");
  expect(errors).toEqual([]);
  await context.close();
});
