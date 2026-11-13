// The home field's resolution on lower-resolution screens, measured in a browser.
//
//   npx --yes serve -l 8823 . &   SITE_BASE_URL=http://127.0.0.1:8823 node tests/home-field-sharpness.cjs
//
// What it holds:
//   1. Live. At 1366x768 and 1280x720, device pixel ratio 1 and 1.25, the live field's canvas is backed at its CSS box
//      times the device pixel ratio, and the scene's internal scale (field.stats().scale, in CSS pixels) stays between
//      the field's floor and its ceiling; on a mid-range machine the ceiling is the device pixel ratio inside the pixel budget.
//   2. Upscale. One settled still of the same scene and time, rendered at 0.6 of the CSS box and shown at the box's
//      size, compared with the same still rendered at the box's own pixels. Reported: the edge energy the shown
//      picture keeps (mean absolute Laplacian of luma, as a share of the native render's) and the overshoot (the share
//      of pixels brighter or darker than every pixel of the native render in their 5 by 5 neighbourhood, past a
//      margin of 6 of 255). The upscaled picture has to keep more edge energy than a plain bilinear stretch and stay
//      under the overshoot bound.
//
// SHARP_REPORT_ONLY=1 prints the numbers and asserts nothing (the baseline run on the code before the change).
// SHARP_SHOTS=<dir> saves screenshots there, named by SHARP_TAG (default "run").
// The test browser draws with a software rasteriser (SwiftShader), which the field refuses unless the address carries
// ?gpu=any. Frame times from it say nothing about a GPU; the sizes and scales are the same arithmetic on any device.
// FIELD_GPU=1 asks for the machine's own GPU instead.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8823';
const REPORT = process.env.SHARP_REPORT_ONLY === '1', SHOTS = process.env.SHARP_SHOTS || '', TAG = process.env.SHARP_TAG || 'run';
const SETTLE = +(process.env.SHARP_SETTLE_MS || 9000);
// a mid-range machine (six cores: above budget.js's weak line, below home-field.js's strong line) at each size, then
// one strong machine, which home-field.js lets draw above the screen's own pixels
const VIEWS = [{ w: 1366, h: 768, dpr: 1 }, { w: 1366, h: 768, dpr: 1.25 }, { w: 1280, h: 720, dpr: 1 }, { w: 1280, h: 720, dpr: 1.25 }].map((v) => ({ ...v, cores: 6 })).concat([{ w: 1366, h: 768, dpr: 1, cores: 16 }]);
const GL = process.env.FIELD_GPU === '1' ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const out = { live: [], upscale: null };
const name = (v, what) => path.join(SHOTS, `${TAG}-${what}-${v.w}x${v.h}-dpr${v.dpr}${v.cores > 8 ? '-strong' : ''}.png`);

