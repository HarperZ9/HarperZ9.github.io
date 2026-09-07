// Run against a local preview. Optional PLAYWRIGHT_MODULE selects an existing install.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.THEME_BASE_URL || "http://127.0.0.1:8766/";
const routes = ["", "flywheel.html", "bulletin.html", "publications.html",
  "frontier-safety.html", "typeface.html", "studio.html", "gallery.html", "loom.html",
  "what-the-label-changes.html", "the-second-hearing.html",
  "figures/control-boundary-flow.html", "demos/crucible-cleanroom/index.html", "system/discovery/lab.html"];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let checked = 0;
try {
  for (const width of [390, 1200]) {
    for (const os of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: os, reducedMotion: "reduce" });
      try {
        for (const route of routes) {
          const page = await context.newPage();
          try {
            const errors = [];
            page.on("pageerror", error => errors.push(error.message));
            assert.equal((await page.goto(new URL(route, base).href)).status(), 200, route);
            await page.waitForFunction(() => document.querySelector("#site-theme-style")?.sheet);
            const control = page.locator("[data-theme-control]");
            await control.waitFor({ state: "attached" });
            if (!(await control.isVisible())) {
              await page.locator(".sn-more>summary,.home-menu>summary").first().click();
            }
            for (const mode of ["light", "dark", "system"]) {
              await control.selectOption(mode);
              const resolved = mode === "system" ? os : mode;
              await page.waitForFunction(expected => {
                const root = document.documentElement;
                return root.dataset.theme === expected && getComputedStyle(document.body).backgroundColor ===
                  (expected === "light" ? "rgb(250, 250, 248)" : "rgb(16, 20, 22)");
              }, resolved, { timeout: 5000 });
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} ${width} ${mode}`);
              if (route === "studio.html") {
                await page.locator("#mm-mode-braille").scrollIntoViewIfNeeded();
                await page.waitForFunction(expected => getComputedStyle(document.getElementById("mm-mode-braille")).color === expected,
                  resolved === "light" ? "rgb(66, 87, 93)" : "rgb(180, 197, 201)", { timeout: 5000 });
              }
            }
            await page.reload();
            await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, os);
            assert.deepEqual(errors, [], route);
            checked++;
          } catch (error) {
            throw new Error(`${route || "home"} / ${width}px / OS ${os}: ${error.message}`, { cause: error });
          } finally { await page.close(); }
        }
      } finally { await context.close(); }
    }
  }
  console.log(`${checked} page/viewport/OS checks passed with Light, Dark and System choices`);
} finally { await browser.close(); }
