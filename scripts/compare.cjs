const { chromium } = require("@playwright/test");
const fs = require("fs");
(async () => {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const p = await b.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await p.goto("https://demo.codeandchill.store/solvik/#/overview");
  await p.locator(".ov-grid").waitFor();
  for (const sel of [
    ".dock",
    ".ov-rev",
    ".ov-hot",
    ".ov-tile",
    ".ov-quota",
    ".ov-mix",
    ".card",
    ".top",
    ".head",
  ]) {
    console.log(
      sel,
      await p
        .locator(sel)
        .first()
        .evaluate((e) => {
          const c = getComputedStyle(e),
            r = e.getBoundingClientRect();
          return {
            class: e.className,
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            bg: c.backgroundColor,
            padding: c.padding,
            font: c.fontFamily,
            tile: c.getPropertyValue("--tile"),
            tint: c.getPropertyValue("--tint"),
          };
        }),
    );
  }
  await b.close();
})();
