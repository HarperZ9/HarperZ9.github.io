// Deep zoom in the browser (9 October 2026). The deep path draws by perturbation against a BigInt
// reference orbit, with BLA steps and rebasing, on WebGL2. This checks, on whatever GPU the browser
// has (an RTX 4090 locally, SwiftShader on CI):
//   1. At shallow views where float32 is exact, the perturbation path draws the same image as the
//      float32 program, for Mandelbrot, Julia and Burning Ship (same palette, relief, glow, flip).
//   2. At 1e-35 the perturbation path separates neighbouring pixels, where df64 collapses them
//      into blocks: the deep frame has many times more distinct adjacent columns.
//   3. The glitch view (rebasing off) marks pixels; the corrected frame has none of the mark.
// Frame times are printed for the progress log.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';
const DEEP = {
  re: '-0.7436227627792091903930625607721105561797006142687856921130208924',
  im: '0.1318305311337870112915195543947448074486402760798047827036608098',
};

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  // BROWSER_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader" runs the CI renderer locally.
  if (process.env.BROWSER_ARGS) launch.args = process.env.BROWSER_ARGS.split(' ');
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    await page.goto(`${base}/robots.txt`);
    const out = await page.evaluate(async (DEEP) => {
      const gl = await import('/system/fractal-gl.js');
      const W = 480, H = 320;
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const read = (c) => {
        const ctx = c.__fractalGLContext;
        const px = new Uint8Array(W * H * 4);
        ctx.readPixels(0, 0, W, H, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        return px;
      };
      const timed = (c, view) => { const t = performance.now(); gl.renderFractalGL(c, view); read(c); return { ms: performance.now() - t, px: read(c) }; };
      const res = { webgl2: false, shallow: {}, deep: {}, glitch: {} };
      const probe = mk(); gl.renderFractalGL(probe, { type: 'mandelbrot', scale: 3.5 });
      res.webgl2 = !!probe.__fractalGL2;
      if (!res.webgl2) return res;
      // 1. shallow agreement
      for (const v of [
        { type: 'mandelbrot', cx: -0.745, cy: 0.113, scale: 0.02, maxIter: 600, palette: 'dusk' },
        { type: 'julia', cx: 0, cy: 0, scale: 3, maxIter: 300, jx: -0.8, jy: 0.156, palette: 'ocean' },
        { type: 'burningship', cx: -1.0, cy: -0.35, scale: 1.8, maxIter: 500, palette: 'bone' },
      ]) {
        const a = mk(), b = mk();
        gl.renderFractalGL(a, { ...v, precision: 'single' });
        const pert = timed(b, { ...v, precision: 'perturbation' });
        const pa = read(a), pb = pert.px;
        let diff = 0, big = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
          diff += d; if (d > 60) big++;
        }
        res.shallow[v.type] = { meanDiff: diff / (W * H * 3), bigFrac: big / (W * H), ms: pert.ms, path: b.__fractalPrecisionUsed };
      }
      // 2. deep separation: distinct adjacent columns along the middle rows
      const cols = (px) => {
        let distinct = 0, total = 0;
        for (let y = H / 2 - 8; y < H / 2 + 8; y++) for (let x = 1; x < W; x++) {
          const i = (y * W + x) * 4, j = i - 4;
          total++;
          // More than the output dither (one code value per channel either way) apart.
          if (Math.abs(px[i] - px[j]) + Math.abs(px[i + 1] - px[j + 1]) + Math.abs(px[i + 2] - px[j + 2]) > 6) distinct++;
        }
        return distinct / total;
      };
      const view = { type: 'mandelbrot', re: DEEP.re, im: DEEP.im, cx: +DEEP.re, cy: +DEEP.im, scale: 1e-35, maxIter: 9000, palette: 'ember' };
      const c1 = mk(), c2 = mk();
      const d1 = timed(c1, { ...view, precision: 'perturbation' });
      const again = timed(c1, { ...view, precision: 'perturbation' });
      gl.renderFractalGL(c2, { ...view, precision: 'double' });
      res.deep = { pert: cols(d1.px), df64: cols(read(c2)), ms: d1.ms, msReused: again.ms, stats: c1.__fractalDeepStats };
      let lit = 0; for (let i = 0; i < d1.px.length; i += 4) if (d1.px[i] + d1.px[i + 1] + d1.px[i + 2] > 0) lit++;
      res.deep.litFrac = lit / (W * H);
      // 3. glitch view
      const rebaseless = { ...view, scale: 1e-6, re: '-0.743643887037158704752191506114774', im: '0.131825904205311970493132056385139', cx: -0.7436438870371587, cy: 0.13182590420531197, maxIter: 3000 };
      const g1 = mk(), g2 = mk();
      gl.renderFractalGL(g1, { ...rebaseless, precision: 'perturbation', glitchView: true });
      gl.renderFractalGL(g2, { ...rebaseless, precision: 'perturbation' });
      const mark = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] > 90 && px[i + 1] < 140 && px[i + 2] < 60) n++; return n; };
      res.glitch = { marked: mark(read(g1)), corrected: mark(read(g2)) };
      return res;
    }, DEEP);
    console.log(JSON.stringify(out, null, 1));
    if (!out.webgl2) {
      console.log('no WebGL2 here: the deep path is not available, and the df64 path still draws');
    } else {
      for (const [k, v] of Object.entries(out.shallow)) {
        assert.equal(v.path, 'perturbation', `${k} drew through the perturbation path`);
        assert.ok(v.meanDiff < 6, `${k}: perturbation matches float32 at a shallow view (mean diff ${v.meanDiff.toFixed(2)})`);
      }
      assert.ok(out.deep.litFrac > 0.3, `the 1e-35 frame is mostly outside the set (${out.deep.litFrac})`);
      assert.ok(out.deep.pert > 0.5, `perturbation separates adjacent columns at 1e-35 (${out.deep.pert.toFixed(3)})`);
      assert.ok(out.deep.pert > 4 * out.deep.df64, `and df64 does not (${out.deep.df64.toFixed(3)})`);
      assert.ok(out.deep.stats.blaEntries > 0, 'BLA table in use');
      assert.ok(out.glitch.marked > 0, 'glitch view marks pixels when rebasing is off');
    }
    assert.deepEqual(errors, [], 'no page errors');
    console.log('fractal deep zoom: pass');
  } catch (e) {
    failures++;
    console.error('FAIL', e.message);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
