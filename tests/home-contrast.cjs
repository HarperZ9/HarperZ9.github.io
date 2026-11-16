// The front page's text against its ground, measured from pixels, with the halo and without it.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/home-contrast.cjs
//   CONTRAST_OUT=out.json   write the lowest ratios
//   CONTRAST_ONLY="light 1440"   one scheme and width
//   CONTRAST_WEAK=1   present a two-core device, which keeps the rendered plate (what most CI runners measure)
//
// Holds, at 1440 by 900 and 390 by 844, in the light scheme and the dark scheme:
//   1. Every text on the front page keeps WCAG AA contrast (4.5 to 1, or 3 to 1 for large text) against the BARE
//      ground, which is the page with every text shadow removed. The halo round the letters is a second layer; no
//      text may depend on it. The same texts are measured with the halo too, and that figure may not be under AA.
//   2. The backdrop alone, with the page's content hidden, is dark enough for the page's ink everywhere the words
//      can go: every 40 pixel tile left of the Sun's clear space (--sun-clear in world/site/field.css) gives 4.5 to 1
//      against its brightest 2 percent. A text scrolls through every height of the screen, so this is the check that
//      does not depend on where the walk happens to stop.
//   3. No text of the page's sections reaches into the Sun's clear space, at 1280 by 720, 1440 by 900 and 1920 by 1080.
//
// Method for 1: the page is walked from top to bottom in steps of three tenths of a screen, with The Playground's
// panel open and its folded list open, so each text is measured at three or more heights. At each stop the glyphs
// are made transparent and the page is shot, so the picture holds what sits behind the words. A text's own line
// boxes are read; light text is compared with the lightest 2 percent of those pixels and dark text with the darkest
// 2 percent. A text with an opaque ground of its own (a button, a mark) is compared with that ground. Where the
// backdrop is live it moves, so each stop is shot twice on the bare ground and the worst frame is kept. Lettering
// whose face is a clipped background (depth.css) is measured by its face colour with its solid removed. Text drawn
// as art over its own picture (aria-hidden) is not text a reader depends on and is left out, by SKIP below.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const SCOPE = 'body *';
const SKIP = 'script, style, noscript, template, [aria-hidden="true"], [aria-hidden="true"] *, [hidden], [hidden] *, .skip, canvas, svg, svg *, option';
const INK = [244, 239, 230];   // --ink over the field (field.css)

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lumOf = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);

const inPage = async ([shot, scope, skip]) => {
  const img = new Image(); img.src = shot; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const k = img.naturalWidth / innerWidth;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  // any CSS colour (oklch too) as the sRGB bytes the browser paints
  const pot = document.createElement('canvas'); pot.width = pot.height = 1; const pg = pot.getContext('2d', { willReadFrequently: true });
  const rgb = (s) => { pg.clearRect(0, 0, 1, 1); pg.fillStyle = '#000'; pg.fillStyle = s; pg.fillRect(0, 0, 1, 1); const d = pg.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const out = [];
  for (const e of document.querySelectorAll(scope)) {
    if (e.matches(skip)) continue;
    if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const words = [...e.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).map((n) => n.data.trim()).join(' ');
    if (!words) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
    const cs = getComputedStyle(e), col = rgb(e.dataset.wasColor || cs.color);
    if (col[3] < 0.05) continue;   // transparent by design: drawn another way
    const text = lum(col[0], col[1], col[2]);
    let own = null;
    for (let a = e; a && a !== document.body && !own; a = a.parentElement) {
      const acs = getComputedStyle(a), b = rgb(acs.backgroundColor);
      if (b[3] === 1 && acs.backgroundImage === 'none') own = b;
      if (a.matches('.place, .w-panel, section, main')) break;
    }
    let hard;
    if (own) hard = lum(own[0], own[1], own[2]);
    else {
      const ls = [];
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.data.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        for (const q of range.getClientRects()) {
          // kept to the element's own box: a font's ascent and descent can reach past a tight line into a picture
          const x0 = Math.max(q.left, r.left, 0), y0 = Math.max(q.top, r.top, 0), x1 = Math.min(q.right, r.right, innerWidth), y1 = Math.min(q.bottom, r.bottom, innerHeight);
          const x = Math.floor(x0 * k), y = Math.floor(y0 * k), ww = Math.floor((x1 - x0) * k), hh = Math.floor((y1 - y0) * k);
          if (ww < 1 || hh < 1) continue;
          const d = g.getImageData(x, y, ww, hh).data;
          for (let i = 0; i < d.length; i += 4 * 3) ls.push(lum(d[i], d[i + 1], d[i + 2]));
        }
      }
      if (!ls.length) continue;
      ls.sort((a, b2) => a - b2);
      hard = text > 0.5 ? ls[Math.floor(ls.length * 0.98)] : ls[Math.floor(ls.length * 0.02)];
    }
    const ratio = (Math.max(text, hard) + 0.05) / (Math.min(text, hard) + 0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (px >= 18.66 && bold);
    out.push({ box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], text: words.slice(0, 56),
      tag: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), ratio: +ratio.toFixed(2), need: large ? 3 : 4.5, px, own: !!own });
  }
  return out;
};

