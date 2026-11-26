// Parity: every control of the Retro Studio against the shader room of The Playground.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/retro-parity.cjs
//
// tests/retro-parity.json maps each studio control to the room control that does its job, or lists it as missing with
// the issue that tracks it. This test fails when:
//   - a control of the studio's markup (system/retro-panel.htm, which /retro.html was until it moved into the room and
//     which the Studio still mounts), or one retro-studio.js builds while it runs, is in neither list;
//   - a listed control is no longer in the studio (the list has gone stale);
//   - a mapped control is not in the opened room (the room lost something);
//   - a mapped control does not act: the room is held paused, the control is driven as its entry's act says, and the
//     part of the room the entry names (the frame's pixels, the room's state, a saved file, a hand-over, the words, the
//     control's pressed state or the address) must change. A frame that changes with no control touched fails too,
//     since a frame check against a moving frame proves nothing;
//   - the planted controls (a button and a select with no handler, put into the room by this test) are not reported dead;
//   - the missing list is not empty and names no issue.
//   - /retro.html redirects while the missing list has entries, or does not redirect into the room once it is empty;
//     with the list empty, the old address (with the hand-over query) must land in the room.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const root = path.join(__dirname, '..');
const parity = JSON.parse(fs.readFileSync(path.join(__dirname, 'retro-parity.json'), 'utf8'));
const SEES = new Set(['frame', 'state', 'saved', 'stored', 'said', 'pressed', 'address']);

// The studio's controls, by id, or by the data attribute that tells same-tagged controls apart.
function studioControls() {
  const html = fs.readFileSync(path.join(root, 'system/retro-panel.htm'), 'utf8'), keys = [];
  for (const m of html.matchAll(/<(input|select|button|textarea)\b([^>]*)>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[2]), data = /\bdata-(src|pal|react)="([^"]+)"/.exec(m[2]);
    assert.ok(id || data, `a studio control with no id and no telling data attribute: ${m[0]}`);
    keys.push(id ? id[1] : `data-${data[1]}=${data[2]}`);
  }
  const js = fs.readFileSync(path.join(root, 'system/retro-studio.js'), 'utf8');
  const made = (js.match(/document\.createElement\("(button|input|select|textarea)"\)/g) || []).length;
  const entries = Object.entries(parity.dynamic.entries);
  for (const [key, e] of entries) { assert.ok(js.includes(e.find), `${key}: its line is no longer in retro-studio.js`); keys.push(key); }
  assert.equal(entries.reduce((n, [, e]) => n + e.creates, 0), made, `retro-studio.js makes ${made} controls while it runs; the parity list accounts for a different number`);
  const listeners = (js.match(/addEventListener\("/g) || []).length;
  return { keys, listeners };
}

// What the room shows and holds, read in the page: a hash of the shown frame's pixels, the room's value without its
// clock, the words in its status lines, the control's pressed state, the address and this tab's hand-over keys.
const print = (page, sel) => page.evaluate((sel) => {
  const host = document.querySelector('#shader .rm-host'), f = host.querySelector('.shd-out:not([hidden])') || host.querySelector('.shd-frame');
  const k = document.createElement('canvas'); k.width = f.width; k.height = f.height; const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(f, 0, 0);
  const d = x.getImageData(0, 0, k.width, k.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619) >>> 0;
  const v = window.__rooms.handles.shader.value(); delete v.time; delete v.frameMs;
  const el = sel ? host.querySelector(sel) : null;
  return { frame: `${k.width}x${k.height}:${h}`, state: JSON.stringify(v), said: [...host.querySelectorAll('[role="status"]')].map((n) => n.textContent).join('|'),
    pressed: el?.getAttribute('aria-pressed') ?? '', address: location.search, stored: Object.keys(sessionStorage).sort().map((key) => `${key}:${sessionStorage.getItem(key).length}`).join(',') };
}, sel);

async function step(page, [what, sel, value]) {
  const loc = sel ? page.locator(`#shader ${sel}`).first() : null;
  if (what === 'open') { await page.evaluate((r) => { document.querySelector(`#shader [data-rack="${r}"]`).open = true; }, sel); await page.waitForFunction(() => document.querySelector('#shader .rm-host').dataset.rack === 'ready'); }
  // the pointer leaves for the page's corner after a press, so a scroll cannot slide the frame under it (the frame reads the pointer)
  else if (what === 'click') { await loc.scrollIntoViewIfNeeded(); await loc.click(); await page.mouse.move(1, 1); }
  else if (what === 'set' || what === 'type') await loc.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  else if (what === 'check') await loc.evaluate((el, v) => { el.checked = v === undefined || v === null ? !el.checked : !!v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  else if (what === 'wait') await page.waitForTimeout(value);
  else if (what === 'file') await loc.setInputFiles(path.join(root, value));
  else if (what === 'draw') {   // a stroke across the shown frame, held at the page's corner after
    await page.locator('#shader .shd-stage').scrollIntoViewIfNeeded(); const box = await page.locator('#shader .shd-stage').boundingBox(); await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3); await page.mouse.down();
    for (let i = 1; i <= 24; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.025), box.y + box.height * (0.3 + 0.4 * Math.sin(i / 4)));
    await page.mouse.up(); await page.mouse.move(1, 1);
  } else throw new Error(`no step called ${what}`);
}
const settle = (page) => page.evaluate(() => new Promise((done) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(done)), 150)));
// a redraw is synchronous in the page (shaderDraw), so two animation frames are enough for the canvas to be read back
const redraw = (page) => page.evaluate(() => { document.querySelector('#shader .rm-host').shaderDraw(1); return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))); });

