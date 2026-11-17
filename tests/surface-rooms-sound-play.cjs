// The sound room played directly (17 November 2026). The author: "the music page has the UI is hard to, it's hard to
// utilize. ... it's hard to interact with." This holds the redesign to what it promises:
//   1. The first press makes sound: one press on the Playground, and one on each /world/sound page. The audio device
//      runs and the analyser reads sound, not silence. Presses to first sound are counted.
//   2. Every control changes the output. Each one is driven and the output is read again: the worker's next bars
//      (tempo, key, notes, bands), the desk's gains in the audio graph, the analyser (a group at zero goes quiet), the
//      file the room states, the address. A planted control with no handler, put among them, must be reported as doing
//      nothing, so the check can fail.
//   3. Parity: every control and behaviour in tests/sound-parity.json is on the page, and every control the room has is
//      in the record.
//   4. At 375, 583, 1280 and 2560 px nothing in the room runs off the screen.
//   5. Reduced motion: the live view redraws about once a second and nothing animates; without it the view runs.
//   6. Sound as an input: with the music playing, the shader room's iAudio reads the sound room's levels.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms-sound-play.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const parity = require('./sound-parity.json');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811', LIVE = '#sound[data-room-live]';
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + path, { waitUntil: 'load' });
  return { ctx, page, errors };
}
const value = (page) => page.evaluate(() => window.__rooms.handles.sound.value());
const leave = async (ctx, page) => { await page.evaluate(() => window.__rooms?.handles.sound?.destroy()).catch(() => {}); await page.waitForTimeout(1300); await ctx.close(); };
const sounding = (page, timeout = 60000) => page.waitForFunction(() => { const v = window.__rooms?.handles.sound?.value(); return v && v.probe.ctx === 'running' && v.levels.level > 0.05; }, null, { timeout, polling: 100 });

async function firstPress(browser) {
  const { ctx, page, errors } = await open(browser, '/playground/');
  await page.waitForSelector('#sound [data-room-open]:not([hidden])');
  const t0 = Date.now(); await page.click('#sound [data-room-open]');   // the only press
  await page.waitForSelector(LIVE); await sounding(page);
  const v = await value(page);
  out.firstSoundMs = Date.now() - t0; out.presses = 1; out.level = +v.levels.level.toFixed(3);
  assert.equal(v.probe.ctx, 'running', 'the audio device runs after one press'); assert.ok(v.levels.level > 0.05, `the analyser reads sound (level ${v.levels.level})`);
  const f0 = v.frames; await page.waitForTimeout(2000); const f1 = (await value(page)).frames;
  out.viewFrames2s = f1 - f0; assert.ok(f1 - f0 > 20, `the view runs while the music plays (${f1 - f0} frames in 2 s)`);
  return { ctx, page, errors };
}

// The output of the room as a reading. A control that plays is read where the sound is made: what the worker last
// rendered with (tempo, key, notes, bands), the desk's gains and band shares in the audio graph, the engine's volume.
// A control of the file is read in the file the room states and the address that makes it. Bar, levels and frames move
// by themselves and are left out, and so are the chords of the last bars rendered, which change with every chunk (the
// planted control caught that on the first CI run).
const FILE = new Set(['piece', 'bars', 'seed']);
const reading = (page, kind) => page.evaluate((file) => { const v = window.__rooms.handles.sound.value(), r = v.probe.rendered;
  return JSON.stringify(file ? { cost: document.querySelector('#sound .snd-cost').textContent, address: location.search, piece: v.piece }
    : { rendered: r && { bpm: r.bpm, semis: r.semis, density: r.density, bands: r.bands }, desk: v.probe.desk && Object.fromEntries(Object.entries(v.probe.desk).map(([g, x]) => [g, Math.round(x * 100) / 100])), band: v.probe.band && Object.fromEntries(Object.entries(v.probe.band).map(([b, x]) => [b, Math.round(x * 100) / 100])), volume: v.probe.volume, piece: v.piece, playing: v.playing }); }, FILE.has(kind));
