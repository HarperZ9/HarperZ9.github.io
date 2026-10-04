// Plate and instrument pixel baselines (tests/fixtures/plate-baselines.json, taken 3 October 2026).
//
// The baselines are SHA-256 hashes of canvas pixels on one reference machine, named in the
// fixture's "platform". Canvas rasterisation differs between GPUs, drivers and Chrome builds, so
// the hashes are compared only when PLATE_BASELINE_COMPARE=1 is set on that platform.
//
// Every run (CI included) checks what holds on any machine:
//   - the ten plate pages carry exactly the fixture's 64 seeded canvases, and the Gallery draws
//     the fixture's 95 instruments;
//   - every plate is on screen, has drawn pixels, and is backed at its layout size times the
//     device pixel ratio (a hidden plate falls back to another size: the defect fixed in #331);
//   - each instrument draws the same pixels twice in one session.
// The page clock is fixed at the fixture's "clock", since the Gallery seeds two plates from the date.
//
// Usage: SITE_BASE_URL=http://127.0.0.1:8806 node tests/plate-baselines.cjs [dpr ...]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8806';
const compare = process.env.PLATE_BASELINE_COMPARE === '1';
const strict = process.env.PLATE_BASELINE_STRICT === '1';
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'plate-baselines.json'), 'utf8'));
const PAGES = ['crucible', 'emet', 'field-guide', 'forum', 'gallery', 'gather', 'guide', 'index-graph', 'person', 'why'];
const DPRS = process.argv.slice(2).map(Number).filter(Boolean);

async function readPlates() {
  for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => r())); }
  scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 2500));
  const sha = async (u8) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const out = [];
  for (const c of document.querySelectorAll('canvas[data-specimen]')) {
    const rect = c.getBoundingClientRect();
    const row = { plate: c.closest('[data-plate]')?.dataset.plate || 'x', seed: c.dataset.specimen,
      size: [c.width, c.height], box: [rect.width * devicePixelRatio, rect.height * devicePixelRatio],
      shown: rect.width > 0 && rect.height > 0 && getComputedStyle(c).visibility !== 'hidden', inked: 0, sha256: null };
    if (c.width && c.height) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) row.inked++;
      row.sha256 = await sha(d);
    }
    out.push(row);
  }
  return out;
}

async function readInstruments() {
  const m = await import('/system/generative-field.js?v=20260925-void-plates');
  const sha = async (u8) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const once = async (name) => {
    const c = document.createElement('canvas'); c.style.width = '320px'; c.style.height = '200px'; document.body.append(c);
    m.renderSpecimen(c, 'instrument-hash', [name], null, 0.6, { size: [320, 200] });
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let inked = 0;
    for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) inked++;
    const r = { size: [c.width, c.height], sha256: await sha(d), inked };
    c.remove();
    return r;
  };
  const out = {};
  for (const name of m.specimenLayerNames()) {
    const a = await once(name), b = await once(name);
    out[name] = { ...a, repeat: a.sha256 === b.sha256 };
  }
  return out;
}

async function runDpr(browser, dpr) {
  const want = fixture[`dpr${dpr}`];
  const failures = [];
  const plates = {};
  let instruments = null;
  for (const name of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    // The Gallery's desk plate and Plate 01 take their seed from the UTC date.
    await ctx.clock.setFixedTime(new Date(fixture.clock));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`${base}/${name}.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    for (const row of await page.evaluate(readPlates)) plates[`${name}|${row.plate}|${row.seed}`] = row;
    if (name === 'gallery') instruments = await page.evaluate(readInstruments);
    if (errors.length) failures.push(`${name}: page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  assert.deepEqual(Object.keys(plates).sort(), Object.keys(want.plates).sort(), `DPR ${dpr}: the seeded canvases differ from the fixture's 64`);
  assert.deepEqual(Object.keys(instruments).sort(), Object.keys(want.instruments).sort(), `DPR ${dpr}: the instruments differ from the fixture's 95`);
  let same = 0, compared = 0;
  for (const [key, got] of Object.entries(plates)) {
    if (!got.shown) failures.push(`${key}: not on screen`);
    if (got.inked < 50) failures.push(`${key}: ${got.inked} drawn pixels`);
    if (Math.abs(got.size[0] - got.box[0]) > 2 || Math.abs(got.size[1] - got.box[1]) > 2) failures.push(`${key}: backed at ${got.size} for a ${got.box.map(Math.round)} box`);
    if (!compare) continue;
    if (!strict && fixture.unstable[`dpr${dpr}|${key}`]) continue;
    compared++;
    if (got.sha256 === want.plates[key].sha256) same++;
    else failures.push(`${key}: pixels differ from the ${fixture.taken} baseline`);
  }
  let isame = 0, icompared = 0;
  for (const [name, got] of Object.entries(instruments)) {
    if (!got.repeat) failures.push(`instrument ${name}: two draws in one session differ`);
    // Alone at tick 0.6 some instruments draw little (clifford: 2 pixels at DPR 1), so any ink counts.
    if (got.inked < 1) failures.push(`instrument ${name}: no drawn pixels`);
    if (!compare) continue;
    const k = `dpr${dpr}|instrument|${name}`;
    if (!strict && fixture.unstable[k] && !fixture.accepted_alternates[k]) continue;
    icompared++;
    const ok = (fixture.accepted_alternates[k] || [want.instruments[name].sha256]).includes(got.sha256);
    if (ok) isame++;
    else failures.push(`instrument ${name}: pixels differ from the ${fixture.taken} baseline`);
  }
  const line = compare
    ? `DPR ${dpr}: plates ${same} of ${compared} match the baseline, instruments ${isame} of ${icompared}`
    : `DPR ${dpr}: ${Object.keys(plates).length} plates on screen and drawn at layout size, ${Object.keys(instruments).length} instruments repeat exactly`;
  return { line, failures };
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  // The comparison needs the reference machine's renderer, so it launches with the fixture's flags.
  if (compare) launch.args = fixture.launch_args;
  const browser = await chromium.launch(launch);
  let failed = false;
  try {
    for (const dpr of DPRS.length ? DPRS : [1]) {
      const { line, failures } = await runDpr(browser, dpr);
      if (failures.length) { failed = true; console.error(`FAIL ${line}\n  ` + failures.join('\n  ')); }
      else console.log(`ok ${line}`);
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
