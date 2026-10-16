// Night School in a real browser, at desktop and phone widths: nothing loads before a press; the
// film mounts, plays forward and shows captions from its timing; the lab mounts, trains, and its
// status reports a step count and a held-out loss computed by the run; the page throws no errors
// and never scrolls sideways. SHOTS=dir saves screenshots (canvas readbacks) for a person to look at.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8810';
const shots = process.env.SHOTS || '';
// WebGPU on SwiftShader; compositing and 2D canvas on the CPU, so no GPU is touched.
const ARGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'];

async function save(page, sel, name) {
  if (!shots) return;
  const url = await page.$eval(sel, (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(shots, name), Buffer.from(url.split(',')[1], 'base64'));
}

async function check(browser, width, force2d) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  ctx.setDefaultTimeout(120000);
  if (force2d) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/night-school-attention.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-school] canvas').count(), 0, 'no lesson canvas before a press');
  const tag = `${width}-${force2d ? '2d' : 'gpu'}`;

  await page.click('[data-school="film"] [data-school-open]');
  await page.waitForSelector('[data-school="film"] canvas', { timeout: 60000 });
  await page.waitForFunction(() => /^0:0[3-9]|^0:[1-5]/.test(document.querySelector('.sf-time')?.textContent || ''), null, { timeout: 90000 });
  // Jump to the inside of the lamp and check a caption is shown.
  await page.$eval('.sf-scrub', (s) => { s.value = '187'; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(2500);
  const cap = await page.textContent('.sf-cap');
  assert.ok(cap && cap.length > 10, `${tag}: a caption shows at 3:07 (got "${cap}")`);
  await save(page, '[data-school="film"] canvas', `film-${tag}.png`);
  await page.$eval('.sf-bar button', (b) => b.click());

  await page.click('[data-school="lab"] [data-school-open]');
  await page.waitForSelector('[data-school="lab"] canvas', { timeout: 60000 });
  await page.click('[data-school="lab"] .ns-go');
  await page.waitForFunction(() => /Step ([1-9]\d{2,})/.test(document.querySelector('.lab .ns-status')?.textContent || ''), null, { timeout: 180000 });
  const status = await page.textContent('.lab .ns-status');
  assert.match(status, /Held-out loss \d+\.\d\d/, `${tag}: the lab reports a held-out loss`);
  await save(page, '[data-school="lab"] canvas', `lab-${tag}.png`);
  if (shots) await page.screenshot({ path: path.join(shots, `page-${tag}.png`), fullPage: false });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 1, `${tag}: the page scrolls sideways by ${wide}px`);
  assert.deepEqual(errors, [], `${tag}: page errors`);
  console.log(`${tag}: ok. ${status.slice(0, 120)}`);
  await ctx.close();
}

