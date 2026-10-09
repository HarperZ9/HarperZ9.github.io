// The Films source (9 October 2026): every film on the site plays on the Studio's stage. This
// checks, at desktop and phone widths: the five explainers and the seven One Step films are in the
// picker; the chosen film's video is on the stage and its chapters, recall questions, transcript and
// sources are in the inspector; nothing plays on its own; an explainer's frame reaches the readings;
// leaving pauses the film and gives the stage back; a reload opens the film chosen last.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
const pick = (page, s) => page.evaluate((s) => document.querySelector(`#studio-source button[data-source="${s}"]`).click(), s);

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await page.goto(`${base}/studio.html?source=films`); await wait(page, 6000);
        const r = await page.evaluate(() => ({
          picks: [...document.querySelectorAll('#films-mount .films-pick')].map((b) => b.dataset.film),
          stageVideo: document.querySelector('#films-stage video') && document.querySelector('#films-stage video').closest('#viewport-stage') !== null,
          chaptersInRail: !!document.querySelector('#films-mount section.mv:not([hidden]) .fl-chapters'),
          chaptersOnStage: !!document.querySelector('#films-stage .fl-chapters'),
          recall: !!document.querySelector('#films-mount section.mv:not([hidden]) .fl-recall'),
          transcript: !!document.querySelector('#films-mount section.mv:not([hidden]) details[id$="-transcript"]'),
          sources: document.querySelectorAll('#films-mount section.mv:not([hidden]) .fl-sources li').length,
          playing: [...document.querySelectorAll('video')].some((v) => !v.paused),
        }));
        assert.equal(r.picks.length, 12, `${tag} 5 explainers and 7 One Step films in the picker (${r.picks.length})`);
        assert.ok(r.stageVideo, `${tag} the chosen film is on the stage`);
        assert.ok(r.chaptersInRail && !r.chaptersOnStage, `${tag} its chapters are in the inspector, not on the stage`);
        assert.ok(r.recall && r.transcript && r.sources > 0, `${tag} recall, transcript and sources are there`);
        assert.equal(r.playing, false, `${tag} nothing plays on its own`);

        // An explainer's frame reaches the readings once it has data.
        // Played muted for a few seconds (the test server has no range requests, so no seeking).
        await page.evaluate(() => { const v = document.querySelector('#films-stage video'); v.muted = true; v.play(); });
        await wait(page, 4500);
        await page.evaluate(() => document.querySelector('#films-stage video').pause());
        await wait(page, 600);
        const lit = await page.evaluate(() => { const c = document.getElementById('studio-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n; });
        assert.ok(lit > 500, `${tag} the explainer's frame is on the Studio canvas for the readings (${lit} lit pixels)`);

        await page.evaluate(() => document.querySelector('.films-pick[data-film="one-step-threads"]').click()); await wait(page, 800);
        assert.match(await page.evaluate(() => document.querySelector('#films-stage video').getAttribute('aria-label')), /threads/i, `${tag} a One Step film takes the stage`);
        await pick(page, 'sketch'); await wait(page, 1200);
        const back = await page.evaluate(() => ({ canvas: !document.getElementById('studio-canvas').hidden, films: document.getElementById('films-stage').hidden, playing: [...document.querySelectorAll('video')].some((v) => !v.paused) }));
        assert.deepEqual(back, { canvas: true, films: true, playing: false }, `${tag} leaving gives the stage back and nothing plays`);
        await page.goto(`${base}/studio.html?source=films`); await wait(page, 6000);
        assert.equal(await page.evaluate(() => document.querySelector('.films-pick[aria-checked="true"]').dataset.film), 'one-step-threads', `${tag} a reload opens the film chosen last`);
        assert.deepEqual(errors, [], `${tag} no console errors`);
        console.log(`${tag} studio films source: pass`);
      } catch (e) {
        failures++;
        console.error(`FAIL ${tag}`, e.message);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