// Drive one control and say what changed. sees lists what must change; the frame must also hold still without it.
async function acts(page, key, sel, act, saved) {
  for (const b of act.before || []) { await step(page, b); await settle(page); }
  const target = act.target || sel, sees = [].concat(act.sees || 'frame');
  // the baseline: redrawn until three frames in a row agree (a frame in flight from the last step settles first). A frame
  // that never holds still for three draws fails a frame check, since a check against a moving frame proves nothing.
  let a = null, same = 0;
  for (let i = 0; i < 12 && same < 2; i++) { await redraw(page); const p = await print(page, target); same = a && a.frame === p.frame ? same + 1 : 0; a = p; }
  if (sees.includes('frame')) assert.equal(same, 2, `${key}: the frame moved with no control touched, so a frame check here proves nothing`);
  a.saved = String(saved.n);
  // after the step, the room is read until one of the named parts changes, or until the entry's wait (1.5 s, or longer
  // for a source that loads or a file that is written) runs out; a dead control is read for the whole wait
  await step(page, [act.do, target, act.value]);
  let b = null, changed = [];
  for (const until = Date.now() + (act.wait || 1500); ;) {
    await page.waitForTimeout(60); b = await print(page, target); b.saved = String(saved.n);
    changed = Object.keys(a).filter((k) => a[k] !== b[k]);
    if (sees.some((x) => changed.includes(x)) || Date.now() > until) break;
  }
  for (const s of act.after || []) { await step(page, s); await settle(page); }
  return { changed, ok: sees.some((s) => changed.includes(s)) };
}