// Lessons after the pilot (F1 to F4): the film mounts, plays and shows a caption; the lab opens after
// the guess, reports numbers it computed in both of its views, and ends when the reader says so.
const PAIR = [
  { slug: 'vectors', at: '196', first: /a \. b = -?\d+\.\d\d\. Lengths/, second: /nearest are \w+ \(-?\d\.\d\d\)/ },
  { slug: 'matrices', at: '250', first: /Determinant -?\d/, second: /gives \d+% of its light to "\w+" \(score -?\d+\.\d\d\)/ },
  // Pair 2: the dial view needs one press before it has a number from the model; F4's end button is the fourth.
  { slug: 'gradients', at: '210', first: /steps of 0\.25\. At \(/, act: '[data-school="lab"] .lab-row:not([hidden]) button', second: /Dial at 0\.\d+: held-out loss \d\.\d{4}, slope -?\d/ },
  // Pair 3: the race has a number once it runs (it starts on Line them up); the network view needs one Train press.
  { slug: 'optimisers', at: '163', first: /update \d+: careful steps/, act: '[data-school="lab"] .lab-row:not([hidden]) button', second: /held-out accuracy \d+\.\d% after 4,000 updates/ },
  { slug: 'heldout', at: '158', first: /Degree 3: error \d\.\d+e-?\d+ on its 16 training points, \d/, act: '[data-school="lab"] .lab-row:not([hidden]) button', second: /40 training points, 4000 updates: training accuracy \d+\.\d%, held-out \d+\.\d%/ },
  { slug: 'backprop', at: '200', first: /Step \d+ of 4000\. Held-out accuracy \d+\.\d%/, second: /Check: worst layer \w+ at \d\.\de-\d+/, done: 4 },
  // Pair 4: both labs have one view, so no tab press (tab: null) and the end button is the first.
  { slug: 'tokens', at: '120', first: /the guides' merges, 50 merges: \d+ pieces for \d+ words/, tab: null, act: '#tl-bytes', second: /bytes as the base: \d+ pieces for \d+ words/, done: 1 },
  // Pair 5: the next-word lab is driven by its text box (fill), the decoding lab by Spin 200.
  { slug: 'nextword', at: '205', first: /the next word "on" had share \d+\.\d%, surprise \d\.\d\d\. Over your text, mean surprise/, tab: null, fill: ['#nl-text', 'tallow found a map .'], second: /After "tallow found a map \.": that is the end of your text\. Over your text, mean surprise \d\.\d\d, torn between \d/, done: 1 },
  { slug: 'decoding', at: '200', first: /temperature 1\.00: \d+ words keep a slot after "pylon"/, tab: null, act: '[data-school="lab"] .lab-row button:nth-child(2)', second: /200 runs: \d+ follow the rules \(\d+%\), \d+ different texts/, done: 1 },
  // Pair 6: the tower is driven by a switch; the dock by Train (250 laps for speed).
  { slug: 'block', at: '180', first: /Everything on\. On 6,144 held-out next words: loss 0\.69, copies 99%/, tab: null, act: '#bl-l1-h1', second: /Off \(zero\): top floor, head 2\. On 6,144 held-out next words: loss \d\.\d\d, copies \d+%/, done: 1 },
  { slug: 'trainloop', at: '226', first: /Choose the settings and press Train/, tab: null, select: ['#tl2-laps', '250'], second: /lap 250, held-out loss \d\.\d\d on 64 held-out rows, copies \d+%\./, done: 1 },
  // Pair 7: both labs train in the page; 250 laps keeps the check short.
  { slug: 'data', at: '154', first: /Choose a mix and press Train/, tab: null, select: ['#dl2-laps', '250'], second: /lap 250, held-out loss \d\.\d\d on 64 held-out rows; look-back words \d+% right\./, done: 1 },
  { slug: 'scaling', at: '100', first: /Choose a size and press Train/, tab: null, select: ['#sl-laps', '250'], second: /lap 250, held-out loss \d\.\d{3} on 6,144 next words/, done: 1 },
  // Pair 8: the student and the fine-tune train in the page from the press of Train.
  { slug: 'distill', at: '200', first: /Choose a teacher and press Train/, tab: null, select: ['#ds-steps', '500'], second: /step 500, held-out loss \d\.\d\d on 64 held-out rows/, done: 1 },
  { slug: 'lora', at: '306', first: /Choose a method and press Train/, tab: null, select: ['#lr-steps', '300'], second: /step 300, answer right \d+% on 64 new-habit rows/, done: 1 },
  // Pair 9: the bucket resamples in the page; the gate rebuilds the early model, then trains.
  { slug: 'errorbars', at: '170', first: /Choose rows and press Draw/, tab: null, select: ['#eb-rows', '64'], second: /64 rows, resampling rows: score \d\.\d{4}, 2000 resamples, middle 95% \d\.\d{4} to \d\.\d{4}\./, done: 1 },
  { slug: 'gaming', at: '150', first: /Choose a checker and press Train/, tab: null, select: ['#gm-steps', '100'], second: /gamed checker: round 100, points \d+%, answers right \d+% on 64 questions\./, done: 1 },
  // Pair 10: the instruments train and score in the page; the cannery counts with the emulator (timing needs a real chip).
  { slug: 'evaluate', at: '120', first: /Choose how far to train and press Train and score/, tab: null, select: ['#ev-steps', '200'], second: /step 200: loss \d\.\d\d, exact match \d+%, perfect judge \d+%, cheap judge \d+% on 64 fresh rows\./, done: 1 },
  { slug: 'threads', at: '150', first: /Choose a crew size and press Count/, tab: null, select: ['#th-n', '65536'], second: /crews of 64, neighbouring reads: 1,024 crews, 0 idle threads, [\d,]+ 32-byte trips \(1\.00 times neighbouring\)\./, done: 1 },
  // Pair 11: the palette quantises and scores in the page; the trays count with the emulator (timing needs a real chip).
  { slug: 'quant', at: '170', first: /Choose bits, scale and rounding, and press Quantise and score/, tab: null, select: ['#qt-bits', '4'], second: /4 bits, one scale per output, plain rounding: loss \d\.\d{4} \(full \d\.\d{4}\), rise [+-]\d\.\d{4} \[[-\d.]+, [-\d.]+\] on 256 held-out rows; [\d,]+ bytes\./, done: 1 },
  { slug: 'tiling', at: '165', first: /Choose a kernel and a size, and press Count and check/, tab: null, select: ['#tl-n', '64'], second: /tiles of 16, 64 wide: 32,768 reads from the warehouse, 3\.56 operations per byte; check passed\./, done: 1 },
  // Pair 12: the cannery counts and checks with the emulator (timing needs a real chip); the jugs round and sum in the page.
  { slug: 'fused', at: '150', first: /Choose a kernel and sizes, and press Count and check/, tab: null, select: ['#fa-n', '64'], second: /fused, 64 words, 16 per head: [\d,]+ bytes to and from the warehouse; check passed\./, done: 1 },
  { slug: 'precision', at: '203', first: /110\.0042 is stored as 110 \(fp16\), 110 \(bf16\)/, tab: null, select: ['#pr-step', '0.01'], second: /adding 0\.01 five thousand times: fp16 32, bf16 4, fp32 [\d.]+\./, done: 1 },
  // Pair 13: the parity check runs the stand-in in the page; the receipt is checked from scratch in the page.
  { slug: 'denoiser', at: '232', first: /Choose a version, a seed and the glint, and press Run the check/, tab: null, select: ['#dn-path', 'scalar'], second: /32-bit throughout, seed 1, with the glint: worst difference [\d.e-]+ at \(\d+, \d+\); 0 pixels over the bound 0\.01: passes\./, done: 1 },
  { slug: 'receipts', at: '189', first: /The real bundle: MATCH; every check passed; 40 of 50 counted from the rows\./, tab: null, select: ['#rc-file', 'results.jsonl'], second: /results\.jsonl, byte 52 of 2892 flipped: DRIFT; failed: .*results_bytes/, done: 1 },
  // Pair 14: the row sorts step by step in the page; the tide table fills in the page.
  { slug: 'search', at: '144', first: /Choose a sort, a row and a size, and press Sort/, tab: null, select: ['#sr-n', '64'], second: /insertion sort, jumbled row of 64: [\d,]+ comparisons, [\d,]+ moves; in order\./, done: 1 },
  { slug: 'editdistance', at: '161', first: /Type two strings and press Fill the table/, tab: null, act: '[data-school=\"lab\"] .lab-row button', second: /\"halve the beach\" to \"half the beach\": distance 2, in 240 squares\./, done: 1 },
  { slug: 'embeddings', at: '140', first: /seed 1, 32 numbers per word, window 2, 5 noise words\. At 100% of training, \d+% of the 46 words/, tab: null, select: ['#el-seed', '2'], second: /seed 2, 32 numbers per word.*At 100% of training, \d+% of the 46 words/, done: 1 },
];
async function checkLesson(browser, width, force2d, L) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  ctx.setDefaultTimeout(120000);
  if (force2d) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); });
  const page = await ctx.newPage(), errors = [], tag = `${L.slug}-${width}-${force2d ? '2d' : 'gpu'}`;
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/night-school-${L.slug}.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-school] canvas').count(), 0, `${tag}: no lesson canvas before a press`);
  await page.click('[data-school="film"] [data-school-open]');
  await page.waitForSelector('[data-school="film"] canvas', { timeout: 60000 });
  await page.waitForFunction(() => /^0:0[3-9]|^0:[1-5]/.test(document.querySelector('.sf-time')?.textContent || ''), null, { timeout: 90000 });
  await page.$eval('.sf-scrub', (s, v) => { s.value = v; s.dispatchEvent(new Event('input')); }, L.at);
  await page.waitForTimeout(2500);
  const cap = await page.textContent('.sf-cap');
  assert.ok(cap && cap.length > 10, `${tag}: a caption shows (got "${cap}")`);
  await save(page, '[data-school="film"] canvas', `film-${tag}.png`);
  await page.$eval('.sf-bar button', (b) => b.click());
  await page.click('[data-school="lab"] [data-school-open]');
  await page.waitForSelector('[data-school="lab"] canvas', { timeout: 60000 });
  await page.click('[data-school="lab"] .ns-go');
  await page.waitForFunction((re) => new RegExp(re).test(document.querySelector('.lab .ns-status')?.textContent || ''), L.first.source, { timeout: 60000 });
  await save(page, '[data-school="lab"] canvas', `lab-${tag}-a.png`);
  if (L.tab !== null) await page.click(L.tab || '[data-school="lab"] .ns-acts button:nth-child(2)');
  if (L.act) await page.click(L.act);
  if (L.fill) await page.fill(L.fill[0], L.fill[1]);
  if (L.select) { await page.selectOption(L.select[0], L.select[1]); await page.click('[data-school="lab"] .lab-row button'); }
  await page.waitForFunction((re) => new RegExp(re).test(document.querySelector('.lab .ns-status')?.textContent || ''), L.second.source, { timeout: 60000 });
  await save(page, '[data-school="lab"] canvas', `lab-${tag}-b.png`);
  const status = await page.textContent('.lab .ns-status');
  await page.click(`[data-school="lab"] .ns-acts button:nth-child(${L.done || 3})`);
  assert.ok(await page.isVisible('[data-school="lab"] .ns-end'), `${tag}: the lab ends when asked`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 1, `${tag}: the page scrolls sideways by ${wide}px`);
  assert.deepEqual(errors, [], `${tag}: page errors`);
  console.log(`${tag}: ok. ${status.slice(0, 120)}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', args: ARGS });
  try {
    // NS_MODES=2d runs only the Canvas 2D paths (CI runners cannot present a SwiftShader WebGPU canvas).
    const all = [[1280, false], [375, false], [1280, true], [375, true]];
    // NS_ONLY=vectors,matrices limits a local run to those lessons (CI runs everything).
    const only = (process.env.NS_ONLY || '').split(',').filter(Boolean);
    if (!only.length || only.includes('attention')) for (const [w, f] of process.env.NS_MODES === '2d' ? all.filter((x) => x[1]) : all) await check(browser, w, f);
    for (const L of PAIR.filter((x) => !only.length || only.includes(x.slug))) for (const [w, f] of process.env.NS_MODES === '2d' ? all.filter((x) => x[1]) : all) await checkLesson(browser, w, f, L);
    const idx = await browser.newPage();
    await idx.goto(`${base}/night-school.html`, { waitUntil: 'networkidle' });
    for (const rel of ['night-school-attention.html', 'night-school-vectors.html', 'night-school-matrices.html', 'night-school-gradients.html', 'night-school-backprop.html', 'night-school-optimisers.html', 'night-school-heldout.html', 'night-school-tokens.html', 'night-school-embeddings.html', 'night-school-nextword.html', 'night-school-decoding.html', 'night-school-block.html', 'night-school-trainloop.html', 'night-school-data.html', 'night-school-scaling.html', 'night-school-distill.html', 'night-school-lora.html', 'night-school-errorbars.html', 'night-school-gaming.html', 'night-school-evaluate.html', 'night-school-threads.html', 'night-school-quant.html', 'night-school-tiling.html', 'night-school-fused.html', 'night-school-precision.html', 'night-school-denoiser.html', 'night-school-receipts.html', 'night-school-search.html', 'night-school-editdistance.html']) assert.ok(await idx.locator(`a[href="${rel}"]`).count() >= 1, `the school links ${rel}`);
    console.log('night-school.html: ok');
    assert.ok(await idx.locator('a[href="night-school-coast.html"]').count() >= 1, 'the school links the coast map');
    // The coast map: every made lesson is a light that links to it, pointing at one shows its name, and
    // neither width scrolls the page sideways (the map scrolls inside its own frame on a phone).
    for (const width of [1280, 375]) {
      const cp = await browser.newPage({ viewport: { width, height: 900 } }), errs = [];
      cp.on('pageerror', (e) => errs.push(String(e)));
      await cp.goto(`${base}/night-school-coast.html`, { waitUntil: 'networkidle' });
      const made = await idx.locator('.sc-lesson a').count();
      assert.equal(await cp.locator('.cm a').count(), made, 'one map link per made lesson');
      const name = cp.locator('[data-for="L10"]');
      assert.equal(Number(await name.evaluate((n) => getComputedStyle(n).opacity)), 0, 'names hidden until pointed at');
      await cp.locator('[data-id="L10"]').hover();
      assert.equal(Number(await name.evaluate((n) => getComputedStyle(n).opacity)), 1, 'pointing at a light shows its name');
      assert.equal(await cp.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `no sideways scroll at ${width}`);
      assert.deepEqual(errs, []);
      await cp.close();
    }
    console.log('night-school-coast.html: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
