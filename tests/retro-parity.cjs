// Parity: every control of the Retro Studio against the shader room of The Playground.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/retro-parity.cjs
//
// tests/retro-parity.json maps each studio control to the room control that does its job, or lists it as missing with
// the issue that tracks it. This test fails when:
//   - a control of retro.html, or one retro-studio.js builds while it runs, is in neither list (a new studio control);
//   - a listed control is no longer in the studio (the list has gone stale);
//   - a mapped control is not in the opened room (the room lost something);
//   - the missing list is not empty and names no issue.
// The missing list is the expected failure: it is counted, printed, and tied to the issue, and /retro.html may not
// redirect to the room while it has entries (REDIRECTS.tsv).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const root = path.join(__dirname, '..');
const parity = JSON.parse(fs.readFileSync(path.join(__dirname, 'retro-parity.json'), 'utf8'));

// The studio's controls, by id, or by the data attribute that tells same-tagged controls apart.
function studioControls() {
  const html = fs.readFileSync(path.join(root, 'retro.html'), 'utf8'), keys = [];
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

(async () => {
  const { keys, listeners } = studioControls();
  const mapped = Object.keys(parity.mapped), missing = parity.missing;
  assert.equal(new Set(keys).size, keys.length, 'every studio control has its own key');
  assert.deepEqual(mapped.filter((k) => missing.includes(k)), [], 'no control is both mapped and missing');
  assert.deepEqual(keys.filter((k) => !mapped.includes(k) && !missing.includes(k)), [], 'every studio control is mapped or listed as missing');
  assert.deepEqual([...mapped, ...missing].filter((k) => !keys.includes(k)), [], 'every listed control is still in the studio');
  if (missing.length) assert.match(parity.issue, /^https:\/\/github\.com\/HarperZ9\/HarperZ9\.github\.io\/issues\/\d+$/, 'the missing list names its issue');

  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/playground/?room=shader&ly=add.50.s:bands#shader`, { waitUntil: 'load' });
    await page.waitForSelector('#shader[data-room-live]');
    await page.click('#shader [data-library]'); await page.waitForSelector('#shd-preset');
    await page.waitForFunction(() => window.__rooms.bus.log().some((l) => l.ok && l.from === 'shader'));
    const absent = await page.evaluate((rows) => rows.filter(([, sel]) => !document.querySelector('#shader').querySelector(sel)).map(([k, sel]) => `${k} (${sel})`),
      Object.entries(parity.mapped).map(([k, v]) => [k, v.room]));
    assert.deepEqual(absent, [], 'every mapped control is in the opened room');
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.__rooms?.handles.shader?.destroy()).catch(() => {}); await page.waitForTimeout(800); await ctx.close();
  } finally { await browser.close(); }
  console.log('retro-parity: ok', JSON.stringify({ studioControls: keys.length, studioListeners: listeners, inTheRoom: mapped.length, missing: missing.length, issue: parity.issue }));
  if (missing.length) console.log(`retro-parity: expected missing, ${missing.length} of ${keys.length}: ${missing.join(' ')}`);
})().catch((e) => { console.error(e); process.exit(1); });
