// The long films on explainers.html, seeking in a real browser.
//
// A source card's "Heard at" link and a transcript sentence move the film to the second they name
// and play from there. A jump past the end of a chapter group does not open that group's recall
// questions; playing up to the end of a chapter group still pauses the film and opens them. The
// line under the player names the source of the chapter playing. The server must answer byte ranges (tools/serve.py does), or the browser cannot seek at all.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8804';
const SLUG = 'passing-check';

async function main() {
  const head = await fetch(`${base}/media/explainers/${SLUG}/${SLUG}.mp4`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(head.status, 206, 'the server answers a byte range, so the video can seek');
  assert.equal((await head.arrayBuffer()).byteLength, 100, 'the range is the bytes asked for');

  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/explainers.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`figure.film[data-film="${SLUG}"][data-ready]`, { timeout: 20000 });
    const v = `#${SLUG} video`;
    await page.evaluate((v) => { document.querySelector(v).muted = true; }, v);
    const state = () => page.evaluate(({ v, s }) => ({
      t: document.querySelector(v).currentTime,
      paused: document.querySelector(v).paused,
      open: [...document.querySelectorAll(`#${s} .fl-recall section`)].map((x) => !x.hidden),
      now: document.querySelector(`#${s} .fl-s.is-now`)?.dataset.t,
    }), { v, s: SLUG });

    // 1. A source card seeks the film to where it is first cited and plays on, past a chapter-group
    //    end it jumped over, without opening those questions.
    const link = page.locator(`#${SLUG}-sources ~ .fl-src-wrap li`).nth(1).locator('.fl-seek');
    const want = parseFloat(await link.getAttribute('data-seek'));
    await link.click();
    await page.waitForFunction(({ v, w }) => Math.abs(document.querySelector(v).currentTime - w) < 1.5 && !document.querySelector(v).paused, { v, w: want }, { timeout: 15000 });
    await page.waitForTimeout(1500);
    let s = await state();
    assert.equal(s.paused, false, `a jump to ${want} s keeps playing (paused at ${s.t})`);
    assert.ok(s.t > want, `the film plays on from ${want} s (now ${s.t})`);
    assert.ok(s.open.every((o) => !o), `a jump opens no recall questions (${s.open})`);
    assert.ok(s.now !== undefined && parseFloat(s.now) <= s.t + 0.1, 'the transcript marks the sentence being spoken');
    const citing = await page.evaluate((s) => document.querySelector(`#${s} .fl-now`)?.textContent || '', SLUG);
    const cited = await link.evaluate((a) => a.closest('li').querySelector('.fl-src-name b').textContent.trim());
    assert.ok(citing.startsWith('Source now') && citing.includes(cited), `the line under the player names the source playing (${citing})`);

    // 2. A transcript sentence seeks to its own start.
    await page.evaluate((s) => { document.querySelector(`#${s}-transcript`).open = true; }, SLUG);
    const sentence = page.locator(`#${SLUG} .fl-s[data-t]`).nth(20);
    const at = parseFloat(await sentence.getAttribute('data-t'));
    await sentence.click();
    await page.waitForFunction(({ v, w }) => Math.abs(document.querySelector(v).currentTime - w) < 1.5, { v, w: at }, { timeout: 15000 });

    // 3. Playing up to the end of the first chapter group still pauses and opens its questions.
    const stop = await page.evaluate((s) => {
      const timing = [...document.querySelectorAll(`#${s} .fl-src-wrap li`)];
      return parseFloat(timing[1].querySelector('.fl-seek').dataset.seek); // the next chapter's start
    }, SLUG);
    await page.evaluate(({ v, t }) => { const el = document.querySelector(v); el.currentTime = t; el.play(); }, { v, t: stop - 3 });
    await page.waitForFunction((v) => document.querySelector(v).paused, v, { timeout: 15000 });
    s = await state();
    assert.ok(Math.abs(s.t - stop) < 1, `playing to a chapter-group end pauses there (${s.t} against ${stop})`);
    assert.equal(s.open[0], true, 'and opens that group\'s questions');
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`ok ${SLUG}: range 206, jump to ${want} s plays on with no questions, sentence seeks to ${at} s, reaching ${stop} s opens the questions`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
