#!/usr/bin/env node
// Record the Distill stages the front page shows: run world/site/distill/picture-panel.js in a browser on the shipped
// picture and write what it made. The page's fixed example is this record, so its numbers are the code's own.
//
//   python tests/lib/serve.py 8811 . &
//   SITE_BASE_URL=http://127.0.0.1:8811 node scripts/distill-picture-record.cjs          write the record and pictures
//   SITE_BASE_URL=http://127.0.0.1:8811 node scripts/distill-picture-record.cjs --check  fail if a fresh run differs
//
// Writes site-src/world/distill-bow.json, media/world/work/bow-rebuilt-640.png and media/world/work/bow-cloth-720.webp.
const fs = require("node:fs"), path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const site = path.dirname(__dirname), base = process.env.SITE_BASE_URL || "http://127.0.0.1:8811";
const EXAMPLE = "/media/world/work/bow-source-640.webp", RECORD = path.join(site, "site-src/world/distill-bow.json");

async function run() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/404.html`);
    return await page.evaluate(async (example) => {
      const { distillPicture } = await import("/world/site/distill/picture-panel.js");
      const r = await distillPicture(await (await fetch(example)).blob()), s = r.study;
      return { record: { source: example, width: s.width, height: s.height, pixels: s.pixels, swatches: s.swatches, spectrum: s.spectrum, difference: s.difference,
        cloth: { width: r.cloth.width, height: r.cloth.height, ends: r.woven.ends, picks: r.woven.picks, weft: r.woven.weft } },
        rebuilt: r.rebuilt.toDataURL("image/png"), cloth: r.cloth.toDataURL("image/webp", 0.9) };
    }, EXAMPLE);
  } finally { browser.close().catch(() => {}); }
}
const bytes = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
(async () => {
  const got = await run(), text = JSON.stringify(got.record, null, 1) + "\n";
  if (process.argv.includes("--check")) {
    const have = fs.readFileSync(RECORD, "utf8").replace(/\r\n/g, "\n");
    if (have !== text) { console.error("distill record: a fresh run differs from site-src/world/distill-bow.json; run the script without --check and rebuild the home"); process.exit(1); }
    console.log("distill record: a fresh run gives the committed record"); process.exit(0);
  }
  fs.writeFileSync(RECORD, text);
  fs.writeFileSync(path.join(site, "media/world/work/bow-rebuilt-640.png"), bytes(got.rebuilt));
  fs.writeFileSync(path.join(site, "media/world/work/bow-cloth-720.webp"), bytes(got.cloth));
  console.log(`distill record: ${got.record.swatches.length} swatches, mean difference ${got.record.difference.mean}, cloth ${got.record.cloth.width} by ${got.record.cloth.height}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