// mean absolute Laplacian of luma, and overshoot against a reference, on two same-size RGBA reads
function compare() {
  return async ([a64, b64]) => {
    const load = async (b) => { const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data }; };
    const luma = ({ w, h, d }) => { const y = new Float32Array(w * h); for (let i = 0; i < w * h; i++) y[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; return y; };
    const A = await load(a64), B = await load(b64), w = A.w, h = A.h, ya = luma(A), yb = luma(B);
    const edge = (y) => { let s = 0; for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i; s += Math.abs(4 * y[k] - y[k - 1] - y[k + 1] - y[k - w] - y[k + w]); } return s / ((w - 2) * (h - 2)); };
    let over = 0, err = 0; const M = 6;
    for (let j = 2; j < h - 2; j++) for (let i = 2; i < w - 2; i++) { let mn = 1e9, mx = -1e9;
      for (let q = -2; q <= 2; q++) for (let p = -2; p <= 2; p++) { const v = yb[(j + q) * w + i + p]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const v = ya[j * w + i]; if (v > mx + M || v < mn - M) over++; err += Math.abs(v - yb[j * w + i]); }
    const n = (w - 4) * (h - 4);
    return { width: w, height: h, edge: +edge(ya).toFixed(3), edgeNative: +edge(yb).toFixed(3), overshoot: +(over / n).toFixed(5), meanError: +(err / n).toFixed(3) };
  };
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}), args: GL });
  try {
    // 1: the live field on the home, as home-field.js starts it
    for (const v of VIEWS) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.dpr, colorScheme: process.env.SHARP_SCHEME || 'light', reducedMotion: 'no-preference' });
      const page = await ctx.newPage(), errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((n) => { Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => n }); Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 }); }, v.cores);
      await page.goto(base + '/?gpu=any', { waitUntil: 'load' });
      await page.mouse.move(200, 200); await page.mouse.move(260, 240);
      await page.waitForFunction(() => window.__homeField && document.querySelector('.gw-backdrop.live'), null, { timeout: 120000 });
      await page.waitForTimeout(SETTLE);
      const r = await page.evaluate(() => { const c = document.querySelector('canvas.gw-live'), b = c.getBoundingClientRect(), s = window.__homeField.stats(), gl = c.getContext('webgl2'), dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return { dpr: devicePixelRatio, box: [b.width, b.height], backing: [c.width, c.height], stats: s, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '' }; });
      r.view = `${v.w}x${v.h} @${v.dpr}, ${v.cores} cores`; r.top = r.stats.top ?? null; r.want = [Math.round(r.box[0] * r.dpr), Math.round(r.box[1] * r.dpr)]; r.backingOverDevice = +(r.backing[0] / r.want[0]).toFixed(3);
      r.internal = [r.stats.renderWidth ?? r.backing[0], r.stats.renderHeight ?? r.backing[1]]; r.scale = +r.stats.scale.toFixed(3); r.frameMs = +r.stats.frameMs.toFixed(1); delete r.stats;
      if (SHOTS) { await page.screenshot({ path: name(v, 'home') });
        await page.evaluate(() => { for (const e of document.querySelectorAll('main, header, footer, .o-hand, dialog')) e.style.visibility = 'hidden'; }); await page.screenshot({ path: name(v, 'field') }); }
      out.live.push(r);
      if (!REPORT) {
        assert.ok(Math.abs(r.backing[0] - r.want[0]) <= 1 && Math.abs(r.backing[1] - r.want[1]) <= 1, `${r.view}: the canvas is backed at its box times the device pixel ratio (${r.backing} against ${r.want})`);
        assert.ok(r.scale >= 0.6 - 1e-6 && r.scale <= r.top + 1e-6, `${r.view}: the internal scale ${r.scale} stays between the floor and the ceiling ${r.top}`);
        if (v.cores <= 8) assert.ok(r.top <= r.dpr + 1e-6 && r.top >= Math.min(r.dpr, Math.sqrt(2.1e6 / (r.box[0] * r.box[1]))) - 1e-6, `${r.view}: a mid-range machine's ceiling is the screen's own pixels inside the pixel budget (${r.top})`);
        assert.ok(Math.abs(r.internal[0] - r.box[0] * r.scale) <= 1.5, `${r.view}: the scene is drawn at the box times the scale (${r.internal[0]} against ${r.box[0] * r.scale})`);
        assert.deepEqual(errors, []);
      }
      await ctx.close();
    }
    // 2: one scene and time, drawn at 0.6 of the box and shown at the box's size, against the box's own pixels
    { const v = VIEWS[0], ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.dpr });
      const page = await ctx.newPage(); await page.goto(base + '/?gpu=any', { waitUntil: 'commit' });
      await page.setContent('<!doctype html><style>html,body{margin:0;background:#000}canvas{position:fixed;inset:0;width:100vw;height:100vh;display:block}</style><canvas></canvas>');
      const draw = (scale) => page.evaluate(async (scale) => {
        const { createField } = await import('/world/site/field/field.js'); const old = document.querySelector('canvas'), c = old.cloneNode(); old.replaceWith(c);
        const W = innerWidth * devicePixelRatio, H = innerHeight * devicePixelRatio, f = createField(c, { space: 'field-day', dprCap: 1, reduced: true });
        // the code before the upscale pass knows no `scale`: there the canvas itself is the smaller surface and the browser stretches it
        if ('renderWidth' in f.stats()) f.still({ n: 4, w: W, h: H, scale }); else f.still({ n: 4, w: Math.round(W * scale), h: Math.round(H * scale) });
        return f.stats(); }, scale);
      const shot = async (what) => { const b = await page.screenshot({ type: 'png' }); if (SHOTS) fs.writeFileSync(name(v, what), b); return b.toString('base64'); };
      await draw(1); const native = await shot('still-native');
      const low = await draw(0.6), shown = await shot('still-0.6');
      // the control: the 0.6 picture stretched by the browser's own bilinear filter
      const plain = await page.evaluate(async ([b64, k]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const s = document.createElement('canvas'); s.width = Math.round(img.width * k); s.height = Math.round(img.height * k); const sx = s.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(img, 0, 0, s.width, s.height);
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.imageSmoothingQuality = 'low'; x.drawImage(s, 0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1]; }, [native, 0.6]);
      out.upscale = { view: `${v.w}x${v.h} @${v.dpr}`, stats: low, shown: await page.evaluate(compare(), [shown, native]), bilinearControl: await page.evaluate(compare(), [plain, native]) };
      const u = out.upscale; u.edgeKept = +(u.shown.edge / u.shown.edgeNative).toFixed(3); u.edgeKeptBilinear = +(u.bilinearControl.edge / u.bilinearControl.edgeNative).toFixed(3);
      if (!REPORT) {
        assert.ok(u.edgeKept > u.edgeKeptBilinear * 1.15, `the upscale keeps more edge energy than a bilinear stretch (${u.edgeKept} against ${u.edgeKeptBilinear} of the native render's)`);
        assert.ok(u.edgeKept <= 1.1, `and adds none the native render does not have (${u.edgeKept})`);
        assert.ok(u.shown.overshoot <= 0.002, `no ringing: ${u.shown.overshoot} of pixels leave the native render's local range`);
      }
      await ctx.close(); }
    console.log(JSON.stringify(out, null, 1));
    console.log(REPORT ? 'home-field-sharpness: reported' : 'home-field-sharpness: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exit(1); });
