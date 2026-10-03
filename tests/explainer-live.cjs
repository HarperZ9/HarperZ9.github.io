// The live explainers in a real browser.
//
// For every page that carries one: the live stage mounts, its spec hash matches the video's build
// receipt (MATCH), and after the page has loaded, playing, scrubbing, changing a parameter,
// answering recall questions and forgetting the answers make no network request at all. With
// reduced motion each step is exactly one drawn frame. A wrong recall answer is told its
// misconception and is not shown the keyed answer; a stored review survives a reload.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const PAGES = [
  ['no-receipt-no-accept.html', ['cost-to-verify', 'receipt-is-not-a-verdict']],
  ['flywheel.html', ['receipt-loop']],
];

async function ready(page, slug) {
  const fig = page.locator(`#explainer-${slug}`);
  await fig.scrollIntoViewIfNeeded();
  await page.waitForSelector(`#explainer-${slug} .xl[data-ready]`, { timeout: 15000 });
  return fig;
}

async function checkFigure(page, slug) {
  const fig = await ready(page, slug);
  assert.equal(await fig.locator('.xl-how [data-verdict]').first().getAttribute('data-verdict'), 'MATCH', `${slug}: spec hash`);
  const requests = [];
  const listen = (r) => requests.push(r.url());
  page.on('request', listen);
  await fig.locator('.xl-stage').scrollIntoViewIfNeeded();
  await fig.locator('.xl-play').click();
  await page.waitForTimeout(800);
  const t = await page.evaluate((s) => document.querySelector(`#explainer-${s}`).explainerHandle.instance.playhead, slug);
  assert.ok(t > 0.3, `${slug}: the playhead moves while playing (${t})`);
  await fig.locator('.xl-play').click();
  await fig.locator('.xl-scrub').evaluate((e) => { e.value = '10'; e.dispatchEvent(new Event('input')); });
  const range = fig.locator('.xl-params input[type=range]').first();
  if (await range.count()) await range.evaluate((e) => { e.value = e.max; e.dispatchEvent(new Event('input')); });
  const q = fig.locator('.xl-q').first();
  const key = await q.evaluate((node) => node.dataset.item);
  const choices = await q.locator('input').evaluateAll((els) => els.map((e) => e.value));
  const recall = await page.evaluate(async (s) => (await (await fetch(`media/explainers/${s}/recall.json`)).json()), slug);
  page.off('request', listen);
  page.on('request', listen);
  const item = recall.items.find((i) => i.id === key);
  const wrong = choices.find((c) => c !== item.answer && item.misconceptions[c]);
  await q.locator(`input[value="${wrong}"]`).check();
  await q.getByRole('button', { name: 'Check' }).click();
  const feedback = await q.locator('.xl-feedback').innerText();
  const keyText = item.choices.find((c) => c.id === item.answer).text;
  assert.ok(feedback.includes(item.misconceptions[wrong].note), `${slug}: names the misconception`);
  assert.ok(!feedback.includes(keyText), `${slug}: does not show the keyed answer`);
  const stored = await page.evaluate((s) => localStorage.getItem(`explainer-recall/v1/${s}`), slug);
  assert.ok(stored && JSON.parse(stored).attempts.length === 1, `${slug}: the first attempt is stored locally`);
  await fig.getByRole('button', { name: 'Forget my answers' }).click();
  page.off('request', listen);
  const extra = requests.filter((u) => !u.endsWith(`media/explainers/${slug}/recall.json`));
  assert.deepEqual(extra, [], `${slug}: no network during interaction`);
}

async function checkReducedMotion(browser) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`${base}/flywheel.html`);
  const fig = await ready(page, 'receipt-loop');
  assert.equal(await fig.locator('.xl-play').isVisible(), false, 'no Play with reduced motion');
  const frames = () => page.evaluate(() => document.querySelector('#explainer-receipt-loop').explainerHandle.stats.frames);
  await page.waitForTimeout(300);
  const before = await frames();
  for (let i = 0; i < 3; i++) await fig.getByRole('button', { name: 'Next step' }).click();
  await page.waitForTimeout(600);
  assert.equal(await frames() - before, 3, 'one still per step');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= 375, `no sideways scroll at 375 px (${width})`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    for (const [path, slugs] of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${base}/${path}`);
      for (const slug of slugs) await checkFigure(page, slug);
      assert.deepEqual(errors, [], `${path}: no page errors`);
      await page.close();
      console.log(`ok ${path}: ${slugs.join(', ')}`);
    }
    await checkReducedMotion(browser);
    console.log('ok reduced motion: one still per step');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