// the brightest 2 percent of each 40 pixel tile of a shot, left of a limit
const tilesInPage = async ([shot, limit]) => {
  const img = new Image(); img.src = shot; await img.decode(); const k = img.naturalWidth / innerWidth;
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, o = [];
  for (let y = 0; y < innerHeight; y += 40) for (let x = 0; x + 40 <= limit; x += 40) {
    const d = g.getImageData(Math.floor(x * k), Math.floor(y * k), Math.floor(40 * k), Math.floor(Math.min(40, innerHeight - y) * k)).data, ls = [];
    for (let q = 0; q < d.length; q += 4) ls.push(0.2126 * lin(d[q]) + 0.7152 * lin(d[q + 1]) + 0.0722 * lin(d[q + 2]));
    ls.sort((a, b) => a - b); o.push([x, y, ls[Math.floor(ls.length * 0.98)]]);
  }
  return o;
};
// the width the page keeps clear on the right for the Sun, in pixels
const sunClear = (page) => page.evaluate(() => {
  const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;height:0;width:var(--sun-clear, 0px)';
  document.body.append(probe); const v = probe.getBoundingClientRect().width; probe.remove(); return v;
});

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const result = {}, failures = [];
  try {
    for (const scheme of ['light', 'dark']) for (const [w, h] of [[1440, 900], [390, 844]]) {
      const key = `${scheme} ${w}x${h}`;
      if (process.env.CONTRAST_ONLY && !key.startsWith(process.env.CONTRAST_ONLY)) continue;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, ...(w < 600 ? { hasTouch: true, isMobile: true } : {}) });
      if (process.env.CONTRAST_WEAK) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 2 }));
      const page = await ctx.newPage();
      await page.route(/\.(mp4|webm|m4a|mp3)(\?|$)/, (r) => r.abort());
      await page.goto(base + '/#w-distill', { waitUntil: 'load' });
      await page.waitForSelector('#dial.w-live');
      // the live backdrop where the device starts one (a desktop with a fine pointer and a GPU); give it time to come up
      if (w >= 600) { await page.mouse.move(200, 200); await page.mouse.move(260, 240); await page.waitForFunction(() => !!window.__homeField, null, { timeout: 30000 }).catch(() => {}); }
      await page.waitForTimeout(1200);
      const live = await page.evaluate(() => !!window.__homeField);
      await page.evaluate(() => { for (const d of document.querySelectorAll('main details')) d.open = true; });

      // 1. every text, on the bare ground and with the halo
      const seen = { halo: new Map(), bare: new Map() };
      const shoot = async (where) => {
        for (const mode of ['bare', 'halo']) {
          await page.evaluate(([scope, bare]) => {
            // lettering whose face is a clipped background keeps its face colour in color; the face is cleared with the glyphs
            for (const e of document.querySelectorAll(scope)) if (!e.dataset.wasColor) { const cs = getComputedStyle(e); e.dataset.wasColor = cs.color; if ((cs.webkitBackgroundClip || cs.backgroundClip) === 'text') e.dataset.mcClip = '1'; }
            const s = document.createElement('style'); s.id = 'mc-hide';
            s.textContent = `[data-mc-clip] { background-image: none !important; ${bare ? 'filter: none !important;' : ''} } `
              + `${scope}, ${scope}::before, ${scope}::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important; ${bare ? 'text-shadow: none !important;' : ''} }`;
            document.head.append(s);
          }, [SCOPE, mode === 'bare']);
          for (let i = 0; i < (live && mode === 'bare' ? 2 : 1); i++) {
            const shot = 'data:image/png;base64,' + (await page.screenshot()).toString('base64');
            for (const r of await page.evaluate(inPage, [shot, SCOPE, SKIP])) {
              const id = r.tag + '|' + r.text, m = seen[mode];
              if (!m.has(id) || m.get(id).ratio > r.ratio) m.set(id, { ...r, where });
            }
            if (live && mode === 'bare') await page.waitForTimeout(250);
          }
          await page.evaluate(() => document.getElementById('mc-hide').remove());
        }
      };
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height - h * 0.2; y += Math.round(h * 0.3)) {
        await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(200); await shoot('y ' + y);
      }

      // 2. the backdrop alone
      const clear = await sunClear(page);
      await page.evaluate(() => scrollTo(0, 0));
      const hide = await page.addStyleTag({ content: 'body > :not(.gw-backdrop) { visibility: hidden !important; }' });
      const tiles = new Map();
      for (let i = 0; i < (live ? 8 : 1); i++) {
        const shot = 'data:image/png;base64,' + (await page.screenshot()).toString('base64');
        for (const [x, y, l] of await page.evaluate(tilesInPage, [shot, w - clear])) { const id = x + ',' + y; if (!tiles.has(id) || tiles.get(id) < l) tiles.set(id, l); }
        if (live) await page.waitForTimeout(300);
      }
      await hide.evaluate((e) => e.remove());
      let fieldLow = { ratio: 99 };
      for (const [id, l] of tiles) {
        const ratio = +((lumOf(INK) + 0.05) / (l + 0.05)).toFixed(2);
        if (ratio < fieldLow.ratio) fieldLow = { ratio, tile: id };
        if (ratio < 4.5) failures.push(`${key}, the backdrop alone: ${ratio} to 1 for the page's ink at tile ${id}`);
      }

      const sum = (m) => { const all = [...m.values()], under = all.filter((r) => r.ratio < r.need).sort((a, b) => a.ratio - b.ratio); return { measured: all.length, lowest: all.reduce((a, r) => (r.ratio < a.ratio ? r : a), { ratio: 99 }), under }; };
      result[key] = { live, field: { ...fieldLow, clear }, bare: sum(seen.bare), halo: sum(seen.halo), lowest25: process.env.CONTRAST_OUT ? [...seen.bare.values()].sort((a, b) => a.ratio - b.ratio).slice(0, 25) : undefined };
      console.log(`${key}: backdrop ${live ? 'live' : 'still'}; ${result[key].bare.measured} texts; bare ground lowest ${result[key].bare.lowest.ratio} ("${result[key].bare.lowest.text}"), under AA ${result[key].bare.under.length}; with halo lowest ${result[key].halo.lowest.ratio}, under AA ${result[key].halo.under.length}; the backdrop alone lowest ${fieldLow.ratio} at tile ${fieldLow.tile}, ${Math.round(clear)} px kept clear for the Sun`);
      for (const mode of ['bare', 'halo']) for (const r of result[key][mode].under) failures.push(`${key}, ${mode === 'bare' ? 'bare ground' : 'with halo'}: ${r.ratio} to 1 (needs ${r.need}) "${r.text}" <${r.tag}> at ${JSON.stringify(r.box)}, ${r.where}`);
      assert.ok(result[key].bare.measured > 60, `${key}: only ${result[key].bare.measured} texts were measured; the walk did not see the page`);
      await ctx.close();
      if (process.env.CONTRAST_OUT) fs.writeFileSync(process.env.CONTRAST_OUT, JSON.stringify(result, null, 1) + '\n');
    }

    // 3. no text reaches the Sun's clear space
    for (const [w, h] of process.env.CONTRAST_ONLY ? [] : [[1280, 720], [1440, 900], [1920, 1080]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'light' }); const page = await ctx.newPage();
      await page.route(/\.(mp4|webm|m4a|mp3)(\?|$)/, (r) => r.abort());
      await page.goto(base + '/#w-distill', { waitUntil: 'load' }); await page.waitForSelector('#dial.w-live');
      const clear = await sunClear(page);
      const over = await page.evaluate(([skip, clear]) => {
        for (const d of document.querySelectorAll('main details')) d.open = true;
        const limit = innerWidth - clear, out = [];
        for (const e of document.querySelectorAll('main *, body > footer *')) {
          if (e.matches(skip) || !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const cs = getComputedStyle(e); if (cs.clipPath !== 'none' || cs.clip !== 'auto') continue;   // a name for readers only, clipped off the screen
          for (const n of e.childNodes) {
            if (n.nodeType !== 3 || !n.data.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(n);
            for (const q of range.getClientRects()) if (q.width > 2 && q.right > limit + 0.5 && q.left < innerWidth) { out.push(`"${n.data.trim().slice(0, 40)}" reaches ${Math.round(q.right)}, past ${Math.round(limit)}`); break; }
          }
        }
        return out;
      }, [SKIP, clear]);
      assert.ok(clear > 40, `${w} by ${h}: the Sun's clear space is ${clear} px; the rule in field.css is not applied`);
      for (const line of over) failures.push(`${w} by ${h}, under the Sun: ${line}`);
      console.log(`${w}x${h}: ${Math.round(clear)} px kept clear for the Sun, ${over.length} texts reach into it`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join('\n')); throw new Error(`${failures.length} contrast findings on the front page`); }
  console.log('home-contrast ok');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
