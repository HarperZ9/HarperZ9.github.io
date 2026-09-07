const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.env.SITE_BASE_URL || "http://127.0.0.1:8802";
const dbName = "zentropy-project-library-v1";

function bufferFromDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));

    async function resetLibrary() {
      await page.evaluate(name => new Promise(resolve => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      }), dbName);
    }

    async function projectState() {
      return page.evaluate(() => window.__galleryProject.current());
    }

    await page.goto(`${base}/gallery.html`);
    await page.waitForSelector("#desk-canvas[data-specimen-rendered='true']");
    await page.getByRole("button", { name: "Save project", exact: true }).waitFor({ timeout: 1500 });
    await page.getByRole("button", { name: "Open project", exact: true }).waitFor({ timeout: 1500 });
    await resetLibrary();

    await page.getByRole("button", { name: /Recipe atlas plate:/ }).click();
    await page.locator("#desk-rack-instruments").evaluate(node => { node.open = true; });
    await page.getByRole("button", { name: /Lock contour/ }).click();
    await page.locator("#desk-rack-fx").evaluate(node => { node.open = true; });
    await page.getByRole("button", { name: /Mosaic:/ }).click();
    await page.getByRole("button", { name: /Scanlines:/ }).click();
    await page.locator("#desk-fx-amount").evaluate(node => {
      node.value = "0.7";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#desk-seed").fill("native-gallery");
    await page.getByRole("button", { name: "Draw a plate from this seed and the selected instruments" }).click();

    const materialPng = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 96, 64);
      gradient.addColorStop(0, "#ff4f1f");
      gradient.addColorStop(1, "#1020ff");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 96, 64);
      ctx.fillStyle = "#f8eecb";
      ctx.fillRect(12, 10, 20, 22);
      ctx.fillStyle = "#111111";
      ctx.fillRect(58, 30, 26, 18);
      return canvas.toDataURL("image/png");
    });
    await page.locator("#desk-import-file").setInputFiles({
      name: "native-material.png",
      mimeType: "image/png",
      buffer: bufferFromDataUrl(materialPng),
    });
    await page.waitForFunction(() => !document.querySelector("#desk-clear-material")?.hidden);
    await page.locator("#desk-influence").evaluate(node => {
      node.value = "0.35";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector("#desk-title")?.textContent.includes("native-material.png"));

    const beforePixels = await page.locator("#desk-canvas").evaluate(canvas => canvas.toDataURL("image/png"));
    const beforeState = await projectState();
    assert.deepEqual(beforeState.recipe.instruments, ["plotter-plate", "contour", "dither"], "Recipe order is captured as editable instruments");
    assert.deepEqual(beforeState.locks, ["contour"], "Selected instrument locks are captured");
    assert.deepEqual(beforeState.effects, ["mosaic", "scanlines"], "Effect order is captured");
    assert.equal(beforeState.strength, 0.7);
    assert.equal(beforeState.baseImage.name, "native-material.png");
    assert.equal(beforeState.baseImage.influence, 0.35);
    assert.match(beforeState.baseImage.png, /^data:image\/png;base64,/);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Save project", exact: true }).click(),
    ]);
    const nativeText = await readFile(await download.path(), "utf8");
    const native = JSON.parse(nativeText);
    assert.equal(native.schema, "zentropy.gallery");
    assert.equal(native.version, 1);
    assert.deepEqual(native.project, beforeState, "Downloaded project stores the editable Gallery state, not only flattened pixels");

    let promptTitle = "Gallery kept in workspace";
    page.on("dialog", async dialog => {
      assert.equal(dialog.type(), "prompt");
      await dialog.accept(promptTitle);
    });
    await page.locator("[data-project-library-save]").click();
    await page.waitForFunction(() => document.querySelector("[data-project-library-status]")?.dataset.state === "ready");

    await page.locator("#desk-seed").fill("mutated-gallery");
    await page.getByRole("button", { name: "Draw a plate from this seed and the selected instruments" }).click();
    await page.locator("#desk-clear-material").click();
    await page.locator("[data-gallery-project-file]").setInputFiles({
      name: "gallery.project.json",
      mimeType: "application/json",
      buffer: Buffer.from(nativeText),
    });
    await page.waitForFunction(() => document.querySelector("[data-gallery-project-status]")?.dataset.state === "ready");
    assert.deepEqual(await projectState(), beforeState, "Native open restores recipe, locks, effects, strength and base image");
    const afterPixels = await page.locator("#desk-canvas").evaluate(canvas => canvas.toDataURL("image/png"));
    assert.equal(afterPixels, beforePixels, "Native open redraws the same rendered composition from editable state");

    await page.locator("#desk-seed").fill("keep-me");
    await page.getByRole("button", { name: "Draw a plate from this seed and the selected instruments" }).click();
    await page.locator("[data-gallery-project-file]").setInputFiles({
      name: "bad-gallery.project.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ schema: "zentropy.gallery", version: 1, project: { ...native.project, effects: ["not-real"] } })),
    });
    await page.waitForFunction(() => document.querySelector("[data-gallery-project-status]")?.dataset.state === "error");
    assert.equal(await page.locator("#desk-seed").inputValue(), "keep-me", "Invalid project does not overwrite current work");

    await page.locator("[data-gallery-project-file]").setInputFiles({
      name: "oversized-gallery.project.json",
      mimeType: "application/json",
      buffer: Buffer.alloc(12 * 1024 * 1024 + 1, 0x20),
    });
    await page.waitForFunction(() => /12 MB|12 MiB|limit|larger/i.test(document.querySelector("[data-gallery-project-status]")?.textContent || ""));
    assert.equal(await page.locator("#desk-seed").inputValue(), "keep-me", "Oversized project does not overwrite current work");

    await page.locator("[data-gallery-project-file]").setInputFiles({
      name: "gallery.project.json",
      mimeType: "application/json",
      buffer: Buffer.from(nativeText),
    });
    await page.waitForFunction(() => document.querySelector("[data-gallery-project-status]")?.dataset.state === "ready");
    await page.evaluate(() => {
      const original = HTMLImageElement.prototype.decode;
      window.__galleryReleaseDecode = null;
      HTMLImageElement.prototype.decode = function patchedDecode() {
        if (typeof this.src === "string" && this.src.startsWith("data:image/png")) {
          return new Promise(resolve => {
            window.__galleryReleaseDecode = () => {
              HTMLImageElement.prototype.decode = original;
              Promise.resolve(original.call(this)).then(resolve, resolve);
            };
          });
        }
        return original.call(this);
      };
    });
    const staleOpen = page.locator("[data-gallery-project-file]").setInputFiles({
      name: "gallery.project.json",
      mimeType: "application/json",
      buffer: Buffer.from(nativeText),
    });
    await page.waitForFunction(() => typeof window.__galleryReleaseDecode === "function");
    await page.locator("#desk-seed").fill("newer-edit-wins");
    await page.locator("#desk-clear-material").click();
    await page.evaluate(() => window.__galleryReleaseDecode());
    await staleOpen;
    await page.waitForFunction(() => document.querySelector("[data-gallery-project-status]")?.dataset.state === "cancelled");
    assert.equal(await page.locator("#desk-seed").inputValue(), "newer-edit-wins", "Stale project open keeps newer seed edit");
    assert.equal((await projectState()).baseImage, null, "Stale project open does not undo Clear material");

    await page.setViewportSize({ width: 390, height: 760 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await page.waitForSelector("#desk-canvas[data-specimen-rendered='true']");
    const mobile = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      saveVisible: !!document.querySelector("[data-gallery-project-save]")?.getClientRects().length,
      openVisible: !!document.querySelector("[data-gallery-project-open]")?.getClientRects().length,
    }));
    assert.ok(mobile.saveVisible && mobile.openVisible, "Gallery project controls remain visible on mobile dark theme");
    assert.ok(mobile.scrollWidth <= mobile.innerWidth + 2, `Gallery mobile layout should not overflow horizontally: ${mobile.scrollWidth} > ${mobile.innerWidth}`);

    assert.deepEqual(errors, []);
    console.log("Gallery native project: JSON capture, workspace keep, native reopen pixel roundtrip, invalid/oversized/stale preservation and mobile theme passed.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