// a reading taken once the last change has settled: the same for a second and a half (a gain glides to its value, and a
// change of tempo, key or notes lands on a later bar), so a control is judged by its own change alone
async function settled(page, kind) { let last = await reading(page, kind), since = Date.now(); for (const until = Date.now() + 30000; Date.now() < until && Date.now() - since < 1500; await page.waitForTimeout(150)) { const r = await reading(page, kind); if (r !== last) { last = r; since = Date.now(); } } return last; }
// drive one control to another value, as a visitor would: a range moved, a radio pressed, a number typed
async function drive(page, el) {
  const kind = await el.evaluate((e) => (e.matches('fieldset') ? 'radios' : e.type));
  if (kind === 'radios') { const other = await el.$('input:not(:checked)'); await other.check(); return; }
  if (kind === 'number') { await el.fill(String(4000 + Math.floor(Math.random() * 999))); return; }
  await el.evaluate((e) => { const lo = +e.min, hi = +e.max, now = +e.value, to = now - lo > (hi - lo) / 2 ? lo + (hi - lo) * 0.2 : lo + (hi - lo) * 0.8; e.value = String(to); e.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function everyControl(page) {
  // the planted control: a slider among the instruments that nothing listens to
  await page.evaluate(() => { const d = document.querySelector('#sound .snd-desk'), p = document.createElement('input'); Object.assign(p, { type: 'range', id: 'snd-planted', min: 0, max: 1, step: 0.1, value: 0.5 }); p.dataset.ctl = 'planted'; d.append(p); });
  const list = await page.$$eval('#sound .rm-host [data-ctl]', (els) => els.map((e) => ({ id: e.id, kind: e.dataset.ctl })));
  const dead = [], alive = [];
  for (const { id, kind } of list) {
    const el = await page.$(id ? `#sound #${id}` : `#sound .rm-host [data-ctl="${kind}"]`), before = await settled(page, kind);
    await drive(page, el);
    let moved = false; for (const until = Date.now() + 20000; !moved && Date.now() < until; await page.waitForTimeout(150)) moved = (await reading(page, kind)) !== before;
    (moved ? alive : dead).push(id ? id.replace(/^snd-/, '') : kind);
  }
  out.controls = alive.length; out.dead = dead;
  assert.deepEqual(dead, ['planted'], `every control changes the output, and the planted one is caught: dead ${dead.join(', ')}`);
  return alive;
}
// the audio itself: the space group (the room and the sea, which never stop) at zero goes quiet on its meter, and back
async function heard(page) {
  const meter = () => page.evaluate(() => window.__rooms.handles.sound.value().probe && document.querySelector('#sound .snd-ch[data-group="space"]').style.getPropertyValue('--lv'));
  const set = (v) => page.evaluate((x) => { const e = document.querySelector('#snd-g-space'); e.value = String(x); e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await set(1); await page.waitForTimeout(1500); const on = +(await meter());
  await set(0); await page.waitForTimeout(1500); const off = +(await meter());
  out.spaceMeter = { on, off }; assert.ok(on > 0.2 && off < 0.05, `the sea and room meter reads ${on} at full and ${off} at zero`);
  await set(1);
  // the tempo lands: the worker renders the next bars at the new tempo and the bar line moves there
  await page.evaluate(() => { const e = document.querySelector('#snd-tempo'); e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const want = await page.$eval('#snd-tempo', (e) => +e.max);
  await page.waitForFunction((b) => window.__rooms.handles.sound.value().probe.rendered?.bpm === b, want, { timeout: 30000 });
  const r = (await value(page)).probe.rendered; out.tempo = { bpm: r.bpm, barSec: +r.barSec.toFixed(3) };
  assert.ok(Math.abs(r.barSec - 240 / want) < 0.01, `a bar at ${want} beats a minute lasts ${r.barSec} s`);
}

async function parityCheck(browser) {
  const { ctx, page, errors } = await open(browser, '/playground/?room=sound#sound'); await page.waitForSelector(LIVE);
  const count = (sel, inside = true) => page.evaluate(([s, i]) => document.querySelectorAll(i ? `#sound .rm-host ${s}` : `#sound ${s}`).length, [sel, inside]);
  const lost = [];
  for (const [was, m] of Object.entries({ ...parity.room.before, ...parity.room.behaviours })) if ((await count(m.now, !m.outside)) < (m.count || 1)) lost.push(was);
  for (const sel of Object.values(parity.room.added)) if ((await count(sel)) < 1) lost.push(sel);
  // every control the room has is in the record
  const recorded = [...Object.values(parity.room.before).map((m) => m.now), ...Object.values(parity.room.added)];
  const unrecorded = await page.evaluate((list) => { const known = new Set(list.flatMap((s) => [...document.querySelectorAll(`#sound .rm-host ${s}`)]));
    return [...document.querySelectorAll('#sound .rm-host button, #sound .rm-host input, #sound .rm-host select, #sound .rm-host textarea, #sound .rm-host a[href], #sound .rm-host a.snd-wav, #sound .rm-host canvas')].filter((e) => !known.has(e) && !known.has(e.closest('details'))).map((e) => e.id || e.name || e.outerHTML.slice(0, 60)); }, [...recorded, 'details']);
  await ctx.close();
  for (const [path, p] of Object.entries(parity.pages)) {
    const { ctx: c2, page: pg } = await open(browser, path);
    await pg.waitForTimeout(800);
    for (const [sel, n] of Object.entries(p.now)) if ((await pg.$$(sel)).length < n) lost.push(`${path} ${sel}`);
    await c2.close();
  }
  out.parity = { room: Object.keys(parity.room.before).length + Object.keys(parity.room.behaviours).length, added: Object.keys(parity.room.added).length, pages: Object.values(parity.pages).reduce((n, p) => n + Object.keys(p.now).length, 0) };
  assert.deepEqual(lost, [], 'no control or behaviour in the record is lost'); assert.deepEqual(unrecorded, [], 'every control of the room is in the record');
  assert.deepEqual(errors, []);
}

async function widths(browser) {
  const res = {};
  for (const w of [375, 583, 1280, 2560]) {
    const { ctx, page, errors } = await open(browser, '/playground/?room=sound#sound', { viewport: { width: w, height: 900 } });
    await page.waitForSelector(LIVE); await page.waitForTimeout(400);
    res[w] = await page.evaluate(() => { const W = document.documentElement.clientWidth; return { scroll: document.documentElement.scrollWidth - W,
      off: [...document.querySelectorAll('#sound *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).map((e) => e.id || e.className || e.tagName).slice(0, 5) }; });
    assert.deepEqual(errors, []); await ctx.close();
  }
  out.widths = Object.fromEntries(Object.entries(res).map(([w, r]) => [w, r.off.length]));
  for (const [w, r] of Object.entries(res)) { assert.equal(r.scroll, 0, `no sideways scroll at ${w} px`); assert.deepEqual(r.off, [], `nothing off the screen at ${w} px`); }
}

async function reduced(browser) {
  const { ctx, page, errors } = await open(browser, '/playground/', { reducedMotion: 'reduce' });
  await page.waitForSelector('#sound [data-room-open]:not([hidden])'); await page.click('#sound [data-room-open]'); await page.waitForSelector(LIVE); await sounding(page);
  const f0 = (await value(page)).frames; await page.waitForTimeout(3000); const f1 = (await value(page)).frames;
  const moving = await page.evaluate(() => document.getAnimations().filter((a) => document.querySelector('#sound').contains(a.effect?.target)).length);
  out.reducedFrames3s = f1 - f0;
  assert.ok(f1 - f0 <= 6, `with reduced motion the view redraws about once a second (${f1 - f0} in 3 s)`); assert.equal(moving, 0, 'nothing animates');
  assert.deepEqual(errors, []); await leave(ctx, page);
}

async function shaderHears(browser) {
  const { ctx, page, errors } = await open(browser, '/playground/?room=shader#shader');
  await page.waitForSelector('#shader[data-room-live]');
  const silent = await page.$eval('#shader .rm-host', (h) => h.dataset.audio);
  await page.click('#sound [data-room-open]'); await page.waitForSelector(LIVE); await sounding(page);
  await page.waitForFunction(() => { const a = (document.querySelector('#shader .rm-host').dataset.audio || '').split(' ').map(Number); return a.length === 4 && a[3] > 0.05; }, null, { timeout: 20000 });
  const heardBy = await page.$eval('#shader .rm-host', (h) => h.dataset.audio);
  out.shaderAudio = { silent, playing: heardBy };
  assert.equal(silent, '0.00 0.00 0.00 0.00', 'iAudio is zero while the sound room is closed');
  assert.deepEqual(errors, []); await leave(ctx, page);
}

async function worldPages(browser) {
  for (const [path, press, read] of [['/world/sound/sound.html', '#voices button', () => window.__bar.engine], ['/world/sound/theme/', '#motifgrid button[data-id]', () => window.__bar.engine]]) {
    const { ctx, page, errors } = await open(browser, path);
    await page.waitForTimeout(600);
    assert.equal(await page.$eval(press, (b) => b.disabled), false, `${path}: the first instrument can be pressed before sound is on`);
    await page.click(press);   // the only press
    await page.waitForFunction(read, null, { timeout: 15000 });
    const got = await page.evaluate(async () => { const e = window.__bar.engine; let best = 0; for (let i = 0; i < 20 && !best; i++) { await new Promise((r) => setTimeout(r, 50)); best = e.levels().reduce((a, b) => Math.max(a, b), 0); } return { state: e.ctx.state, best }; });
    assert.equal(got.state, 'running', `${path}: the audio device runs after one press`); assert.ok(got.best > 0, `${path}: the analyser reads the sound of that press`);
    out[path] = { presses: 1, peakBin: got.best };
    assert.deepEqual(errors, []); await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const live = await firstPress(browser);
    await everyControl(live.page); await heard(live.page);
    assert.deepEqual(live.errors, [], 'no page errors while every control was driven'); await leave(live.ctx, live.page);
    await parityCheck(browser);
    await widths(browser);
    await reduced(browser);
    await shaderHears(browser);
    await worldPages(browser);
    console.log('surface-rooms-sound-play: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); console.log('surface-rooms-sound-play: partial', JSON.stringify(out)); process.exit(1); });