(async () => {
  const { keys, listeners } = studioControls();
  const mapped = Object.keys(parity.mapped), missing = parity.missing;
  assert.equal(new Set(keys).size, keys.length, 'every studio control has its own key');
  assert.deepEqual(mapped.filter((k) => missing.includes(k)), [], 'no control is both mapped and missing');
  assert.deepEqual(keys.filter((k) => !mapped.includes(k) && !missing.includes(k)), [], 'every studio control is mapped or listed as missing');
  assert.deepEqual([...mapped, ...missing].filter((k) => !keys.includes(k)), [], 'every listed control is still in the studio');
  for (const [k, v] of Object.entries(parity.mapped)) { assert.ok(v.act && v.act.do, `${k}: a mapped control says how to drive it`); for (const s of [].concat(v.act.sees || 'frame')) assert.ok(SEES.has(s), `${k}: sees ${s}?`); }
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'site-src/world/addresses.json'), 'utf8'));
  const retroRow = ledger.rows.find((r) => r.path === '/retro.html');
  const moved = !!(retroRow && retroRow.kind === 'moved' && retroRow.to);
  assert.equal(moved, missing.length === 0, missing.length ? '/retro.html may not redirect while controls are missing' : '/retro.html is mapped in addresses.json');
  if (missing.length) assert.match(parity.issue, /^https:\/\/github\.com\/HarperZ9\/HarperZ9\.github\.io\/issues\/\d+$/, 'the missing list names its issue');

  // a fake microphone and an allowed prompt, so the Microphone control can be driven headless
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}), args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const dead = [], report = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const page = await ctx.newPage(), errors = [], saved = { n: 0 };
    page.on('pageerror', (e) => errors.push(e.message)); page.on('download', () => { saved.n++; });
    // a hand-over opens another page; a 204 keeps this one, and the test reads what was stored for the next
    await page.route(/\/(studio|loom)\.html/, (r) => r.fulfill({ status: 204 }));
    await page.goto(`${base}/playground/?room=shader&ly=add.50.s:bands#shader`, { waitUntil: 'load' });
    await page.waitForSelector('#shader[data-room-live]');
    await page.click('#shader [data-library]'); await page.waitForSelector('#shd-preset');
    await page.waitForFunction(() => window.__rooms.bus.log().some((l) => l.ok && l.from === 'shader'));
    await page.click('#shader [data-run]'); await page.waitForFunction(() => window.__rooms.handles.shader.value().running === false); await page.mouse.move(1, 1);

    // The planted controls first: a button and a select with nothing behind them must be reported dead.
    await page.evaluate(() => { const p = document.querySelector('#shader .shd-take'); p.insertAdjacentHTML('beforeend', '<button type="button" id="planted-b">planted</button><select id="planted-s"><option>a</option><option>b</option></select>'); });
    for (const [sel, act] of [['#planted-b', { do: 'click', sees: [...SEES] }], ['#planted-s', { do: 'set', value: 'b', sees: [...SEES] }]]) {
      const r = await acts(page, sel, sel, act, saved);
      assert.equal(r.ok, false, `the planted control ${sel} has no handler, yet the check saw ${r.changed.join(', ')} change`);
    }
    await page.evaluate(() => { document.querySelector('#planted-b').remove(); document.querySelector('#planted-s').remove(); });

    // A control the room makes when it is needed (an effect's dial, a route's row) is looked for after its entry's steps.
    const absent = [];
    for (const [k, v] of Object.entries(parity.mapped)) {
      for (const s of v.act.before || []) { await step(page, s); await settle(page); }
      if (!(await page.locator(`#shader ${v.room}`).count())) { absent.push(`${k} (${v.room})`); continue; }
      const t0 = Date.now(), r = await acts(page, k, v.room, { ...v.act, before: [] }, saved); report[k] = `${r.changed.join(' ')} (${Date.now() - t0} ms)`;
      if (!r.ok) dead.push(`${k} (${v.act.target || v.room}: wanted ${[].concat(v.act.sees || 'frame').join('/')}, saw ${r.changed.join(', ') || 'nothing'})`);
    }
    assert.deepEqual(absent, [], 'every mapped control is in the opened room');
    assert.deepEqual(dead, [], 'every mapped control acts on the room');
    assert.deepEqual(errors, []);
    // /retro.html redirection via 404.html is verified by tests/addresses-moved.cjs on the Pages-like server.
    await page.evaluate(() => window.__rooms?.handles.shader?.destroy()).catch(() => {}); await page.waitForTimeout(800); await ctx.close();
  } finally { await browser.close(); }
  if (process.env.PARITY_REPORT) console.log(JSON.stringify(report, null, 1));
  console.log('retro-parity: ok', JSON.stringify({ studioControls: keys.length, studioListeners: listeners, inTheRoom: mapped.length, acting: mapped.length - dead.length, missing: missing.length, issue: parity.issue }));
  if (missing.length) console.log(`retro-parity: expected missing, ${missing.length} of ${keys.length}: ${missing.join(' ')}`);
})().catch((e) => { console.error(e); process.exit(1); });
