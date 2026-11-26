// A moved address lands on its new place, with and without scripts, and an unknown address is still not found.
//
// GitHub Pages serves 404.html, with status 404, for an address that has no file. The suite's own server
// (python -m http.server) answers such an address with its own error page, so this test starts a small server that
// behaves as Pages does: a file when there is one, 404.html and status 404 when there is none.
//
// For every row of kind "moved" in the address ledger (site-src/world/addresses.json):
//   - the old address has no file, and answers 404 with the not-found page;
//   - with scripts, the browser ends at the row's target (page, query and place) and the place is on the page;
//   - without scripts, the not-found page lists the old address beside a plain link to the same target.
// An address that was never published stays on the not-found page: its heading shows, nothing redirects, and
// the status is 404.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png' };

// Folders the Pages build leaves out (_config.yml): a file there is not at any address.
const served = (p) => !/^\/(?:home|tests|docs|tools)\//.test(p);

function pagesLike() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    const send = (status, f) => { res.writeHead(status, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res); };
    if (file.startsWith(ROOT) && served(p) && fs.existsSync(file) && fs.statSync(file).isFile()) return send(200, file);
    send(404, path.join(ROOT, '404.html'));
  });
}

// The end of a chain of moved rows, as the ledger's own rules read it.
function endOf(row, byPath) {
  let to = row.to;
  for (let hops = 0; hops < 5; hops++) {
    const next = byPath.get(to) || byPath.get(to.split('#')[0]) || byPath.get(to.split('#')[0].split('?')[0]);
    if (!next || next.kind !== 'moved') return to;
    to = next.to;
  }
  throw new Error(`${row.path}: moved chain longer than five hops`);
}

(async () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'site-src/world/addresses.json'), 'utf8'));
  const byPath = new Map(ledger.rows.map((r) => [r.path, r]));
  const moved = ledger.rows.filter((r) => r.kind === 'moved');
  assert.ok(moved.length > 0, 'the ledger has no moved row, so this test would check nothing');
  const projectSites = ledger.projectSites || [];

  const server = pagesLike();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  const failures = [];
  try {
    const scripted = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const plain = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
    // A representative sample covering every distinct target hub plus a stride across the ledger;
    // every row is checked statically in tests/test_no_dead_address.py.
    const seenHub = new Set();
    const sample = [];
    for (let i = 0; i < moved.length; i++) {
      const t = endOf(moved[i], byPath).split('#')[0].split('?')[0];
      if (!seenHub.has(t) || (sample.length < 24 && i % Math.max(1, Math.floor(moved.length / 18)) === 0)) {
        seenHub.add(t);
        sample.push(moved[i]);
      }
    }
    const spage = await scripted.newPage();
    const qpage = await plain.newPage();
    for (const row of sample) {
      const target = endOf(row, byPath);
      if (projectSites.some((p) => target.startsWith(p))) continue; // another repository's pages: not served here
      const file = path.join(ROOT, row.path.endsWith('/') ? row.path + 'index.html' : row.path);
      if (served(row.path) && fs.existsSync(file)) { failures.push(`${row.path}: a moved row has no file, and one exists`); continue; }

      const first = await spage.goto(base + row.path, { waitUntil: 'domcontentloaded' });
      if (first.status() !== 404) failures.push(`${row.path}: expected the not-found page with status 404, got ${first.status()}`);
      try {
        await spage.waitForURL((u) => u.pathname + u.search + u.hash === target, { timeout: 8000 });
      } catch {
        failures.push(`${row.path}: with scripts the browser stayed at ${new URL(spage.url()).pathname + new URL(spage.url()).search + new URL(spage.url()).hash}, the row leads to ${target}`);
        continue;
      }
      const place = target.split('#')[1];
      if (place) {
        const there = await spage.evaluate((id) => !!(document.getElementById(id) || document.getElementsByName(id)[0] || document.querySelector(`[data-tab="${id}"]`)), place);
        if (!there) failures.push(`${row.path}: landed on ${target}, and the page has no place named ${place}`);
      }
      const heading = await spage.locator('h1').first().textContent().catch(() => '');
      if (/No page at this address/.test(heading || '')) failures.push(`${row.path}: landed on the not-found page again`);

      await qpage.goto(base + row.path, { waitUntil: 'domcontentloaded' });
      const link = await qpage.evaluate((old) => {
        const li = [...document.querySelectorAll('#nf-moved li')].find((x) => x.querySelector('code')?.textContent === old);
        return li ? li.querySelector('a').getAttribute('href') : null;
      }, row.path).catch(() => null);
      // With scripts off the browser parses <noscript> as markup, so the list is in the document.
      if (link !== target) failures.push(`${row.path}: without scripts the link reads ${link}, the row leads to ${target}`);
    }
    await spage.close();
    await qpage.close();

    // A row may map the places its old page had: each one lands on that place's new address.
    let placed = 0;
    for (const row of moved.filter((r) => r.places)) {
      for (const [place, to] of Object.entries(row.places).slice(0, 3)) {
        const tab = await scripted.newPage();
        await tab.goto(`${base}${row.path}#${place}`, { waitUntil: 'domcontentloaded' });
        try { await tab.waitForURL((u) => u.pathname + u.search + u.hash === to, { timeout: 8000 }); placed += 1; }
        catch { failures.push(`${row.path}#${place}: the browser stayed at ${tab.url()}, the row's places lead to ${to}`); }
        await tab.close();
      }
    }
    // The query and the place a reader asked for travel with them when the new address names neither.
    const carried = moved.find((r) => !/[?#]/.test(endOf(r, byPath)) && endOf(r, byPath) !== '/' && !r.places && !projectSites.some((p) => endOf(r, byPath).startsWith(p)));
    if (carried) {
      const tab = await scripted.newPage(), want = endOf(carried, byPath) + '?from=old#top';
      await tab.goto(`${base}${carried.path}?from=old#top`, { waitUntil: 'domcontentloaded' });
      try { await tab.waitForURL((u) => u.pathname + u.search + u.hash === want, { timeout: 8000 }); }
      catch { failures.push(`${carried.path}?from=old#top: the browser stayed at ${tab.url()}, expected ${want}`); }
      await tab.close();
    }

    const page = await scripted.newPage();
    const unknown = '/an-address-this-site-never-published-7c1e.html';
    assert.equal(byPath.has(unknown), false);
    const answer = await page.goto(base + unknown, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('nf-near')?.textContent.length > 0, null, { timeout: 8000 });
    if (answer.status() !== 404) failures.push(`unknown address: status ${answer.status()}, expected 404`);
    if (new URL(page.url()).pathname !== unknown) failures.push(`unknown address: the browser left for ${page.url()}`);
    if (!/No page at this address/.test(await page.locator('h1').first().textContent())) failures.push('unknown address: the not-found heading is missing');
    if (!/No address on the site is close/.test(await page.locator('#nf-near').textContent())) failures.push(`unknown address: the page offered ${await page.locator('#nf-near').textContent()}`);
    console.log(`addresses-moved: ${sample.length} of ${moved.length} moved rows opened with and without scripts; ${placed} mapped places and ${carried ? 'one' : 'no'} carried query checked; one unknown address checked`);
  } finally {
    await browser.close();
    server.closeAllConnections();
    server.close();
  }
  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
